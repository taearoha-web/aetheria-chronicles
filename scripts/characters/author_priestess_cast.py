"""Author the bounded, planted prayer cast on an existing packed priestess rig.

blender -b -t 2 --python scripts/characters/author_priestess_cast.py -- 
  --input priestess-repaired.blend --output priestess.blend --glb priestess.glb

Only Skill_01 changes; all other actions are fingerprint-checked. Inputs remain
untouched. Optional --render-dir writes three pose stills using the input camera.
"""
import argparse
import hashlib
import json
import math
import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector, Matrix, Euler


def curves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag = strip.channelbag(slot)
                if bag:
                    yield from bag.fcurves


def fingerprint(action):
    payload = [(c.data_path, c.array_index,
                [(list(k.co), k.interpolation) for k in c.keyframe_points])
               for c in curves(action)]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--glb', type=Path)
    parser.add_argument('--render-dir', type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    for target in [args.output, args.glb]:
        if target:
            if target.resolve() == args.input.resolve():
                parser.error('Outputs must not overwrite the input')
            target.parent.mkdir(parents=True, exist_ok=True)
    temp_path = args.output.parent / '.blender-export-temp'
    temp_path.mkdir(exist_ok=True)
    tempfile.tempdir = str(temp_path)
    bpy.ops.wm.open_mainfile(filepath=str(args.input.resolve()))
    scene = bpy.context.scene
    arm = next(o for o in scene.objects if o.type == 'ARMATURE')
    arm.data.pose_position = 'POSE'
    inverse = arm.matrix_world.inverted()
    rest = {b.name: arm.matrix_world @ b.matrix_local for b in arm.data.bones}
    heads = {name: matrix.translation.copy() for name, matrix in rest.items()}
    unchanged = {a.name: fingerprint(a) for a in bpy.data.actions if a.name != 'Skill_01'}

    def smooth(value):
        value = max(0, min(1, value))
        return value * value * (3 - 2 * value)

    def set_world(name, head, tail=None, rotation=None):
        if rotation is None:
            basis = rest[name].to_quaternion()
            rotation = (basis @ Vector((0, 1, 0))).rotation_difference(
                (tail - head).normalized()) @ basis
        arm.pose.bones[name].matrix = inverse @ Matrix.LocRotScale(
            head, rotation, Vector((1, 1, 1)))
        bpy.context.view_layer.update()

    def solve(upper, lower, target, pole):
        hip = arm.matrix_world @ arm.pose.bones[upper].head
        a, b = arm.data.bones[upper].length, arm.data.bones[lower].length
        delta = target - hip
        distance, direction = delta.length, delta.normalized()
        if not abs(a - b) + 1e-6 < distance < a + b + 1e-5:
            raise ValueError(f'Unreachable IK target for {upper}: {distance}')
        along = (a * a - b * b + distance * distance) / (2 * distance)
        bend = pole - hip
        bend -= direction * bend.dot(direction)
        bend.normalize()
        joint = hip + direction * along + bend * math.sqrt(max(0, a * a - along * along))
        set_world(upper, hip, joint)
        set_world(lower, joint, target)

    def apply(time):
        factor = smooth(time / 0.48) * (1 - smooth((time - 0.78) / 0.52))
        for bone in arm.pose.bones:
            bone.rotation_mode = 'QUATERNION'
            bone.rotation_quaternion = (1, 0, 0, 0)
            bone.location = (0, 0, 0)
            bone.scale = (1, 1, 1)
        poses = [('spine', (-1.2 * factor, 0, 0)), ('head', (6 * factor, 0, -3 * factor)),
                 ('cape', (1.5 * math.sin(time * math.pi / 1.3), 0, 0))]
        for name, degrees in poses:
            basis = arm.data.bones[name].matrix_local.to_quaternion()
            rotation = Euler(tuple(math.radians(v) for v in degrees), 'XYZ').to_quaternion()
            arm.pose.bones[name].rotation_quaternion = basis.inverted() @ rotation @ basis
        pelvis = arm.pose.bones['pelvis']
        pelvis.location = pelvis.bone.matrix_local.to_quaternion().inverted() @ Vector(
            (0, 0, -0.008 * factor))
        bpy.context.view_layer.update()
        for side in ['R', 'L']:
            foot = 'foot.' + side
            solve('thigh.' + side, 'shin.' + side, heads[foot], heads['shin.' + side])
            set_world(foot, heads[foot], rotation=rest[foot].to_quaternion())
        target = heads['hand.L'].lerp(Vector((0.19, -0.35, 1.35)), factor)
        solve('upper_arm.L', 'forearm.L', target, heads['forearm.L'] + Vector((0.22, 0, 0.02)))
        rotation = Euler((math.radians(-150 * factor), 0, math.radians(-10 * factor)),
                         'XYZ').to_quaternion() @ rest['hand.L'].to_quaternion()
        set_world('hand.L', target, rotation=rotation)

    arm.animation_data.action = None
    bpy.data.actions.remove(bpy.data.actions['Skill_01'])
    action = bpy.data.actions.new('Skill_01')
    action.use_fake_user = True
    arm.animation_data.action = action
    previous, samples = {}, []
    locations = {'pelvis', 'thigh.R', 'shin.R', 'foot.R', 'thigh.L', 'shin.L', 'foot.L',
                 'upper_arm.L', 'forearm.L', 'hand.L'}
    for frame in range(1, 80):
        time = (frame - 1) / 60
        apply(time)
        for bone in arm.pose.bones:
            if bone.name in previous and bone.rotation_quaternion.dot(previous[bone.name]) < 0:
                bone.rotation_quaternion.negate()
            previous[bone.name] = bone.rotation_quaternion.copy()
            bone.keyframe_insert('rotation_quaternion', frame=frame, group=bone.name)
            if bone.name in locations:
                bone.keyframe_insert('location', frame=frame, group=bone.name)
        samples.append({'time': time, **{name: list(arm.matrix_world @ arm.pose.bones[name].head)
                       for name in ['foot.R', 'foot.L', 'hand.L', 'staff_tip']}})
    for curve in curves(action):
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
    for name, digest in unchanged.items():
        if fingerprint(bpy.data.actions[name]) != digest:
            raise ValueError(f'Unexpected modification of {name}')
    baked_drift = {name: 0 for name in ['foot.R', 'foot.L']}
    for frame in range(1, 80):
        scene.frame_set(frame)
        for name in baked_drift:
            delta = (arm.matrix_world @ arm.pose.bones[name].head - heads[name]).length
            baked_drift[name] = max(baked_drift[name], delta)
    if max(baked_drift.values()) > 0.001:
        raise ValueError(f'Baked ankle drift exceeds one millimeter: {baked_drift}')
    report = {'duration': 1.30, 'impact': 0.58, 'fps': 60, 'unchangedActions': unchanged,
              'maxBakedAnkleDriftMeters': baked_drift, 'samples': samples}
    args.output.with_suffix('.cast.json').write_text(json.dumps(report, indent=2))
    arm.animation_data.action = bpy.data.actions['Idle']
    scene.frame_set(1)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)
    if args.glb:
        bpy.ops.object.select_all(action='DESELECT')
        arm.select_set(True)
        for obj in scene.objects:
            if obj.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == arm for m in obj.modifiers):
                obj.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.export_scene.gltf(filepath=str(args.glb.resolve()), export_format='GLB',
            use_selection=True, export_animations=True, export_animation_mode='ACTIONS',
            export_force_sampling=True, export_frame_range=False, export_anim_single_armature=True,
            export_image_format='JPEG', export_jpeg_quality=95)
    if args.render_dir:
        args.render_dir.mkdir(parents=True, exist_ok=True)
        arm.animation_data.action = action
        for label, time in [('anticipation', .25), ('contact', .58), ('recover', 1.05)]:
            frame = 1 + time * 60
            scene.frame_set(math.floor(frame), subframe=frame % 1)
            scene.render.filepath = str(args.render_dir / (label + '.png'))
            bpy.ops.render.render(write_still=True)
    print('PRIESTESS_CAST_READY', json.dumps(baked_drift), flush=True)


if __name__ == '__main__':
    main()
