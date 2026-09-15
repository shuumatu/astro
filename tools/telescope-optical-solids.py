"""Closed teaching solids; all optics use the same prescription as frontend ray tracing.

Holder architecture reference: https://www.fpi-protostar.com/ftp/instman.pdf
Dimensions fit this artistic GLB, not manufacturer measurements. No working adjustment simulation.
"""
import json
from pathlib import Path
import numpy as np

SPEC = json.loads((Path(__file__).resolve().parents[1] / 'frontend/src/features/demos/scenes/telescope/optical-spec.json').read_text())
P, S, F, HUB = [np.array(SPEC[k], float) for k in ['primary', 'secondary', 'focus', 'spiderHub']]
AXIS = np.array([1., 0, 0])
EXIT = (F-S)/np.linalg.norm(F-S)
NORMAL = (AXIS-EXIT)/np.linalg.norm(AXIS-EXIT)  # points into the blank, away from its reflecting face
MAJOR = AXIS-NORMAL*np.dot(AXIS, NORMAL); MAJOR /= np.linalg.norm(MAJOR)
MINOR = np.cross(NORMAL, MAJOR)
FOCAL_LENGTH = S[0]-P[0]+np.linalg.norm(F-S)

def ring(center, u, v, a, b, segments=96):
    theta = np.arange(segments)*2*np.pi/segments
    return center + a*np.cos(theta)[:,None]*u + b*np.sin(theta)[:,None]*v

def skin(rings, caps=True):
    """Closed loft; input rings have the same winding and begin on the near face."""
    faces=[]
    for lower, upper in zip(rings, rings[1:]):
        for j in range(len(lower)):
            n=(j+1)%len(lower)
            faces.extend([[lower[j],lower[n],upper[n]], [lower[j],upper[n],upper[j]]])
    if caps:
        for j in range(len(rings[0])):
            n=(j+1)%len(rings[0])
            faces.extend([[rings[0].mean(axis=0),rings[0][n],rings[0][j]],
                          [rings[-1].mean(axis=0),rings[-1][j],rings[-1][n]]])
    return np.array(faces)

def cylinder(x1, x2, radius, y=0, z=S[2], segments=64, bevel=.0005):
    bevel=min(bevel,(x2-x1)/4,radius/4)
    profile=[(x1,radius-bevel),(x1+bevel,radius),(x2-bevel,radius),(x2,radius-bevel)] if bevel else [(x1,radius),(x2,radius)]
    rings=[ring(np.array([x,y,z]),np.array([0,1,0]),np.array([0,0,1]),r,r,segments) for x,r in profile]
    return skin(rings)

def cylinder_axis(center, direction, length, radius, segments=64):
    direction=np.asarray(direction,float); direction/=np.linalg.norm(direction)
    helper=np.array([1.,0,0]) if abs(direction[0])<.9 else np.array([0.,1,0])
    u=np.cross(direction,helper); u/=np.linalg.norm(u); v=np.cross(direction,u)
    return skin([ring(np.asarray(center)-direction*length/2,u,v,radius,radius,segments),
                 ring(np.asarray(center)+direction*length/2,u,v,radius,radius,segments)])

def triangular_plate(center, axis, radius, thickness, segments=12):
    """Rounded three-lobed collimation plate, extruded along tube axis."""
    axis=np.asarray(axis,float); axis/=np.linalg.norm(axis)
    # Build a regular triangle in the YZ plane; extra points subtly round each corner.
    verts=[]
    for i in range(3):
        a=2*np.pi*i/3 + np.pi/2
        for da in (-.12, 0, .12):
            aa=a+da
            verts.append(center + radius*np.cos(aa)*np.array([0,1,0]) + radius*np.sin(aa)*np.array([0,0,1]))
    loop=np.asarray(verts)
    return skin([loop-axis*thickness/2, loop+axis*thickness/2])

def oblique_cylinder_x(center, front_depth, back_x, radius, normal, segments=64):
    """Constant-diameter X-cylinder with a plane-cut front face.

    The front rim is the intersection of a true cylinder (axis X) and the
    plane at `front_depth` along the secondary normal. This is the normal
    machined secondary-holder shape: a straight barrel, not a tapered loft.
    """
    center=np.asarray(center,float); normal=np.asarray(normal,float)
    theta=np.arange(segments)*2*np.pi/segments
    yz=np.c_[np.zeros(segments), np.cos(theta)*radius, np.sin(theta)*radius]
    # Both rims share exactly the same Y/Z points.  Only X changes, so every
    # generator of the cylindrical wall is parallel to the incoming +X ray.
    # The front rim is the intersection of those generators with the oblique
    # plane dot(p-center, normal)=front_depth.
    front=np.empty((segments,3)); front[:,1:]=center[1:]+yz[:,1:]
    front[:,0]=center[0]+(front_depth-normal[1]*yz[:,1]-normal[2]*yz[:,2])/normal[0]
    back=np.empty((segments,3)); back[:,0]=back_x; back[:,1:]=center[1:]+yz[:,1:]
    return skin([front,back])

