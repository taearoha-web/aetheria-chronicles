import * as THREE from 'three';
export interface BladeSample {base:THREE.Vector3;tip:THREE.Vector3}
export const REVIEW_BEATS={basic:3,basicImpact:3.42,counter:5,counterImpact:5.46,cleave:7,cleaveImpact:7.48,heal:10.3,healImpact:10.88,end:18};

/** Fixed, authored effects sampled only from the review clock. */
export function createReviewEffects(scene:THREE.Scene,camera:THREE.Camera,contact:{basic:THREE.Vector3;cleave:THREE.Vector3},tracks:{basic:BladeSample[];cleave:BladeSample[]},staff:()=>THREE.Vector3,knight:()=>THREE.Vector3){
 const root=new THREE.Group();root.name='Authored contact effects';scene.add(root);
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 const updates:((time:number)=>void)[]=[];
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
 const glow=ctx.createRadialGradient(64,64,1,64,64,64);glow.addColorStop(0,'rgba(255,255,245,1)');glow.addColorStop(.13,'rgba(255,250,217,.96)');glow.addColorStop(.38,'rgba(255,255,255,.3)');glow.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,128,128);
 const glowTexture=new THREE.CanvasTexture(canvas);textures.add(glowTexture);
 const add=(geometry:THREE.BufferGeometry,material:THREE.Material)=>{geometries.add(geometry);materials.add(material);const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;root.add(mesh);return mesh;};
 const sprite=(color:number,size:number)=>{const material=new THREE.SpriteMaterial({map:glowTexture,color,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});materials.add(material);const node=new THREE.Sprite(material);node.scale.setScalar(size);root.add(node);return node;};
 const blade=(samples:BladeSample[],start:number,hit:number,strong:boolean)=>{
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  samples.forEach((sample,i)=>{const base=sample.base.clone().lerp(sample.tip,.28);positions.push(...base.toArray(),...sample.tip.toArray());uv.push(0,i/(samples.length-1),1,i/(samples.length-1));if(i<samples.length-1){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{progress:{value:0},opacity:{value:0},gold:{value:new THREE.Color(strong?0xffad36:0xffd382)}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float progress;uniform float opacity;uniform vec3 gold;void main(){if(v.y>progress)discard;float edge=sin(v.x*3.14159);float tail=smoothstep(progress-.6,progress,v.y);vec3 c=mix(gold,vec3(1.,.98,.82),pow(edge,5.));gl_FragColor=vec4(c,edge*tail*opacity);}'});
  const mesh=add(geometry,material);
  updates.push(time=>{const age=time-start;mesh.visible=age>=hit-.19&&age<=hit+.28;material.uniforms.progress.value=THREE.MathUtils.clamp((age-(hit-.19))/.27,0,1);material.uniforms.opacity.value=age<hit?.86:Math.exp(-(age-hit)*9)*(strong?1.3:1);});
 };
 blade(tracks.basic,REVIEW_BEATS.basic,.42,false);blade(tracks.cleave,REVIEW_BEATS.cleave,.48,true);
 const burst=(when:number,at:THREE.Vector3,strong:boolean,color:number)=>{
  const flash=sprite(color,strong?1.55:.95);flash.position.copy(at);
  const core=sprite(0xfffbea,strong?.52:.28);core.position.copy(at);
  const planeMaterial=new THREE.MeshBasicMaterial({color:strong?0xffb858:0xffe3a8,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide});
  const star=new THREE.Shape();star.moveTo(-1,0);star.lineTo(-.12,.085);star.lineTo(0,.7);star.lineTo(.1,.08);star.lineTo(1,0);star.lineTo(.1,-.08);star.lineTo(0,-.7);star.lineTo(-.12,-.08);star.closePath();
  const slash=add(new THREE.ShapeGeometry(star),planeMaterial);slash.position.copy(at);
  const count=strong?20:10,positions=new Float32Array(count*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometries.add(geometry);
  const material=new THREE.PointsMaterial({map:glowTexture,color:0xffd382,size:strong?.055:.038,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});materials.add(material);
  const sparks=new THREE.Points(geometry,material);sparks.position.copy(at);root.add(sparks);
  updates.push(time=>{
   const age=time-when,active=age>=0&&age<.65;flash.visible=core.visible=slash.visible=sparks.visible=active;if(!active)return;
   flash.material.opacity=Math.exp(-age*12)*(strong?.9:.68);core.material.opacity=Math.exp(-age*20);flash.scale.setScalar((strong?1.55:.95)*(1+age*1.6));
   slash.quaternion.copy(camera.quaternion);slash.rotateZ(strong?-.37:.22);slash.scale.setScalar((strong?.76:.5)*(1+age*.8));planeMaterial.opacity=Math.exp(-age*16)*.85;
   material.opacity=Math.pow(Math.max(0,1-age/.65),1.3);
   for(let i=0;i<count;i++){const angle=i*2.399963,velocity=(strong?1.9:1.15)*(1+i%4*.2);positions[i*3]=Math.cos(angle)*velocity*age+.32*age;positions[i*3+1]=Math.sin(angle)*velocity*age-.9*age*age;positions[i*3+2]=Math.sin(i*3.1)*.5*age;}geometry.attributes.position.needsUpdate=true;
  });
 };
 burst(REVIEW_BEATS.basicImpact,contact.basic,false,0xffb84e);burst(REVIEW_BEATS.cleaveImpact,contact.cleave,true,0xff9841);
 const healGlow=sprite(0x8be9d1,1.35),staffGlow=sprite(0xbfecff,.62);
 const healGeometry=new THREE.BufferGeometry(),healPositions=new Float32Array(25*6),healUvs=new Float32Array(25*4),healIndices:number[]=[];
 for(let i=0;i<25;i++){healUvs.set([0,i/24,1,i/24],i*4);if(i<24){const j=i*2;healIndices.push(j,j+1,j+2,j+1,j+3,j+2);}}
 healGeometry.setAttribute('position',new THREE.BufferAttribute(healPositions,3));healGeometry.setAttribute('uv',new THREE.BufferAttribute(healUvs,2));healGeometry.setIndex(healIndices);
 const healMaterial=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,uniforms:{age:{value:0},opacity:{value:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float age;uniform float opacity;void main(){float wave=.5+.5*sin(v.y*18.-age*12.);gl_FragColor=vec4(mix(vec3(.26,.83,.69),vec3(.88,1.,.97),wave),sin(v.x*3.14159)*opacity);}'});
 const ribbon=add(healGeometry,healMaterial);
 const petals:THREE.Mesh[]=[];
 for(let i=0;i<9;i++){const shape=new THREE.Shape();shape.moveTo(0,-.12);shape.quadraticCurveTo(.09,0,0,.16);shape.quadraticCurveTo(-.09,0,0,-.12);petals.push(add(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0xbdfbf0,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})));}
 updates.push(time=>{
  const age=time-REVIEW_BEATS.heal,release=time-REVIEW_BEATS.healImpact,start=staff(),end=knight().add(new THREE.Vector3(0,1.0,0));
  staffGlow.position.copy(start);staffGlow.visible=age>=0&&age<1.1;staffGlow.material.opacity=Math.sin(Math.min(1,Math.max(0,age/1.1))*Math.PI)*.72;
  const active=release>=0&&release<1.1;ribbon.visible=healGlow.visible=active;petals.forEach(p=>p.visible=active);if(!active)return;
  healGlow.position.copy(end);healGlow.material.opacity=Math.sin(Math.min(1,release/1.1)*Math.PI)*.42;
  healMaterial.uniforms.age.value=release;healMaterial.uniforms.opacity.value=Math.exp(-release*2.8)*.8;
  for(let i=0;i<25;i++){const t=i/24,p=start.clone().lerp(end,t);p.y+=Math.sin(t*Math.PI)*.48;healPositions.set([p.x,p.y-.04,p.z,p.x,p.y+.04,p.z],i*6);}healGeometry.attributes.position.needsUpdate=true;
  petals.forEach((petal,i)=>{const angle=i*2.399963+release*1.7;petal.position.copy(end).add(new THREE.Vector3(Math.cos(angle)*.43,release*.9-.7+i%3*.17,Math.sin(angle)*.35));petal.quaternion.copy(camera.quaternion);petal.rotateZ(angle);(petal.material as THREE.MeshBasicMaterial).opacity=Math.sin(Math.min(1,release/1.1)*Math.PI)*.7;});
 });
 return{update(time:number){updates.forEach(update=>update(time));},dispose(){scene.remove(root);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
