import * as THREE from 'three'

// Calibrated in the original optical tube's local frame (stored in scene extras).
// These describe an ideal educational mirror system, not measured optical specifications.
export const PRIMARY = new THREE.Vector3(-0.405, 0, 0.40827)
export const SECONDARY = new THREE.Vector3(0.0619, 0, 0.40827)
export const FOCUS = new THREE.Vector3(0.0619, 0.185, 0.43476)
const axis = new THREE.Vector3(1, 0, 0)
const exitAxis = FOCUS.clone().sub(SECONDARY).normalize()
export const OPTICAL_VIEW_NORMAL = axis.clone().cross(exitAxis).normalize()
export const SECONDARY_NORMAL = axis.clone().sub(exitAxis).normalize()
export const FOCAL_LENGTH = SECONDARY.x - PRIMARY.x + FOCUS.distanceTo(SECONDARY)

export function traceRay(y: number, z: number): THREE.Vector3[] {
  const primary = PRIMARY.clone().add(new THREE.Vector3((y*y + z*z)/(4*FOCAL_LENGTH), y, z))
  const unfoldedFocus = PRIMARY.clone().addScaledVector(axis, FOCAL_LENGTH)
  const reflected = unfoldedFocus.sub(primary).normalize()
  const distance = SECONDARY.clone().sub(primary).dot(SECONDARY_NORMAL) / reflected.dot(SECONDARY_NORMAL)
  const secondary = primary.clone().addScaledVector(reflected, distance)
  return [new THREE.Vector3(0.28, primary.y, primary.z), primary, secondary, FOCUS.clone()]
}

export function buildOptics(frame: number[]): THREE.Group {
  const group = new THREE.Group()
  group.name = 'TeachingOptics'
  group.matrix.fromArray(frame)
  group.matrixAutoUpdate = false
  const positions: number[] = []
  const indices: number[] = []
  for (let ring=0; ring<=16; ring++) {
    const radius = .078 * ring / 16
    for (let j=0; j<=64; j++) {
      const angle=j/64*Math.PI*2
      positions.push(PRIMARY.x+radius*radius/(4*FOCAL_LENGTH), radius*Math.cos(angle), PRIMARY.z+radius*Math.sin(angle))
      if (ring<16 && j<64) {
        const a=ring*65+j, b=a+65
        indices.push(a,b,a+1,b,b+1,a+1)
      }
    }
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  const primary=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xffc56e,emissive:0x624112,emissiveIntensity:.45,side:THREE.DoubleSide,metalness:.5,roughness:.25}))
  primary.name='TeachingPrimaryMirror'; group.add(primary)
  const secondary=new THREE.Mesh(new THREE.CircleGeometry(.024,48),new THREE.MeshStandardMaterial({color:0x8fe7ff,emissive:0x12465a,side:THREE.DoubleSide,metalness:.5,roughness:.25}))
  secondary.scale.x=Math.SQRT2
  secondary.position.copy(SECONDARY)
  // The ellipse's long axis lies in the plane containing the incident and exit axes.
  const majorAxis=axis.clone().addScaledVector(SECONDARY_NORMAL,-axis.dot(SECONDARY_NORMAL)).normalize()
  const minorAxis=SECONDARY_NORMAL.clone().cross(majorAxis)
  secondary.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(majorAxis,minorAxis,SECONDARY_NORMAL))
  secondary.name='TeachingSecondaryMirror'; group.add(secondary)
  for (let i=0; i<8; i++) {
    const angle=(i+.5)*Math.PI/4
    const points=traceRay(.061*Math.cos(angle),.061*Math.sin(angle))
    for (let step=0;step<3;step++) {
      const start=points[step]!,end=points[step+1]!
      const color=[0xffd975,0x77dbc9,0xb1a0ff][step]!
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([start,end]),new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}))
      line.userData.lessonStep=step; group.add(line)
      const arrow=new THREE.ArrowHelper(end.clone().sub(start).normalize(),start.clone().lerp(end,.55),.025,color,.012,.006)
      arrow.userData.lessonStep=step; group.add(arrow)
    }
  }
  const focus=new THREE.Mesh(new THREE.SphereGeometry(.006,12,8),new THREE.MeshBasicMaterial({color:0xffffff}))
  focus.position.copy(FOCUS); focus.name='FocalPoint'; focus.userData.lessonStep=3; group.add(focus)
  return group
}
