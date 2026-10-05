import * as THREE from 'three'

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _pole = new THREE.Vector3()
const _elbow = new THREE.Vector3()
const _from = new THREE.Vector3()
const _to = new THREE.Vector3()
const _delta = new THREE.Quaternion()
const _world = new THREE.Quaternion()
const _parent = new THREE.Quaternion()

const swingBone = (bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) => {
  _delta.setFromUnitVectors(from, to)
  bone.getWorldQuaternion(_world).premultiply(_delta)
  if (bone.parent) bone.parent.getWorldQuaternion(_parent).invert()
  else _parent.identity()
  bone.quaternion.copy(_parent.multiply(_world))
  bone.updateMatrixWorld(true)
}

/* Works purely off world-space joint positions, so it doesn't care about a
   rig's local bone axes — Mixamo, VRoid and the procedural stand-in all pose
   the same from the same target. `pole` is the world direction the elbow
   bends toward. */
export const solveTwoBoneIK = (
  upper: THREE.Object3D,
  lower: THREE.Object3D,
  end: THREE.Object3D,
  target: THREE.Vector3,
  pole: THREE.Vector3,
) => {
  upper.getWorldPosition(_a)
  lower.getWorldPosition(_b)
  end.getWorldPosition(_c)
  const upperLen = _a.distanceTo(_b)
  const lowerLen = _b.distanceTo(_c)
  if (upperLen < 1e-5 || lowerLen < 1e-5) return

  _dir.subVectors(target, _a)
  const reach = THREE.MathUtils.clamp(
    _dir.length(),
    Math.abs(upperLen - lowerLen) + 1e-4,
    upperLen + lowerLen - 1e-4,
  )
  _dir.normalize()

  const cosA = THREE.MathUtils.clamp(
    (upperLen * upperLen + reach * reach - lowerLen * lowerLen) / (2 * upperLen * reach),
    -1,
    1,
  )
  _pole.copy(pole).addScaledVector(_dir, -pole.dot(_dir))
  if (_pole.lengthSq() < 1e-8) _pole.set(0, 0, -1).addScaledVector(_dir, -_dir.z)
  _pole.normalize()

  _elbow
    .copy(_a)
    .addScaledVector(_dir, upperLen * cosA)
    .addScaledVector(_pole, upperLen * Math.sqrt(1 - cosA * cosA))

  _from.subVectors(_b, _a).normalize()
  _to.subVectors(_elbow, _a).normalize()
  swingBone(upper, _from, _to)

  lower.getWorldPosition(_b)
  end.getWorldPosition(_c)
  _from.subVectors(_c, _b).normalize()
  _to.subVectors(target, _b).normalize()
  swingBone(lower, _from, _to)
}
