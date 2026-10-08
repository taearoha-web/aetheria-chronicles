import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HEROES } from '../simulation/data';
import { getActionTiming } from '../simulation';
import { FIELD_X, FIELD_Z } from '../simulation/movement';
import type { Combatant, CombatEvent, GameState } from '../simulation/types';
import { createEnvironment, type Environment } from './environment';
import { SkillVfx, type SkillCue } from './SkillVfx';

type Mode = 'home' | 'battle' | 'heroes';
type ClipRole = 'idle' | 'attack' | 'attack2' | 'run' | 'hurt' | 'death' | 'skill' | 'skill1' | 'skill2' | 'skill3' | 'victory';
export interface ModelDefinition {
  url: string;
  forward?: '+z' | '-z' | '+x' | '-x';
  height?: number;
  originNode?:string;
  clips?: Partial<Record<ClipRole, string>>;
  sockets?: { weaponTip?: string; weaponBase?: string; cast?: string };
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
  model: THREE.Object3D; clips: Map<string,THREE.AnimationAction>; jointCount: number;
  sockets: Partial<Record<'weaponTip'|'weaponBase'|'cast',THREE.Object3D>>;
  skillSlot?: number; actionDuration: number;
  victoryAt?:number; victoryFinished?:boolean;
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
  private skillVfx: SkillVfx;
  private skillCues = new Map<string,SkillCue>();
  private presentationBattleTime = 0;
  private restoreActiveCasts=false;
  private showcaseMotion: { actorId:string; clip:string; age:number; duration:number; loop:boolean; cue?:SkillCue; impacted:boolean } | null = null;
  private cameraZoom = 0;
  private baseFov = 39;
  onSkill?: (cue: SkillCue) => void;
  onSkillImpact?: (cue: SkillCue) => void;
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
    this.skillVfx = new SkillVfx(this.scene);
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
          const center=box.getCenter(new THREE.Vector3());
          const origin=definition.originNode?gltf.scene.getObjectByName(definition.originNode)??gltf.scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(definition.originNode)):undefined;
          if(origin){const point=origin.getWorldPosition(new THREE.Vector3());center.x=point.x;center.z=point.z;}
          this.models.set(key, { gltf, definition, scale: (definition.height ?? 1.95) / size.y, floor: box.min.y, center });
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

  get modelDiagnostics() { return { cached: [...this.models.keys()], preview:this.showcaseMotion?{clip:this.showcaseMotion.clip,age:this.showcaseMotion.age,duration:this.showcaseMotion.duration}:null, actors: [...this.actors.values()].map(actor => ({ id: actor.id, modelKey: actor.modelKey, x:actor.group.position.x, z:actor.group.position.z, facing:actor.group.rotation.y, clip:actor.current?.getClip().name,currentTime:actor.current?.time,clipDuration:actor.current?.getClip().duration,jointCount:actor.jointCount,action:actor.action,skillSlot:actor.skillSlot,weaponTip:this.socketPosition(actor,'weaponTip').toArray(),weaponHand:this.socketPosition(actor,'weaponBase').toArray() })) }; }
  get effectDiagnostics() { return { ...this.skillVfx.diagnostics, simulationTime:this.presentationBattleTime, delayedEvents: 0, drawCalls: this.renderer.info.render.calls, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures }; }
  setReducedEffects(reduced: boolean): void { this.skillVfx.setReduced(reduced); this.cameraShake = 0; this.cameraZoom = 0; }

  setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.showcaseSignature = '';
    this.clearActors();
    this.clearEffects();
    if (mode === 'battle') {
      this.restoreActiveCasts=true;
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
    this.clearEffects();
    this.selectedHero = heroId;
    this.showcaseSignature = '';
    if (this.loaded && this.mode !== 'battle') { this.clearActors(); this.syncShowcase(); }
  }

  availableAnimations(heroId:string):string[] {
    const hero=heroById[heroId];return hero ? this.models.get(hero.modelKey)?.gltf.animations.map(clip=>clip.name)??[] : [];
  }

  /** Inspect an authored clip without spending mana or mutating the player's save. */
  previewAnimation(heroId:string,clipOrSlot:string|number):boolean {
    if(this.mode==='battle'||!heroById[heroId])return false;
    if(typeof clipOrSlot==='number'&&(!Number.isInteger(clipOrSlot)||clipOrSlot<0||clipOrSlot>2))return false;
    if(this.selectedHero!==heroId)this.preview(heroId);
    const actor=this.actors.get('showcase');if(!actor)return false;
    const skillSlot=typeof clipOrSlot==='number'?clipOrSlot:/^Skill_0?[123]$/i.test(clipOrSlot)?Number(clipOrSlot.slice(-1))-1:undefined;
    const role=skillSlot!==undefined?(`skill${skillSlot+1}` as ClipRole):undefined;
    const action=role?actor.actions[role]:actor.clips.get(String(clipOrSlot));if(!action)return false;
    this.clearEffects();
    const timing=skillSlot!==undefined?getActionTiming(heroId,'skill',skillSlot):undefined;
    const duration=timing?.duration??action.getClip().duration;
    const loop=/idle|run|walk/i.test(action.getClip().name);
    this.playAction(actor,action,loop,true,duration);
    actor.action=skillSlot!==undefined?'skill':'preview';actor.skillSlot=skillSlot;actor.actionTime=0;actor.actionDuration=duration;
    let cue:SkillCue|undefined;
    if(skillSlot!==undefined){
      const hero=heroById[heroId],support=heroId==='kael'?skillSlot===1:heroId==='lyra'?skillSlot<2:false;
      const origin=actor.group.position.clone();
      cue={heroId,skillId:hero.skills[skillSlot].id,slot:skillSlot,name:hero.skills[skillSlot].name,color:hero.color,origin,targets:support?[origin.clone()]:[origin.clone().add(new THREE.Vector3(1.3,0,-1.4))],impactDelay:timing!.impact,duration,facing:actor.group.rotation.y,weaponTip:()=>this.socketPosition(actor,'weaponTip'),weaponBase:()=>this.socketPosition(actor,'weaponBase')};
      this.skillVfx.cast(cue);this.onSkill?.(cue);
    }
    this.showcaseMotion={actorId:actor.id,clip:action.getClip().name,age:0,duration,loop,cue,impacted:false};
    return true;
  }

  private socketPosition(actor:Actor,role:'weaponTip'|'weaponBase'|'cast'):THREE.Vector3 {
    actor.group.updateMatrixWorld(true);
    const socket=actor.sockets[role];
    return socket?socket.getWorldPosition(new THREE.Vector3()):actor.group.localToWorld(new THREE.Vector3(0,role==='weaponTip'?1.65:1.0,role==='weaponTip'?.25:0));
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
    const clips=new Map(asset.gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
    const patterns: Record<ClipRole, RegExp> = {
      idle: /idle|standing|breath/i, attack: /attack|slash|sword|punch|fight/i,
      attack2:/attack[_ ]?0?2/i,run: /run|walk/i, hurt: /hit|hurt|damage/i, death: /death|dead|die|fall/i, skill: /cast|magic|spell|skill|special/i,
      skill1:/skill[_ ]?0?1$/i,skill2:/skill[_ ]?0?2$/i,skill3:/skill[_ ]?0?3$/i,victory:/victory|celebrate/i,
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
    let jointCount=0;model.traverse(node=>{if(node instanceof THREE.Bone)jointCount++;});
    const sockets:Actor['sockets']={};
    for(const role of ['weaponTip','weaponBase','cast'] as const){
      const name=asset.definition.sockets?.[role];if(!name)continue;
      sockets[role]=model.getObjectByName(name)??model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
      if(!sockets[role])model.traverse(node=>{if(node.userData.name===name)sockets[role]=node;});
    }
    const actor:Actor = { id, modelKey, group, body, model, clips, jointCount, sockets, mixer, actions, seq:-1, actionTime:0, action:'idle',actionDuration:0, base:new THREE.Vector3(), color:new THREE.Color(color), modelMaterials, ring, hp, hpFill, deadTime:0 };
    this.actors.set(id, actor);
    this.play(actor, 'idle');
    return actor;
  }

  private play(actor: Actor, role: ClipRole, restart=false, duration?:number): void {
    const next = actor.actions[role] ?? actor.actions.idle;
    if(!next)return;
    const loop=role==='idle'||role==='run'||next===actor.actions.idle;
    this.playAction(actor,next,loop,restart,loop?undefined:duration);
  }
  private playAction(actor:Actor,next:THREE.AnimationAction,loop:boolean,restart=false,duration?:number):void {
    if (next === actor.current&&!restart) return;
    const previous=actor.current;
    next.reset(); next.enabled=true;next.paused=false; next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(duration?next.getClip().duration/Math.max(.05,duration):1);
    next.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);next.clampWhenFinished=!loop;
    next.play();
    if(previous&&previous!==next)next.crossFadeFrom(previous,.08,false);
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
    this.arrangeShowcase();
  }

  private arrangeShowcase():void {
    if(this.mode==='battle')return;
    const portrait=this.container.clientWidth<this.container.clientHeight;
    const starterLead=this.selectedHero==='kael'||this.selectedHero==='lyra';
    const lead=this.actors.get('showcase');
    if(lead){
      lead.group.position.set(portrait&&this.mode==='home'?1.05:.8,0,portrait&&this.mode==='home'?-.19:.6);
      lead.group.scale.setScalar(this.mode==='heroes'?1.25:portrait||starterLead?1.4:1.65);
      lead.base.copy(lead.group.position);
    }
    let index=0;
    for(const actor of this.actors.values())if(actor.id.startsWith('companion-')){
      const starterPair=starterLead&&(actor.id==='companion-kael'||actor.id==='companion-lyra');
      actor.group.position.set(portrait?-.79-index*.8:starterPair?-.8:-1.35-index*1.1,0,portrait?1.15-index*.6:starterPair?1.7:-.25-index*.8);
      actor.group.scale.setScalar(portrait||starterPair?1.4:1);actor.base.copy(actor.group.position);index++;
    }
  }

  render(state: GameState, dt: number): void {
    if(this.disposed||this.contextLost)return;
    const safeDt=Math.min(Math.max(dt,0),.08);
    let effectDt=safeDt;
    this.time+=safeDt; this.lastState=state;
    this.environment.animate(this.time,this.mode==='battle');
    if(this.loaded){
      if(this.mode==='battle'&&state.battle){
        const battle=state.battle;
        if(this.battleId!==battle.id){this.battleId=battle.id;this.presentationBattleTime=battle.elapsed;this.seenEvents.clear();this.clearActors();this.clearEffects();}
        const combatants=[...battle.allies,...battle.enemies];
        const activeIds=new Set(combatants.map(actor=>actor.id));
        for(const[id,actor]of this.actors){if(!activeIds.has(id))this.removeActor(actor);}
        const previousBattleTime=this.presentationBattleTime;
        this.presentationBattleTime=battle.status==='fighting'?battle.elapsed:this.presentationBattleTime+(battle.paused?0:safeDt*battle.speed);
        const simulationDt=Math.max(0,this.presentationBattleTime-previousBattleTime);effectDt=simulationDt;
        for(const combatant of combatants)this.updateCombatant(combatant,combatants,simulationDt);
        if(this.restoreActiveCasts){
          this.restoreActiveCasts=false;
          for(const actor of combatants){
            if(!actor.alive||actor.action!=='skill'||battle.elapsed>=actor.actionStartedAt+actor.actionDuration)continue;
            const cast=battle.effects.find(event=>event.type==='skill'&&event.sourceId===actor.id&&event.actionSeq===actor.actionSeq);
            if(cast&&this.seenEvents.has(cast.id))this.showEvent(cast,true);
          }
        }
        for(const event of battle.effects){
          if(this.seenEvents.has(event.id))continue;
          this.seenEvents.add(event.id);
          // Simulation emits impacts at the authored frame. Never add a second visual delay.
          this.showEvent(event);
        }
        if(this.seenEvents.size>500){const liveIds=new Set(battle.effects.map(event=>event.id));this.seenEvents=liveIds;}
      }else{
        for(const actor of this.actors.values()){
          actor.mixer.update(safeDt);
          // Static GLBs retain their authored pose; a subtle breathe adds life without pretending to be skeletal animation.
          if(!actor.actions.idle)actor.body.position.y=Math.sin(this.time*1.9)*.009;
          if(actor.id==='showcase'&&!this.showcaseMotion)actor.group.rotation.y=.4+Math.sin(this.time*.15)*.09;
          actor.ring.material.opacity=actor.id==='showcase'?.36+Math.sin(this.time*1.7)*.08:.16;
        }
        if(this.showcaseMotion){
          const motion=this.showcaseMotion;motion.age+=safeDt;
          if(motion.cue&&!motion.impacted&&motion.age>=motion.cue.impactDelay){motion.impacted=true;this.onSkillImpact?.(motion.cue);}
          if(!motion.loop&&motion.age>=motion.duration){const actor=this.actors.get(motion.actorId);if(actor){this.play(actor,'idle');actor.action='idle';actor.skillSlot=undefined;}this.showcaseMotion=null;}
        }
      }
    }
    this.skillVfx.update(effectDt);
    for(let i=this.effects.length-1;i>=0;i--){
      const effect=this.effects[i]; effect.age+=effectDt;
      const t=Math.min(effect.age/effect.duration,1);effect.update(t);
      if(t>=1){this.scene.remove(effect.object);effect.dispose();this.effects.splice(i,1);}
    }
    const smoothing=1-Math.exp(-safeDt*3);
    this.camera.position.lerp(this.targetPosition,smoothing);
    this.lookAt.lerp(this.targetLookAt,smoothing);
    this.cameraShake=Math.max(0,this.cameraShake-effectDt*.9);
    this.cameraZoom=Math.max(0,this.cameraZoom-effectDt*2.5);
    const fov=this.baseFov-this.cameraZoom;
    if(Math.abs(this.camera.fov-fov)>.01){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
    const cameraTime=this.mode==='battle'?this.presentationBattleTime:this.time;
    this.camera.lookAt(this.lookAt.x+Math.sin(cameraTime*70)*this.cameraShake*.07,this.lookAt.y+Math.cos(cameraTime*53)*this.cameraShake*.04,this.lookAt.z);
    for(const actor of this.actors.values())actor.hp.quaternion.copy(actor.group.quaternion).invert().multiply(this.camera.quaternion);
    this.renderer.render(this.scene,this.camera);
  }

  private updateCombatant(combatant:Combatant,combatants:Combatant[],dt:number):void {
    if (!this.models.has(combatant.modelKey)) return;
    let actor=this.actors.get(combatant.id);
    if(!actor){
      actor=this.createActor(combatant.id,combatant.modelKey,combatant.side==='ally'?(heroById[combatant.heroId??'']?.color??'#86c7e7'):'#d78c9b');
      actor.base.set(combatant.x*FIELD_X,.015,combatant.z*FIELD_Z);
      actor.group.position.copy(actor.base); actor.group.rotation.y=combatant.side==='ally'?Math.PI/2:-Math.PI/2;
      if(combatant.role==='boss')actor.group.scale.setScalar(1.4);
    }
    actor.base.set(combatant.x*FIELD_X,.015,combatant.z*FIELD_Z);
    actor.hp.visible=combatant.alive;
    const ratio=Math.max(0,Math.min(1,combatant.hp/combatant.maxHp));actor.hpFill.scale.x=ratio;actor.hpFill.position.x=-(1-ratio)*.36;
    actor.ring.visible=combatant.alive;actor.ring.material.opacity=combatant.shield>0?.65:.22;
    const elapsed=Math.max(0,this.presentationBattleTime-combatant.actionStartedAt);
    if(combatant.alive&&this.lastState?.battle?.status==='won'&&actor.actions.victory&&elapsed>=combatant.actionDuration){
      if(actor.victoryAt===undefined){actor.victoryAt=this.presentationBattleTime;actor.action='victory';this.play(actor,'victory',true);}
      actor.mixer.update(dt);actor.group.position.copy(actor.base);
      const faceCamera=Math.atan2(this.camera.position.x-actor.base.x,this.camera.position.z-actor.base.z);
      actor.group.rotation.y+=Math.atan2(Math.sin(faceCamera-actor.group.rotation.y),Math.cos(faceCamera-actor.group.rotation.y))*Math.min(1,dt*4);
      if(!actor.victoryFinished&&this.presentationBattleTime-actor.victoryAt>=actor.actions.victory.getClip().duration){actor.victoryFinished=true;actor.action='idle';this.play(actor,'idle');}
      return;
    }
    const stateAction=combatant.action;
    if(actor.seq!==combatant.actionSeq||(actor.action!==stateAction&&actor.action!=='complete')){
      actor.seq=combatant.actionSeq;actor.actionTime=0;actor.action=combatant.action;
      actor.skillSlot=combatant.activeSkillSlot;actor.actionDuration=combatant.actionDuration;
      const skillRole=combatant.activeSkillSlot!==undefined?`skill${combatant.activeSkillSlot+1}` as ClipRole:'skill';
      const clip:ClipRole=combatant.action==='dead'?'death':combatant.action==='move'?'run':combatant.action==='hit'?'hurt':combatant.action==='skill'?(actor.actions[skillRole]?skillRole:'skill'):combatant.action==='attack'?'attack':'idle';
      this.play(actor,clip,true,combatant.actionDuration||undefined);
      if(combatant.action==='attack'&&(combatant.heroId==='kael'||combatant.heroId==='lyra')){
        const target=combatants.find(other=>other.id===combatant.targetId);
        if(target){
          const timing=getActionTiming(combatant.heroId,'attack'),source=actor,seq=combatant.actionSeq;
          const startedAt=combatant.actionStartedAt;
          this.skillVfx.cast({heroId:combatant.heroId,skillId:'basic-attack',slot:-1,name:'Attack',color:heroById[combatant.heroId].color,origin:actor.base.clone(),targets:[new THREE.Vector3(target.x*FIELD_X,0,target.z*FIELD_Z)],impactDelay:timing.impact,duration:timing.duration,facing:actor.group.rotation.y,elapsed,clock:()=>Math.max(0,this.presentationBattleTime-startedAt),weaponTip:()=>this.socketPosition(source,'weaponTip'),weaponBase:()=>this.socketPosition(source,'weaponBase'),targetPositions:()=>[this.actors.get(target.id)?.base.clone()??new THREE.Vector3(target.x*FIELD_X,0,target.z*FIELD_Z)],valid:()=>combatant.alive&&combatant.actionSeq===seq},false);
        }
      }
      if(combatant.action==='attack'&&combatant.heroId!=='kael'&&combatant.heroId!=='lyra'){
        const target=combatants.find(other=>other.id===combatant.targetId);
        if(target){
          const end=new THREE.Vector3(target.x*FIELD_X,1.1,target.z*FIELD_Z);
          if(combatant.attackMode==='melee')this.spawnSwing(actor.base,end,actor.color);
          else this.spawnTrail(actor.base,end,actor.color,false);
        }
      }
    }
    actor.actionTime=elapsed;actor.mixer.update(dt);
    if(actor.current&&['attack','skill','hit','dead'].includes(actor.action)&&actor.actionDuration>0){
      actor.current.time=Math.min(actor.current.getClip().duration-.00001,elapsed/actor.actionDuration*actor.current.getClip().duration);
      actor.mixer.update(0);
    }
    if(!combatant.alive){
      actor.deadTime+=dt;
      if(!actor.actions.death){actor.body.rotation.z=THREE.MathUtils.lerp(actor.body.rotation.z,combatant.side==='ally'?1.45:-1.45,Math.min(1,dt*4));actor.body.position.y=-Math.min(.45,actor.deadTime*.28);}
      actor.group.visible=actor.deadTime<2.7;
      return;
    }
    actor.group.visible=true;actor.deadTime=0;
    const target=combatants.find(other=>other.id===combatant.targetId&&other.alive);
    if(target){const facing=Math.atan2((target.x-combatant.x)*FIELD_X,(target.z-combatant.z)*FIELD_Z);actor.group.rotation.y=facing;}
    const attack=(actor.action==='attack'||actor.action==='skill')&&actor.actionTime<actor.actionDuration;
    const authoredStarter=combatant.heroId==='kael'||combatant.heroId==='lyra';
    const lunge=attack&&!authoredStarter&&combatant.attackMode==='melee'?Math.sin(Math.min(1,actor.actionTime/Math.max(.1,actor.actionDuration))*Math.PI)*.06:0;
    if(combatant.action==='move')actor.group.position.lerp(actor.base,Math.min(1,dt*24));else actor.group.position.copy(actor.base);
    actor.group.position.x+=Math.sin(actor.group.rotation.y)*lunge;actor.group.position.z+=Math.cos(actor.group.rotation.y)*lunge;
    actor.body.position.y=actor.actions.idle?0:Math.sin(this.time*1.9+combatant.x)*.009;
    if(actor.action==='hit'&&actor.actionTime<.22)actor.group.position.x-=(combatant.side==='ally'?1:-1)*Math.sin(actor.actionTime/.22*Math.PI)*.12;
    if(actor.actionDuration>0&&elapsed>=actor.actionDuration&&actor.action!=='idle'&&actor.action!=='move'&&actor.action!=='complete'){this.play(actor,'idle');actor.action='complete';}
  }

  private spawnSwing(start:THREE.Vector3,end:THREE.Vector3,color:THREE.Color):void {
    const geometry=new THREE.RingGeometry(.48,.54,24,1,-Math.PI*.6,Math.PI*1.05);
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
    const arc=new THREE.Mesh(geometry,material);arc.position.copy(start).lerp(end,.6);arc.position.y=1.05;arc.rotation.z=.4;this.scene.add(arc);
    this.effects.push({object:arc,duration:.26,age:0,update:t=>{arc.rotation.z=.4+t*.8;arc.scale.setScalar(.65+t*.6);material.opacity=(1-t)*.65;},dispose:()=>{geometry.dispose();material.dispose();}});
  }

  private spawnTrail(start:THREE.Vector3,end:THREE.Vector3,color:THREE.Color,strong:boolean):void {
    const points=[start.clone().add(new THREE.Vector3(0,1.05,0)),start.clone().lerp(end,.5).add(new THREE.Vector3(0,strong?1.65:1.0,0)),end.clone()];
    const path=new THREE.CatmullRomCurve3(points);
    const geometry=new THREE.TubeGeometry(path,16,strong?.032:.012,5,false);
    const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:strong?.7:.38,depthWrite:false,blending:THREE.AdditiveBlending});
    const trail=new THREE.Mesh(geometry,material);this.scene.add(trail);
    this.effects.push({object:trail,duration:.4,age:0,update:t=>{material.opacity=(1-t)*(strong?.75:.42);},dispose:()=>{geometry.dispose();material.dispose();}});
  }

  private showEvent(event:CombatEvent,restoring=false):void {
    if(event.type==='wave')return;
    if(event.type==='skillImpact'){
      const key=`${event.sourceId}:${event.actionSeq}`;
      const cue=this.skillCues.get(key);if(!cue)return;
      cue.impactConfirmed=true;cue.impactTargets=event.targetIds??(event.targetId?[event.targetId]:[]);
      this.skillVfx.resolveImpact(cue);
      this.onSkillImpact?.(cue);this.skillCues.delete(key);
      if(!this.skillVfx.diagnostics.reduced){this.cameraShake=Math.max(this.cameraShake,cue.slot===2?.46:.13);if(cue.slot===2)this.cameraZoom=.65;}
      return;
    }
    if(event.type==='skill'){
      const caster=this.actors.get(event.sourceId??'');if(!caster)return;
      const combatant=[...this.lastState?.battle?.allies??[],...this.lastState?.battle?.enemies??[]].find(actor=>actor.id===event.sourceId);
      const hero=heroById[combatant?.heroId??event.sourceId??''];
      const targetIds=event.targetIds??(event.targetId?[event.targetId]:[]);
      const targets=targetIds.map(id=>this.actors.get(id)?.base.clone()).filter((point):point is THREE.Vector3=>!!point);
      // Boss sweeps have no hero definition and target the living opposing formation.
      if(!hero&&!targets.length)for(const ally of this.lastState?.battle?.allies??[]){if(ally.alive){const actor=this.actors.get(ally.id);if(actor)targets.push(actor.base.clone());}}
      const timing=getActionTiming(hero?.id??'boss','skill',event.skillSlot??2);
      const battle=this.lastState!.battle!,battleId=battle.id,wave=battle.wave;
      const previousImpact=restoring?battle.effects.find(hit=>hit.type==='skillImpact'&&hit.sourceId===event.sourceId&&hit.actionSeq===event.actionSeq):undefined;
      const cue:SkillCue={heroId:hero?.id??'boss',skillId:event.skillId??'eclipse-burst',slot:event.skillSlot??2,name:event.label??'Eclipse Burst',color:hero?.color??'#dd4590',origin:caster.base.clone(),targets,targetIds,impactDelay:event.impactAt!==undefined?Math.max(0,event.impactAt-event.createdAt):timing.impact,duration:event.duration??timing.duration,facing:caster.group.rotation.y,elapsed:Math.max(0,this.presentationBattleTime-event.createdAt),clock:()=>Math.max(0,this.presentationBattleTime-event.createdAt),restored:restoring,impactConfirmed:!!previousImpact,impactTargets:previousImpact?.targetIds,weaponTip:()=>this.socketPosition(caster,'weaponTip'),weaponBase:()=>this.socketPosition(caster,'weaponBase'),targetPositions:()=>targetIds.map((id,index)=>this.actors.get(id)?.base.clone()??targets[index]),valid:()=>{
        if(cue.impactConfirmed)return true;
        const current=this.lastState?.battle;
        return !!current&&current.id===battleId&&current.wave===wave&&current.waveTransition===0&&!!combatant?.alive&&combatant.actionSeq===event.actionSeq&&targetIds.some(id=>[...current.allies,...current.enemies].some(actor=>actor.id===id&&actor.alive));
      }};
      this.skillCues.set(`${event.sourceId}:${event.actionSeq}`,cue);
      if(this.skillCues.size>32)this.skillCues.delete(this.skillCues.keys().next().value!);
      this.skillVfx.cast(cue);if(!restoring)this.onSkill?.(cue);
      return;
    }
    const target=this.actors.get(event.targetId??event.sourceId??'');if(!target)return;
    if(event.type==='damage'){
      this.spawnBurst(target.base.clone().add(new THREE.Vector3(0,1.0,0)),event.critical?0xffcc76:0xffe9b7,event.critical?20:8);
      if(event.critical&&!this.skillVfx.diagnostics.reduced)this.cameraShake=Math.max(this.cameraShake,.3);
      if(event.amount)this.spawnNumber(target,event.amount,event.critical?'#ffe0a0':'#fff3df',!!event.critical);
    }else if(event.type==='heal'){
      this.spawnRing(target.base,0x8effc5,false);
      if(event.amount)this.spawnNumber(target,event.amount,'#a1ffca',false,true);
    }else if(event.type==='shield')this.spawnRing(target.base,0x94cbff,true);
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
    this.baseFov=this.camera.fov;
    this.camera.clearViewOffset();
    const portrait=width<height;
    if(this.mode==='home')this.camera.setViewOffset(width,height,-width*(width>720?.16:.04),portrait?-height*.13:0,width,height);
    if(this.mode==='heroes'&&portrait)this.camera.setViewOffset(width,height,0,height*.09,width,height);
    this.arrangeShowcase();
    if(this.mode==='battle'){
      const offset=new THREE.Vector3(1.6,3.85,10.85);
      if(width<height){
        // Vertical FOV alone cuts both teams off on a portrait phone. Fit the
        // complete formation into its narrow horizontal frustum, with room for weapons.
        const horizontalHalfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)*this.camera.aspect);
        const requiredDistance=6.0/Math.tan(horizontalHalfFov);
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
  private clearActors():void {for(const actor of this.actors.values())this.removeActor(actor);this.showcaseMotion=null;}
  private clearEffects():void {for(const effect of this.effects){this.scene.remove(effect.object);effect.dispose();}this.effects=[];this.skillCues.clear();this.skillVfx.clear();this.cameraZoom=0;this.cameraShake=0;}
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.resizeObserver.disconnect();this.clearActors();this.clearEffects();this.environment.dispose();
    const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    for(const asset of this.models.values())asset.gltf.scene.traverse(node=>{if(node instanceof THREE.Mesh){geometry.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);}}});
    geometry.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());textures.forEach(value=>value.dispose());
    this.renderer.domElement.removeEventListener('webglcontextlost',this.canvasLostHandler);this.renderer.domElement.removeEventListener('webglcontextrestored',this.canvasRestoredHandler);
    this.environmentTarget.dispose();this.renderer.dispose();this.renderer.domElement.remove();
    this.skillVfx.dispose();
  }
}