def modeled_parts():
    parts=[]
    def add(name, part, faces, finish='black'):
        faces=np.asarray(faces)
        normals=np.cross(faces[:,1]-faces[:,0],faces[:,2]-faces[:,0])
        lengths=np.linalg.norm(normals,axis=1)
        assert np.all(lengths>1e-14), name
        normals/=lengths[:,None]
        parts.append({'name':name,'part':part,'positions':faces.reshape(-1,3),
                      'normals':np.repeat(normals,3,axis=0),'finish':finish})

    # Primary front remains precisely on the ray-traced paraboloid; thickness extends rearward.
    radius=SPEC['primaryRadius']; front=[]; prior=None
    for level in range(1,25):
        r=radius*level/24
        current=ring(P+AXIS*(r*r/(4*FOCAL_LENGTH)),np.array([0,1,0]),np.array([0,0,1]),r,r)
        for j in range(len(current)):
            n=(j+1)%len(current)
            if prior is None: front.append([P,current[j],current[n]])
            else: front.extend([[prior[j],current[j],current[n]],[prior[j],current[n],prior[n]]])
        prior=current
    back=ring(P-AXIS*SPEC['primaryThickness'],np.array([0,1,0]),np.array([0,0,1]),radius,radius)
    body=list(skin([back,prior],caps=False))
    for j in range(len(back)): body.append([back.mean(axis=0),back[(j+1)%len(back)],back[j]])
    add('PrimaryParabolicMirror_modeled','primaryMirror',front+body,'primary')

    # Reflecting face at S, backing entirely on the +normal side. No half-thickness offset.
    minor=SPEC['secondaryMinorRadius']; major=minor*np.sqrt(2)
    mirror_front=ring(S,MAJOR,MINOR,major,minor)
    mirror_back=ring(S+NORMAL*SPEC['secondaryThickness'],MAJOR,MINOR,major,minor)
    add('SecondaryFlatMirror_modeled','secondaryMirror',skin([mirror_front,mirror_back]),'secondary')

    # Standard Newtonian holder: shallow angled mirror cup, coaxial back shell,
    # central pull bolt and three push/spring adjusters.
    # Keep the optical prescription fixed. Only adhesive pads touch the rear
    # glass face; the recessed metal cup sits one pad thickness behind it.
    rear=S+NORMAL*SPEC['secondaryThickness']
    holder_spec=SPEC['secondaryHolder']
    pad_thickness=holder_spec['bondPadThickness']
    cup_thickness=holder_spec['cupThickness']
    holder_front=rear+NORMAL*pad_thickness
    for j in range(3):
        a=2*np.pi*j/3; center=rear+.012*np.cos(a)*MAJOR+.012*np.sin(a)*MINOR
        add(f'SecondaryHolder_BondPad_{j+1}','secondaryHolder',skin([
            ring(center,MAJOR,MINOR,.0045,.0035,32),
            ring(center+NORMAL*pad_thickness,MAJOR,MINOR,.0045,.0035,32)]),'rubber')
    # Both cup rims are inside the glass outline, exposing the glass edge instead
    # of wrapping a wider metal disk around the reflecting face.
    rim_scale=holder_spec['cupOutlineScale']
    cup_front=ring(holder_front,MAJOR,MINOR,major*rim_scale,minor*rim_scale)
    cup_back=ring(holder_front+NORMAL*cup_thickness,MAJOR,MINOR,
                  major*(rim_scale-.04),minor*(rim_scale-.04))
    add('SecondaryHolder_MirrorCup','secondaryHolder',skin([cup_front,cup_back]))
    # Straight, reduced-diameter barrel with a genuine oblique cut at the
    # front. Its first metal edge starts at the cup rear plane, so it cannot
    # intersect the glass while remaining visibly cylindrical.
    # Bind the barrel axis to the optical centre of the secondary.  Using the
    # cup-back centroid here introduced a visible lateral offset after the
    # oblique cut, making the barrel appear detached in the exploded view.
    shell_axis=np.array([S[0], S[1], S[2]])
    add('SecondaryHolder_BackShell','secondaryHolder',
        oblique_cylinder_x(shell_axis,
                           SPEC['secondaryThickness'] + pad_thickness + cup_thickness,
                           .124, holder_spec['shellRadius'], NORMAL))
    plate_center=np.array([.128,S[1],S[2]])
    add('SecondaryHolder_CollimationPlate','secondaryHolder',triangular_plate(plate_center,AXIS,.031,.010))
    add('SecondaryHolder_HubCollar','secondaryHolder',cylinder(.158,.168,.023))
    stem_end=np.array([.163,S[1],S[2]])
    add('SecondaryHolder_CentralStem','secondaryHolder',cylinder_axis((plate_center+stem_end)/2,AXIS,.035,.004), 'steel')
    add('SecondaryHolder_AxialNut','secondaryHolder',cylinder(.166,.171,.006,segments=6), 'steel')
    add('SecondaryHolder_AxialWasher','secondaryHolder',cylinder(.165,.166,.007), 'steel')
    # Three 120-degree push/pull adjusters are parallel to the tube axis and all attach to the plate.
    for j in range(3):
        angle=2*np.pi*j/3
        radial=.018*np.cos(angle)*np.array([0,1,0])+.018*np.sin(angle)*np.array([0,0,1])
        screw_center=np.array([.146,S[1],S[2]])+radial
        add(f'SecondaryHolder_TiltScrew_{j+1}','secondaryHolder',cylinder_axis(screw_center,AXIS,.048,.0017,32), 'steel')
        add(f'SecondaryHolder_Spring_{j+1}','secondaryHolder',cylinder_axis(np.array([.145,S[1],S[2]])+radial,AXIS,.020,.0032,32),'rubber')
        head_center=np.array([.169,S[1],S[2]])+radial
        add(f'SecondaryHolder_ScrewWasher_{j+1}','secondaryHolder',cylinder_axis(head_center,AXIS,.0025,.0035,48),'steel')
        rings=[ring(head_center+AXIS*(x-.019),np.array([0,1,0]),np.array([0,0,1]),r,r,48)
               for x,r in [(0,.003),(.001,.0034),(.005,.0034),(.006,.003),(.006,.0015),(.004,.0015)]]
        # A circular socket recess with six-sided recess insert, not an unsealed hollow head.
        add(f'SecondaryHolder_SocketHead_{j+1}','secondaryHolder',skin(rings),'steel')
    return parts
