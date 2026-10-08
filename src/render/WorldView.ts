import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HEROES } from '../simulation/data';
import type { Combatant, CombatEvent, GameState } from '../simulation/types';
import { createEnvironment, type Environment } from './environment';

type Mode = 'home' | 'battle' | 'heroes';
type ClipRole = 'idle' | 'attack' | 'run' | 'hurt' | 'death' | 'skill';
export interface ModelDefinition {
  url: string;
  forward?: '+z' | '-z' | '+x' | '-x';
  height?: number;
  clips?: Partial<Record<ClipRole, string>>;
}
interface ModelAsset { gltf: GLTF; definition: ModelDefinition; scale: number; floor: number; center: THREE.Vector3 }
interface Actor {
  id: string; modelKey: string; group: THREE.Group; body: THREE.Group;
  mixer: THREE.AnimationMixer; actions: Partial<Record<ClipRole, THREE.AnimationAction>>;
  current?: THREE.AnimationAction; seq: number; actionTime: number; action: string;
  base: THREE.Vector3; color: THREE.Color; modelMaterials: THREE.MeshStandardMaterial[];
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  hp: THREE.Group; hpFill: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  deadTime: number;
}
interface SpellEffect { object: THREE.Object3D; duration: number; age: number; update: (t:number)=>void; dispose:()=>void }
const heroById = Object.fromEntries(HEROES.map(hero => [hero.id, hero]));
const forwardRotation = { '+z': 0, '-z': Math.PI, '+x': -Math.PI/2, '-x': Math.PI/2 };

