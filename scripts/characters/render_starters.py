"""Render all authored actions and a duo portrait from the packed editable rigs.

blender -b --python scripts/characters/render_starters.py -- \
  --characters /path/to/starter-characters --metadata /path/to/starter-animation-metadata.json
"""
import argparse,bpy,json,math,os,sys
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--characters',required=True);p.add_argument('--metadata',required=True);p.add_argument('--duo-only',action='store_true');p.add_argument('--only',choices=['knight','priestess'])
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);metadata=json.load(open(a.metadata))
def reset(arm):
    for bone in arm.pose.bones:bone.location=(0,0,0);bone.rotation_quaternion=(1,0,0,0)
if not a.duo_only:
    for hero in ['knight','priestess']:
        if a.only and a.only!=hero:continue
        bpy.ops.wm.open_mainfile(filepath=os.path.join(a.characters,'starter-'+hero+'.blend'))
        arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');scene=bpy.context.scene
        scene.render.resolution_x=640;scene.render.resolution_y=800;scene.cycles.samples=16
        for clip,timing in metadata['models'][hero]['clips'].items():
            reset(arm);arm.animation_data.action=bpy.data.actions[clip]
            time=timing['impact'] if timing['impact'] is not None else (.18 if clip=='Run' else .8 if clip=='Victory' else .6)
            if clip=='Death':time=1.1
            scene.frame_set(round(time*60)+1)
            scene.render.filepath=os.path.join(a.characters,hero+'-'+clip+'.png');bpy.ops.render.render(write_still=True)
        if hero=='knight':
            reset(arm);arm.animation_data.action=bpy.data.actions['Skill_03'];scene.frame_set(38)
            scene.camera.data.ortho_scale=3.6;scene.camera.location=(.5,-5,1.5)
            scene.camera.rotation_euler=(Vector((0,0,1.3))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=os.path.join(a.characters,'knight-Skill_03-airborne.png');bpy.ops.render.render(write_still=True)
if a.only:sys.exit(0)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
for hero,x,angle in [('knight',-.57,-5),('priestess',.56,5)]:
    with bpy.data.libraries.load(os.path.join(a.characters,'starter-'+hero+'.blend'),link=False) as (source,target):
        target.objects=[name for name in source.objects if name.startswith('Starter_')]
    objects=[o for o in target.objects if o is not None]
    for obj in objects:scene.collection.objects.link(obj)
    arm=next(o for o in objects if o.type=='ARMATURE');reset(arm);arm.location.x=x;arm.rotation_euler.z=math.radians(angle)
scene.frame_set(37)
world=bpy.data.worlds.new('Midnight studio');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.05,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
for loc,power,size,color in [((-3,-4,4),750,4,(.84,.91,1)),((3,-2,3),500,3,(1,.86,.7)),((1,3,4),950,3,(.4,.63,1))]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.data.color=color
    light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.006));floor=bpy.context.object
material=bpy.data.materials.new('Slate stage');material.diffuse_color=(.026,.041,.071,1);material.use_nodes=True
node=material.node_tree.nodes.get('Principled BSDF');node.inputs['Base Color'].default_value=(.026,.041,.071,1);node.inputs['Roughness'].default_value=.36;node.inputs['Metallic'].default_value=.2;floor.data.materials.append(material)
bpy.ops.object.camera_add(location=(.15,-6,1.5));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=2.43
camera.rotation_euler=(Vector((0,0,1.00))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
scene.view_settings.view_transform='AgX';scene.render.resolution_x=1440;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(a.characters,'duo-preview.png');bpy.ops.render.render(write_still=True)
