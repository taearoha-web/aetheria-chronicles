import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Environment = {
  animate: (time: number, battle: boolean) => void;
  dispose: () => void;
};

/** A small, deterministic shrine set. All geometry here is scenery, never actors. */
export function createEnvironment(scene: THREE.Scene): Environment {
  const root = new THREE.Group();
  root.name = 'Moonwater sanctuary';
  scene.add(root);
  const disposable = new Set<THREE.Material | THREE.BufferGeometry | THREE.Texture>();
  let seed = 8129;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const material = (params: THREE.MeshStandardMaterialParameters) => {
    const value = new THREE.MeshStandardMaterial(params); disposable.add(value); return value;
  };
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = root) => {
    disposable.add(geometry);
    const value = new THREE.Mesh(geometry, mat);
    value.castShadow = true; value.receiveShadow = true;
    parent.add(value); return value;
  };
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = stoneCanvas.height = 512;
  const context = stoneCanvas.getContext('2d')!;
  context.fillStyle = '#778987'; context.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 12000; i++) {
    const light = Math.floor(95 + random() * 75);
    context.fillStyle = `rgba(${light},${light + 9},${light + 6},${0.08 + random() * .12})`;
    context.fillRect(random() * 512, random() * 512, 1 + random() * 8, 1 + random() * 3);
  }
  for (let i = 0; i < 24; i++) {
    context.beginPath(); context.moveTo(random() * 512, random() * 512);
    context.bezierCurveTo(random()*512,random()*512,random()*512,random()*512,random()*512,random()*512);
    context.strokeStyle = 'rgba(34,55,55,.12)'; context.lineWidth = .3 + random(); context.stroke();
  }
  const stoneTexture = new THREE.CanvasTexture(stoneCanvas);
  stoneTexture.colorSpace = THREE.SRGBColorSpace;
  stoneTexture.wrapS = stoneTexture.wrapT = THREE.RepeatWrapping; stoneTexture.repeat.set(5, 5);
  disposable.add(stoneTexture);
  const ivory = material({ color: 0xc0c9bb, map: stoneTexture, roughness: .86 });
  const stone = material({ color: 0x6f827b, map: stoneTexture, roughness: .95 });
  const paleStone = material({ color: 0xc5c1ac, map: stoneTexture, roughness: .88 });
  const moss = material({ color: 0x233d34, roughness: 1 });
  const gold = material({ color: 0xb29a5b, metalness: .68, roughness: .35 });
  const glow = material({ color: 0x78ebcd, emissive: 0x50bfa7, emissiveIntensity: 1.15, roughness: .22, metalness: .25 });
  const darkStone = material({ color: 0x172d2c, map: stoneTexture, roughness: .98 });

  // Large, quiet gradients give the silhouettes room to read on a small screen.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#152c43') }, horizon: { value: new THREE.Color('#739493') }, bottom: { value: new THREE.Color('#243f40') } },
    vertexShader: 'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vPosition;uniform vec3 top;uniform vec3 horizon;uniform vec3 bottom;void main(){float h=normalize(vPosition).y;vec3 c=mix(horizon,top,smoothstep(0.0,.8,h));c=mix(c,bottom,smoothstep(0.0,-.4,h));gl_FragColor=vec4(c,1.0);}',
  });
  disposable.add(skyMat);
  const sky = mesh(new THREE.SphereGeometry(100, 32, 16), skyMat); sky.castShadow = sky.receiveShadow = false;
  const base = mesh(new THREE.CylinderGeometry(10.8, 11.4, .75, 12), darkStone); base.position.y = -.55;
  const floor = mesh(new THREE.CylinderGeometry(10.3, 10.5, .28, 12), ivory); floor.position.y = -.15;
  const inner = mesh(new THREE.CylinderGeometry(6, 6, .025, 96), paleStone); inner.position.y = .004;
  const rim = mesh(new THREE.TorusGeometry(5.8, .024, 5, 96), gold); rim.rotation.x = Math.PI / 2; rim.position.y = .03;
  const rim2 = mesh(new THREE.TorusGeometry(5.55, .012, 4, 96), gold); rim2.rotation.x = Math.PI / 2; rim2.position.y = .033;
  const centerRune = mesh(new THREE.TorusGeometry(1.35, .018, 4, 64), gold); centerRune.rotation.x = Math.PI / 2; centerRune.position.y = .035;
  for (let n = 0; n < 24; n++) {
    const a = n / 24 * Math.PI * 2;
    const mark = mesh(new THREE.BoxGeometry(.024, .012, n % 3 === 0 ? .32 : .13), gold);
    mark.position.set(Math.sin(a)*5.67, .035, Math.cos(a)*5.67); mark.rotation.y = a;
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const line = mesh(new THREE.BoxGeometry(.025, .014, 3.95), stone);
    line.position.set(Math.sin(a) * 7.9, .004, Math.cos(a)*7.9); line.rotation.y = a;
  }
  for (let i = 0; i < 3; i++) {
    const step = mesh(new THREE.BoxGeometry(6 + i * .65, .2, 1.15), ivory); step.position.set(0, -.22 - i * .19, 10.3 + i * .6);
  }
  const earth = mesh(new THREE.CircleGeometry(75, 64), moss); earth.rotation.x = -Math.PI / 2; earth.position.y = -.96;

  // Columns and paired broken archways create a readable fantasy backdrop.
  const column = (x: number, z: number, height: number, ruined = false) => {
    const group = new THREE.Group(); root.add(group); group.position.set(x, 0, z);
    const foot = mesh(new THREE.BoxGeometry(1.24, .28, 1.24), stone, group); foot.position.y = .14;
    const bevel = mesh(new THREE.CylinderGeometry(.51, .7, .21, 8), paleStone, group); bevel.position.y = .36;
    const shaft = mesh(new THREE.CylinderGeometry(.31, .39, height, 12), ivory, group); shaft.position.y = height / 2 + .45;
    for (let i = 0; i < 3; i++) {
      const collar = mesh(new THREE.CylinderGeometry(.405, .405, .085, 12), i === 1 ? gold : paleStone, group);
      collar.position.y = .55 + (height-.2) * i / 2;
    }
    const capital = mesh(new THREE.CylinderGeometry(.67, .36, .26, 8), paleStone, group); capital.position.y = height + .52;
    if (!ruined) {
      const top = mesh(new THREE.BoxGeometry(1.32, .2, 1.16), ivory, group); top.position.y = height + .75;
    }
    return group;
  };
  column(-8.2, -4.8, 5.7); column(-5.5, -7.5, 5.9);
  column(8.1, -4.8, 4.2, true); column(5.6, -7.5, 5.9);
  column(-8.8, 3.6, 2.3, true); column(9, 2.5, 3.4, true);
  for (const side of [-1, 1]) {
    const arch = mesh(new THREE.TorusGeometry(2.45, .29, 6, 28, Math.PI*.67), ivory);
    arch.position.set(side*4.9,4.85,-8.2); arch.rotation.z = side < 0 ? -.06 : .49;
    const balustrade = mesh(new THREE.BoxGeometry(3.8,.35,.75), stone); balustrade.position.set(side*6.2,.7,-8.3); balustrade.rotation.y=side*.34;
    for (let i=0;i<3;i++) {
      const post = mesh(new THREE.CylinderGeometry(.15,.2,.65,8),paleStone); post.position.set(side*(4.8+i*1.1),.3,-8.3);
    }
  }

  const portalBase = mesh(new THREE.CylinderGeometry(1.7, 2.1, .4, 12), stone); portalBase.position.set(0, .05, -8.4);
  const portal = new THREE.Group(); portal.position.set(0, 3.4, -8.65); root.add(portal);
  const portalRing = mesh(new THREE.TorusGeometry(2.5, .15, 8, 72), gold, portal);
  const portalStone = mesh(new THREE.TorusGeometry(2.75, .20, 8, 72, Math.PI*1.54), ivory, portal); portalStone.rotation.z=-.34;
  const portalLight = mesh(new THREE.TorusGeometry(2.31, .025, 6, 72), glow, portal);
  for (let i=0;i<8;i++) {
    const a=i/8*Math.PI*2;
    const rune=mesh(new THREE.OctahedronGeometry(.15),glow,portal); rune.position.set(Math.sin(a)*2.55,Math.cos(a)*2.55,.04);
  }
  const portalLamp = new THREE.PointLight(0x61dfc2, 12, 10, 2); portalLamp.position.set(0,3,-7); root.add(portalLamp);
  // The distant moon is scenery and intentionally does not cast shadows.
  const moonMat = new THREE.MeshBasicMaterial({color:0xf3e4c1,fog:false}); disposable.add(moonMat);
  const moon=mesh(new THREE.SphereGeometry(3.2,32,24),moonMat); moon.position.set(-19,24,-60); moon.castShadow=false;

  const leaves=[material({color:0x153f36,roughness:1}),material({color:0x225143,roughness:1}),material({color:0x326049,roughness:1})];
  const bark=material({color:0x354037,roughness:1});
  for(let i=0;i<19;i++) {
    const angle = -Math.PI / 2 + (random()-.5)*Math.PI*1.5;
    const radius=14+random()*22, x=Math.cos(angle)*radius,z=Math.sin(angle)*radius-6;
    const height=4+random()*7;
    const trunk=mesh(new THREE.CylinderGeometry(.13,.33,height,6),bark); trunk.position.set(x,height/2-.8,z);
    for(let tier=0;tier<3;tier++) {
      const leaf=mesh(new THREE.ConeGeometry((2.1-tier*.43)*(height/7),height*.55,9),leaves[i%3]);
      leaf.position.set(x,height*(.45+tier*.18),z); leaf.rotation.y=random()*Math.PI;
    }
  }
  // Tufts around the masonry soften the clean arena perimeter.
  const grassGeo = new THREE.ConeGeometry(.06,.65,3); disposable.add(grassGeo);
  const grass = new THREE.InstancedMesh(grassGeo, leaves[1], 260); root.add(grass); grass.receiveShadow=true;
  const dummy=new THREE.Object3D();
  for(let i=0;i<260;i++) {
    const a=random()*Math.PI*2,r=10.7+random()*3;
    dummy.position.set(Math.sin(a)*r,-.65,Math.cos(a)*r);
    dummy.rotation.set((random()-.5)*.5,random()*6.28,(random()-.5)*.6);
    dummy.scale.setScalar(.5+random()*1.25);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
  }
  for(let i=0;i<14;i++) {
    const a=random()*Math.PI*2,r=10.6+random()*2;
    const rock=mesh(new THREE.DodecahedronGeometry(.3+random()*.6,0),stone);
    rock.position.set(Math.sin(a)*r,-.6,Math.cos(a)*r);rock.rotation.set(random(),random(),random());rock.scale.y=.65;
  }

  const moteCanvas=document.createElement('canvas');moteCanvas.width=moteCanvas.height=32;
  const moteCtx=moteCanvas.getContext('2d')!; const gradient=moteCtx.createRadialGradient(16,16,0,16,16,16);
  gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.2,'#c8ffe4');gradient.addColorStop(.6,'rgba(137,255,222,.3)');gradient.addColorStop(1,'rgba(70,220,170,0)');
  moteCtx.fillStyle=gradient;moteCtx.fillRect(0,0,32,32);
  const moteTexture=new THREE.CanvasTexture(moteCanvas);disposable.add(moteTexture);
  const positions=new Float32Array(120*3);const initial=new Float32Array(positions.length);
  for(let i=0;i<120;i++){positions[i*3]=(random()-.5)*24;positions[i*3+1]=.4+random()*8;positions[i*3+2]=(random()-.5)*20-4;}
  initial.set(positions);
  const moteGeometry=new THREE.BufferGeometry();moteGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));disposable.add(moteGeometry);
  const moteMaterial=new THREE.PointsMaterial({map:moteTexture,color:0x8fffdb,size:.085,transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending});disposable.add(moteMaterial);
  const motes=new THREE.Points(moteGeometry,moteMaterial);root.add(motes);
  const beams:THREE.Mesh[]=[];
  const beamMaterial=new THREE.MeshBasicMaterial({color:0x7bddc4,transparent:true,opacity:.018,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});disposable.add(beamMaterial);
  for(let i=0;i<3;i++){
    const beam=mesh(new THREE.ConeGeometry(1.8,18,8,1,true),beamMaterial);beam.position.set(-8+i*3,8,-3-i*3);beam.rotation.z=-.38;beam.castShadow=false;beams.push(beam);
  }

  // Batch the static masonry and foliage by material. This preserves all authored shapes
  // while avoiding hundreds of separate scenery draw calls on a phone.
  root.updateMatrixWorld(true);
  const batches=new Map<string,THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]>();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh||object===portalRing||!(object.material instanceof THREE.MeshStandardMaterial)||object.material.transparent)return;
    const key=`${object.material.uuid}-${object.castShadow}-${object.receiveShadow}`;
    const batch=batches.get(key)??[];batch.push(object);batches.set(key,batch);
  });
  for(const batch of batches.values()){
    if(batch.length<2)continue;
    const transformed=batch.map(object=>{
      const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      return geometry.applyMatrix4(object.matrixWorld);
    });
    const combined=mergeGeometries(transformed,false);
    transformed.forEach(geometry=>geometry.dispose());
    if(!combined)continue;
    disposable.add(combined);
    const combinedMesh=new THREE.Mesh(combined,batch[0].material);
    combinedMesh.castShadow=batch[0].castShadow;combinedMesh.receiveShadow=batch[0].receiveShadow;root.add(combinedMesh);
    for(const object of batch){object.removeFromParent();disposable.delete(object.geometry);object.geometry.dispose();}
  }
  return {
    animate(time,battle){
      portalLight.scale.setScalar(1+Math.sin(time*.55)*.025);
      glow.emissiveIntensity=1.0+Math.sin(time*.8)*.15;
      for(let i=0;i<120;i++){
        positions[i*3]=initial[i*3]+Math.sin(time*.15+i)*.45;
        positions[i*3+1]=initial[i*3+1]+Math.sin(time*.28+i*.4)*.25;
      }
      moteGeometry.attributes.position.needsUpdate=true;
      portalRing.rotation.z=time*.018;
      moteMaterial.opacity=battle?.48:.72;
    },
    dispose(){scene.remove(root);for(const item of disposable)item.dispose();},
  };
}
