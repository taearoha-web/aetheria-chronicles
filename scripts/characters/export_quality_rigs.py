"""Re-export the packed quality-review rigs without the owner's original files.

blender -b -t 2 --python scripts/characters/export_quality_rigs.py -- 
  --characters art/quality --output-dir public/assets/quality

This writes only GLBs and an export receipt; it never saves over the .blends.
"""
import argparse
import hashlib
import json
import math
import sys
import tempfile
from pathlib import Path

import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--characters', required=True, type=Path)
parser.add_argument('--output-dir', required=True, type=Path)
parser.add_argument('--only', choices=['knight', 'priestess'])
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.output_dir.mkdir(parents=True, exist_ok=True)
temporary = args.output_dir / '.blender-export-temp'
temporary.mkdir(exist_ok=True)
tempfile.tempdir = str(temporary)
receipt = {}
for hero in ['knight', 'priestess']:
    if args.only and hero != args.only:
        continue
    source = args.characters / (hero + '.blend')
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
    scene = bpy.context.scene
    arm = next(obj for obj in scene.objects if obj.type == 'ARMATURE')
    meshes = [obj for obj in scene.objects if obj.type == 'MESH' and any(
        modifier.type == 'ARMATURE' and modifier.object == arm for modifier in obj.modifiers)]
    if len(meshes) != 1:
        raise ValueError('Expected one skinned character mesh')
    mesh = meshes[0]
    if mesh.data.validate(verbose=True, clean_customdata=False):
        raise ValueError('Packed rig has an invalid mesh; repair a copy before export')
    for vertex in mesh.data.vertices:
        weights = [group.weight for group in vertex.groups]
        if not weights or not all(math.isfinite(w) for w in weights) or abs(sum(weights) - 1) > .001:
            raise ValueError(f'Invalid weights at vertex {vertex.index}')
    arm.data.pose_position = 'POSE'
    for bone in arm.pose.bones:
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.location = (0, 0, 0)
        bone.scale = (1, 1, 1)
    arm.animation_data.action = bpy.data.actions['Idle']
    scene.frame_set(1)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = arm
    target = args.output_dir / (hero + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(target.resolve()), export_format='GLB',
        use_selection=True, export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=True, export_frame_range=False, export_anim_single_armature=True,
        export_image_format='JPEG', export_jpeg_quality=95)
    with target.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    receipt[hero] = {'source': str(source), 'bytes': target.stat().st_size, 'sha256': digest}
(args.output_dir / 'export-receipt.json').write_text(json.dumps(receipt, indent=2))
print('QUALITY_EXPORT_COMPLETE', json.dumps(receipt), flush=True)
