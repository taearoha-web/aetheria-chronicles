"""Export edited, packed Blender rigs without the owner's original source GLBs.

blender -b --python scripts/characters/export_packed_starters.py -- \
  --characters art/characters --project .

All ten authored actions and embedded textures are retained. This never saves
over the editable .blend files. Run npm run check:assets after exporting.
"""
import argparse,bpy,hashlib,json,os,sys
p=argparse.ArgumentParser();p.add_argument('--characters',required=True);p.add_argument('--project',required=True);p.add_argument('--only',choices=['knight','priestess'])
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
models=os.path.join(a.project,'public','assets','models');metadata_path=os.path.join(models,'starter-animation-metadata.json')
metadata=json.load(open(metadata_path,encoding='utf-8'))
for hero in ['knight','priestess']:
    if a.only and a.only!=hero:continue
    bpy.ops.wm.open_mainfile(filepath=os.path.join(a.characters,'starter-'+hero+'.blend'))
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    for bone in arm.pose.bones:bone.location=(0,0,0);bone.rotation_quaternion=(1,0,0,0)
    arm.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and any(mod.type=='ARMATURE' and mod.object==arm for mod in obj.modifiers):obj.select_set(True)
    bpy.context.view_layer.objects.active=arm
    path=os.path.join(models,'starter-'+hero+'.glb')
    options={'filepath':path,'export_format':'GLB','use_selection':True,'export_animations':True,'export_animation_mode':'ACTIONS','export_force_sampling':True,'export_frame_range':False,'export_anim_single_armature':True,'export_optimize_animation_size':True,'export_image_format':'JPEG','export_jpeg_quality':90,'export_all_influences':False}
    available={prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    bpy.ops.export_scene.gltf(**{k:v for k,v in options.items() if k in available})
    with open(path,'rb') as stream:metadata['models'][hero]['model_sha256']=hashlib.file_digest(stream,'sha256').hexdigest()
    metadata['models'][hero]['bytes']=os.path.getsize(path)
with open(metadata_path,'w',encoding='utf-8') as stream:json.dump(metadata,stream,indent=2)
