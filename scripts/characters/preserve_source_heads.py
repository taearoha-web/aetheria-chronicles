"""Restore source head geometry, normals, and textures onto an existing starter rig.

Run with Blender 5.2, for example:
  blender -b -t 2 --python scripts/characters/preserve_source_heads.py -- 
    --source /path/to/original.glb --rig art/characters/starter-knight.blend 
    --output /path/to/knight-review.blend --height 1.90 --glb /path/to/knight-review.glb

The two input files are read only. Output paths must differ from both inputs.
The source must use the original starter orientation and the rig must use the
same normalized coordinates. This is a bounded repair for these two starters,
not general automatic retopology or automatic rigging.
"""
import argparse
import json
import math
import sys
import tempfile
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--rig', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--glb', type=Path)
    parser.add_argument('--height', required=True, type=float)
    parser.add_argument('--head-cutoff', default=1.52, type=float)
    parser.add_argument('--body-triangles', default=60000, type=int)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    inputs = {args.source.resolve(), args.rig.resolve()}
    for output in [args.output, args.glb]:
        if output and output.resolve() in inputs:
            parser.error('Output must not overwrite either input.')
        if output:
            output.parent.mkdir(parents=True, exist_ok=True)
    if args.height <= 0 or args.body_triangles < 1:
        parser.error('Height and body triangle budget must be positive.')
    return args


def active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def cached_weights(mesh):
    names = {group.index: group.name for group in mesh.vertex_groups}
    kd = KDTree(len(mesh.data.vertices))
    cache = []
    for vertex in mesh.data.vertices:
        kd.insert(vertex.co, vertex.index)
        values = [(names[g.group], g.weight) for g in vertex.groups
                  if math.isfinite(g.weight) and g.weight > 0]
        if not values:
            raise ValueError(f'Input rig vertex {vertex.index} has no valid weights')
        cache.append(values)
    kd.balance()
    return kd, cache


def normalize_transferred_weights(mesh, kd, cache):
    """Handle degenerate barycentric source faces, then retain four influences."""
    names = {group.index: group.name for group in mesh.vertex_groups}
    fallback = []
    for vertex in mesh.data.vertices:
        values = [(names[g.group], g.weight) for g in vertex.groups]
        invalid = (not values or any(not math.isfinite(w) for _, w in values)
                   or sum(max(0, w) for _, w in values) < 1e-8)
        if invalid:
            _, index, distance = kd.find(vertex.co)
            values = cache[index]
            fallback.append({'vertex': vertex.index, 'nearestDistance': distance})
        values = sorted([(n, w) for n, w in values if w > 0],
                        key=lambda pair: pair[1], reverse=True)[:4]
        total = sum(w for _, w in values)
        if total <= 0:
            raise ValueError(f'No usable weights for vertex {vertex.index}')
        for group in list(vertex.groups):
            mesh.vertex_groups[group.group].remove([vertex.index])
        for name, value in values:
            mesh.vertex_groups[name].add([vertex.index], value / total, 'REPLACE')
    return fallback


