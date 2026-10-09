import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createReviewEnvironment} from './ReviewEnvironment';
import {createReviewEffects,REVIEW_BEATS as B,type BladeSample} from './ReviewEffects';

export interface ReviewState {phase:string;time:number;playing:boolean;ready:boolean}
export interface ReviewOptions {backgroundUrl?:string}
interface Actor {id:string;group:THREE.Group;model:THREE.Group;mixer:THREE.AnimationMixer;actions:Map<string,THREE.AnimationAction>;current?:THREE.AnimationAction;clip:string;tip?:THREE.Object3D;hand?:THREE.Object3D;height:number;center:THREE.Vector3;size:THREE.Vector3}
const V=THREE.Vector3;
const clamp=THREE.MathUtils.clamp;
const smooth=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const duration:Record<string,number>={Idle:2.4,Run:.72,Attack_01:.92,Skill_01:1.15,Hit:.45,Death:1.4,Victory:2};

/** A presentation study with its own clock: no campaign, saves, damage rules, or economy. */
export async function createCombatReview(container:HTMLElement,onState:(state:ReviewState)=>void,options:ReviewOptions={}){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x172b2a);scene.fog=new THREE.Fog(0x233c34,12,42);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.domElement.style.cssText='width:100%;height:100%;display:block';renderer.domElement.setAttribute('aria-label','ฉากทดลองภาพและจังหวะ: อัศวิน นักบวช และผู้พิทักษ์');container.appendChild(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(32,1,.1,90);
 const ambient=new THREE.HemisphereLight(0xbbd8e6,0x253327,.9);scene.add(ambient);
 const key=new THREE.DirectionalLight(0xffe1b4,3.1);key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-7,right:7,top:5,bottom:-5,near:.2,far:24});key.shadow.normalBias=.025;key.shadow.bias=-.0002;key.shadow.radius=3;scene.add(key);
 const rim=new THREE.DirectionalLight(0x83c4d3,2.0);rim.position.set(1,4,-5);scene.add(rim);
 const fill=new THREE.DirectionalLight(0xf1ebd4,.32);fill.position.set(4,2,4);scene.add(fill);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.08);scene.environment=environment.texture;scene.environmentIntensity=.25;room.dispose();pmrem.dispose();
 const set=createReviewEnvironment(scene,options.backgroundUrl);
 let time=0,playing=true,ready=false,rate=1,soundEnabled=false,disposed=false,last=performance.now(),animationFrame=0,hold=0,holdMask=0,notifyAt=-1;
 let effects:ReturnType<typeof createReviewEffects>|undefined;
 let resizeObserver:ResizeObserver|undefined;
 const audio=new ReviewAudio();
 const loader=new GLTFLoader(),actors:Actor[]=[];
 const base=import.meta.env.BASE_URL;
 const state=():ReviewState=>({phase:phase(time),time,playing,ready});
 const notify=()=>{onState(state());container.dataset.reviewPhase=phase(time);container.dataset.reviewTime=time.toFixed(3);};
 function phase(t:number){return t<.8?'ประจันหน้า':t<2.5?'ก้าวเข้าระยะดาบ':t<3?'ตั้งหลัก':t<4.1?'คมดาบ · โจมตีประชิด':t<5?'คืนท่าป้องกัน':t<6.1?'รับแรงปะทะ':t<7?'เตรียมคมดาบรุ่งอรุณ':t<8.5?'คมดาบรุ่งอรุณ · ฟันหนัก':t<10.3?'ผ่อนแรงและตั้งหลัก':t<11.8?'คำภาวนาเยียวยา':t<17.9?'กลับสู่ท่าเตรียมพร้อม':'จบฉากทดลอง';}
 notify();
 async function load(id:string,url:string,height:number):Promise<Actor>{
  const gltf=await loader.loadAsync(url);gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new V()),center=bounds.getCenter(new V());
  const origin=gltf.scene.getObjectByName('root');if(origin){const point=origin.getWorldPosition(new V());center.x=point.x;center.z=point.z;}
  const group=new THREE.Group();group.name=id;const model=gltf.scene;
  const scale=height/size.y;model.scale.multiplyScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);group.add(model);scene.add(group);
  model.traverse(node=>{if(node instanceof THREE.Mesh){node.castShadow=node.receiveShadow=true;node.frustumCulled=false;for(const material of Array.isArray(node.material)?node.material:[node.material])if(material instanceof THREE.MeshStandardMaterial){material.envMapIntensity=.4;material.roughness=Math.max(.38,material.roughness);}}});
  const mixer=new THREE.AnimationMixer(model),actions=new Map(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
  if(!actions.has('Idle')||!actions.has('Run')||!actions.has('Attack_01'))throw new Error(`${id}: required authored animation is missing`);
  const socket=(name:string)=>model.getObjectByName(name)??model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
  const actor:Actor={id,group,model,mixer,actions,clip:'',tip:socket(id==='Lyra'?'staff_tip':'sword_tip'),hand:socket('hand.R'),height,center,size:size.multiplyScalar(scale)};actors.push(actor);return actor;
 }
 let knight:Actor,healer:Actor,enemy:Actor;
 try{
  [knight,healer]=await Promise.all([load('Kael',`${base}assets/quality/knight.glb`,1.9),load('Lyra',`${base}assets/quality/priestess.glb`,1.95)]);
  enemy=await load('Guardian',`${base}assets/tiger.glb`,1.58);
 }catch(error){dispose();throw error;}
 const endpoints={knight:new V(-.68,0,.38),healer:new V(-2.5,0,-.1),enemy:new V(1.3,0,.2),contact:new V(.6,1,.3)};
 const knightYaw=Math.PI/2-.08,cleaveYaw=knightYaw-.4;
 let contactGaps:{basic?:{distance:number;surface:number[];blade:number[]};cleave?:{distance:number;surface:number[];blade:number[]}}={};
 let portrait=false;
 function pose(actor:Actor,name:string,seconds:number,desiredDuration?:number){
  const next=actor.actions.get(name)??actor.actions.get('Idle')!;
  if(next!==actor.current||actor.clip!==next.getClip().name){actor.mixer.stopAllAction();next.reset().setEffectiveWeight(1).play();next.enabled=true;next.paused=false;actor.current=next;actor.clip=next.getClip().name;}
  const clipDuration=next.getClip().duration,loop=name==='Idle'||name==='Run';
  next.time=loop?Math.max(0,seconds)%clipDuration:clamp(seconds/(desiredDuration??duration[name]??clipDuration)*clipDuration,0,clipDuration-.00001);
  actor.mixer.update(0);actor.group.updateMatrixWorld(true);
 }
 function arrive(actor:Actor,runSeconds:number,idleSeconds:number,idleWeight:number){
  const run=actor.actions.get('Run')!,idle=actor.actions.get('Idle')!;
  if(actor.clip!=='Run → Idle'){
   actor.mixer.stopAllAction();run.reset().play();idle.reset().play();actor.clip='Run → Idle';actor.current=idle;
  }
  // Both clips are sampled from the same review clock; seeking has no transition history.
  run.setEffectiveWeight(1-idleWeight);idle.setEffectiveWeight(idleWeight);
  run.time=Math.max(0,runSeconds)%run.getClip().duration;idle.time=Math.max(0,idleSeconds)%idle.getClip().duration;
  actor.mixer.update(0);actor.group.updateMatrixWorld(true);
 }
 const socket=(actor:Actor,tip:boolean)=>{actor.group.updateMatrixWorld(true);return(tip?actor.tip:actor.hand)?.getWorldPosition(new V())??actor.group.localToWorld(new V(0,1.0,.3));};
 function bladeTrack(clip:string,hit:number,clipDuration:number):BladeSample[]{
  const result:BladeSample[]=[];for(let i=0;i<25;i++){pose(knight,clip,hit-.19+i/24*.27,clipDuration);result.push({tip:socket(knight,true),base:socket(knight,false)});}return result;
 }
 function measureContact(){
  const tip=socket(knight,true),base=socket(knight,false).lerp(tip,.28),blade=new THREE.Line3(base,tip),vertex=new V(),nearest=new V(),surface=new V(),onBlade=new V();let distance=Infinity;
  enemy.group.updateMatrixWorld(true);
  enemy.model.traverse(node=>{if(!(node instanceof THREE.Mesh))return;if(node instanceof THREE.SkinnedMesh)node.skeleton.update();for(let i=0;i<node.geometry.attributes.position.count;i++){node.getVertexPosition(i,vertex).applyMatrix4(node.matrixWorld);blade.closestPointToPoint(vertex,true,nearest);const gap=nearest.distanceTo(vertex);if(gap<distance){distance=gap;surface.copy(vertex);onBlade.copy(nearest);}}});
  return{distance,surface:surface.toArray(),blade:onBlade.toArray()};
 }
 function layout(){
  const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);portrait=height>width;
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=portrait?36:32;camera.updateProjectionMatrix();
  set.resize(width,height);
  endpoints.healer.set(portrait?-1.05:-2.5,0,portrait?-2.1:-.1);
  knight.group.position.copy(endpoints.knight);knight.group.rotation.y=knightYaw;healer.group.rotation.y=Math.PI/2-.18;enemy.group.rotation.y=-Math.PI/2+.1;
  pose(knight,'Attack_01',.42,.92);const tip=socket(knight,true);endpoints.contact.copy(tip);
  enemy.group.position.set(0,0,0);pose(enemy,'Idle',0);const enemyBounds=new THREE.Box3().setFromObject(enemy.group);
  endpoints.enemy.set(tip.x-enemyBounds.min.x*.82,0,tip.z+.05);
  enemy.group.position.copy(endpoints.enemy);pose(enemy,'Hit',0,.45);
  pose(knight,'Attack_01',.42,.92);contactGaps={basic:measureContact()};
  const basic=bladeTrack('Attack_01',.42,.92);
  knight.group.rotation.y=cleaveYaw;
  const cleave=bladeTrack('Skill_01',.48,1.15);
  pose(knight,'Skill_01',.48,1.15);const cleaveContact=socket(knight,true);contactGaps.cleave=measureContact();
  effects?.dispose();effects=createReviewEffects(scene,camera,{basic:endpoints.contact,cleave:cleaveContact},{basic,cleave},()=>socket(healer,true),()=>knight.group.position.clone());
  render(time);
 }
 function render(t:number){
  const approach=smooth((t-.8)/1.55);
  knight.group.position.copy(endpoints.knight);knight.group.position.x-=(portrait?.85:1.6)*(1-approach);
  knight.group.rotation.y=THREE.MathUtils.lerp(knightYaw,cleaveYaw,smooth((t-6.1)/.7));
  healer.group.position.copy(endpoints.healer);healer.group.position.x-=(portrait?.2:.6)*(1-approach);
  enemy.group.position.copy(endpoints.enemy);enemy.group.position.x+=(portrait?.45:1.0)*(1-approach);
  const basicHit=t-B.basicImpact,strongHit=t-B.cleaveImpact,counterHit=t-B.counterImpact;
  const recoil=(age:number,amount:number)=>age>=0&&age<.6?Math.sin(Math.min(1,age/.16)*Math.PI/2)*Math.exp(-Math.max(0,age-.12)*5)*amount:0;
  enemy.group.position.x+=recoil(basicHit,.12)+recoil(strongHit,.27);knight.group.position.x-=recoil(counterHit,.09);
  if(t>=.8&&t<2.19){pose(knight,'Run',(t-.8)*.98);pose(healer,'Run',(t-.8)*.68);pose(enemy,'Run',(t-.8)*.88);}
  else if(t>=2.19&&t<2.35){const weight=smooth((t-2.19)/.16);arrive(knight,(t-.8)*.98,t*.82,weight);arrive(healer,(t-.8)*.68,t*.82+.3,weight);arrive(enemy,(t-.8)*.88,t*.85,weight);}
  else{
   if(t>=B.basic&&t<B.basic+.92)pose(knight,'Attack_01',t-B.basic,.92);
   else if(t>=B.counterImpact&&t<B.counterImpact+.45)pose(knight,'Hit',t-B.counterImpact,.45);
   else if(t>=6.1&&t<6.8)arrive(knight,(t-6.1)/.7*.72,t*.82,1-.8*Math.sin((t-6.1)/.7*Math.PI));
   else if(t>=B.cleave&&t<B.cleave+1.15)pose(knight,'Skill_01',t-B.cleave,1.15);
   else pose(knight,'Idle',t*.82);
   if(t>=B.heal&&t<B.heal+1.3)pose(healer,'Skill_01',t-B.heal,1.3);else pose(healer,'Idle',t*.82+.3);
   if(t>=B.counter&&t<B.counter+.95)pose(enemy,'Attack_01',t-B.counter,.95);
   else if(strongHit>=0&&strongHit<.62)pose(enemy,'Hit',strongHit,.62);
   else if(basicHit>=0&&basicHit<.45)pose(enemy,'Hit',basicHit,.45);
   else pose(enemy,'Idle',t*.85);
  }
  const distance=portrait?THREE.MathUtils.lerp(16.4,14.2,approach):THREE.MathUtils.lerp(8.6,7.25,approach);
  const punch=strongHit>=0&&strongHit<.45?Math.exp(-strongHit*10):0;
  const focusX=portrait?.55:.0;
  camera.position.set(portrait?-.7:.3,(portrait?3.4:2.35)-punch*.045,distance-punch*.14);
  camera.lookAt(focusX+punch*.018,portrait?.98:.96,endpoints.knight.z-.15);
  effects?.update(t);renderer.render(scene,camera);
 }
 function advance(dt:number){
  if(hold>0){const consumed=Math.min(hold,dt);hold-=consumed;dt-=consumed;if(dt<=0)return;}
  const hits=[{time:B.basicImpact,hold:.035,kind:'strike' as const},{time:B.counterImpact,hold:0,kind:'counter' as const},{time:B.cleaveImpact,hold:.075,kind:'cleave' as const},{time:B.healImpact,hold:0,kind:'heal' as const}];
  let next=Math.min(B.end,time+dt);
  for(let i=0;i<hits.length;i++){const hit=hits[i];if(!(holdMask&(1<<i))&&time<=hit.time&&next>=hit.time){holdMask|=1<<i;if(soundEnabled)audio.hit(hit.kind);if(hit.hold){next=hit.time;hold=hit.hold;break;}}}
  time=next;if(time>=B.end)playing=false;
 }
 function loop(now:number){if(disposed)return;const dt=Math.min((now-last)/1000,.07);last=now;if(playing){advance(dt*rate);render(time);}if(Math.abs(time-notifyAt)>.04||(!playing&&notifyAt!==time)){notifyAt=time;notify();}animationFrame=requestAnimationFrame(loop);}
 resizeObserver=new ResizeObserver(()=>layout());resizeObserver.observe(container);layout();ready=true;notify();last=performance.now();animationFrame=requestAnimationFrame(loop);
 function reset(){time=0;hold=0;holdMask=0;audio.stop();render(time);notify();}
 function dispose(){
  if(disposed)return;disposed=true;cancelAnimationFrame(animationFrame);resizeObserver?.disconnect();effects?.dispose();audio?.dispose();set.dispose();
  const geometry=new Set<THREE.BufferGeometry>(),material=new Set<THREE.Material>(),texture=new Set<THREE.Texture>();
  for(const actor of actors){actor.mixer.stopAllAction();actor.model.traverse(node=>{if(node instanceof THREE.Mesh){geometry.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material]){material.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)texture.add(value);}}});}
  geometry.forEach(g=>g.dispose());material.forEach(m=>m.dispose());texture.forEach(t=>t.dispose());environment.dispose();renderer.dispose();renderer.domElement.remove();
 }
 const api={play(){if(time>=B.end)reset();if(soundEnabled)audio.resume();playing=true;last=performance.now();notify();},pause(){playing=false;audio.stop();notify();},restart(){reset();playing=true;if(soundEnabled)audio.resume();last=performance.now();notify();},setSpeed(speed:number){rate=clamp(speed,.25,2);},setSound(enabled:boolean){soundEnabled=enabled;if(enabled)audio.resume();else audio.stop();notify();},seek(seconds:number){playing=false;time=clamp(seconds,0,B.end);hold=0;holdMask=[B.basicImpact,B.counterImpact,B.cleaveImpact,B.healImpact].reduce((mask,beat,i)=>time>=beat?mask|(1<<i):mask,0);audio.stop();render(time);notify();},dispose};
 const diagnostics=()=>({ ...state(),speed:rate,soundEnabled,hold,beats:{...B},contact:endpoints.contact.toArray(),contactGaps,actors:actors.map(actor=>{
  const bounds=new THREE.Box3().setFromObject(actor.group),points=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new V(x,y,z).project(camera));
  const width=container.clientWidth,height=container.clientHeight;
  return{id:actor.id,clip:actor.clip,clipTime:actor.current?.time,position:actor.group.position.toArray(),weaponTip:actor.tip?socket(actor,true).toArray():null,screen:{left:Math.min(...points.map(p=>(p.x+1)*width/2)),right:Math.max(...points.map(p=>(p.x+1)*width/2)),top:Math.min(...points.map(p=>(1-p.y)*height/2)),bottom:Math.max(...points.map(p=>(1-p.y)*height/2))}};
 }),drawCalls:renderer.info.render.calls});
 Object.defineProperty(window,'aetheriaReview',{configurable:true,value:{...api,get state(){return diagnostics();},snapshot:diagnostics}});
 return api;
}

