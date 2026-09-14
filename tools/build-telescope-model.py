"""Bake transforms and split reviewed GLB material/connectivity fragments into semantic nodes.

Source is preserved. Mappings were reviewed with audit-telescope.py's rendered atlas.
Never classify an entire material or merged mesh as a functional assembly.
"""
import runpy
from pathlib import Path
import json
import struct
import hashlib
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE_HASH = '70ec2b8b23c246a579233d2fe5a7f840550348cbb45145d3003c5644377c64a5'
if hashlib.sha256((ROOT/'frontend/public/models/telescope_newtonian_reflector.glb').read_bytes()).hexdigest() != SOURCE_HASH:
    raise SystemExit('Source GLB changed. Re-audit fragment shapes and mappings before rebuilding.')
audit = runpy.run_path(str(ROOT / 'tools/audit-telescope.py'))
source, read, transform, components = [audit[k] for k in ['doc', 'accessor', 'matrix', 'components']]

# Material primitive -> connected fragments, ranked by face count (see fragments-1.png).
MERGED = {
    0: ['mount', 'tube'],
    1: ['focuser', 'focuser'], 2: ['focuser'],
    3: ['mount', 'mount', 'mount', 'mount', 'counterweight', 'mirrorCell'],
    4: ['tube', 'tube', 'mount', 'tube', 'tube'],
    5: ['mount', 'rings', 'rings', 'counterweight', 'counterweight', 'counterweight',
        'counterweight', 'finder', 'rings', 'tube', 'mirrorCell', 'mount', 'focuser', 'focuser'],
    6: ['tube', 'mount', 'mount', 'focuser', 'finder', 'finder', 'mount', 'tube',
        'mount', 'mirrorCell', 'rings', 'mount', 'mount'],
    7: ['tube', 'tube'],
}
SIMPLE = {2:'hardware',3:'hardware',4:'hardware',5:'focuser',6:'mount',7:'rings',
          8:'hardware',9:'hardware',10:'hardware',11:'mount',12:'hardware',13:'tray',14:'tripod'}
NAMES = {'tube':'OpticalTube','rings':'TubeRingsAndSaddle','finder':'FinderScope',
         'focuser':'FocuserAndEyepiece','spider':'SecondarySupport','mount':'EquatorialMount',
         'counterweight':'CounterweightsAndShaft','tripod':'Tripod','tray':'AccessoryTray',
         'hardware':'Fasteners','mirrorCell':'RearMirrorCell','internalDisk':'InternalPerforatedDisk'}

output = {'asset':{'version':'2.0','generator':'Astro geometry-reviewed telescope builder'},
          'scene':0,'scenes':[{'nodes':[]}], 'nodes':[], 'meshes':[], 'materials':source['materials'],
          'buffers':[{'byteLength':0}], 'bufferViews':[], 'accessors':[]}
binary = bytearray()
groups = {}
report = []
def add_accessor(values):
    values = np.asarray(values, dtype='<f4')
    while len(binary)%4: binary.append(0)
    offset = len(binary); binary.extend(values.tobytes())
    view = len(output['bufferViews'])
    output['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':values.nbytes,'target':34962})
    aid = len(output['accessors'])
    output['accessors'].append({'bufferView':view,'componentType':5126,'count':len(values),
                               'type':'VEC3','min':values.min(axis=0).tolist(),'max':values.max(axis=0).tolist()})
    return aid