/** Rendering is deliberately a pure adapter over GameState; it cannot spend currency or apply damage. */
export class WorldView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(39, 1, .1, 140);
  readonly renderer: THREE.WebGLRenderer;
  loaded = false;
  loadingError: string | null = null;
  private environment: Environment;
  private environmentTarget: THREE.WebGLRenderTarget;
  private resizeObserver: ResizeObserver;
  private models = new Map<string, ModelAsset>();
  private definitions: Record<string, ModelDefinition> = {};
  private loader = new GLTFLoader();
  private assetRequests = new Map<string, Promise<void>>();
  private assetQueue: Array<() => void> = [];
  private activeDownloads = 0;
  private showcaseSignature = '';
  private actors = new Map<string, Actor>();
  private effects: SpellEffect[] = [];
  private mode: Mode = 'home';
  private selectedHero = 'kael';
  private time = 0;
  private battleId = '';
  private seenEvents = new Set<number>();
  private lastState: GameState | null = null;
  private disposed = false;
  private contextLost = false;
  private targetPosition = new THREE.Vector3(7.5, 3.6, 10.5);
  private lookAt = new THREE.Vector3(.45, 1.4, 0);
  private targetLookAt = new THREE.Vector3(.45, 1.4, 0);
  private cameraShake = 0;
  private canvasLostHandler: (event: Event) => void;
  private canvasRestoredHandler: () => void;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'world-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Animated 3D fantasy heroes in Moonwater Sanctuary');
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';
    container.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.FogExp2(0x617e7f, .021);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const studio = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(studio, .06);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = .4;
    studio.dispose(); pmrem.dispose();
    this.camera.position.copy(this.targetPosition);
    this.camera.lookAt(this.lookAt);
    const hemisphere = new THREE.HemisphereLight(0xc5e5ef, 0x3f564a, 2.0);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xffe5bd, 3.8);
    sun.position.set(-6, 13, 8); sun.castShadow = true;
    const shadowSize = window.innerWidth < 768 ? 1024 : 2048;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 11, bottom: -11, near: .5, far: 45 });
    sun.shadow.bias = -.00025; sun.shadow.normalBias = .045;
    sun.shadow.radius = 2;
    this.scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0x75b5e5, 2.6); rim.position.set(2, 6, -9); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffcce8, .6); fill.position.set(7, 3, 5); this.scene.add(fill);
    this.environment = createEnvironment(this.scene);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.canvasLostHandler = (event) => { event.preventDefault(); this.contextLost = true; this.container.dataset.webglStatus = 'context-lost'; };
    this.canvasRestoredHandler = () => { this.contextLost = false; this.container.dataset.webglStatus = 'ready'; };
    this.renderer.domElement.addEventListener('webglcontextlost', this.canvasLostHandler);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.canvasRestoredHandler);
    this.resize();
  }

  async init(onProgress?: (message: string) => void): Promise<void> {
    try {
      onProgress?.('Preparing Moonwater Sanctuary…');
      const response = await fetch(`${import.meta.env.BASE_URL}assets/manifest.json`);
      if (!response.ok) throw new Error(`Cannot load character manifest (${response.status}).`);
      const manifest = await response.json();
      this.definitions = manifest.models ?? manifest;
      const entries = Object.entries(this.definitions).filter(([,value]) => typeof value === 'object' && value !== null && 'url' in value);
      if (!entries.length) throw new Error('Character manifest contains no GLB models.');
      onProgress?.('กำลังเรียกสหายแห่งรุ่งอรุณ…');
      // Only the starting duo is downloaded at boot. Other actors load when needed.
      await Promise.all(['knight', 'healer'].map(key => this.loadModel(key)));
      if (!this.models.has('knight')) throw new Error('The knight character model is missing.');
      this.loaded = true;
      this.container.dataset.webglStatus = 'ready';
      this.syncShowcase();
      onProgress?.('Your adventure is ready');
    } catch (error) {
      this.loadingError = error instanceof Error ? error.message : String(error);
      this.container.dataset.webglStatus = 'asset-error';
      throw error;
    }
  }

  loadAssets(onProgress?: (message: string) => void): Promise<void> { return this.init(onProgress); }

  private loadModel(key: string): Promise<void> {
    if (this.models.has(key)) return Promise.resolve();
    const existing = this.assetRequests.get(key);
    if (existing) return existing;
    const definition = this.definitions[key];
    if (!definition) return Promise.reject(new Error(`Missing character definition: ${key}`));
    const request = new Promise<void>((resolve, reject) => {
      this.assetQueue.push(() => {
        this.activeDownloads++;
        const url = `${import.meta.env.BASE_URL}${definition.url.replace(/^\//, '')}`;
        this.loader.loadAsync(url).then(gltf => {
          gltf.scene.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          if (!Number.isFinite(size.y) || size.y < .001) throw new Error(`${key} has no visible geometry.`);
          this.models.set(key, { gltf, definition, scale: (definition.height ?? 1.95) / size.y, floor: box.min.y, center: box.getCenter(new THREE.Vector3()) });
          resolve();
        }).catch(reject).finally(() => { this.activeDownloads--; this.drainAssets(); });
      });
    });
    this.assetRequests.set(key, request);
    this.drainAssets();
    return request;
  }

  private drainAssets(): void {
    while (this.activeDownloads < 2 && this.assetQueue.length) this.assetQueue.shift()!();
  }

  /** The simulation waits for actual combat models; it never substitutes another actor. */
  prepare(state: GameState): boolean {
    this.lastState = state;
    if (!this.loaded || this.loadingError) return false;
    const keys = this.mode === 'battle' && state.battle
      ? [...state.battle.allies, ...state.battle.enemies].map(actor => actor.modelKey)
      : [heroById[this.selectedHero].modelKey, ...(this.mode === 'home' ? state.profile.party.map(id => heroById[id].modelKey) : [])];
    for (const key of new Set(keys)) {
      if (!this.models.has(key) && !this.assetRequests.has(key)) {
        void this.loadModel(key).catch(error => { this.loadingError = String(error instanceof Error ? error.message : error); });
      }
    }
    const ready = keys.every(key => this.models.has(key));
    const signature = `${this.mode}:${this.selectedHero}:${state.profile.party.join(',')}`;
    if (ready && this.mode !== 'battle' && signature !== this.showcaseSignature) {
      this.clearActors(); this.syncShowcase(); this.showcaseSignature = signature;
    }
    return ready;
  }

  get modelDiagnostics() { return { cached: [...this.models.keys()], actors: [...this.actors.values()].map(actor => ({ id: actor.id, modelKey: actor.modelKey })) }; }

  setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.showcaseSignature = '';
    this.clearActors();
    this.clearEffects();
    if (mode === 'battle') {
      this.targetPosition.set(1.6, 4.8, 10.7);
      this.targetLookAt.set(0, .95, -.15);
    } else {
      this.targetPosition.set(mode === 'heroes' ? 4.4 : 7.5, mode === 'heroes' ? 2.8 : 3.6, mode === 'heroes' ? 7.4 : 10.5);
      this.targetLookAt.set(.45, 1.1, 0);
      if (this.loaded) this.syncShowcase();
    }
    this.resize();
  }

  preview(heroId: string): void {
    if (!heroById[heroId]) return;
    this.selectedHero = heroId;
    this.showcaseSignature = '';
    if (this.loaded && this.mode !== 'battle') { this.clearActors(); this.syncShowcase(); }
  }

  private createActor(id: string, modelKey: string, color: THREE.ColorRepresentation): Actor {
    const asset = this.models.get(modelKey);
    if (!asset) throw new Error(`3D character model “${modelKey}” is missing. Check assets/manifest.json.`);
    const group = new THREE.Group(); group.name = `Actor ${id}`;
    const body = new THREE.Group(); group.add(body);
    const model = clone(asset.gltf.scene);
    model.scale.multiplyScalar(asset.scale);
    model.position.set(-asset.center.x * asset.scale, -asset.floor * asset.scale, -asset.center.z * asset.scale);
    body.add(model);
    const modelMaterials: THREE.MeshStandardMaterial[] = [];
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = node.receiveShadow = true;
      node.frustumCulled = false; // Skinned bounds often omit animated weapons and capes.
      const original = Array.isArray(node.material) ? node.material : [node.material];
      const copy = original.map(material => {
        const cloned = material.clone();
        if (cloned instanceof THREE.MeshStandardMaterial) {
          cloned.envMapIntensity = .7;
          modelMaterials.push(cloned);
        }
        return cloned;
      });
      node.material = Array.isArray(node.material) ? copy : copy[0];
    });
    body.rotation.y = forwardRotation[asset.definition.forward ?? '+z'];
    const mixer = new THREE.AnimationMixer(model);
    const actions: Partial<Record<ClipRole, THREE.AnimationAction>> = {};
    const patterns: Record<ClipRole, RegExp> = {
      idle: /idle|standing|breath/i, attack: /attack|slash|sword|punch|fight/i,
      run: /run|walk/i, hurt: /hit|hurt|damage/i, death: /death|dead|die|fall/i, skill: /cast|magic|spell|skill|special/i,
    };
    for (const role of Object.keys(patterns) as ClipRole[]) {
      const explicit = asset.definition.clips?.[role];
      const clip = asset.gltf.animations.find(clip => explicit ? clip.name === explicit : patterns[role].test(clip.name));
      if (clip) actions[role] = mixer.clipAction(clip);
    }
    if (!actions.idle && asset.gltf.animations.length) actions.idle = mixer.clipAction(asset.gltf.animations[0]);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .35, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(.4, .44, 40), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = .06; group.add(ring);
    const hp = new THREE.Group(); hp.position.y = (asset.definition.height ?? 1.95) + .3; hp.visible=false; group.add(hp);
    const hpBack = new THREE.Mesh(new THREE.PlaneGeometry(.75, .055), new THREE.MeshBasicMaterial({ color: 0x081c22, transparent: true, opacity: .82, depthTest: false }));
    hpBack.renderOrder=10;
    hp.add(hpBack);
    const hpFill = new THREE.Mesh(new THREE.PlaneGeometry(.72, .028), new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false }));
    hpFill.renderOrder=11;
    hpFill.position.z=.006; hp.add(hpFill);
    this.scene.add(group);
    const actor:Actor = { id, modelKey, group, body, mixer, actions, seq:-1, actionTime:0, action:'idle', base:new THREE.Vector3(), color:new THREE.Color(color), modelMaterials, ring, hp, hpFill, deadTime:0 };
    this.actors.set(id, actor);
    this.play(actor, 'idle');
    return actor;
  }

  private play(actor: Actor, role: ClipRole): void {
    const next = actor.actions[role] ?? actor.actions.idle;
    if (!next || next === actor.current) return;
    const previous=actor.current;
    next.reset(); next.enabled=true; next.setEffectiveWeight(1);
    if (role !== 'idle' && role !== 'run' && next !== actor.actions.idle) { next.setLoop(THREE.LoopOnce,1); next.clampWhenFinished=true; }
    else { next.setLoop(THREE.LoopRepeat,Infinity);next.clampWhenFinished=false; }
    next.play();
    if(previous)next.crossFadeFrom(previous,.14,true);
    actor.current=next;
  }

  private syncShowcase(): void {
    const hero=heroById[this.selectedHero] ?? HEROES[0];
    if (!this.models.has(hero.modelKey)) return;
    const actor=this.createActor('showcase',hero.modelKey,hero.color);
    actor.group.position.set(.8,0,.6); actor.base.copy(actor.group.position);
    actor.group.rotation.y=.4;
    actor.group.scale.setScalar(this.mode==='heroes'?1.25:1.65);
    actor.ring.material.opacity=.42;
    // The starting duo is visible together. Additional party members join the home scene after recruitment.
    if(this.mode==='home'){
      const party=this.lastState?.profile.party ?? ['kael','lyra'];
      party.filter(id=>id!==hero.id).slice(0,3).forEach((id,index)=>{
        const definition=heroById[id];if(!definition||!this.models.has(definition.modelKey))return;
        const companion=this.createActor(`companion-${id}`,definition.modelKey,definition.color);
        companion.group.position.set(-1.35-index*1.1,0,-.25-index*.8);companion.base.copy(companion.group.position);
        companion.group.rotation.y=.5; companion.ring.material.opacity=.18;
      });
    }
  }

  render(state: GameState, dt: number): void {
    if(this.disposed||this.contextLost)return;
    const safeDt=Math.min(Math.max(dt,0),.08);
    this.time+=safeDt; this.lastState=state;
    this.environment.animate(this.time,this.mode==='battle');
    if(this.loaded){
      if(this.mode==='battle'&&state.battle){
        const battle=state.battle;
        if(this.battleId!==battle.id){this.battleId=battle.id;this.seenEvents.clear();this.clearActors();this.clearEffects();}
        const combatants=[...battle.allies,...battle.enemies];
        const activeIds=new Set(combatants.map(actor=>actor.id));
        for(const[id,actor]of this.actors){if(!activeIds.has(id))this.removeActor(actor);}
        const simulationDt=battle.paused?0:safeDt*battle.speed;
        for(const combatant of combatants)this.updateCombatant(combatant,combatants,simulationDt);
        for(const event of battle.effects){if(!this.seenEvents.has(event.id)){this.seenEvents.add(event.id);this.showEvent(event);}}
        if(this.seenEvents.size>500){const liveIds=new Set(battle.effects.map(event=>event.id));this.seenEvents=liveIds;}
      }else{
        for(const actor of this.actors.values()){
          actor.mixer.update(safeDt);
          // Static GLBs retain their authored pose; a subtle breathe adds life without pretending to be skeletal animation.
          if(!actor.actions.idle)actor.body.position.y=Math.sin(this.time*1.9)*.009;
          if(actor.id==='showcase')actor.group.rotation.y=.4+Math.sin(this.time*.15)*.09;
          actor.ring.material.opacity=actor.id==='showcase'?.36+Math.sin(this.time*1.7)*.08:.16;
        }
      }
    }
    for(let i=this.effects.length-1;i>=0;i--){
      const effect=this.effects[i]; effect.age+=safeDt;
      const t=Math.min(effect.age/effect.duration,1);effect.update(t);
      if(t>=1){this.scene.remove(effect.object);effect.dispose();this.effects.splice(i,1);}
    }
    const smoothing=1-Math.exp(-safeDt*3);
    this.camera.position.lerp(this.targetPosition,smoothing);
    this.lookAt.lerp(this.targetLookAt,smoothing);
    this.cameraShake=Math.max(0,this.cameraShake-safeDt*.9);
    this.camera.lookAt(this.lookAt.x+Math.sin(this.time*70)*this.cameraShake*.07,this.lookAt.y+Math.cos(this.time*53)*this.cameraShake*.04,this.lookAt.z);
    for(const actor of this.actors.values())actor.hp.quaternion.copy(actor.group.quaternion).invert().multiply(this.camera.quaternion);
    this.renderer.render(this.scene,this.camera);
  }

  private updateCombatant(combatant:Combatant,combatants:Combatant[],dt:number):void {
    if (!this.models.has(combatant.modelKey)) return;
    let actor=this.actors.get(combatant.id);
    if(!actor){
      actor=this.createActor(combatant.id,combatant.modelKey,combatant.side==='ally'?(heroById[combatant.heroId??'']?.color??'#86c7e7'):'#d78c9b');
      actor.base.set(combatant.x*1.55,.015,combatant.z*1.25);
      actor.group.position.copy(actor.base); actor.group.rotation.y=combatant.side==='ally'?Math.PI/2:-Math.PI/2;
      if(combatant.role==='boss')actor.group.scale.setScalar(1.4);
    }
    actor.base.set(combatant.x*1.55,.015,combatant.z*1.25);
    actor.hp.visible=combatant.alive;
    const ratio=Math.max(0,Math.min(1,combatant.hp/combatant.maxHp));actor.hpFill.scale.x=ratio;actor.hpFill.position.x=-(1-ratio)*.36;
    actor.ring.visible=combatant.alive;actor.ring.material.opacity=combatant.shield>0?.65:.22;
    if(actor.seq!==combatant.actionSeq){
      actor.seq=combatant.actionSeq;actor.actionTime=0;actor.action=combatant.action;
      const clip:ClipRole=combatant.action==='dead'?'death':combatant.action==='hit'?'hurt':combatant.action==='skill'?'skill':combatant.action==='attack'?'attack':'idle';
      this.play(actor,clip);
      if(combatant.action==='attack'||combatant.action==='skill'){
        const target=combatants.find(other=>other.id===combatant.targetId);
        if(target&&combatant.role!=='healer')this.spawnTrail(actor.base,new THREE.Vector3(target.x*1.55,1.1,target.z*1.25),actor.color,combatant.action==='skill');
      }
    }
    actor.actionTime+=dt;actor.mixer.update(dt);
    if(!combatant.alive){
      actor.deadTime+=dt;
      if(!actor.actions.death){actor.body.rotation.z=THREE.MathUtils.lerp(actor.body.rotation.z,combatant.side==='ally'?1.45:-1.45,Math.min(1,dt*4));actor.body.position.y=-Math.min(.45,actor.deadTime*.28);}
      actor.group.visible=actor.deadTime<2.7;
      return;
    }
    actor.group.visible=true;actor.deadTime=0;
    const attack=(actor.action==='attack'||actor.action==='skill')&&actor.actionTime<.55;
    const lunge=attack?Math.sin(Math.min(1,actor.actionTime/.55)*Math.PI)*(actor.action==='skill'?.43:.23):0;
    actor.group.position.copy(actor.base);
    actor.group.position.x+=(combatant.side==='ally'?1:-1)*lunge;
    actor.body.position.y=actor.actions.idle?0:Math.sin(this.time*1.9+combatant.x)*.009;
    if(actor.action==='hit'&&actor.actionTime<.22)actor.group.position.x-=(combatant.side==='ally'?1:-1)*Math.sin(actor.actionTime/.22*Math.PI)*.12;
    if(actor.actionTime>.65&&actor.action!=='idle'){this.play(actor,'idle');actor.action='idle';}
  }

  private spawnTrail(start:THREE.Vector3,end:THREE.Vector3,color:THREE.Color,strong:boolean):void {
    const points=[start.clone().add(new THREE.Vector3(0,1.05,0)),start.clone().lerp(end,.5).add(new THREE.Vector3(0,strong?1.65:1.0,0)),end.clone()];
    const path=new THREE.CatmullRomCurve3(points);
    const geometry=new THREE.TubeGeometry(path,16,strong?.032:.012,5,false);
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:strong?.7:.38,depthWrite:false,blending:THREE.AdditiveBlending});
    const trail=new THREE.Mesh(geometry,material);this.scene.add(trail);
    this.effects.push({object:trail,duration:.4,age:0,update:t=>{material.opacity=(1-t)*(strong?.75:.42);},dispose:()=>{geometry.dispose();material.dispose();}});
  }

  private showEvent(event:CombatEvent):void {
    if(event.type==='wave')return;
    const target=this.actors.get(event.targetId??event.sourceId??'');if(!target)return;
    if(event.type==='damage'){
      this.spawnBurst(target.base.clone().add(new THREE.Vector3(0,1.0,0)),event.critical?0xffcc76:0xffe9b7,event.critical?20:8);
      if(event.critical)this.cameraShake=.4;
      if(event.amount)this.spawnNumber(target,event.amount,event.critical?'#ffe0a0':'#fff3df',!!event.critical);
    }else if(event.type==='heal'){
      this.spawnRing(target.base,0x8effc5,false);
      if(event.amount)this.spawnNumber(target,event.amount,'#a1ffca',false,true);
    }else if(event.type==='shield')this.spawnRing(target.base,0x94cbff,true);
    else if(event.type==='skill'){
      this.spawnRing(target.base,target.color,true);this.spawnBurst(target.base.clone().add(new THREE.Vector3(0,.15,0)),target.color,24);
    }
  }

  private spawnRing(position:THREE.Vector3,color:THREE.ColorRepresentation,tall:boolean):void {
    const geometry=new THREE.RingGeometry(.35,.4,48);
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
    const ring=new THREE.Mesh(geometry,material);ring.rotation.x=-Math.PI/2;ring.position.copy(position);ring.position.y=.09;this.scene.add(ring);
    this.effects.push({object:ring,age:0,duration:.7,update:t=>{ring.scale.setScalar(1+t*3.3);ring.position.y=.09+(tall?t*1.6:0);material.opacity=.85*(1-t);},dispose:()=>{geometry.dispose();material.dispose();}});
  }

  private spawnBurst(position:THREE.Vector3,color:THREE.ColorRepresentation,count:number):void {
    const positions=new Float32Array(count*3),velocities=new Float32Array(count*3);
    for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2;velocities[i*3]=Math.cos(a)*(.2+Math.random());velocities[i*3+1]=Math.random()*1.8;velocities[i*3+2]=Math.sin(a)*(.2+Math.random());}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const material=new THREE.PointsMaterial({color,size:.04,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});
    const points=new THREE.Points(geometry,material);points.position.copy(position);this.scene.add(points);
    this.effects.push({object:points,age:0,duration:.65,update:t=>{for(let i=0;i<count;i++){positions[i*3]=velocities[i*3]*t;positions[i*3+1]=velocities[i*3+1]*t-t*t*.5;positions[i*3+2]=velocities[i*3+2]*t;}geometry.attributes.position.needsUpdate=true;material.opacity=1-t;},dispose:()=>{geometry.dispose();material.dispose();}});
  }

  private spawnNumber(actor:Actor,amount:number,color:string,critical:boolean,heal=false):void {
    // Damage numbers are short-lived feedback, not permanent nameplates covering the scene.
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;
    const context=canvas.getContext('2d')!;context.font=`${critical?'800':'600'} ${critical?57:48}px Georgia,serif`;context.textAlign='center';context.textBaseline='middle';
    const label=`${heal?'+':''}${Math.round(amount)}`;context.strokeStyle='rgba(12,20,26,.9)';context.lineWidth=6;context.strokeText(label,128,48);context.fillStyle=color;context.fillText(label,128,48);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false});
    const sprite=new THREE.Sprite(material);sprite.scale.set(1.45,.55,1);sprite.position.copy(actor.base).add(new THREE.Vector3((Math.random()-.5)*.25,2.0,.05));this.scene.add(sprite);
    sprite.renderOrder=12;
    const start=sprite.position.y;
    this.effects.push({object:sprite,age:0,duration:.85,update:t=>{sprite.position.y=start+t*.75;material.opacity=t>.55?(1-t)/.45:1;},dispose:()=>{texture.dispose();material.dispose();}});
  }

  resize():void {
    const width=Math.max(this.container.clientWidth,1),height=Math.max(this.container.clientHeight,1);
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;
    this.camera.fov=width/height<.85?52:39;
    this.camera.clearViewOffset();
    if(this.mode==='home')this.camera.setViewOffset(width,height,-width*(width>720?.16:.04),0,width,height);
    if(this.mode==='battle'){
      const offset=new THREE.Vector3(1.6,3.85,10.85);
      if(width<height){
        // Vertical FOV alone cuts both teams off on a portrait phone. Fit the
        // complete formation into its narrow horizontal frustum, with room for weapons.
        const horizontalHalfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)*this.camera.aspect);
        const requiredDistance=5.4/Math.tan(horizontalHalfFov);
        offset.multiplyScalar(Math.max(1,requiredDistance/offset.length()));
      }
      this.targetPosition.copy(this.targetLookAt).add(offset);
    }
    this.camera.updateProjectionMatrix();
  }

  private removeActor(actor:Actor):void {
    this.scene.remove(actor.group);actor.mixer.stopAllAction();actor.mixer.uncacheRoot(actor.mixer.getRoot());
    actor.modelMaterials.forEach(material=>material.dispose());actor.ring.geometry.dispose();actor.ring.material.dispose();
    actor.hp.traverse(node=>{if(node instanceof THREE.Mesh){node.geometry.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>material.dispose());}});
    this.actors.delete(actor.id);
  }
  private clearActors():void {for(const actor of this.actors.values())this.removeActor(actor);}
  private clearEffects():void {for(const effect of this.effects){this.scene.remove(effect.object);effect.dispose();}this.effects=[];}
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.resizeObserver.disconnect();this.clearActors();this.clearEffects();this.environment.dispose();
    const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    for(const asset of this.models.values())asset.gltf.scene.traverse(node=>{if(node instanceof THREE.Mesh){geometry.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);}}});
    geometry.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());textures.forEach(value=>value.dispose());
    this.renderer.domElement.removeEventListener('webglcontextlost',this.canvasLostHandler);this.renderer.domElement.removeEventListener('webglcontextrestored',this.canvasRestoredHandler);
    this.environmentTarget.dispose();this.renderer.dispose();this.renderer.domElement.remove();
  }
}