class ReviewAudio{
 private context?:AudioContext;private nodes:AudioScheduledSourceNode[]=[];
 resume(){this.context??=new AudioContext();void this.context.resume();}
 hit(kind:'strike'|'counter'|'cleave'|'heal'){
  const c=this.context;if(!c||c.state!=='running')return;const now=c.currentTime;
  if(kind==='heal'){
   for(const [index,note]of [523.25,659.25,783.99].entries()){const source=c.createOscillator(),gain=c.createGain();source.type='sine';source.frequency.value=note;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.045,now+.02+index*.035);gain.gain.exponentialRampToValueAtTime(.0001,now+.65);source.connect(gain).connect(c.destination);source.start(now+index*.035);source.stop(now+.7);this.nodes.push(source);}return;
  }
  const heavy=kind==='cleave',length=heavy?.21:.12,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*length),c.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='highpass';filter.frequency.value=heavy?700:1400;gain.gain.value=heavy?.18:.1;source.connect(filter).connect(gain).connect(c.destination);source.start();this.nodes.push(source);
  const low=c.createOscillator(),envelope=c.createGain();low.type='sine';low.frequency.setValueAtTime(heavy?150:240,now);low.frequency.exponentialRampToValueAtTime(45,now+.14);envelope.gain.setValueAtTime(heavy?.16:.065,now);envelope.gain.exponentialRampToValueAtTime(.0001,now+.2);low.connect(envelope).connect(c.destination);low.start();low.stop(now+.22);this.nodes.push(low);
 }
 stop(){for(const node of this.nodes){try{node.stop();}catch{}node.disconnect();}this.nodes=[];}
 dispose(){this.stop();void this.context?.close();}
}