def main():
    args = arguments()
    temp_path = args.output.parent / '.blender-export-temp'
    temp_path.mkdir(exist_ok=True)
    tempfile.tempdir = str(temp_path)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.open_mainfile(filepath=str(args.rig.resolve()))
    scene = bpy.context.scene
    armatures = [o for o in scene.objects if o.type == 'ARMATURE']
    meshes = [o for o in scene.objects if o.type == 'MESH']
    if len(armatures) != 1 or len(meshes) != 1:
        raise ValueError('Input rig must contain one armature and one character mesh')
    arm, old = armatures[0], meshes[0]
    arm.data.pose_position = 'REST'
    kd, cache = cached_weights(old)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
    imported = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    if len(imported) != 1:
        raise ValueError('Source GLB must contain exactly one character mesh')
    raw = imported[0]
    raw.parent = None
    active(raw)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    low = Vector(tuple(min(v.co[i] for v in raw.data.vertices) for i in range(3)))
    high = Vector(tuple(max(v.co[i] for v in raw.data.vertices) for i in range(3)))
    center = (low + high) * 0.5
    center.z = low.z
    factor = args.height / (high.z - low.z)
    for vertex in raw.data.vertices:
        vertex.co = (vertex.co - center) * factor
    for polygon in raw.data.polygons:
        polygon.use_smooth = True
    raw.data.update()
    pieces, counts = [], {}
    for part in ['head', 'body']:
        obj = raw.copy()
        obj.data = raw.data.copy()
        bpy.context.collection.objects.link(obj)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        remove = [f for f in bm.faces if
                  (f.calc_center_median().z > args.head_cutoff) != (part == 'head')]
        bmesh.ops.delete(bm, geom=remove, context='FACES')
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        active(obj)
        if part == 'body':
            modifier = obj.modifiers.new('Body-only reduction', 'DECIMATE')
            modifier.ratio = min(1, args.body_triangles / len(obj.data.polygons))
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        counts[part] = len(obj.data.polygons)
        pieces.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = old.name
    for polygon in mesh.data.polygons:
        polygon.use_smooth = True
    for group in old.vertex_groups:
        mesh.vertex_groups.new(name=group.name)
    transfer = mesh.modifiers.new('Existing rig weights', 'DATA_TRANSFER')
    transfer.object = old
    transfer.use_vert_data = True
    transfer.data_types_verts = {'VGROUP_WEIGHTS'}
    transfer.vert_mapping = 'POLYINTERP_NEAREST'
    transfer.layers_vgroup_select_src = 'ALL'
    transfer.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    fallback = normalize_transferred_weights(mesh, kd, cache)
    mesh.data.validate(verbose=True, clean_customdata=False)
    transfer = mesh.modifiers.new('Original source normals', 'DATA_TRANSFER')
    transfer.object = raw
    transfer.use_loop_data = True
    transfer.data_types_loops = {'CUSTOM_NORMAL'}
    transfer.loop_mapping = 'POLYINTERP_NEAREST'
    bpy.ops.object.modifier_apply(modifier=transfer.name)
    bpy.data.objects.remove(raw, do_unlink=True)
    bpy.data.objects.remove(old, do_unlink=True)
    mesh.parent = arm
    skin = mesh.modifiers.new('Anatomical skeleton', 'ARMATURE')
    skin.object = arm
    skin.use_deform_preserve_volume = False
    arm.data.pose_position = 'POSE'
    arm.animation_data.action = bpy.data.actions.get('Idle')
    for pose_bone in arm.pose.bones:
        pose_bone.location = (0, 0, 0)
        pose_bone.rotation_mode = 'QUATERNION'
        pose_bone.rotation_quaternion = (1, 0, 0, 0)
        pose_bone.scale = (1, 1, 1)
    scene.frame_set(1)
    for action in bpy.data.actions:
        action.use_fake_user = True
    for image in bpy.data.images:
        if image.users > 0:
            image.pack()
    for vertex in mesh.data.vertices:
        values = [g.weight for g in vertex.groups]
        if (not values or len(values) > 4 or any(not math.isfinite(v) for v in values)
                or abs(sum(values) - 1) > 0.001):
            raise ValueError(f'Invalid output weights at vertex {vertex.index}')
    if mesh.data.validate(verbose=True, clean_customdata=False):
        raise ValueError('Output mesh required unexpected additional repairs')
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)
    if args.glb:
        active(arm)
        mesh.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=str(args.glb.resolve()), export_format='GLB', use_selection=True,
            export_animations=True, export_animation_mode='ACTIONS',
            export_force_sampling=True, export_frame_range=False,
            export_anim_single_armature=True, export_image_format='JPEG',
            export_jpeg_quality=95)
    report = {
        'source': str(args.source), 'rig': str(args.rig),
        'triangles': len(mesh.data.polygons), 'vertices': len(mesh.data.vertices),
        'sourceHeadTrianglesPreserved': counts['head'], 'bodyTriangles': counts['body'],
        'headCutoff': args.head_cutoff, 'height': args.height,
        'customNormals': mesh.data.has_custom_normals,
        'weightFallbacks': fallback,
        'textureSizes': {image.name: list(image.size) for image in bpy.data.images
                         if image.users and image.type == 'IMAGE'},
    }
    args.output.with_suffix('.repair.json').write_text(json.dumps(report, indent=2))
    print('HEAD_REPAIR_COMPLETE', json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
