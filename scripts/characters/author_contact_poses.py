"""Scratch-only knight motion candidate. Does not export GLB or edit its input.

blender -b --threads 2 --python author-contact-poses.py -- INPUT.blend OUTPUT.blend
Optional: --no-renders for a fast authoring/measurement pass.
Run from the workspace/repository root. OUTPUT must be below the current
directory's work/quality-reset/animation. The adjacent OUTPUT-report.json
records source SHA-256, unchanged action fingerprints, exact skill timings,
key postures, and actual baked contact-foot drift. No GLB is exported.
"""
import argparse, hashlib, json, math, os, sys
import bpy
from mathutils import Vector, Euler, Matrix

parser = argparse.ArgumentParser()
parser.add_argument('input')
parser.add_argument('output')
parser.add_argument('--no-renders', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = os.path.abspath(args.input)
output = os.path.abspath(args.output)
scratch = os.path.abspath(os.path.join(os.getcwd(), 'work', 'quality-reset', 'animation'))
assert os.path.commonpath([output, scratch]) == scratch, 'Output must stay in scratch animation directory'
assert os.path.normcase(source) != os.path.normcase(output), 'Never modify the input blend'
os.makedirs(os.path.dirname(output), exist_ok=True)
FPS = 60
TIMINGS = {'Attack_01': (.92, .42), 'Skill_01': (1.15, .48)}
REQUIRED = {'Idle','Run','Attack_01','Attack_02','Skill_01','Skill_02','Skill_03','Hit','Death','Victory'}

def sha(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def curves(action):
    if hasattr(action, 'fcurves'):
        return list(action.fcurves)
    result = []
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag = strip.channelbag(slot)
                if bag:
                    result.extend(bag.fcurves)
    return result

def fingerprint(action):
    data = [(c.data_path, c.array_index, [(list(k.co), list(k.handle_left), list(k.handle_right), k.interpolation) for k in c.keyframe_points]) for c in curves(action)]
    assert data, 'Expected populated original action ' + action.name
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

def smooth(value):
    value = max(0., min(1., value))
    return value * value * (3. - 2. * value)

def interpolated(keys, t):
    if t <= keys[0][0]:
        return keys[0][1]
    for (ta, a), (tb, b) in zip(keys, keys[1:]):
        if t <= tb:
            u = smooth((t-ta)/(tb-ta))
            return {n: tuple((1-u)*a.get(n, (0,0,0))[i] + u*b.get(n, (0,0,0))[i] for i in range(3)) for n in set(a)|set(b)}
    return keys[-1][1]

def pose(pelvis=(0,0,0), shift=(0,0,0), spine=(0,0,0), chest=(0,0,0), arm=(0,0,0), elbow=(0,0,0), offarm=(0,0,0), offelbow=(0,0,0), hand=(0,0,0)):
    return {'pelvis':pelvis,'@shift':shift,'spine':spine,'chest':chest,'upper_arm.R':arm,'forearm.R':elbow,'upper_arm.L':offarm,'forearm.L':offelbow,'hand.R':hand}

# Blender world axes: -Y faces the target, +Z is up, -X is the sword arm.
# Basic: compact high diagonal cut. Skill: wider, near-horizontal body-driven sweep.
# These are reviewed as an isolated candidate; timing is never changed to fit poses.
KEYS = {
 'Attack_01': [
  (0., pose()),
  (.13, pose(pelvis=(0,0,-2),shift=(-.008,.005,-.020),spine=(-2,0,-3),chest=(-2,0,-3),arm=(-72,2,-9),elbow=(-20,0,-4),offarm=(-18,0,8),offelbow=(-20,0,0))),
  (.27, pose(pelvis=(2,0,-7),shift=(-.050,.030,-.075),spine=(3,0,-7),chest=(-4,0,-5),arm=(-102,8,-13),elbow=(-18,0,-6),offarm=(-35,0,-12),offelbow=(-61,0,-15))),
  (.42, pose(pelvis=(6,0,5),shift=(.055,-.090,-.045),spine=(6,0,5),chest=(3,0,4),arm=(-84,3,12),elbow=(10,0,0),offarm=(-31,0,-15),offelbow=(-55,0,-12),hand=(0,0,-3))),
  (.52, pose(pelvis=(7,0,6),shift=(.063,-.105,-.065),spine=(9,0,6),chest=(4,0,5),arm=(-70,3,18),elbow=(11,0,0),offarm=(-27,0,-15),offelbow=(-47,0,-10),hand=(0,0,-4))),
  (.70, pose(pelvis=(0,0,1),shift=(.008,-.023,-.027),spine=(1,0,1),chest=(-1,0,0),arm=(-42,0,5),elbow=(-13,0,0),offarm=(-12,0,0),offelbow=(-14,0,0))),
  (.92, pose()),
 ],
 'Skill_01': [
  (0., pose()),
  (.16, pose(pelvis=(0,0,-4),shift=(-.015,.006,-.026),spine=(-2,0,-5),chest=(-1,0,-5),arm=(-72,-10,-20),elbow=(-25,0,-8),offarm=(-25,0,12),offelbow=(-35,0,0))),
  (.30, pose(pelvis=(3,0,-10),shift=(-.075,.045,-.125),spine=(7,0,-10),chest=(-4,0,-8),arm=(-85,-14,-43),elbow=(-30,0,-12),offarm=(-38,0,-12),offelbow=(-67,0,-20))),
  (.48, pose(pelvis=(8,0,8),shift=(.065,-.105,-.065),spine=(10,0,7),chest=(3,0,6),arm=(-103,8,22),elbow=(9,0,5),offarm=(-34,0,-17),offelbow=(-61,0,-12),hand=(0,0,-4))),
  (.64, pose(pelvis=(9,0,9),shift=(.075,-.115,-.090),spine=(12,0,8),chest=(5,0,6),arm=(-100,9,41),elbow=(4,0,8),offarm=(-30,0,-22),offelbow=(-52,0,-12),hand=(0,0,-6))),
  (.85, pose(pelvis=(0,0,2),shift=(.013,-.035,-.033),spine=(1,0,1),chest=(0,0,-2),arm=(-54,0,12),elbow=(-17,0,0),offarm=(-18,0,0),offelbow=(-24,0,0))),
  (1.15, pose()),
 ],
}

source_hash = sha(source)
bpy.ops.wm.open_mainfile(filepath=source)
scene = bpy.context.scene
scene.render.fps = FPS
arm = next(o for o in scene.objects if o.type == 'ARMATURE')
assert 'knight' in arm.name.lower(), 'This candidate is specific to the knight skeleton'
assert set(a.name for a in bpy.data.actions) == REQUIRED, 'Expected exactly ten original actions'
assert len(arm.data.bones) == 30
original = {a.name: fingerprint(a) for a in bpy.data.actions if a.name not in TIMINGS}
rest_world = {b.name: arm.matrix_world @ b.matrix_local for b in arm.data.bones}
rest_heads = {n: m.translation.copy() for n,m in rest_world.items()}
world_inv = arm.matrix_world.inverted()

def desired_bone(name, head, tail=None, orientation=None):
    rest = rest_world[name]
    q = orientation
    if q is None:
        rest_dir = rest.to_quaternion() @ Vector((0,1,0))
        q = rest_dir.rotation_difference((tail-head).normalized()) @ rest.to_quaternion()
    arm.pose.bones[name].matrix = world_inv @ Matrix.LocRotScale(head, q, Vector((1,1,1)))
    bpy.context.view_layer.update()

def ankle_target(clip, side, t):
    target = rest_heads['foot.' + side].copy()
    if side == 'R':
        return target
    distance = .060 if clip == 'Attack_01' else .100
    start, planted = .06, .24
    lift_start, end = ((.72,.92) if clip == 'Attack_01' else (.88,1.15))
    if t < planted:
        u = max(0., min(1., (t-start)/(planted-start)))
        travel = smooth(u)
        height = math.sin(math.pi*u)*.025
    elif t <= lift_start:
        travel, height = 1., 0.
    else:
        u = min(1., (t-lift_start)/(end-lift_start))
        travel, height = 1.-smooth(u), math.sin(math.pi*u)*.020
    target.y -= distance*travel
    target.z += height
    return target

def plant_leg(side, target):
    thigh, shin, foot = ['%s.%s' % (part, side) for part in ('thigh','shin','foot')]
    hip = arm.matrix_world @ arm.pose.bones[thigh].head
    a = arm.data.bones[thigh].length
    b = arm.data.bones[shin].length
    delta = target-hip
    length = delta.length
    assert abs(a-b)+1e-5 < length < a+b+1e-5, 'Foot target outside reachable leg length'
    direction = delta.normalized()
    along = (a*a-b*b+length*length)/(2*length)
    bend = Vector((0,-1,0))
    bend -= direction*bend.dot(direction)
    bend.normalize()
    knee = hip + direction*along + bend*math.sqrt(max(0,a*a-along*along))
    desired_bone(thigh, hip, knee)
    desired_bone(shin, knee, target)
    desired_bone(foot, target, orientation=rest_world[foot].to_quaternion())

def apply_pose(clip, t):
    values = interpolated(KEYS[clip],t)
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        basis = pb.bone.matrix_local.to_quaternion()
        degrees = values.get(pb.name,(0,0,0))
        pb.rotation_quaternion = basis.inverted() @ Euler(tuple(math.radians(d) for d in degrees),'XYZ').to_quaternion() @ basis
        pb.location = (0,0,0)
        pb.scale = (1,1,1)
    # Preserve ordinary cloth motion modestly; it follows torso with little independent swing.
    for name in ('cape','cape_tip','robe.R','robe.L','robe_tip.R','robe_tip.L'):
        pb = arm.pose.bones[name]
        amplitude = (2 if name.endswith('tip') else 1) * math.sin(math.pi*t/TIMINGS[clip][0])
        basis = pb.bone.matrix_local.to_quaternion()
        pb.rotation_quaternion = basis.inverted() @ Euler((math.radians(amplitude),0,0)).to_quaternion() @ basis
    pelvis = arm.pose.bones['pelvis']
    # Convert armature/world translation to the pelvis's bone basis.
    pelvis.location = pelvis.bone.matrix_local.to_quaternion().inverted() @ Vector(values.get('@shift',(0,0,0)))
    bpy.context.view_layer.update()
    for side in ('R','L'):
        plant_leg(side,ankle_target(clip,side,t))

report = {'input':source,'inputSha256':source_hash,'output':output,'fps':FPS,'unchangedActionHashes':original,'clips':{},'reviewStatus':'candidate awaiting visual review; not exported to the game'}
for clip,(duration,impact) in TIMINGS.items():
    old = bpy.data.actions[clip]
    arm.animation_data.action = None
    bpy.data.actions.remove(old)
    action = bpy.data.actions.new(clip)
    action.use_fake_user = True
    arm.animation_data.action = action
    times = sorted(set([0.,duration,impact]+[f/FPS for f in range(math.floor(duration*FPS)+1)]+[k[0] for k in KEYS[clip]]))
    samples = []
    previous = {}
    for t in times:
        frame = 1+t*FPS
        scene.frame_set(math.floor(frame),subframe=frame%1)
        apply_pose(clip,t)
        for pb in arm.pose.bones:
            if pb.name in previous and pb.rotation_quaternion.dot(previous[pb.name]) < 0:
                pb.rotation_quaternion.negate()
            previous[pb.name] = pb.rotation_quaternion.copy()
            pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
            if pb.name in ('pelvis','thigh.R','shin.R','foot.R','thigh.L','shin.L','foot.L'):
                pb.keyframe_insert('location',frame=frame,group=pb.name)
        samples.append({'time':t,**{n:list(arm.matrix_world @ arm.pose.bones[n].head) for n in ('pelvis','thigh.R','thigh.L','shin.R','shin.L','foot.R','foot.L','hand.R','sword_tip')}})
    for curve in curves(action):
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
    contact = [s for s in samples if impact-.04 <= s['time'] <= impact+.12]
    drift = {n:max((Vector(s[n])-Vector(contact[0][n])).length for s in contact) for n in ('foot.R','foot.L')}
    assert max(drift.values()) < .0005, 'Planted ankle drift exceeded 0.5 mm'
    # Re-evaluate the baked action rather than trusting only the IK construction.
    baked=[]
    for sample in contact:
        frame=1+sample['time']*FPS
        scene.frame_set(math.floor(frame),subframe=frame%1)
        bpy.context.view_layer.update()
        baked.append({n:list(arm.matrix_world @ arm.pose.bones[n].head) for n in ('foot.R','foot.L')})
    baked_drift={n:max((Vector(s[n])-Vector(baked[0][n])).length for s in baked) for n in ('foot.R','foot.L')}
    assert max(baked_drift.values()) < .0005, 'Baked action foot drift exceeded 0.5 mm'
    key_postures=[]
    for sample in samples:
        if any(abs(sample['time']-t)<1e-7 for t in ((.27,impact,.52) if clip=='Attack_01' else (.30,impact,.64))):
            flex={}
            for side in ('R','L'):
                knee=Vector(sample['shin.'+side]);hip=Vector(sample['thigh.'+side]);ankle=Vector(sample['foot.'+side])
                flex[side]=180-math.degrees((hip-knee).angle(ankle-knee))
            key_postures.append({'time':sample['time'],'kneeFlexionDegrees':flex,'pelvis':sample['pelvis'],'swordTip':sample['sword_tip']})
    report['clips'][clip] = {'duration':duration,'impact':impact,'plantedContactAnkleDriftMeters':drift,'bakedContactAnkleDriftMeters':baked_drift,'keyPostures':key_postures,'samples':samples}
    print('ACTION_AUTHORED',clip,json.dumps(drift),flush=True)

assert {a.name:fingerprint(a) for a in bpy.data.actions if a.name not in TIMINGS} == original
assert set(a.name for a in bpy.data.actions) == REQUIRED
arm.animation_data.action = bpy.data.actions['Idle']
scene.frame_start, scene.frame_end = 1,145
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=output,compress=True)
assert sha(source) == source_hash, 'Input file unexpectedly changed'
report_path = os.path.splitext(output)[0]+'-report.json'

if not args.no_renders:
    for obj in list(scene.objects):
        if obj.type in ('CAMERA','LIGHT'):
            bpy.data.objects.remove(obj,do_unlink=True)
    scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.world=bpy.data.worlds.new('Contact pose review');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.085,.105,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
    for pos,power,size in [((-3,-4,4),550,4),((3,-2,3),250,3),((0,3,4),400,3)]:
        bpy.ops.object.light_add(type='AREA',location=pos);lamp=bpy.context.object
        lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size
        lamp.rotation_euler=(Vector((0,0,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=20,location=(0,0,-.002))
    floor=bpy.context.object;floor.name='scratch_contact_floor'
    material=bpy.data.materials.new('scratch_floor');material.diffuse_color=(.13,.15,.19,1);floor.data.materials.append(material)
    bpy.ops.object.camera_add(location=(3,-4,2.0));camera=bpy.context.object
    camera.data.type='ORTHO';camera.data.ortho_scale=3.25
    camera.rotation_euler=(Vector((0,-.20,1.18))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
    scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
    for clip,(duration,impact) in TIMINGS.items():
        arm.animation_data.action=bpy.data.actions[clip]
        for label,t in [('windup',.27 if clip=='Attack_01' else .30),('contact',impact),('follow',.52 if clip=='Attack_01' else .64)]:
            frame=1+t*FPS;scene.frame_set(math.floor(frame),subframe=frame%1)
            scene.render.filepath=os.path.join(os.path.dirname(output),clip+'-'+label+'.png')
            bpy.ops.render.render(write_still=True)
            print('POSE_RENDERED',clip,label,flush=True)

with open(report_path,'w',encoding='utf-8') as f:
    json.dump(report,f,indent=2)
print('CANDIDATE_COMPLETE',output,flush=True)
