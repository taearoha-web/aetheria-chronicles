"""Build the owner's starter heroes with Blender 5.2.

blender -b --factory-startup --python scripts/characters/build_starters.py -- \
  --knight-source /path/to/knight.glb --priestess-source /path/to/priestess.glb \
  --project /path/to/aetheria-chronicles --deliverables /path/to/starter-characters

Sources are read-only. All textures are packed into editable .blend files.
The bind pose, semantic masks and anatomical landmarks below are specific to
these two approved character designs, not a general-purpose auto-rigger.
"""
import argparse, bpy, hashlib, json, math, os, sys
from mathutils import Vector, Euler, Quaternion
import numpy as np

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
parser=argparse.ArgumentParser()
parser.add_argument('--knight-source',required=True);parser.add_argument('--priestess-source',required=True)
parser.add_argument('--project',required=True);parser.add_argument('--deliverables',required=True)
parser.add_argument('--only',choices=['knight','priestess']);parser.add_argument('--skip-renders',action='store_true')
parser.add_argument('--review-fast',action='store_true')
A=parser.parse_args(args)
MODEL_DIR=os.path.join(A.project,'public','assets','models')
os.makedirs(MODEL_DIR,exist_ok=True);os.makedirs(A.deliverables,exist_ok=True)
FPS=60
TIMINGS={
 'knight':{'Idle':(2.4,None),'Run':(.72,None),'Attack_01':(.92,.42),'Attack_02':(1.05,.48),'Skill_01':(1.15,.48),'Skill_02':(1.4,.65),'Skill_03':(1.85,1.0),'Hit':(.45,.08),'Death':(1.4,.75),'Victory':(2.0,None)},
 'priestess':{'Idle':(2.4,None),'Run':(.84,None),'Attack_01':(1.1,.52),'Attack_02':(1.2,.58),'Skill_01':(1.3,.58),'Skill_02':(1.5,.7),'Skill_03':(1.8,.95),'Hit':(.45,.08),'Death':(1.4,.75),'Victory':(2.0,None)}}

