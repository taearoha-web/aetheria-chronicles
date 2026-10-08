import * as THREE from 'three';
import { addStarterEffects } from './StarterEffects';

export interface SkillCue {
  heroId: string; skillId: string; slot: number; name: string;
  color: string; origin: THREE.Vector3; targets: THREE.Vector3[];
  impactDelay:number; duration:number; facing:number; elapsed?:number;
  weaponTip?:()=>THREE.Vector3; weaponBase?:()=>THREE.Vector3;
  targetPositions?:()=>THREE.Vector3[];
  valid?:()=>boolean;
  clock?:()=>number; restored?:boolean;
  targetIds?:string[]; impactConfirmed?:boolean; impactTargets?:string[];
}
interface Cast { group: THREE.Group; age: number; duration: number; update: (age: number) => void; record:boolean; valid?:()=>boolean; clock?:()=>number; cue:SkillCue }
type Updater = (age: number) => void;
const TAU = Math.PI * 2;
const palettes: Record<string, [number, number]> = {
  kael: [0x58cbff, 0xe9fbff], lyra: [0xdc98ff, 0xffeafc],
  seraphina: [0xff6326, 0xffe5a1], riven: [0x9764ff, 0xe4c5ff],
  astrid: [0x55ddf1, 0xcdffff], elias: [0x9177ff, 0xf4faff],
  nova: [0x6ff7b0, 0xe4ffe6], lucien: [0xffc55c, 0xfff4ce],
  boss: [0xdd4590, 0xfbd8ff],
};

/** A bounded presentation timeline. No game state, damage or progression is changed here. */
export class SkillVfx {
  private casts: Cast[] = [];
  private sigil: THREE.CanvasTexture;
  private glow: THREE.CanvasTexture;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private history: string[] = [];
  private impacts: {heroId:string;skillId:string;slot:number;age:number;impactDelay:number;targetCount:number}[] = [];
  private resolvedCues = new WeakSet<SkillCue>();
  private total = 0;
  constructor(private scene: THREE.Scene) {
    this.sigil = this.makeSigil();
    this.glow = this.makeGlow();
  }
  setReduced(reduced: boolean): void { this.reduced = reduced; }
  get diagnostics() {
    const skills=this.casts.filter(cast=>cast.record);
    return {activeCasts:skills.length,activeBasic:this.casts.filter(cast=>!cast.record).length,maxCasts:8,totalCasts:this.total,
      ages:skills.map(cast=>cast.age),recentSkills:[...this.history],reduced:this.reduced,
      casts:skills.map(({age,cue})=>({heroId:cue.heroId,skillId:cue.skillId,slot:cue.slot,age,duration:cue.duration,impactDelay:cue.impactDelay,impactConfirmed:cue.impactConfirmed,targetIds:[...cue.targetIds??[]],impactTargets:[...cue.impactTargets??[]]})),
      impacts:this.impacts.map(impact=>({...impact}))};
  }

