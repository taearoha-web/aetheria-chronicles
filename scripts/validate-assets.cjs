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
  return { bytes, document };
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
  const { bytes, document: doc } = readGlb(filename);
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