def filehash(p):
    with open(p,'rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def skeleton(key):
    female=key=='priestess';d=-.1 if female else 0
    B={}
    def bone(name,a,b,parent=None):B[name]=(tuple(a),tuple(b),parent)
    bone('root',(0,0,0),(0,0,.15))
    bone('pelvis',(0,d,1.00),(0,d,1.15),'root')
    bone('spine',(0,d,1.15),(0,d,1.33),'pelvis')
    bone('chest',(0,d,1.33),(0,d,1.51),'spine')
    bone('neck',(0,d,1.51),(0,d,1.64),'chest')
    bone('head',(0,d,1.64),(0,d,1.86),'neck')
    for side,s in [('R',-1),('L',1)]:
        shoulder=(s*.19,d,1.5)
        elbow=(s*.275,d-.03,1.24)
        wrist=(s*.325,d-.045,.985)
        hand=(s*.34,d-.045,.91)
        if female and side=='R':shoulder=(-.238,-.118,1.50);elbow=(-.263,-.089,1.382);wrist=(-.380,-.243,1.329);hand=(-.405,-.305,1.352)
        if female and side=='L':shoulder=(.193,-.078,1.50);elbow=(.255,-.075,1.26);wrist=(.350,-.18,1.08);hand=(.400,-.233,.90)
        if not female and side=='R':shoulder=(-.196,.114,1.50);elbow=(-.257,.152,1.24);wrist=(-.316,.143,1.04);hand=(-.284,.111,.950)
        if not female and side=='L':shoulder=(.236,-.110,1.50);elbow=(.334,-.107,1.24);wrist=(.337,-.152,1.04);hand=(.314,-.142,.910)
        bone('clavicle.'+side,(s*.045,d,1.46),shoulder,'chest')
        bone('upper_arm.'+side,shoulder,elbow,'clavicle.'+side)
        bone('forearm.'+side,elbow,wrist,'upper_arm.'+side)
        bone('hand.'+side,wrist,hand,'forearm.'+side)
        if female:
            hip=(s*.072,-.075,.99);knee=(s*.047,-.14 if side=='L' else -.05,.57);ankle=(s*.042,-.17 if side=='L' else -.01,.15);toe=(s*.042,-.28 if side=='L' else -.12,.075)
        else:
            hip=(s*.13,.01,1.0);knee=(s*.17,-.01,.585);ankle=(s*.225,-.015,.15);toe=(s*.225,-.15,.05)
        bone('thigh.'+side,hip,knee,'pelvis');bone('shin.'+side,knee,ankle,'thigh.'+side);bone('foot.'+side,ankle,toe,'shin.'+side)
        bone('robe.'+side,(s*.14,d+.04,1.03),(s*.22,d+.06,.68),'pelvis')
        bone('robe_tip.'+side,(s*.22,d+.06,.68),(s*.29,d+.09,.27),'robe.'+side)
    bone('cape',(0,.135,1.48),(.21,.18,1.14),'chest')
    bone('cape_tip',(.21,.18,1.14),(.40,.22,.81),'cape')
    bone('hair',(0,d+.075,1.75),(0,d+.115,1.52),'head')
    bone('hair_tip',(0,d+.115,1.52),(0,d+.17,1.30),'hair')
    grip=(-.404,-.303,1.33) if female else (-.31,.11,.97)
    tip=(-.459,-.299,1.94) if female else (-.655,-.195,.09)
    bone('weapon',grip,tip,'hand.R')
    bone('staff_tip' if female else 'sword_tip',tip,(tip[0],tip[1],tip[2]+.035),'weapon')
    return B

def prepare(source,key):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps=FPS
    bpy.ops.import_scene.gltf(filepath=source)
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    if len(meshes)>1:bpy.ops.object.join()
    mesh=bpy.context.object;mesh.parent=None
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    xyz=np.array([v.co[:] for v in mesh.data.vertices]);lo=xyz.min(0);hi=xyz.max(0)
    target=1.95 if key=='priestess' else 1.9
    center=(lo+hi)*.5;center[2]=lo[2];factor=target/(hi[2]-lo[2])
    for v in mesh.data.vertices:v.co=(v.co-Vector(center))*factor
    # Preserve UV seams. Welding this particular generated source before collapse
    # destroyed its UV/topology correspondence; never remove doubles here.
    modifier=mesh.modifiers.new('UV-preserving mobile reduction','DECIMATE')
    modifier.ratio=min(1.0,80000/max(1,len(mesh.data.polygons)))
    modifier.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for p in mesh.data.polygons:p.use_smooth=True
    mesh.data.update();mesh.name='Starter_'+key+'_surface'
    for img in bpy.data.images:
        if max(img.size)>1024:
            ratio=1024/max(img.size);img.scale(round(img.size[0]*ratio),round(img.size[1]*ratio))
        img.pack()
    for mat in mesh.data.materials:
        mat.name='Starter_'+key+'_PBR'
        if mat.use_nodes:
            bsdf=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if bsdf:bsdf.inputs['IOR'].default_value=1.45
    return mesh

def distance(points,a,b):
    a=np.array(a);b=np.array(b);ab=b-a
    t=np.clip(((points-a)*ab).sum(1)/(ab@ab),0,1)
    return np.linalg.norm(points-(a+t[:,None]*ab),axis=1)

def semantic_regions(xyz,key):
    x,y,z=xyz.T;female=key=='priestess'
    B=skeleton(key)
    if female:
        staff_x=-.26-.108*z
        shaft=(abs(x-staff_x)<.055)&(abs(y+.31)<.075)&(x<-.25)
        ornament=(z>1.58)&(x<-.24)&(abs(y+.30)<.11)
        ribbon=(x<-.435)&(z>.70)&(z<1.52)&(y<-.08)
        weapon=shaft|ornament|ribbon
    else:
        weapon=(distance(xyz,(-.31,.11,.97),(-.655,-.195,.09))<.115)&(z<1.01)
        weapon|=(abs(z-.91)<.075)&(abs(x+.32)<.16)&(abs(y-.08)<.085)
        weapon&=(x<-.225)&((z>=.88)|(x<(-.28-.30*(.87-z))))
        # Camera-ray verified inner hooked guard, below the main crossbar.
        # Its x=-.26, y=+.09, z=.85 surface is distinct from the hip pouch.
        weapon|=(x>-.355)&(x<-.21)&(y>.035)&(y<.18)&(z>.82)&(z<.89)
        weapon|=(x>-.34)&(x<-.26)&(y>.035)&(y<.12)&(z>.755)&(z<.825)
    cape=(y>.075)&(z>.43)&(z<1.49)&((abs(x)>.21)|(y>.21)) if female else (x>.07)&(y>.125)&(z>.95)&(z<1.51)
    if not female:cape|=((x>.40)&(z>.89)&(z<1.47))|((x>.23)&(y>.04)&(z>.95)&(z<1.5))
    hair=(z>1.43)&(z<1.87)&(y>(.08 if female else .12))&(abs(x)<.19)
    if not female:hair&=z>1.71
    head=(z>1.635)&(abs(x)<.24)
    robe=(z<1.065)&(z>.27)&((abs(x)>(.17 if female else .24))|(y>(.075 if female else .12)))
    def arm_capsule(side):
        d=np.minimum.reduce([distance(xyz,B[name+'.'+side][0],B[name+'.'+side][1])/radius for name,radius in [('upper_arm',.115),('forearm',.095),('hand',.078)]])
        return (d<1)&(z>.89)&(z<1.58)
    right_arm=arm_capsule('R');left_arm=arm_capsule('L')
    cape&=~(right_arm|left_arm)
    regions=np.full(len(xyz),'body',dtype=object)
    regions[z<1.08]='legs';regions[robe]='robe';regions[right_arm]='arm.R';regions[left_arm]='arm.L';regions[cape]='cape';regions[head]='head';regions[hair]='hair';regions[weapon]='weapon'
    return regions

def split_semantic_surfaces(mesh,key):
    # Only rigid equipment is a separate surface; all organic and cloth vertices
    # remain connected. Preserve every source UV and custom corner normal.
    old=mesh.data
    face_xyz=np.array([p.center[:] for p in old.polygons])
    labels=semantic_regions(face_xyz,key)
    vertices=[];faces=[];vertex_labels=[];lookup={}
    normals=[tuple(n.vector) for n in old.corner_normals]
    uv_layers=[(layer.name,[tuple(item.uv) for item in layer.data]) for layer in old.uv_layers]
    for poly,label in zip(old.polygons,labels):
        face=[]
        for original_index in poly.vertices:
            token=(int(original_index),'weapon' if label=='weapon' else 'organic')
            if token not in lookup:
                lookup[token]=len(vertices);vertices.append(tuple(old.vertices[original_index].co));vertex_labels.append(label)
            face.append(lookup[token])
        faces.append(face)
    data=bpy.data.meshes.new(key+'_semantic_surface');data.from_pydata(vertices,[],faces);data.update()
    for mat in old.materials:data.materials.append(mat)
    for poly,original in zip(data.polygons,old.polygons):poly.material_index=original.material_index;poly.use_smooth=True
    for name,coords in uv_layers:
        layer=data.uv_layers.new(name=name)
        for item,uv in zip(layer.data,coords):item.uv=uv
    if len(normals)==len(data.loops):data.normals_split_custom_set(normals)
    mesh.data=data;bpy.data.meshes.remove(old)
    return np.array(vertex_labels,dtype=object)

def bind(mesh,key,B):
    regions=split_semantic_surfaces(mesh,key)
    bpy.ops.object.select_all(action='DESELECT')
    arm_data=bpy.data.armatures.new('Starter_'+key+'_skeleton')
    arm=bpy.data.objects.new('Starter_'+key+'_rig',arm_data);bpy.context.collection.objects.link(arm)
    arm.show_in_front=True;arm.data.display_type='OCTAHEDRAL';arm.select_set(True);bpy.context.view_layer.objects.active=arm
    bpy.ops.object.mode_set(mode='EDIT')
    for name,(head,tail,parent) in B.items():
        bone=arm.data.edit_bones.new(name);bone.head=head;bone.tail=tail
        if parent:bone.parent=arm.data.edit_bones[parent]
        bone.use_deform=not name.endswith('_tip') or name in ('cape_tip','hair_tip')
    bpy.ops.object.mode_set(mode='OBJECT')
    xyz=np.array([v.co[:] for v in mesh.data.vertices]);x,y,z=xyz.T;female=key=='priestess'
    names=list(B);n=len(xyz);weights=np.zeros((n,len(names)),dtype=np.float32)
    idx={name:i for i,name in enumerate(names)}
    groups={'body':['pelvis','spine','chest','neck'],'legs':['pelvis','thigh.R','shin.R','foot.R','thigh.L','shin.L','foot.L'],
      'robe':['pelvis','robe.R','robe_tip.R','robe.L','robe_tip.L'],'arm.R':['chest','clavicle.R','upper_arm.R','forearm.R','hand.R'],
      'arm.L':['chest','clavicle.L','upper_arm.L','forearm.L','hand.L'],'cape':['chest','cape','cape_tip'],'hair':['head','hair','hair_tip'],'head':['neck','head'],'weapon':['weapon']}
    # Continuous spatial fields preserve the source's fused cloth/body topology.
    # No organic region may abruptly exclude an anatomical bone at a triangle edge.
    def smooth(a,b,v):
        t=np.clip((v-a)/(b-a),0,1);return t*t*(3-2*t)
    def field(candidates):
        dist=np.stack([distance(xyz,B[name][0],B[name][1]) for name in candidates],axis=1)
        score=1/(dist+.035)**6
        for side in ['R','L']:
            arm_names=[p+'.'+side for p in ['upper_arm','forearm','hand']]
            limb_distance=np.minimum.reduce([distance(xyz,B[name][0],B[name][1]) for name in arm_names])
            arm_gate=1-smooth(.16,.25,limb_distance)
            if not female:
                boundary=(.16 if side=='R' else .17)+(1-smooth(1.10,1.5,z))*(.025 if side=='R' else .07)
                arm_gate*=smooth(boundary,boundary+.025,-x if side=='R' else x)*smooth(.88 if side=='R' else .84,.94 if side=='R' else .91,z)
            for j,name in enumerate(candidates):
                if name in arm_names:score[:,j]*=arm_gate
        score/=score.sum(axis=1,keepdims=True)
        result=np.zeros_like(weights)
        for j,name in enumerate(candidates):result[:,idx[name]]=score[:,j]
        return result
    anatomy=['pelvis','spine','chest','neck','head']+[p+'.'+s for s in ['R','L'] for p in ['clavicle','upper_arm','forearm','hand','thigh','shin','foot']]
    weights=field(anatomy)
    if female:
        cape_gate=smooth(-.02,.14,y)*smooth(.16,.28,abs(x))*smooth(.30,.50,z)*(1-smooth(1.39,1.55,z))
    else:
        outer=smooth(.34,.425,x);back=smooth(-.025,.095,y)*smooth(.13,.28,x)
        cape_gate=np.maximum(outer,back)*smooth(.78,.98,z)*(1-smooth(1.40,1.59,z))
        left_arm_dist=np.minimum.reduce([distance(xyz,B[name+'.L'][0],B[name+'.L'][1]) for name in ['upper_arm','forearm','hand']])
        cape_gate=np.maximum(outer,back*smooth(.065,.12,left_arm_dist))*smooth(.78,.98,z)*(1-smooth(1.40,1.59,z))
    cloth=field(['pelvis','spine','chest','cape','cape_tip'])
    weights=weights*(1-cape_gate[:,None])+cloth*cape_gate[:,None]
    robe_gate=(1-smooth(.92,1.12,z))*smooth(.16,.27,abs(x))*smooth(.16,.33,z)
    if female:robe_gate=np.maximum(robe_gate,(1-smooth(.94,1.13,z))*smooth(-.01,.15,y))*smooth(.18,.34,z)
    robe_gate*=.8 if female else .5
    hand_distance=np.minimum.reduce([distance(xyz,B['hand.'+side][0],B['hand.'+side][1]) for side in ['R','L']])
    robe_gate*=smooth(.085,.18,hand_distance)
    robe_field=field(['pelvis','robe.R','robe_tip.R','robe.L','robe_tip.L'])
    weights=weights*(1-robe_gate[:,None])+robe_field*robe_gate[:,None]
    if female:
        hair_gate=smooth(.00,.12,y)*smooth(1.30,1.50,z)*(1-smooth(1.79,1.9,z))*(1-smooth(.15,.23,abs(x)))
        hair_field=field(['head','hair','hair_tip'])
        weights=weights*(1-hair_gate[:,None])+hair_field*hair_gate[:,None]
    weights[regions=='weapon']=0;weights[regions=='weapon',idx['weapon']]=1
    # Smooth only the weight field across coincident source UV vertices and
    # geometric neighbors. This is not a destructive mesh/UV weld. It reconnects
    # organic shoulder/sleeve boundaries while keeping the entire weapon rigid.
    logical_key=np.column_stack((np.round(xyz,5),(regions=='weapon').astype(int)))
    _,inverse=np.unique(logical_key,axis=0,return_inverse=True)
    logical_count=int(inverse.max())+1
    logical=np.zeros((logical_count,len(names)),dtype=np.float64)
    counts=np.bincount(inverse,minlength=logical_count)
    np.add.at(logical,inverse,weights);logical/=counts[:,None]
    weapon_locked=np.zeros(logical_count,dtype=bool);weapon_locked[inverse[regions=='weapon']]=True
    logical[weapon_locked]=0;logical[weapon_locked,idx['weapon']]=1
    edges=np.array([e.vertices[:] for e in mesh.data.edges],dtype=np.int64)
    a=inverse[edges[:,0]];b=inverse[edges[:,1]]
    nonzero=(a!=b)&(~weapon_locked[a])&(~weapon_locked[b]);a=a[nonzero];b=b[nonzero]
    a,b=np.concatenate([a,b]),np.concatenate([b,a])
    degree=np.bincount(a,minlength=logical_count)
    for iteration in range(3):
        total=np.zeros_like(logical);np.add.at(total,a,logical[b])
        avg=total/np.maximum(1,degree)[:,None]
        logical=.58*logical+.42*avg
        logical[weapon_locked]=0;logical[weapon_locked,idx['weapon']]=1
        logical[~weapon_locked,idx['weapon']]=0
    order=np.argsort(logical,axis=1)[:,::-1];keep=np.zeros_like(logical,dtype=bool)
    np.put_along_axis(keep,order[:,:4],True,axis=1);logical*=keep;logical/=logical.sum(axis=1,keepdims=True)
    weights=logical[inverse].astype(np.float32)
    assert np.all(np.isfinite(weights)) and np.max(abs(weights.sum(1)-1))<1e-5
    for name in names:
        group=mesh.vertex_groups.new(name=name)
        column=weights[:,idx[name]]
        # Quantization into 256 buckets makes authored source groups compact and
        # deterministic while retaining smooth blends. Normalize afterward below.
        for bucket in np.unique(np.round(column[column>0]*255).astype(int)):
            if bucket==0:continue
            indices=np.where(np.round(column*255).astype(int)==bucket)[0].tolist()
            if indices:group.add(indices,float(bucket)/255,'REPLACE')
    bpy.context.view_layer.objects.active=mesh;mesh.select_set(True)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    mod=mesh.modifiers.new('Anatomical skeleton','ARMATURE');mod.object=arm;mod.use_deform_preserve_volume=False
    mesh.parent=arm
    arm['source_role']=key;arm['bind_pose']='Approved relaxed source pose; +Z front in glTF'
    arm['rig_notes']='Authored continuous spatial weights; rigid weapon; measured asymmetric joints; secondary cloth chains.'
    report={'vertex_count':n,'regions':{r:int((regions==r).sum()) for r in groups},'weighted_bones':{name:int((weights[:,idx[name]]>.001).sum()) for name in names},'unweighted_vertices':int((weights.sum(1)==0).sum()),'max_influences':int((weights>0).sum(1).max()),'weights_normalized':True}
    return arm,report

def pose_default():return {}
def r(p,name,x=0,y=0,z=0):p[name]=(x,y,z)
def common_secondary(p,phase,amount=1):
    r(p,'cape',math.sin(phase-.4)*3*amount,0,math.sin(phase)*2*amount)
    r(p,'cape_tip',math.sin(phase-.9)*5*amount,0,math.cos(phase)*2*amount)
    r(p,'hair',math.sin(phase-.2)*1.2*amount,0,math.sin(phase)*1.2*amount)
    r(p,'hair_tip',math.sin(phase-.6)*2*amount,0,0)
    for side,sgn in [('R',-1),('L',1)]:
        r(p,'robe.'+side,math.sin(phase+sgn)*2.3*amount,math.sin(phase)*sgn,0)
        r(p,'robe_tip.'+side,math.sin(phase+sgn-.5)*3*amount,0,0)

def keypose(key,clip,t,duration,impact):
    female=key=='priestess';u=t/duration;p={};loc={};phase=u*math.tau
    common_secondary(p,phase,.55 if clip=='Idle' else 1)
    if clip=='Idle':
        r(p,'spine',math.sin(phase)*.7,0,0);r(p,'chest',-math.sin(phase)*.45,0,math.sin(phase)*.4)
        r(p,'head',.4*math.sin(phase),1.0*math.sin(phase),0)
        r(p,'upper_arm.L',.6*math.sin(phase),0,.35*math.sin(phase));r(p,'forearm.L',.4*math.sin(phase+.2),0,0)
        loc['pelvis']=(0,0,.004*math.sin(phase))
    elif clip=='Run':
        stride=17 if female else 27
        loc['pelvis']=(0,0,.018*(1-math.cos(phase*2)))
        r(p,'pelvis',0,0,2.5*math.sin(phase));r(p,'spine',-7,0,2*math.sin(phase));r(p,'chest',0,0,-3*math.sin(phase))
        for side,sgn in [('R',1),('L',-1)]:
            swing=math.sin(phase)*sgn
            knee=max(0,-swing)*(28 if female else 43)
            r(p,'thigh.'+side,stride*swing,0,0);r(p,'shin.'+side,knee,0,0);r(p,'foot.'+side,-knee*.65-stride*swing*.3,0,0)
            r(p,'upper_arm.'+side,-swing*(5 if female and side=='R' else 13),0,sgn*3)
            r(p,'forearm.'+side,-9-abs(swing)*7,0,0)
        common_secondary(p,phase,1.7)
    elif clip=='Hit':
        f=math.sin(min(1,t/.12)*math.pi/2)*max(0,1-(t-.10)/.35)
        r(p,'spine',12*f,0,-6*f);r(p,'chest',8*f,0,3*f);r(p,'head',-8*f,0,0);r(p,'upper_arm.L',15*f,0,8*f)
        loc['pelvis']=(0,.025*f,-.035*f)
    elif clip=='Death':
        f=min(1,t/.8);s=f*f*(3-2*f)
        r(p,'pelvis',8*s,0,3*s);r(p,'spine',30*s,0,-3*s);r(p,'neck',22*s,0,0)
        r(p,'thigh.R',-60*s,0,0);r(p,'shin.R',100*s,0,0);r(p,'foot.R',-40*s,0,0)
        r(p,'thigh.L',-53*s,0,0);r(p,'shin.L',94*s,0,0);r(p,'foot.L',-38*s,0,0)
        r(p,'upper_arm.R',-8*s,0,-5*s);r(p,'upper_arm.L',-12*s,0,8*s)
        loc['pelvis']=(0,.025*s,-.42*s)
    elif clip=='Victory':
        f=math.sin(math.pi*min(1,u/.28)/2);end=max(0,min(1,(1-u)/.18));f*=end
        r(p,'spine',-3*f,0,0);r(p,'head',-4*f,0,0)
        r(p,'upper_arm.L',-85*f,0,-15*f);r(p,'forearm.L',-32*f,0,0)
        r(p,'upper_arm.R',(-10 if female else -115)*f,0,-5*f);r(p,'forearm.R',(-6 if female else -30)*f,0,0)
    else:
        # Separate anticipation, release, held contact, and recovery windows.
        wind=max(0,min(1,t/(impact*.64)))
        release=max(0,min(1,(t-impact*.64)/(impact*.36)))
        recovery=max(0,min(1,(t-impact-.09)/(duration-impact-.09)))
        hold=1-recovery; anticipation=(1-release)*wind
        hit=release*hold
        if not female and clip in ('Attack_01','Attack_02','Skill_01'):
            big=clip=='Skill_01';cross=clip=='Attack_02'
            r(p,'pelvis',-3*hit,0,-9*anticipation+12*hit)
            r(p,'spine',-4*anticipation+8*hit,0,-12*anticipation+12*hit)
            r(p,'chest',-3*anticipation+5*hit,0,-12*anticipation+12*hit)
            r(p,'upper_arm.R',-(122 if big else 102)*anticipation-50*hit,(-25 if cross else -8)*anticipation+18*hit,-22*anticipation+(38 if cross else 22)*hit)
            r(p,'forearm.R',-36*anticipation+18*hit,0,7*hit)
            r(p,'hand.R',-5*anticipation,0,-7*hit)
            r(p,'upper_arm.L',-14*anticipation+8*hit,0,-16*hit)
            r(p,'forearm.L',-10*hit,0,0)
            r(p,'thigh.L',-7*hit,0,0);r(p,'shin.L',12*hit,0,0)
            loc['pelvis']=(0,-.075*hit,-.025*hit)
        elif not female and clip=='Skill_02':
            f=wind*(1-recovery)
            r(p,'spine',-3*f,0,0);r(p,'head',-4*f,0,0)
            r(p,'upper_arm.R',-60*f,0,-40*f);r(p,'forearm.R',-52*f,0,25*f)
            r(p,'upper_arm.L',-85*f,0,8*f);r(p,'forearm.L',-30*f,0,0);r(p,'hand.L',-20*f,0,10*f)
        elif not female and clip=='Skill_03':
            jump=max(0,math.sin(math.pi*max(0,min(1,(t-.28)/.70)))) if t<1.0 else 0
            crouch=max(0,1-abs(t-.20)/.2)*.14+max(0,1-abs(t-1.0)/.22)*.09
            air=min(1,jump*2);attack=max(0,min(1,(t-.8)/.2))*(1-recovery)
            loc['pelvis']=(0,-.12*attack,.43*jump-crouch)
            r(p,'spine',-5*air+12*attack,0,0);r(p,'chest',-5*air+10*attack,0,0)
            r(p,'upper_arm.R',-145*air*(1-attack)-66*attack,0,10*attack)
            r(p,'forearm.R',-32*air*(1-attack)+24*attack,0,0)
            r(p,'upper_arm.L',-45*air,0,-12*air)
            bend=crouch*150+air*16
            for side in ['R','L']:r(p,'thigh.'+side,-bend,0,0);r(p,'shin.'+side,bend*1.8,0,0);r(p,'foot.'+side,-bend*.8,0,0)
        elif female:
            f=wind*(1-recovery)
            if clip=='Skill_01':
                r(p,'spine',-3*f,0,0);r(p,'head',8*f,0,0)
                r(p,'upper_arm.L',-38*f,-12*f,24*f);r(p,'forearm.L',-68*f,0,25*f);r(p,'hand.L',10*f,0,10*f)
                r(p,'upper_arm.R',-9*f,0,-3*f);r(p,'forearm.R',-7*f,0,0)
                loc['pelvis']=(0,0,.012*f)
            elif clip=='Skill_02':
                r(p,'chest',-3*f,0,-8*f);r(p,'head',-3*f,0,0)
                r(p,'upper_arm.L',-80*f,-8*f,-10*f);r(p,'forearm.L',-20*f,0,0);r(p,'hand.L',-65*f,0,0)
                r(p,'upper_arm.R',-12*f,0,-5*f);r(p,'forearm.R',-9*f,0,0)
            elif clip=='Skill_03':
                r(p,'spine',-6*anticipation+7*hit,0,-7*anticipation+7*hit)
                r(p,'upper_arm.R',-38*anticipation-15*hit,0,-18*anticipation+10*hit)
                r(p,'forearm.R',-22*anticipation+10*hit,0,0)
                r(p,'upper_arm.L',-95*anticipation-72*hit,0,-12*anticipation+12*hit)
                r(p,'forearm.L',-28*anticipation-10*hit,0,0);r(p,'hand.L',-40*hit,0,0)
                loc['pelvis']=(0,-.035*hit,.035*anticipation)
            else:
                alt=clip=='Attack_02'
                r(p,'spine',-3*anticipation+4*hit,0,-8*anticipation+8*hit)
                r(p,'upper_arm.R',-16*anticipation-8*hit,0,-5*anticipation)
                r(p,'forearm.R',-8*anticipation+5*hit,0,0)
                r(p,'upper_arm.L',-28*anticipation-(77 if alt else 68)*hit,0,5*anticipation-8*hit)
                r(p,'forearm.L',-35*anticipation-12*hit,0,0);r(p,'hand.L',-40*hit,0,0)
        for name in ['cape','cape_tip','robe.R','robe.L','robe_tip.R','robe_tip.L']:
            x,y,z=p.get(name,(0,0,0));p[name]=(x+6*hit if 'hit' in locals() else x,y,z)
    return p,loc

def animate(arm,key):
    arm.animation_data_create();actions={}
    for clip,(duration,impact) in TIMINGS[key].items():
        act=bpy.data.actions.new(clip);act.use_fake_user=True;arm.animation_data.action=act
        last=duration*FPS+1
        # Dense authored sampling includes exact hit time and exact clip end.
        frames=sorted(set([1.0,last]+[float(f) for f in range(1,math.floor(last)+1,3)]+([impact*FPS+1] if impact is not None else [])))
        for frame in frames:
            rotations,locations=keypose(key,clip,(frame-1)/FPS,duration,impact)
            for pb in arm.pose.bones:
                pb.rotation_mode='QUATERNION';degrees=rotations.get(pb.name,(0,0,0))
                basis=pb.bone.matrix_local.to_quaternion()
                q=Euler(tuple(math.radians(d) for d in degrees),'XYZ').to_quaternion()
                pb.rotation_quaternion=basis.inverted() @ q @ basis
                worldloc=Vector(locations.get(pb.name,(0,0,0)))
                pb.location=basis.inverted() @ worldloc
                pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=pb.name)
                if pb.name=='pelvis':pb.keyframe_insert(data_path='location',frame=frame,group=pb.name)
        actions[clip]=act
    arm.animation_data.action=actions['Idle'];bpy.context.scene.frame_set(1)
    return actions

