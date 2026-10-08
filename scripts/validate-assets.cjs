'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const projectRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(projectRoot, 'public');
const assetRoot = path.join(publicRoot, 'assets');
const args = new Set(process.argv.slice(2));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function rejectExternalUris(value, location = 'document') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const current = location + '.' + key;
    if (key === 'uri') {
      assert(typeof child === 'string' && child.startsWith('data:'), current + ' contains an external URI');
    } else {
      rejectExternalUris(child, current);
    }
  }
}

function readGlb(filename) {
  const bytes = fs.readFileSync(filename);
  assert(bytes.length >= 20, 'GLB is truncated');
  assert(bytes.toString('ascii', 0, 4) === 'glTF', 'invalid GLB magic');
  assert(bytes.readUInt32LE(4) === 2, 'GLB version must be 2');
  assert(bytes.readUInt32LE(8) === bytes.length, 'GLB declared length does not match its file length');
  let offset = 12;
  let document;
  let binaryLength = 0;
  let binary;
  let chunkIndex = 0;
  while (offset < bytes.length) {
    assert(offset + 8 <= bytes.length, 'truncated GLB chunk header');
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    assert(length % 4 === 0, 'GLB chunk length is not aligned to four bytes');
    const start = offset + 8;
    const end = start + length;
    assert(end <= bytes.length, 'GLB chunk extends beyond the file');
    if (chunkIndex === 0) assert(type === 0x4e4f534a, 'first GLB chunk must be JSON');
    if (type === 0x4e4f534a) {
      assert(document === undefined, 'GLB has duplicate JSON chunks');
      document = JSON.parse(bytes.toString('utf8', start, end));
    } else if (type === 0x004e4942) {
      assert(binaryLength === 0, 'GLB has duplicate binary chunks');
      binaryLength = length;
      binary = bytes.subarray(start,end);
    }
    offset = end;
    chunkIndex += 1;
  }
  assert(document && document.asset && document.asset.version === '2.0', 'missing or invalid glTF 2.0 document');
  rejectExternalUris(document);
  for (const buffer of document.buffers || []) {
    if (buffer.uri === undefined) {
      assert(Number.isInteger(buffer.byteLength) && buffer.byteLength > 0 && buffer.byteLength <= binaryLength, 'embedded buffer exceeds the GLB binary chunk');
    }
  }
  return { bytes, document, binary };
}

function accessorValues(doc,binary,index) {
  const accessor=doc.accessors?.[index],view=doc.bufferViews?.[accessor?.bufferView];
  assert(accessor&&view&&!accessor.sparse,'starter animation/skin accessor must be embedded and non-sparse');
  const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},components=sizes[accessor.type];
  const readers={5120:[1,'readInt8'],5121:[1,'readUInt8'],5122:[2,'readInt16LE'],5123:[2,'readUInt16LE'],5125:[4,'readUInt32LE'],5126:[4,'readFloatLE']};
  const reader=readers[accessor.componentType];assert(reader&&components,'unsupported starter accessor layout');
  const [size,method]=reader,stride=view.byteStride||components*size,start=(view.byteOffset||0)+(accessor.byteOffset||0);
  assert(start+(accessor.count-1)*stride+components*size<=binary.length,'starter accessor exceeds embedded binary');
  const values=new Float64Array(accessor.count*components);
  const denominator=accessor.normalized?(accessor.componentType===5121?255:accessor.componentType===5123?65535:1):1;
  for(let item=0;item<accessor.count;item++)for(let component=0;component<components;component++)values[item*components+component]=binary[method](start+item*stride+component*size)/denominator;
  return {values,components,count:accessor.count};
}

