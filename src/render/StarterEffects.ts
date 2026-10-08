import * as THREE from 'three';
import type { SkillCue } from './SkillVfx';

type Update=(age:number)=>void;
interface Resources { sigil:THREE.Texture; glow:THREE.Texture; reduced:boolean }
const UP=new THREE.Vector3(0,1,0);

/** Original starter effects. Every visual follows the same authored impact clock as damage. */
export function addStarterEffects(cue:SkillCue,root:THREE.Group,updates:Update[],resources:Resources):void {
  const knight=cue.heroId==='kael',basic=cue.slot<0;
  const color=knight?0xffd087:0xb9dcff,core=knight?0xfff4d8:0xffefff;
  const hit=cue.impactDelay,targets=cue.targets.length?cue.targets:[cue.origin];
  const mat=(c:number,opacity=1)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const timed=(object:THREE.Object3D,material:THREE.Material&{opacity:number},start:number,duration:number,opacity:number,update?:(t:number)=>void)=>{
    updates.push(age=>{const t=(age-start)/duration;object.visible=t>=0&&t<1&&!(cue.impactConfirmed===false&&start>=hit-.0001);if(!object.visible)return;material.opacity=opacity*Math.min(1,t*10)*Math.pow(1-t,.65);update?.(t);});
  };
  const anchor=(point:THREE.Vector3,index?:number)=>{
    const group=new THREE.Group();group.position.copy(point);root.add(group);
    if(index!==undefined)updates.push(age=>{
      const points=cue.targetPositions?.();if(points?.[index])group.position.copy(points[index]);
      group.visible=age<hit||cue.impactConfirmed===undefined||(cue.impactConfirmed&&(!cue.targetIds||cue.impactTargets?.includes(cue.targetIds[index])===true));
    });
    return group;
  };
  const rune=(parent:THREE.Group,size:number,start:number,duration:number,c=color)=>{
    const material=mat(c);material.map=resources.sigil;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.06;parent.add(mesh);
    timed(mesh,material,start,duration,.38,t=>{mesh.scale.setScalar(size*(.94+t*.1));mesh.rotation.z=t*.16;});
  };
  const ring=(parent:THREE.Group,size:number,start:number,duration:number,c=color)=>{
    const material=mat(c),mesh=new THREE.Mesh(new THREE.RingGeometry(.93,1,48),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.065;parent.add(mesh);
    timed(mesh,material,start,duration,.68,t=>mesh.scale.setScalar(size*(.25+t*1.2)));
  };
  const glow=(parent:THREE.Group,position:THREE.Vector3,size:number,start:number,duration:number,c=core)=>{
    const material=new THREE.SpriteMaterial({map:resources.glow,color:c,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    const sprite=new THREE.Sprite(material);sprite.position.copy(position);parent.add(sprite);
    timed(sprite,material,start,duration,.43,t=>sprite.scale.setScalar(size*(.4+Math.sin(t*Math.PI)*.7)));
    return sprite;
  };
  const beam=(parent:THREE.Group,height:number,start:number,duration:number)=>{
    for(let i=0;i<2;i++){
      const material=mat(i?color:core);material.map=resources.glow;
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(i?.44:.15,height),material);mesh.position.y=height/2;mesh.rotation.y=i*Math.PI/2;parent.add(mesh);
      timed(mesh,material,start,duration,i?.34:.64,t=>{mesh.scale.y=.85+Math.sin(t*Math.PI)*.15;});
    }
  };
  const motes=(parent:THREE.Group,start:number,healing:boolean,count:number)=>{
    count=resources.reduced?Math.ceil(count/2):count;
    const positions=new Float32Array(count*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const material=new THREE.PointsMaterial({color:core,size:.045,map:resources.glow,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    const points=new THREE.Points(geometry,material);parent.add(points);
    updates.push(age=>{const t=age-start;points.visible=t>=0&&t<.85&&cue.impactConfirmed!==false;if(!points.visible)return;material.opacity=Math.pow(1-t/.85,.7);for(let i=0;i<count;i++){const angle=i*2.399963+(healing?t*1.3:0),radius=healing?.45+Math.sin(i)*.16:t*(.7+(i%5)*.14);positions[i*3]=Math.cos(angle)*radius;positions[i*3+1]=healing?.15+t*(.85+i%3*.2):.55+t*(.4+i%5*.19)-t*t*.65;positions[i*3+2]=Math.sin(angle)*radius;}geometry.attributes.position.needsUpdate=true;});
  };
  const source=anchor(cue.origin);
  if(!basic)rune(source,cue.slot===2?.86:.62,0,Math.max(.45,hit+.24));

  // A short, bone-attached strip follows the actual blade path; it never substitutes for contact.
  const weaponTrail=(start:number,end:number)=>{
    if(!cue.weaponTip||!cue.weaponBase)return;
    const samples=resources.reduced?7:12,positions=new Float32Array(samples*6),uv=new Float32Array(samples*4),indices:number[]=[];
    for(let i=0;i<samples;i++){uv.set([0,i/(samples-1),1,i/(samples-1)],i*4);if(i<samples-1){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);
    const material=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{color:{value:new THREE.Color(color)},opacity:{value:0}},vertexShader:'varying vec2 t;void main(){t=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 t;uniform vec3 color;uniform float opacity;void main(){float feather=sin(t.x*3.14159)*pow(1.-t.y,1.6);gl_FragColor=vec4(color,feather*opacity);}'});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;root.add(mesh);
    let lastAge=-1,initialized=false;
    updates.push(age=>{mesh.visible=age>=start&&age<end;if(!mesh.visible||age===lastAge)return;lastAge=age;const tip=cue.weaponTip!(),base=cue.weaponBase!().lerp(tip,.22);if(!initialized){for(let i=0;i<samples;i++)positions.set([...base.toArray(),...tip.toArray()],i*6);initialized=true;}else positions.copyWithin(6,0,positions.length-6);positions.set([...base.toArray(),...tip.toArray()],0);geometry.attributes.position.needsUpdate=true;material.uniforms.opacity.value=.56*Math.min(1,(age-start)*18,(end-age)*12);});
  };

  if(basic){
    if(knight)weaponTrail(Math.max(0,hit-.2),hit+.16);
    else {
      const charge=glow(root,cue.origin.clone().add(UP),.4,0,hit);
      updates.push(()=>{if(cue.weaponTip)charge.position.copy(cue.weaponTip());});
      for(const [index,point] of targets.entries()){
        const target=anchor(point,index);glow(target,new THREE.Vector3(0,1,0),.38,hit,.22);
        const vertices=new Float32Array(6),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
        const material=new THREE.LineBasicMaterial({color:core,transparent:true,opacity:.42,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
        const ray=new THREE.Line(geometry,material);ray.frustumCulled=false;root.add(ray);
        updates.push(age=>{const t=(age-hit)/.12;ray.visible=t>=0&&t<1;if(!ray.visible)return;const start=cue.weaponTip?.()??cue.origin.clone().add(UP);const end=(cue.targetPositions?.()[index]??point).clone().add(UP);vertices.set(start.toArray(),0);vertices.set(end.toArray(),3);geometry.attributes.position.needsUpdate=true;material.opacity=.42*(1-t);});
      }
    }
    return;
  }

  if(knight&&cue.slot===0){
    weaponTrail(hit-.23,hit+.23);
    for(const[index,point]of targets.entries()){
      const target=anchor(point,index),material=mat(core);
      const slash=new THREE.Mesh(new THREE.RingGeometry(.85,.94,36,1,-1.1,2.2),material);slash.position.y=1.05;slash.rotation.set(.15,-cue.facing+.25,-.5);target.add(slash);
      timed(slash,material,hit,.28,.65,t=>{slash.rotation.z=-.5+t*.5;slash.scale.setScalar(.8+t*.25);});motes(target,hit,false,18);
    }
  }else if(knight&&cue.slot===1){
    const charge=glow(root,cue.origin.clone().add(UP),.62,.08,hit-.05);updates.push(()=>{if(cue.weaponTip)charge.position.copy(cue.weaponTip());});
    for(const[index,point]of targets.entries()){
      const target=anchor(point,index);rune(target,.6,hit,.74);ring(target,.84,hit,.65);
      const shape=new THREE.Shape();shape.moveTo(-.42,.48);shape.lineTo(0,.7);shape.lineTo(.42,.48);shape.lineTo(.35,-.2);shape.lineTo(0,-.54);shape.lineTo(-.35,-.2);shape.closePath();
      const material=mat(color),ward=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);ward.position.set(.15,1.05,.22);ward.rotation.y=cue.facing;target.add(ward);
      timed(ward,material,hit,.82,.22,t=>{ward.scale.setScalar(.65+Math.min(t*4,1)*.35);ward.position.y=1+t*.14;});motes(target,hit,true,10);
    }
  }else if(knight){
    weaponTrail(hit-.28,hit+.19);
    for(const[index,point]of targets.entries()){
      const target=anchor(point,index);rune(target,.68,hit-.32,.47);beam(target,3.0,hit,.3);ring(target,1.38,hit,.6);motes(target,hit,false,resources.reduced?14:24);
    }
  }else if(cue.slot===0){
    const prayer=glow(root,cue.origin.clone().add(UP),.7,.06,hit+.1);updates.push(()=>{if(cue.weaponTip)prayer.position.copy(cue.weaponTip());});
    for(const[index,point]of targets.entries()){
      const target=anchor(point,index);rune(target,.66,hit,.78);motes(target,hit,true,22);glow(target,new THREE.Vector3(0,.85,0),.82,hit,.63);
      for(let i=0;i<2;i++){
        const material=mat(core),cross=new THREE.Mesh(new THREE.PlaneGeometry(i?.11:.35,i?.35:.11),material);cross.position.set(0,1.28,.1);target.add(cross);timed(cross,material,hit,.56,.56,t=>{cross.position.y=1.28+t*.3;});
      }
    }
  }else if(cue.slot===1){
    const charge=glow(root,cue.origin.clone().add(UP),.58,.08,hit);updates.push(()=>{if(cue.weaponTip)charge.position.copy(cue.weaponTip());});
    for(const[index,point]of targets.entries()){
      const target=anchor(point,index);rune(target,.72,hit,.83);
      for(let i=0;i<(resources.reduced?2:3);i++){
        const shape=new THREE.Shape();shape.moveTo(0,.75);shape.lineTo(.32,.33);shape.lineTo(.25,-.45);shape.lineTo(0,-.66);shape.lineTo(-.25,-.45);shape.lineTo(-.32,.33);shape.closePath();
        const material=mat(i===1?core:color),panel=new THREE.Mesh(new THREE.ShapeGeometry(shape),material),angle=i/3*Math.PI*2+.25;
        panel.position.set(Math.sin(angle)*.7,1,Math.cos(angle)*.7);panel.rotation.y=angle;target.add(panel);
        timed(panel,material,hit+i*.025,.88,.2,t=>{panel.scale.y=.4+Math.min(t*5,1)*.6;panel.position.y=.9+Math.min(t*5,1)*.1;});
      }
      motes(target,hit,true,10);
    }
  }else{
    const charge=glow(root,cue.origin.clone().add(UP),.85,.08,hit);updates.push(()=>{if(cue.weaponTip)charge.position.copy(cue.weaponTip());});
    for(const[index,point]of targets.entries()){
      const target=anchor(point,index);rune(target,.8,hit-.38,.58);beam(target,3.8,hit,.4);ring(target,1.05,hit,.62);motes(target,hit,false,22);
      const material=mat(core),halo=new THREE.Mesh(new THREE.RingGeometry(.34,.38,40),material);halo.rotation.x=-Math.PI/2;halo.position.y=2.7;target.add(halo);timed(halo,material,hit-.2,.52,.5,t=>{halo.rotation.z=t;});
    }
  }
}