def studio():
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Character review studio');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.09,.14,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    for loc,power,size,col in [((-3,-4,4),500,4,(.9,.95,1)),((3,-2,2.6),350,3,(1,.9,.8)),((1,3,3),650,3,(.6,.78,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc);obj=bpy.context.object;obj.data.energy=power;obj.data.shape='DISK';obj.data.size=size;obj.data.color=col
        obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(.2,-5,1.18));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.25
    cam.rotation_euler=(Vector((0,0,.97))-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
    scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
    return cam

metadata={'schemaVersion':1,'fps':FPS,'models':{}}
metadata_path=os.path.join(MODEL_DIR,'starter-animation-metadata.json')
if os.path.exists(metadata_path):
    with open(metadata_path) as f:metadata=json.load(f)
for key,source in [('knight',A.knight_source),('priestess',A.priestess_source)]:
    if A.only and A.only!=key:continue
    print('BUILD_START',key,flush=True)
    mesh=prepare(source,key);B=skeleton(key);arm,report=bind(mesh,key,B);actions=animate(arm,key)
    scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=145
    for img in bpy.data.images:img.pack()
    editable=os.path.join(A.deliverables,'starter-'+key+'.blend')
    bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=arm
    exportpath=os.path.join(MODEL_DIR,'starter-'+key+'.glb')
    options={'filepath':exportpath,'export_format':'GLB','use_selection':True,'export_animations':True,'export_animation_mode':'ACTIONS','export_force_sampling':True,'export_frame_range':False,'export_anim_single_armature':True,'export_optimize_animation_size':True,'export_image_format':'JPEG','export_jpeg_quality':90,'export_all_influences':False}
    available={p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    bpy.ops.export_scene.gltf(**{k:v for k,v in options.items() if k in available})
    metrics={'role':key,'source_basename':os.path.basename(source),'source_sha256':filehash(source),'model_sha256':filehash(exportpath),'bytes':os.path.getsize(exportpath),'forward':'+z','standingHeight':1.95 if key=='priestess' else 1.9,'bones':list(B),'weights':report,'sockets':{'weaponTip':'staff_tip' if key=='priestess' else 'sword_tip','weaponBase':'hand.R'},'clips':{c:{'duration':v[0],'impact':v[1],'loop':c in ('Idle','Run')} for c,v in TIMINGS[key].items()},'limitations':['Authored from a relaxed AI-generated static mesh; source fingers and cloth contacts are not production retopology.','No facial blendshape or individual finger rig; secondary cloth uses bones, not physical simulation.']}
    metadata['models'][key]=metrics
    with open(metadata_path,'w') as f:json.dump(metadata,f,indent=2)
    with open(os.path.join(A.deliverables,'starter-'+key+'-rig-report.json'),'w') as f:json.dump(metrics,f,indent=2)
    print('RIG_EXPORTED',key,json.dumps(metrics),flush=True)
    if not A.skip_renders:
        cam=studio()
        poses=[('Idle',.6),('Run',.18),('Attack_01',TIMINGS[key]['Attack_01'][1]),('Attack_02',TIMINGS[key]['Attack_02'][1]),('Skill_01',TIMINGS[key]['Skill_01'][1]),('Skill_02',TIMINGS[key]['Skill_02'][1]),('Skill_03',TIMINGS[key]['Skill_03'][1]),('Hit',.08),('Death',1.1),('Victory',.8)]
        if A.review_fast:poses=[p for p in poses if p[0] in ('Attack_01','Skill_02')]
        for clip,time in poses:
            for pb in arm.pose.bones:pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0)
            arm.animation_data.action=actions[clip];scene.frame_set(int(round(time*FPS))+1)
            cam.location=(.5,-5,1.4);cam.data.ortho_scale=2.65;cam.rotation_euler=(Vector((0,0,1.0))-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=os.path.join(A.deliverables,key+'-'+clip+'.png');bpy.ops.render.render(write_still=True)
        arm.animation_data.action=actions['Idle'];scene.frame_set(1)
        cam.location=(.04,-4,1.55);cam.data.ortho_scale=.83;cam.rotation_euler=(Vector((0,-.06,1.5))-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.film_transparent=True
        scene.render.filepath=os.path.join(A.project,'public','assets','knight-portrait.png' if key=='knight' else 'healer-portrait.png');bpy.ops.render.render(write_still=True)
        scene.render.film_transparent=False;scene.render.resolution_x=640;scene.render.resolution_y=800
        cam.location=(.5,-5,1.4);cam.data.ortho_scale=2.4;cam.rotation_euler=(Vector((0,0,1.0))-cam.location).to_track_quat('-Z','Y').to_euler()
    for pb in arm.pose.bones:pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0)
    arm.animation_data.action=actions['Idle'];scene.frame_set(1)
    bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.type='MATERIAL'
                area.spaces.active.region_3d.view_location=(0,0,1.0)
                area.spaces.active.region_3d.view_distance=3.2
                area.spaces.active.region_3d.view_rotation=Euler((math.radians(80),0,math.radians(4)),'XYZ').to_quaternion()
    bpy.ops.wm.save_as_mainfile(filepath=editable,compress=True)
    print('BUILD_COMPLETE',key,flush=True)
