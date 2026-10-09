import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** A grounded road set, deliberately separate from the campaign's sanctuary. */
export function createReviewEnvironment(scene:THREE.Scene,backgroundUrl?:string){
 const group=new THREE.Group();group.name='Overgrown causeway';scene.add(group);
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 let seed=90211;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
 const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=1024;
 const ctx=textureCanvas.getContext('2d')!;ctx.fillStyle='#484a3c';ctx.fillRect(0,0,1024,1024);
 for(let i=0;i<12000;i++){const x=random()*1024,y=random()*1024,r=random()*7+.5;ctx.fillStyle=`rgba(${75+Math.floor(random()*60)},${72+Math.floor(random()*50)},${54+Math.floor(random()*40)},${.02+random()*.09})`;ctx.beginPath();ctx.ellipse(x,y,r*2,r,random()*Math.PI,0,Math.PI*2);ctx.fill();}
 for(let i=0;i<160;i++){ctx.strokeStyle='rgba(14,21,18,.22)';ctx.lineWidth=.8+random()*2;ctx.beginPath();let x=random()*1024,y=random()*1024;ctx.moveTo(x,y);for(let j=0;j<4;j++){x+=(random()-.5)*120;y+=(random()-.5)*100;ctx.lineTo(x,y);}ctx.stroke();}
 const groundTexture=new THREE.CanvasTexture(textureCanvas);groundTexture.colorSpace=THREE.SRGBColorSpace;groundTexture.wrapS=groundTexture.wrapT=THREE.RepeatWrapping;groundTexture.repeat.set(5,3);groundTexture.anisotropy=4;textures.add(groundTexture);
 const mat=(p:THREE.MeshStandardMaterialParameters)=>{const m=new THREE.MeshStandardMaterial(p);materials.add(m);return m;};
 const road=mat({color:0x898b70,map:groundTexture,roughness:.95,metalness:0,bumpMap:groundTexture,bumpScale:.022});
 const masonry=mat({color:0x525c53,map:groundTexture,roughness:.96});
 const dark=mat({color:0x283b34,roughness:1});
 const create=(geo:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number)=>{geometries.add(geo);const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const groundGeo=new THREE.PlaneGeometry(50,30,40,24);groundGeo.rotateX(-Math.PI/2);
 const positions=groundGeo.getAttribute('position');for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,Math.abs(z)<2?.0:Math.sin(x*.3)*Math.sin(z*.4)*.18);}groundGeo.computeVertexNormals();
 const ground=create(groundGeo,road,0,-.012,-3);ground.castShadow=false;
 // Irregular low retaining walls sit behind the fighters; no raised display disk.
 for(let i=0;i<23;i++){
  const x=(i-11)*1.25,z=-4.5-random()*.9,h=.25+random()*.3;
  const block=create(new THREE.BoxGeometry(1.05+random()*.45,h,.72),masonry,x,h/2-.06,z);block.rotation.y=(random()-.5)*.18;block.rotation.z=(random()-.5)*.06;
  if(i%3===0){const top=create(new THREE.BoxGeometry(.85+random()*.35,h*.7,.63),masonry,x+.17,h*.9,z+.02);top.rotation.y=.15;}
 }
 // Broken supports, slightly asymmetric: a readable silhouette instead of many small ornaments.
 for(const [x,z,height]of [[-6.8,-6.0,3.5],[6.4,-6.7,4.2],[-9,-10,5.2],[10,-11,4.0]]){
  create(new THREE.BoxGeometry(1.1,.32,.95),masonry,x,.15,z);
  const pillar=create(new THREE.CylinderGeometry(.36,.47,height,7),masonry,x,height/2+.15,z);pillar.rotation.z=x>0?.04:-.025;
  create(new THREE.BoxGeometry(1.05,.2,.94),masonry,x,height+.22,z);
 }
 for(let i=0;i<32;i++){
  const x=(random()-.5)*29,z=(i%2?-1:1)*(3.4+random()*4),rock=create(new THREE.IcosahedronGeometry(.15+random()*.45,0),masonry,x,.04,z);rock.scale.set(1.4,.4,1);rock.rotation.set(random(),random(),random());
 }
 // Sparse, long leaves form a foreground frame without covering the contact lane.
 const leafGeometry=new THREE.BufferGeometry();leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.05,0,0, .05,0,0, .035,.62,.05, -.035,.62,.05, 0,1.1,.14],3));leafGeometry.setIndex([0,1,2,0,2,3,3,2,4]);leafGeometry.computeVertexNormals();geometries.add(leafGeometry);
 const leaves=new THREE.InstancedMesh(leafGeometry,dark,160),dummy=new THREE.Object3D();leaves.castShadow=true;group.add(leaves);
 for(let i=0;i<160;i++){dummy.position.set((random()-.5)*32,-.03,i<100?-4.0-random()*5:4+random()*3);dummy.rotation.set(0,random()*Math.PI*2,(random()-.5)*.65);dummy.scale.setScalar(.25+random()*.45);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);}
 group.updateMatrixWorld(true);
 const buckets=new Map<THREE.Material,THREE.Mesh[]>();group.traverse(node=>{if(node instanceof THREE.Mesh&&!(node instanceof THREE.InstancedMesh)&&node.geometry!==groundGeo){const material=node.material as THREE.Material;const items=buckets.get(material)??[];items.push(node);buckets.set(material,items);}});
 for(const [material,items]of buckets){if(items.length<2)continue;const pieces=items.map(m=>(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrixWorld));const combined=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(combined){create(combined,material,0,0,0);items.forEach(m=>m.removeFromParent());}}
 let backdrop:THREE.Texture|undefined,aspect=innerWidth/innerHeight,disposed=false;
 const resize=(width:number,height:number)=>{
  aspect=width/Math.max(1,height);if(!backdrop)return;
  const image=backdrop.image as HTMLImageElement,imageAspect=image.width/image.height;
  const repeatX=Math.min(1,aspect/imageAspect),repeatY=Math.min(1,imageAspect/aspect);
  backdrop.repeat.set(repeatX,repeatY);backdrop.offset.set((1-repeatX)/2,(1-repeatY)/2);backdrop.updateMatrix();
 };
 if(backgroundUrl){
  void new THREE.TextureLoader().loadAsync(backgroundUrl).then(texture=>{
   if(disposed){texture.dispose();return;}textures.add(texture);texture.colorSpace=THREE.SRGBColorSpace;backdrop=texture;
   scene.background=texture;scene.backgroundIntensity=.93;resize(aspect,1);
   // A camera-facing matte supplies distant architecture. The actual terrain
   // remains a 3D shadow receiver under the skinned characters, avoiding a seam.
   group.children.forEach(node=>{node.visible=node===ground;});
   const shadow=new THREE.ShadowMaterial({opacity:.4,color:0x101a20});materials.add(shadow);ground.material=shadow;
  }).catch(error=>console.warn('Review backdrop unavailable; using the 3D scene.',error));
 }
 return{resize,dispose(){disposed=true;scene.remove(group);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