function validateStarter(doc,binary,model) {
  const required=['Idle','Run','Attack_01','Attack_02','Skill_01','Skill_02','Skill_03','Hit','Death','Victory'];
  const animations=doc.animations||[],names=animations.map(animation=>animation.name);
  assert(names.length===10&&new Set(names).size===10&&required.every(name=>names.includes(name)),'starter must contain exactly the ten authored motion clips');
  assert(doc.skins.some(skin=>skin.joints.length>=20),'starter requires a articulated skeleton of at least twenty joints');
  const jointCount=Math.max(...doc.skins.map(skin=>skin.joints.length)),influenced=new Set();
  for(const primitive of doc.meshes.flatMap(mesh=>mesh.primitives)) {
    const attributes=primitive.attributes;
    assert(attributes.TEXCOORD_0!==undefined&&attributes.JOINTS_0!==undefined&&attributes.WEIGHTS_0!==undefined,'starter mesh must retain UV coordinates and skinning attributes');
    const joints=accessorValues(doc,binary,attributes.JOINTS_0),weights=accessorValues(doc,binary,attributes.WEIGHTS_0);
    assert(joints.components===4&&weights.components===4&&joints.count===weights.count,'starter skinning attributes must be matching VEC4 accessors');
    const more=attributes.WEIGHTS_1!==undefined?accessorValues(doc,binary,attributes.WEIGHTS_1):null;
    for(let vertex=0;vertex<weights.count;vertex++){
      let sum=0;
      for(let lane=0;lane<4;lane++){
        const weight=weights.values[vertex*4+lane],joint=joints.values[vertex*4+lane];
        assert(Number.isFinite(weight)&&weight>=0&&weight<=1.001,'starter has invalid bone weights');
        assert(Number.isInteger(joint)&&joint>=0&&joint<jointCount,'starter references a missing bone');
        sum+=weight;if(weight>.005)influenced.add(joint);
        if(more)sum+=more.values[vertex*4+lane];
      }
      assert(Math.abs(sum-1)<.025,'starter bone weights are zero or not normalized');
    }
    const material=doc.materials?.[primitive.material];
    assert(material?.pbrMetallicRoughness?.baseColorTexture,'starter mesh must retain its embedded base-color texture');
  }
  assert(influenced.size>=12,'starter vertices must actually be influenced by an articulated body, not one rigid root');
  const clipFingerprints=new Set(),durationByClip={};
  for(const animation of animations){
    let changingChannels=0,duration=0;const signature=[];
    for(const channel of animation.channels||[]){
      const sampler=animation.samplers[channel.sampler],input=accessorValues(doc,binary,sampler.input),output=accessorValues(doc,binary,sampler.output);
      assert(input.count>=2,'starter clip has no timed keys');duration=Math.max(duration,input.values[input.values.length-1]);
      let varies=false;for(let i=output.components;i<output.values.length;i++)if(Math.abs(output.values[i]-output.values[i%output.components])>1e-5){varies=true;break;}
      if(varies)changingChannels++;
      signature.push(channel.target.node+':'+channel.target.path+':'+crypto.createHash('sha256').update(Buffer.from(output.values.buffer)).digest('hex'));
    }
    assert(duration>0&&changingChannels>=3,'starter '+animation.name+' has insufficient meaningful joint animation');
    durationByClip[animation.name]=duration;clipFingerprints.add(signature.join('|'));
  }
  assert(clipFingerprints.size===required.length,'starter motion clips must contain distinct keyed animation');
  for(const socket of Object.values(model.sockets||{}))assert(doc.nodes.some(node=>node.name===socket),'missing authored weapon socket: '+socket);
  for(const[clip,timing]of Object.entries(model.clipTimings||{})){
    assert(durationByClip[clip]!==undefined,'timing metadata references a missing clip: '+clip);
    assert(Number.isFinite(timing.duration)&&Math.abs(timing.duration-durationByClip[clip])<.04,'timing duration differs from authored clip: '+clip);
    if(timing.impact!==undefined&&timing.impact!==null)assert(Number.isFinite(timing.impact)&&timing.impact>=0&&timing.impact<=timing.duration,'impact lies outside authored clip: '+clip);
  }
  return {weightedJoints:influenced.size,durationByClip};
}

