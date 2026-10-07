import * as THREE from 'three'

/* A big chunky "9" for the figure scene — the system menu's floating
   calendar digit he grabs as it falls. Built from hand-drawn outlines (a
   ring for the bowl, a hooked stem) and extruded: flat colour like the
   menu's type, its sides a shade darker, outlined like him; it cuts its own
   hole in the band and casts a shadow on it. Glyph units: 1 = its height, x from -0.34 to 0.34, y from 0 to 1. */

export type DigitConfig = {
  show: boolean
  /** whose hand holds it (his), or 'none' to float free at `pos` */
  hold: 'right' | 'left' | 'none'
  /** height, metres */
  size: number
  /** thickness, fraction of the height */
  depth: number
  /** the point of the glyph that sits in the hand, fractions of its
      width / height from the bottom-left */
  grip: { x: number; y: number }
  /** held: offset from the wrist in the hand's own axes, metres */
  offset: THREE.Vector3
  /** degrees: held, relative to the hand; free, in the world */
  pitch: number
  yaw: number
  roll: number
  /** free only: where the grip point sits (world space) and a slow tumble, degrees per second */
  pos: THREE.Vector3
  spin: number
  color: string
}

const WIDTH = 0.68

const glyph = () => {
  const bowl = new THREE.Shape().absarc(0, 0.66, 0.34, 0, Math.PI * 2, false)
  bowl.holes.push(new THREE.Path().absarc(0, 0.66, 0.14, 0, Math.PI * 2, true))
  /* the stem drops from the bowl's right side and hooks left at the foot */
  const stem = new THREE.Shape()
    .moveTo(0.34, 0.66)
    .lineTo(0.34, 0.3)
    .quadraticCurveTo(0.34, 0, 0, 0)
    .lineTo(-0.26, 0)
    .lineTo(-0.26, 0.19)
    .lineTo(0, 0.19)
    .quadraticCurveTo(0.14, 0.19, 0.14, 0.32)
    .lineTo(0.14, 0.66)
    .closePath()
  return [bowl, stem]
}

const deg = THREE.MathUtils.degToRad

/* how dark the sides are next to the faces */
const SIDE_SHADE = 0.62

export const createDigit = () => {
  /* the extrusion's groups: faces, then sides */
  const face = new THREE.MeshBasicMaterial()
  const side = new THREE.MeshBasicMaterial()
  const materials = [face, side]
  const mesh = new THREE.Mesh(undefined, materials)
  const group = new THREE.Group()
  group.add(mesh)

  let built = ''
  const build = (depth: number) => {
    const key = depth.toFixed(3)
    if (key === built) return
    built = key
    mesh.geometry.dispose()
    const geometry = new THREE.ExtrudeGeometry(glyph(), { depth, bevelEnabled: false, curveSegments: 48 })
    /* centred through its thickness */
    geometry.translate(0, 0, -depth / 2)
    mesh.geometry = geometry
  }

  const handPos = new THREE.Vector3()
  const handQ = new THREE.Quaternion()
  const handScale = new THREE.Vector3()
  const turnQ = new THREE.Quaternion()
  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const offset = new THREE.Vector3()
  let spun = 0

  return {
    /** add to the scene, not to the character: it follows the hand by hand */
    group,
    materials,
    /** `hand` = the holding wrist bone, already posed (null when free) */
    update: (dt: number, d: DigitConfig, hand: THREE.Object3D | null) => {
      group.visible = d.show
      if (!d.show) return
      build(d.depth)
      face.color.set(d.color)
      side.color.copy(face.color).multiplyScalar(SIDE_SHADE)
      /* the grip point at the group's origin, at the chosen size */
      mesh.scale.setScalar(d.size)
      mesh.position.set(-(d.grip.x - 0.5) * WIDTH, -d.grip.y, 0).multiplyScalar(d.size)
      euler.set(deg(d.pitch), deg(d.yaw), deg(d.roll))
      if (hand) {
        /* the bone's world frame without its scale (the rig is sized) */
        hand.matrixWorld.decompose(handPos, handQ, handScale)
        group.position.copy(handPos).add(offset.copy(d.offset).applyQuaternion(handQ))
        group.quaternion.copy(handQ).multiply(turnQ.setFromEuler(euler))
      } else {
        spun += dt * deg(d.spin)
        group.position.copy(d.pos)
        group.quaternion.setFromEuler(euler).multiply(turnQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, spun))
      }
    },
    dispose: () => {
      mesh.geometry.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
