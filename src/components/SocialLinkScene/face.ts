import * as THREE from 'three'

/* Expressions on the P5R rig's face bones (eyes, upper lids, brows, jaw,
   lip corners, cheeks — "b r eyelidthe_u01", "b ago01", ...). Every move is
   written in face space — +X his left, +Y up, +Z out of the face, metres —
   and carried into each bone's own axes, so it follows the head wherever
   the neck turns it. Rigs without the bones get null. */

export type FaceConfig = {
  /* eyes: + = toward his left / up, degrees */
  gazeYaw: number
  gazePitch: number
  /* 0 = open, 1 = shut */
  blinkL: number
  blinkR: number
  /* brows: + = raised, - = lowered */
  browL: number
  browR: number
  /* + = inner ends up (worried), - = inner ends down (angry) */
  browTilt: number
  /* 0..1 inner ends pulled together and down */
  frown: number
}

export type FacialConfig = {
  /* degrees */
  jawOpen: number
  /* + = corners up and out, - = down */
  smile: number
  /* + = wider mouth, - = narrower */
  mouthWide: number
  /* + = upper lip lifted */
  upperLip: number
  /* + = cheeks raised (pushes the lower lids up into a squint) */
  cheek: number
  /* eye size multiplier, 1 = as modelled */
  eyeSize: number
}

type Side = 'l' | 'r'

/* how far each control moves its bones at 1, metres */
const LID_DROP = 0.021
const LID_FORWARD = 0.0015
const BROW_RAISE = 0.006
const BROW_TILT = { inner: 0.0045, outer: 0.0025 }
const FROWN = { inward: 0.004, down: 0.003 }
const SMILE = { corner: 0.005, cornerOut: 0.002, lip: 0.002, crease: 0.002, cheek: 0.003 }
const WIDE = { corner: 0.005, lip: 0.002 }
const UPPER_LIP = { center: 0.003, side: 0.002 }
const CHEEK = { cheek: 0.004, underEye: 0.002 }

const deg = THREE.MathUtils.degToRad