function validateModel(key, model) {
  assert(model && typeof model === 'object', 'invalid model manifest entry');
  assert(typeof model.url === 'string' && model.url.length > 0, 'missing model URL');
  assert(!/[?#%]/.test(model.url) && !/^[a-z][a-z0-9+.-]*:/i.test(model.url), 'model URL must be a plain local asset path');
  const filename = path.resolve(publicRoot, model.url);
  assert(inside(assetRoot, filename), 'model path is outside public/assets');
  assert(path.extname(filename).toLowerCase() === '.glb', 'model must be a GLB file');
  assert(fs.existsSync(filename), 'missing GLB: ' + model.url);
  assert(fs.statSync(filename).isFile(), 'model path is not a file');
  assert(inside(fs.realpathSync(assetRoot), fs.realpathSync(filename)), 'model resolves outside public/assets');
  const { bytes, document: doc, binary } = readGlb(filename);
  for (const field of ['meshes', 'skins', 'images']) {
    assert(Array.isArray(doc[field]) && doc[field].length > 0, 'missing ' + field);
  }
  assert(doc.skins.every(skin => Array.isArray(skin.joints) && skin.joints.length > 0), 'skin has no joints');
  assert(doc.images.every(image => Number.isInteger(image.bufferView) || (typeof image.uri === 'string' && image.uri.startsWith('data:'))), 'image has no embedded payload');
  const animationNames = (doc.animations || []).map(animation => animation.name);
  assert(model.clips && typeof model.clips === 'object' && Object.keys(model.clips).length > 0, 'missing named clip mappings');
  for (const [action, clip] of Object.entries(model.clips)) {
    assert(typeof clip === 'string' && animationNames.includes(clip), 'missing named clip for ' + action + ': ' + String(clip));
  }
  const primitives = doc.meshes.flatMap(mesh => mesh.primitives || []);
  assert(primitives.length > 0, 'meshes have no primitives');
  let triangles = 0;
  let vertices = 0;
  for (const primitive of primitives) {
    const position = doc.accessors?.[primitive.attributes?.POSITION];
    assert(position && Number.isInteger(position.count) && position.count > 0, 'mesh has no valid position accessor');
    vertices += position.count;
    const count = primitive.indices === undefined ? position.count : doc.accessors?.[primitive.indices]?.count;
    assert(Number.isInteger(count) && count > 0, 'mesh has no valid index or vertex count');
    if (primitive.mode === undefined || primitive.mode === 4) triangles += count / 3;
  }
  const starter=/starter-(knight|priestess)\.glb$/.test(model.url)?validateStarter(doc,binary,model):undefined;
  return {
    file: path.relative(assetRoot, filename).split(path.sep).join('/'),
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    triangles,
    vertices,
    skins: doc.skins.length,
    joints: doc.skins.map(skin => skin.joints.length),
    meshes: doc.meshes.length,
    images: doc.images.length,
    animationNames,
    requiredExtensions: doc.extensionsRequired || [],
    embedded: true,
    source: model.source,
    license: model.license,
    ...(starter?{starter}:{}),
  };
}

try {
  for (const arg of args) assert(arg === '--write-report', 'unknown argument: ' + arg);
  const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8'));
  assert(manifest.models && !Array.isArray(manifest.models) && typeof manifest.models === 'object', 'manifest.models must be an object');
  assert(Object.keys(manifest.models).length > 0, 'manifest has no models');
  const reports = {};
  for (const [key, model] of Object.entries(manifest.models)) {
    try { reports[key] = validateModel(key, model); }
    catch (error) { throw new Error(key + ': ' + error.message); }
  }
  const heroSource = fs.readFileSync(path.join(projectRoot, 'src/simulation/data.ts'), 'utf8').split('export const HERO_BY_ID')[0];
  const heroModels = [...heroSource.matchAll(/modelKey: '([^']+)'/g)].map(match => match[1]);
  assert(heroModels.length === 8, 'expected eight hero model assignments');
  assert(new Set(heroModels).size === heroModels.length, 'heroes must never share a model key');
  assert(heroModels.every(key => reports[key]), 'hero model is missing from the manifest');
  assert(new Set(heroModels.map(key => reports[key].sha256)).size === heroModels.length, 'heroes must never share a GLB payload');
  const totalBytes = Object.values(reports).reduce((total, model) => total + model.bytes, 0);
  if (args.has('--write-report')) {
    fs.writeFileSync(path.join(assetRoot, 'validation.json'), JSON.stringify({ checkedAt: new Date().toISOString(), result: 'PASS', totalBytes, models: reports }, null, 2) + '\n');
  }
  console.log('Asset validation PASS: ' + Object.keys(reports).length + ' embedded, textured, rigged GLBs; ' + (totalBytes / 1024 / 1024).toFixed(2) + ' MiB total.');
  console.log('  Hero roster: eight distinct model keys and GLB payloads.');
  for (const [key, report] of Object.entries(reports)) console.log('  ' + key + ': ' + report.triangles + ' triangles, ' + report.animationNames.length + ' clips');
} catch (error) {
  console.error('Asset validation FAILED: ' + error.message);
  process.exitCode = 1;
}