  cast(cue: SkillCue, record=true): void {
    if (this.casts.length >= 8) this.remove(this.casts.shift()!);
    const group = new THREE.Group(); group.name = `Skill ${cue.heroId}:${cue.skillId}`;
    this.scene.add(group);
    const updates: Updater[] = [];
    const [color, core] = palettes[cue.heroId] ?? palettes.boss;
    const ultimate = cue.slot === 2;
    const support = ['starlight','sanctuary','astral','sunward','icewall','grace','covenant'].includes(cue.skillId);
    const targets = cue.targets.length ? cue.targets : [cue.origin];
    const impact = cue.impactDelay;
    const starter=cue.heroId==='kael'||cue.heroId==='lyra';
    if(starter){
      addStarterEffects(cue,group,updates,{sigil:this.sigil,glow:this.glow,reduced:this.reduced});
      this.finishCast(cue,group,updates,Math.max(cue.duration,impact+.95)+.05,record);
      return;
    }
    this.circle(group, updates, cue.origin, color, ultimate ? 1.15 : .75, 0, .62, true);
    this.aura(group, updates, cue.origin.clone().add(new THREE.Vector3(0, 1, 0)), color, .9, 0, .34);
    if (support) {
      for (const target of targets) {
        this.circle(group, updates, target, color, ultimate ? 1.12 : .85, impact, 1.05, true);
        if (cue.skillId === 'sunward' || cue.skillId === 'icewall' || cue.skillId === 'astral' || cue.skillId === 'covenant') {
          this.barrier(group, updates, target, color, impact, cue.heroId === 'astrid');
        }
        if (cue.heroId === 'lyra' || cue.heroId === 'lucien') {
          this.pillar(group, updates, target, color, core, impact, ultimate ? 2.7 : 2.1);
          this.petals(group, updates, target, color, impact, ultimate ? 10 : 6);
        }
      }
    } else if (cue.heroId === 'seraphina') {
      const center = this.center(targets);
      if (ultimate) {
        // A winged flame silhouette dives before the fire plume blossoms.
        const wings = new THREE.Group(); group.add(wings);
        for (const side of [-1, 1]) for (let feather = 0; feather < 5; feather++) {
          const start = new THREE.Vector3(0, .05, 0);
          const tip = new THREE.Vector3(side * (1.4 + feather * .17), .65 - feather * .22, 0);
          const arc = this.ribbon(wings, updates, [start, new THREE.Vector3(side * .8, .75, 0), tip], color, .24, 0, .44);
          arc.renderOrder = 3;
        }
        updates.push(age => { const t = Math.min(age / impact, 1); wings.position.copy(center).add(new THREE.Vector3(0, 4 * (1 - t) + .45, 0)); wings.rotation.z = -.25 * (1 - t); wings.scale.setScalar(.4 + t * .7); });
      } else {
        this.projectile(group, updates, cue.origin, center, color, core, cue.slot === 1 ? .45 : .25,impact);
      }
      for (const target of targets) {
        this.flames(group, updates, target, impact, ultimate ? 3.2 : 1.9);
        this.circle(group, updates, target, color, ultimate ? 1.6 : 1, impact, .85, false);
      }
    } else if (cue.heroId === 'elias') {
      let from = cue.origin.clone().add(new THREE.Vector3(0, 1.3, 0));
      for (const target of targets) {
        const end = target.clone().add(new THREE.Vector3(0, 1.1, 0));
        this.lightning(group, updates, ultimate ? target.clone().add(new THREE.Vector3(0, 4.8, 0)) : from, end, color, core, impact);
        if (ultimate) this.lightning(group, updates, from, end, color, core, impact + .11);
        this.circle(group, updates, target, color, ultimate ? 1.45 : .9, impact, .65, false);
        from = end;
      }
    } else if (cue.heroId === 'astrid') {
      for (const target of targets) {
        this.crystals(group, updates, target, color, core, impact, ultimate ? 9 : 5);
        this.circle(group, updates, target, color, ultimate ? 1.6 : 1.05, impact, .95, false);
      }
    } else if (cue.heroId === 'nova') {
      for (const target of targets) {
        this.vortex(group, updates, target, color, core, impact, ultimate ? 2.5 : 1.6);
        this.projectile(group, updates, cue.origin, target, color, core, .15,impact);
      }
    } else if (cue.heroId === 'lyra' || cue.heroId === 'lucien') {
      for (const target of targets) this.pillar(group, updates, target, color, core, impact, 2.7);
    } else {
      for (const target of targets) {
        // Knight: a forward crescent. Abyss warrior: crossed blades and a dark eclipse.
        this.slash(group, updates, target, color, core, impact, ultimate ? 1.8 : 1.2, cue.heroId === 'riven');
        this.projectile(group, updates, cue.origin, target, color, core, .13,impact);
        if (cue.heroId === 'riven' && ultimate) this.eclipse(group, updates, target, color, impact);
      }
    }
    for (const target of targets) {
      this.aura(group, updates, target.clone().add(new THREE.Vector3(0, 1.1, 0)), core, ultimate ? 1.5 : 1, impact, .4);
      this.particles(group, updates, target, color, core, impact, support, ultimate);
    }
    this.finishCast(cue,group,updates,Math.max(cue.duration,impact+1.2),record);
  }
  private finishCast(cue:SkillCue,group:THREE.Group,updates:Updater[],duration:number,record:boolean):void {
    const cast:Cast={group,age:cue.clock?.()??cue.elapsed??0,duration,record,valid:cue.valid,clock:cue.clock,cue,update:age=>{group.visible=cue.impactConfirmed!==false||age<cue.impactDelay;updates.forEach(update=>update(age));}};
    cast.update(cast.age);this.casts.push(cast);
    if(record&&!cue.restored){this.total++;this.history.push(`${cue.heroId}:${cue.skillId}`);if(this.history.length>32)this.history.shift();}
  }
  resolveImpact(cue:SkillCue):void {
    if(!this.resolvedCues.has(cue)){
      this.resolvedCues.add(cue);
      this.impacts.push({heroId:cue.heroId,skillId:cue.skillId,slot:cue.slot,age:cue.clock?.()??cue.elapsed??cue.impactDelay,impactDelay:cue.impactDelay,targetCount:cue.impactTargets?.length??0});
      if(this.impacts.length>32)this.impacts.shift();
    }
    if(cue.heroId==='kael'||cue.heroId==='lyra')return;
    const index=this.casts.findIndex(cast=>cast.cue===cue);if(index<0)return;
    const previous=this.casts[index],points=cue.targetPositions?.()??cue.targets;
    const resolved=points.filter((_,i)=>!cue.targetIds||cue.impactTargets?.includes(cue.targetIds[i]));
    if(resolved.length)cue.targets=resolved;
    this.remove(previous);this.casts.splice(index,1);
    const restored=cue.restored;cue.restored=true;this.cast(cue,previous.record);cue.restored=restored;
  }
  update(dt: number): void {
    for (let i = this.casts.length - 1; i >= 0; i--) {
      const cast = this.casts[i]; cast.age=cast.clock?cast.clock():cast.age+dt; cast.update(cast.age);
      if (cast.age >= cast.duration || cast.valid?.()===false) { this.remove(cast); this.casts.splice(i, 1); }
    }
  }
  clear(): void { this.casts.forEach(cast => this.remove(cast)); this.casts = []; }
  dispose(): void { this.clear(); this.sigil.dispose(); this.glow.dispose(); }
  private remove(cast: Cast): void {
    this.scene.remove(cast.group);
    cast.group.traverse(node => {
      if (node instanceof THREE.Mesh || node instanceof THREE.Points || node instanceof THREE.Sprite || node instanceof THREE.Line) {
        // THREE.Sprite owns a shared geometry; only dispose per-cast geometry.
        if (!(node instanceof THREE.Sprite)) node.geometry.dispose();
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
      }
    });
  }
  private center(points: THREE.Vector3[]): THREE.Vector3 {
    return points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
  }
  private material(color: number, opacity = 1): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  }
  private animate(node: THREE.Object3D, material: THREE.Material & { opacity: number }, updates: Updater[], start: number, duration: number, fn: (t: number) => void, opacity = 1): void {
    updates.push(age => {
      const t = (age - start) / duration; node.visible = t >= 0 && t < 1;
      if (!node.visible) return;
      material.opacity = opacity * Math.min(1, t * 12) * Math.pow(1 - t, .75); fn(t);
    });
  }
  private circle(group: THREE.Group, updates: Updater[], position: THREE.Vector3, color: number, size: number, start: number, duration: number, rune: boolean): void {
    const material = this.material(color, .6);
    if (rune) material.map = this.sigil;
    const geometry = rune ? new THREE.PlaneGeometry(2, 2) : new THREE.RingGeometry(.96, 1, 64);
    const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; mesh.position.copy(position); mesh.position.y = .08; group.add(mesh);
    this.animate(mesh, material, updates, start, duration, t => { mesh.scale.setScalar(size * (rune ? .7 + t * .6 : .4 + t * 1.8)); mesh.rotation.z = t * (rune ? .45 : .2); }, rune ? .6 : .7);
  }
  private aura(group: THREE.Group, updates: Updater[], position: THREE.Vector3, color: number, size: number, start: number, duration: number): void {
    const material = new THREE.SpriteMaterial({ map: this.glow, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: .6 });
    const mesh = new THREE.Sprite(material); mesh.position.copy(position); group.add(mesh);
    this.animate(mesh, material, updates, start, duration, t => mesh.scale.setScalar(size * (.6 + t * 2.2)), .72);
  }
  private ribbon(group: THREE.Group, updates: Updater[], points: THREE.Vector3[], color: number, width: number, start: number, duration: number): THREE.Mesh {
    const path = new THREE.CatmullRomCurve3(points);
    const vertices: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, point = path.getPoint(t), tangent = path.getTangent(t);
      const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
      if (normal.lengthSq() < .1) normal.set(0, 1, 0);
      const w = Math.sin(t * Math.PI) * width;
      for (const sign of [-1, 1]) vertices.push(point.x + normal.x * w * sign, point.y + normal.y * w * sign, point.z + normal.z * w * sign);
      if (i < 32) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices);
    const material = this.material(color); const mesh = new THREE.Mesh(geometry, material); group.add(mesh);
    this.animate(mesh, material, updates, start, duration, () => {}, .85); return mesh;
  }
  private projectile(group: THREE.Group, updates: Updater[], origin: THREE.Vector3, target: THREE.Vector3, color: number, core: number, width: number,impact:number): void {
    const a = origin.clone().add(new THREE.Vector3(0, 1.15, 0)), b = target.clone().add(new THREE.Vector3(0, 1.05, 0));
    const middle = a.clone().lerp(b, .5).add(new THREE.Vector3(0, .4, 0));
    this.ribbon(group, updates, [a, middle, b], color, width, .1, .35);
    this.ribbon(group, updates, [a, middle, b], core, width * .24, .13, .28);
    const material = new THREE.SpriteMaterial({ map: this.glow, color: core, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const orb = new THREE.Sprite(material); group.add(orb);
    this.animate(orb, material, updates, .06, Math.max(.04,impact-.06), t => { orb.position.copy(a).lerp(b, t); orb.position.y += Math.sin(t * Math.PI) * .4; orb.scale.setScalar(width * 4); });
  }
  private slash(group: THREE.Group, updates: Updater[], target: THREE.Vector3, color: number, core: number, start: number, radius: number, crossed: boolean): void {
    const slash = new THREE.Group(); slash.position.copy(target).add(new THREE.Vector3(0, 1, 0)); group.add(slash);
    for (let blade = 0; blade < (crossed ? 2 : 1); blade++) {
      const points = Array.from({ length: 9 }, (_, i) => { const a = -.9 + i / 8 * Math.PI * 1.3; return new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius * .75, 0); });
      const stroke = new THREE.Group(); stroke.rotation.z = blade ? -1.3 : .55; stroke.rotation.y = .35; slash.add(stroke);
      this.ribbon(stroke, updates, points, color, .21, start + blade * .06, .44);
      this.ribbon(stroke, updates, points, core, .045, start + blade * .06, .4);
    }
    updates.push(age => slash.scale.setScalar(.75 + Math.min(Math.max(age - start, 0), .5)));
  }
  private lightning(group: THREE.Group, updates: Updater[], from: THREE.Vector3, to: THREE.Vector3, color: number, core: number, start: number): void {
    const points = Array.from({ length: 13 }, (_, i) => {
      const p = from.clone().lerp(to, i / 12); if (i > 0 && i < 12) { p.x += Math.sin(i * 4.7) * .24; p.y += Math.cos(i * 3.2) * .17; p.z += Math.sin(i * 6.1) * .1; } return p;
    });
    // Polygonal lightning preserves sharp forks; a spline would turn bolts into ropes.
    const path = new THREE.CurvePath<THREE.Vector3>(); for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(points[i - 1], points[i]));
    for (const [c, radius] of [[color, .045], [core, .012]]) {
      const material = this.material(c); const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 36, radius, 4, false), material); group.add(mesh);
      this.animate(mesh, material, updates, start, .42, t => { material.opacity *= .65 + .35 * Math.sin(t * 55) ** 2; });
    }
  }
  private pillar(group: THREE.Group, updates: Updater[], position: THREE.Vector3, color: number, core: number, start: number, height: number): void {
    for (let i = 0; i < (this.reduced ? 2 : 4); i++) {
      const material = this.material(i === 0 ? core : color); material.map = this.glow;
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material); beam.position.copy(position).add(new THREE.Vector3(Math.sin(i * 2.4) * .2, height / 2, Math.cos(i * 2.4) * .18)); beam.rotation.y = i * Math.PI / 4; group.add(beam);
      this.animate(beam, material, updates, start + i * .025, .8, t => { beam.scale.set(.55 + Math.sin(t * Math.PI) * .45, height * (.65 + Math.sin(t * Math.PI) * .4), 1); beam.position.y = height / 2 + t * .2; }, i === 0 ? .72 : .44);
    }
  }
  private barrier(group: THREE.Group, updates: Updater[], position: THREE.Vector3, color: number, start: number, crystal: boolean): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .2, side: THREE.FrontSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, wireframe: crystal });
    const geometry = crystal ? new THREE.IcosahedronGeometry(1.1, 1) : new THREE.SphereGeometry(1.05, 20, 12);
    const shield = new THREE.Mesh(geometry, material); shield.position.copy(position).add(new THREE.Vector3(0, 1, 0)); group.add(shield);
    this.animate(shield, material, updates, start, 1.1, t => { shield.scale.setScalar(.8 + Math.sin(Math.min(t * 3, 1) * Math.PI / 2) * .3); shield.rotation.y = t * .7; }, crystal ? .55 : .14);
    this.circle(group, updates, position, color, 1.12, start, 1.1, false);
  }
  private flames(group: THREE.Group, updates: Updater[], position: THREE.Vector3, start: number, height: number): void {
    for(let i=0;i<(this.reduced?2:3);i++){
      const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
        uniforms:{age:{value:0}},
        vertexShader:`varying vec2 tex; void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader:`varying vec2 tex; uniform float age; void main(){float y=tex.y;float x=tex.x-.5;float curl=sin(y*16.-age*12.)*.065+sin(y*29.+age*9.)*.028;float width=(1.-y)*(.42+sin(y*21.-age*8.)*.08);float heat=clamp(1.-abs(x+curl)/max(width,.01),0.,1.);float taper=smoothstep(0.,.09,y)*pow(1.-y,.3);float fade=sin(clamp(age/.85,0.,1.)*3.14159);vec3 fire=mix(vec3(1.,.13,.015),vec3(1.,.87,.26),pow(heat,2.8));float alpha=pow(heat,.7)*taper*fade*.9;if(alpha<.015)discard;gl_FragColor=vec4(fire,alpha);}`,
      });
      const flame=new THREE.Mesh(new THREE.PlaneGeometry(1.7,height),material);flame.position.copy(position).add(new THREE.Vector3(Math.sin(i*2.4)*.15,height/2,Math.cos(i*2.4)*.15));flame.rotation.y=i*Math.PI/3;group.add(flame);
      updates.push(age=>{const t=age-start;flame.visible=t>=0&&t<.85;material.uniforms.age.value=Math.max(t,0);flame.scale.y=.7+Math.sin(Math.min(Math.max(t,0)/.85,1)*Math.PI)*.3;});
    }
  }
  private petals(group: THREE.Group, updates: Updater[], position: THREE.Vector3, color: number, start: number, count: number): void {
    if (this.reduced) count = Math.ceil(count / 2);
    for (let i = 0; i < count; i++) {
      const material = this.material(color); const petal = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), material); group.add(petal); const angle = i / count * TAU;
      this.animate(petal, material, updates, start + i * .013, .9, t => { const radius = .3 + t * .9; petal.position.copy(position).add(new THREE.Vector3(Math.cos(angle) * radius, .22 + Math.sin(t * Math.PI) * .3 + t * .65, Math.sin(angle) * radius)); petal.rotation.set(0, -angle, .5 + t); petal.scale.set(.09, .36 * (1 - t * .3), .055); }, .65);
    }
  }
  private crystals(group: THREE.Group, updates: Updater[], position: THREE.Vector3, color: number, core: number, start: number, count: number): void {
    if (this.reduced) count = Math.ceil(count / 2);
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshStandardMaterial({color:i%3===0?core:color,emissive:color,emissiveIntensity:.45,metalness:.32,roughness:.28,transparent:true,opacity:.9,depthWrite:false});
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), material); group.add(shard); const angle = i / count * TAU, height = 1.1 + (i % 3) * .5;
      this.animate(shard, material, updates, start + i * .022, .82, t => { shard.position.copy(position).add(new THREE.Vector3(Math.cos(angle) * .7, -.15 + height * .5 * Math.min(t * 5, 1), Math.sin(angle) * .7)); shard.scale.set(.16, height * .5 * Math.min(t * 5, 1), .16); shard.rotation.set(Math.cos(angle) * .2, angle, Math.sin(angle) * .2); }, .85);
    }
  }
  private vortex(group: THREE.Group, updates: Updater[], position: THREE.Vector3, color: number, core: number, start: number, height: number): void {
    const vortex = new THREE.Group(); vortex.position.copy(position); group.add(vortex);
    for (let strand = 0; strand < (this.reduced ? 2 : 3); strand++) {
      const points = Array.from({ length: 25 }, (_, i) => { const t = i / 24, a = t * TAU * 1.5 + strand * TAU / 3, radius = .6 + t * .35; return new THREE.Vector3(Math.cos(a) * radius, .1 + t * height, Math.sin(a) * radius); });
      this.ribbon(vortex, updates, points, strand === 0 ? core : color, .075, start, .9);
    }
    updates.push(age => { vortex.rotation.y = (age - start) * 9; vortex.scale.setScalar(.8 + Math.max(0, age - start) * .3); });
  }
  private eclipse(group: THREE.Group, updates: Updater[], position: THREE.Vector3, color: number, start: number): void {
    const material = this.material(color); const eclipse = new THREE.Mesh(new THREE.RingGeometry(.82, 1, 64), material); eclipse.position.copy(position).add(new THREE.Vector3(0, 1.4, 0)); eclipse.rotation.y = .2; group.add(eclipse);
    this.animate(eclipse, material, updates, start, .75, t => eclipse.scale.setScalar(.6 + Math.sin(t * Math.PI) * .7), .85);
  }
  private particles(group: THREE.Group, updates: Updater[], position: THREE.Vector3, color: number, core: number, start: number, support: boolean, ultimate: boolean): void {
    const count = (ultimate ? 100 : 52) * (this.reduced ? .5 : 1);
    const positions = new Float32Array(count * 3), velocities = new Float32Array(count * 3), seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399963, spread = .8 + (i % 9) / 9 * 1.4;
      positions[i * 3] = support ? Math.cos(angle) * .65 : 0;
      positions[i * 3 + 1] = support ? (i % 7) * .08 : .65;
      positions[i * 3 + 2] = support ? Math.sin(angle) * .65 : 0;
      velocities[i * 3] = Math.cos(angle) * spread * (support ? .15 : 1);
      velocities[i * 3 + 1] = support ? 1.3 + (i % 5) * .16 : .8 + (i % 7) * .25;
      velocities[i * 3 + 2] = Math.sin(angle) * spread * (support ? .15 : 1);
      seeds[i] = (i % 11) / 11;
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3)); geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { age: { value: 0 }, color: { value: new THREE.Color(color) }, core: { value: new THREE.Color(core) }, gravity: { value: support ? 0 : 1.3 }, scale: { value: Math.min(window.devicePixelRatio || 1, 1.5) * 62 } },
      vertexShader: `attribute vec3 velocity; attribute float seed; uniform float age; uniform float gravity; uniform float scale; varying float life; varying float sparkle; void main(){ float t=max(age-seed*.12,0.0); vec3 p=position+velocity*t; p.y-=gravity*t*t; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; life=max(0.0,1.0-t/1.05); sparkle=seed; gl_PointSize=clamp(scale*(.6+seed)*life/-mv.z,1.0,16.0); }`,
      fragmentShader: `uniform vec3 color; uniform vec3 core; varying float life; varying float sparkle; void main(){ vec2 p=gl_PointCoord*2.0-1.0; float r=length(p); if(r>1.0)discard; float glow=pow(max(0.0,1.0-r),2.0); float star=max(0.0,1.0-abs(p.x)*10.0)*max(0.0,1.0-abs(p.y)) + max(0.0,1.0-abs(p.y)*10.0)*max(0.0,1.0-abs(p.x)); gl_FragColor=vec4(mix(color,core,glow),min(1.0,glow+star*.45)*life); }`,
    });
    const points = new THREE.Points(geometry, material); points.position.copy(position); points.frustumCulled = false; group.add(points);
    updates.push(age => { const t = age - start; points.visible = t >= 0 && t < 1.15; material.uniforms.age.value = Math.max(0, t); });
  }
  private makeGlow(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128; const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.12, 'rgba(255,255,255,.8)'); gradient.addColorStop(.38, 'rgba(255,255,255,.22)'); gradient.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }
  private makeSigil(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512; const ctx = canvas.getContext('2d')!;
    ctx.translate(256, 256); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
    for (const radius of [155, 189, 222, 234]) { ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 32; i++) { ctx.save(); ctx.rotate(i / 32 * TAU); ctx.beginPath(); ctx.moveTo(0, 194); ctx.lineTo(0, 214); ctx.moveTo(-4, 202); ctx.lineTo(4, 206); ctx.moveTo(-3, 209); ctx.lineTo(4, 199); ctx.stroke(); ctx.restore(); }
    for (const offset of [0, Math.PI / 3]) { ctx.beginPath(); for (let i = 0; i <= 3; i++) { const a = offset + i / 3 * TAU; const x = Math.cos(a) * 150, y = Math.sin(a) * 150; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.lineWidth = 5; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 230, Math.sin(a) * 230, 5, 0, TAU); ctx.stroke(); }
    return new THREE.CanvasTexture(canvas);
  }
}