/** `root` = the character's own frame: +Z forward, +X his left */
export const buildFace = (root: THREE.Object3D) => {
  const nodes: THREE.Object3D[] = []
  root.traverse((o) => nodes.push(o))
  /* GLTFLoader turns the names' spaces into underscores; the "_end_" leaves
     and mesh nodes don't match */
  const find = (name: string) => {
    const pattern = new RegExp(`^${name.replace(/ /g, '[ _]')}_\\d+$`)
    return nodes.find((o) => pattern.test(o.name)) ?? null
  }
  const head = nodes.find((o) => /^Bip01[ _]Head_\d+$/.test(o.name))
  const jaw = find('b ago01')
  if (!head || !jaw) return null

  const sided = (name: string) => ({ l: find(name.replace('%', 'l')), r: find(name.replace('%', 'r')) })
  const bones = {
    eye: sided('b % eye00'),
    lid: [sided('b % eyelidthe_u01'), sided('b % eyelidthe_u02'), sided('b % eyelidthe_u03')],
    browInner: sided('b % mayug01'),
    browMid: sided('b % mayug02'),
    browOuter: sided('b % mayug03'),
    glabella: sided('b % mikensiwa01'),
    lipTop: sided('b % s_mouse01'),
    lipBottom: sided('b % s_mouse02'),
    corner: sided('b % s_mouse03'),
    smileLine: sided('b % s_mouse_shiwa'),
    cheek: sided('b % hoho01'),
    underEye: sided('b % eye_d01'),
    upperLip: find('b s u_mouse'),
  }
  const { upperLip, lid, ...pairs } = bones
  const all = [jaw, upperLip, ...[...lid, ...Object.values(pairs)].flatMap((pair) => [pair.l, pair.r])]
  const rest = all
    .filter((b): b is THREE.Object3D => !!b)
    .map((bone) => ({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() }))

  /* the head's rest orientation in the character's frame, so face space
     can be rebuilt from wherever the head is now */
  const rootQ = new THREE.Quaternion()
  const headRestInv = new THREE.Quaternion()
  root.updateWorldMatrix(true, true)
  head.getWorldQuaternion(headRestInv).premultiply(root.getWorldQuaternion(rootQ).invert()).invert()

  const faceToWorld = new THREE.Quaternion()
  const worldQ = new THREE.Quaternion()
  const axis = new THREE.Vector3()
  const move = new THREE.Vector3()
  const at = new THREE.Vector3()
  const q = new THREE.Quaternion()
  let touched = false

  /* turn a bone about a face-space axis, through its own joint */
  const turn = (bone: THREE.Object3D | null, x: number, y: number, z: number, angle: number) => {
    if (!bone || angle === 0) return
    axis.set(x, y, z).applyQuaternion(faceToWorld).applyQuaternion(bone.getWorldQuaternion(worldQ).invert())
    bone.quaternion.multiply(q.setFromAxisAngle(axis, angle))
    bone.updateMatrixWorld(true)
  }
  /* slide a bone by a face-space offset; `out` flips x for the right side
     so + always means away from the nose */
  const slide = (bone: THREE.Object3D | null, x: number, y: number, z: number) => {
    if (!bone || !bone.parent || (x === 0 && y === 0 && z === 0)) return
    move.set(x, y, z).applyQuaternion(faceToWorld)
    bone.getWorldPosition(at).add(move)
    bone.position.copy(bone.parent.worldToLocal(at))
  }
  const out = (side: Side) => (side === 'l' ? 1 : -1)

  return {
    reset: () => {
      if (!touched) return
      for (const r of rest) {
        r.bone.position.copy(r.position)
        r.bone.quaternion.copy(r.quaternion)
        r.bone.scale.copy(r.scale)
      }
      touched = false
    },
    /** call after the head is posed; leaves the face bones' matrices current */
    apply: (face: FaceConfig, facial: FacialConfig) => {
      touched = true
      head.updateWorldMatrix(true, false)
      faceToWorld.copy(head.getWorldQuaternion(worldQ)).multiply(headRestInv)

      /* jaw first: the lower lip bones ride on it */
      turn(jaw, 1, 0, 0, deg(facial.jawOpen))
      for (const side of ['l', 'r'] as const) {
        const eye = bones.eye[side]
        if (eye) {
          eye.scale.setScalar(facial.eyeSize)
          turn(eye, 0, 1, 0, deg(face.gazeYaw))
          turn(eye, 1, 0, 0, -deg(face.gazePitch))
        }
      }
      head.updateMatrixWorld(true)

      for (const side of ['l', 'r'] as const) {
        const o = out(side)
        const blink = side === 'l' ? face.blinkL : face.blinkR
        const brow = side === 'l' ? face.browL : face.browR
        for (const lid of bones.lid) slide(lid[side], 0, -LID_DROP * blink, LID_FORWARD * blink)
        slide(bones.browInner[side], -o * FROWN.inward * face.frown, BROW_RAISE * brow + BROW_TILT.inner * face.browTilt - FROWN.down * face.frown, 0)
        slide(bones.browMid[side], 0, BROW_RAISE * brow + 0.3 * BROW_TILT.inner * face.browTilt, 0)
        slide(bones.browOuter[side], 0, BROW_RAISE * brow - BROW_TILT.outer * face.browTilt, 0)
        slide(bones.glabella[side], -o * FROWN.inward * face.frown, -FROWN.down * face.frown, 0)

        slide(bones.corner[side], o * (SMILE.cornerOut * facial.smile + WIDE.corner * facial.mouthWide), SMILE.corner * facial.smile, 0)
        slide(bones.lipTop[side], o * WIDE.lip * facial.mouthWide, SMILE.lip * facial.smile + UPPER_LIP.side * facial.upperLip, 0)
        slide(bones.lipBottom[side], o * WIDE.lip * facial.mouthWide, SMILE.lip * facial.smile, 0)
        slide(bones.smileLine[side], o * 0.5 * SMILE.crease * facial.smile, SMILE.crease * facial.smile, 0)
        slide(bones.cheek[side], 0, SMILE.cheek * Math.max(facial.smile, 0) + CHEEK.cheek * facial.cheek, 0)
        slide(bones.underEye[side], 0, CHEEK.underEye * facial.cheek, 0)
      }
      slide(bones.upperLip, 0, UPPER_LIP.center * facial.upperLip, 0)
      head.updateMatrixWorld(true)
    },
  }
}

export type FaceRig = NonNullable<ReturnType<typeof buildFace>>