for ni,node in enumerate(source['nodes']):
    if 'mesh' not in node: continue
    mid=node['mesh']; m=transform(ni)
    for pi,primitive in enumerate(source['meshes'][mid]['primitives']):
        positions=read(primitive['attributes']['POSITION'])
        ids=read(primitive['indices']).flatten() if 'indices' in primitive else np.arange(len(positions))
        world=(np.c_[positions,np.ones(len(positions))]@m.T)[:,:3]*1000
        normals=read(primitive['attributes']['NORMAL'])@np.linalg.inv(m[:3,:3])
        normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-16)
        triangles=world[ids.reshape(-1,3)]
        chunks=components(triangles,True)
        if mid==1: assert len(chunks)==len(MERGED[pi]), (pi,len(chunks))
        for ci,faces in enumerate(chunks):
            part=MERGED[pi][ci] if mid==1 else SIMPLE.get(mid,'mount')
            if mid==0 and triangles[faces].mean(axis=(0,1))[1]<.55: part='tripod'
            batches={part:faces}
            if mid==1 and pi==6 and ci==0:
                # Tube + front spider were welded. Split interior faces from cylindrical wall.
                local=positions[ids.reshape(-1,3)[faces]]
                radius=np.sqrt(local[:,:,1]**2+(local[:,:,2]-.40827)**2)
                interior=(radius.min(axis=1)<.078) & (local[:,:,0].mean(axis=1)>0)
                center=local.mean(axis=1)
                center_radius=np.sqrt(center[:,1]**2+(center[:,2]-.40827)**2)
                internal_disk=(local[:,:,0].min(axis=1)>-.131) & (local[:,:,0].max(axis=1)<-.115) & (radius.max(axis=1)<.091)
                # End disks can be triangulated entirely from rim vertices, without a center vertex.
                rear=(center_radius<.078) & (center[:,0]<-.40)
                batches={'tube':np.asarray(faces)[~(interior|rear|internal_disk)], 'spider':np.asarray(faces)[interior],
                         'mirrorCell':np.asarray(faces)[rear], 'internalDisk':np.asarray(faces)[internal_disk]}
            for part,faces in batches.items():
                if len(faces)==0: continue
                vertex_ids=ids.reshape(-1,3)[faces].flatten()
                name=f'{NAMES[part]}_n{ni}_p{pi}_c{ci}'
                pos=world[vertex_ids]
                normal=normals[vertex_ids]
                mesh_id=len(output['meshes'])
                output['meshes'].append({'name':name,'primitives':[{'attributes':{'POSITION':add_accessor(pos),
                    'NORMAL':add_accessor(normal)},'material':primitive['material']}]})
                node_id=len(output['nodes'])
                output['nodes'].append({'name':name,'mesh':mesh_id,'extras':{'partId':part,
                     'sourceNode':ni,'sourceMesh':mid,'sourcePrimitive':pi,'sourceComponent':ci}})
                output['scenes'][0]['nodes'].append(node_id)
                groups.setdefault(part,[]).append(pos.reshape(-1,3,3))
                report.append({'name':name,'part':part,'triangles':len(faces)})

# Source mesh-1 local -> baked model coordinates: use this exact frame for optical overlays.
frame=transform(2).copy(); frame[:3,:]*=1000
output['scenes'][0]['extras']={'opticalFrame':frame.flatten(order='F').tolist(),
    'note':'Mechanical surfaces preserved; optical parameters are educational, not manufacturer measurements.'}
output['buffers'][0]['byteLength']=len(binary)
j=json.dumps(output,separators=(',',':')).encode(); j+=b' '*((-len(j))%4)
binary+=b'\0'*((-len(binary))%4)
result=struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
target=ROOT/'frontend/public/models/telescope_newtonian_classified.glb'
target.write_bytes(result)
(ROOT/'.cache/telescope-audit/classification.json').write_text(json.dumps(report,indent=2))
atlas=Image.new('RGB',(1600,1200),'#101820')
for k,(part,geometry) in enumerate(groups.items()):
    x,y=(k%4)*400,(k//4)*400
    audit['draw_mesh'](atlas,np.concatenate(geometry),(x,y+24,x+400,y+400))
    ImageDraw.Draw(atlas).text((x+8,y+8),part,fill='white')
atlas.save(ROOT/'.cache/telescope-audit/classified.png')
print('BUILT',target,len(result),'bytes',len(report),'fragments')
