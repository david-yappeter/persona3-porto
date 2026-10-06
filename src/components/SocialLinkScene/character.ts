import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'
import { noOutline, toonify, type Grade } from './toon'
import { addLongCoat } from './coat'
import { buildWind, type Motion } from './wind'
import { buildFace, type FaceRig } from './face'
import { POSE } from './pose'

export type ArmChain = { upper: THREE.Object3D; lower: THREE.Object3D; hand: THREE.Object3D }

type FingerJoint = { bone: THREE.Object3D; rest: THREE.Quaternion; axis: THREE.Vector3; joint: number; finger: number; thumb: boolean }

/* everything needed to orient the card hand and curl its fingers. Bases are
   in the model's own (unrotated) space: f = toward the fingers, n = out of
   the palm. */
export type HandRig = {
  restQuat: THREE.Quaternion
  restF: THREE.Vector3
  restN: THREE.Vector3
  joints: FingerJoint[]
  /** middle finger base / last joint — the grip is laid out from these */
  knuckle: THREE.Object3D | null
  fingerTip: THREE.Object3D | null
  /** curl in radians: per joint (base, middle, tip) for the four fingers,
      one value spread over the thumb, plus an optional extra per finger
      (index, middle, ring, little) added at every joint */
  curl: (fingers: readonly [number, number, number], thumb: number, extra?: readonly [number, number, number, number]) => void
  /** rotates the hand from its current pose about its own axes, in radians:
      bend toward the palm, side toward the thumb, twist around the fingers */
  wrist: (bend: number, side: number, twist: number) => void
}

export type CharacterRig = {
  root: THREE.Object3D
  /* character's left = screen right when facing the camera — this is the
     arm that holds / dangles the card */
  cardArm: ArmChain
  otherArm: ArmChain
  /** null when the rig's finger bones can't be identified */
  cardHand: HandRig | null
  otherHand: HandRig | null
  /** turns the neck then the head by these world-space rotations about
      their own joints (applied over rest, call after update and before
      IK); the shoulders keep their place even on rigs whose clavicles hang
      off the neck. A no-op for a rig without the bones. */
  look: (neck: THREE.Quaternion, head: THREE.Quaternion) => void
  /** bends the body by world-space rotations over rest: the spine (spread
      over its segments, legs kept in place) and each leg's hip and knee
      ([left, right]). Call after update and before look; rigs without the
      bones skip those parts. */
  bend: (spine: THREE.Quaternion, hips: readonly THREE.Quaternion[], knees: readonly THREE.Quaternion[]) => void
  /** before IK: reset arms to rest / advance animation */
  update: (dt: number) => void
  /** face bones (expressions); null when the rig has none */
  face: FaceRig | null
  /** after IK: hair/cloth physics, blinking (motion defaults to POSE.wind) */
  postUpdate: (dt: number, motion?: Motion) => void
  dispose: () => void
}

export type BoneNameOverrides = Partial<
  Record<'leftUpperArm' | 'leftLowerArm' | 'leftHand' | 'rightUpperArm' | 'rightLowerArm' | 'rightHand' | 'neck' | 'head', string>
>

export type LoadOptions = {
  gradientMap: THREE.Texture
  grade: Grade
  boneNames?: BoneNameOverrides
  /** meshes with a material whose name matches are hidden (props, helpers) */
  hiddenMaterials?: RegExp
  /** like hiddenMaterials, but still counted when the model is sized and
      placed — for a part dropped after the framing was tuned around it */
  undrawnMaterials?: RegExp
  /** non-VRM only: keep the file's own materials instead of toon-converting */
  originalMaterials?: boolean
  /** non-VRM only: materials matching `to` take the base texture of the
      material matching `from` (and drop their own flat colour) — for rips
      that left a texture off one part */
  borrowTextures?: TextureBorrow[]
}

/** `offset` shifts where the borrowed texture is read (UV units) */
export type TextureBorrow = { to: RegExp; from: RegExp; offset?: [u: number, v: number] }

/** model is rescaled so it stands this tall, in metres */
const CHARACTER_HEIGHT = 1.72

/* P3-protagonist navy hair — VRoid hair textures are near-greyscale and
   coloured by the material tint, so retinting the factors is enough */
const HAIR_COLOR = new THREE.Color(0.36, 0.48, 0.86)
const HAIR_SHADE = new THREE.Color(0.1, 0.13, 0.38)

/* the source's open jacket shows a plain white shirt — the model's vest is
   painted on the same texture as its shirt, so the whole top goes untextured
   white; the tie is hidden outright */
const SHIRT_COLOR = new THREE.Color(1, 1, 1)
const SHIRT_SHADE = new THREE.Color(0.72, 0.8, 0.95)

type MToonLike = THREE.Material & {
  color?: THREE.Color
  shadeColorFactor?: THREE.Color
  map?: THREE.Texture | null
  shadeMultiplyTexture?: THREE.Texture | null
  isOutline?: boolean
}

/* normalized (lowercase, alphanumeric only, mixamorig prefix stripped) names
   for the rigs people usually export: Mixamo, VRoid/VRM, Blender rigify,
   Unreal/3ds Max biped */
const BONE_CANDIDATES: Record<keyof BoneNameOverrides, string[]> = {
  leftUpperArm: ['leftarm', 'leftupperarm', 'jbiplupperarm', 'upperarml', 'upperarmleft', 'lupperarm', 'bip01lupperarm'],
  leftLowerArm: ['leftforearm', 'leftlowerarm', 'jbipllowerarm', 'forearml', 'lowerarml', 'forearmleft', 'lforearm', 'bip01lforearm'],
  leftHand: ['lefthand', 'jbiplhand', 'handl', 'handleft', 'lhand', 'bip01lhand'],
  rightUpperArm: ['rightarm', 'rightupperarm', 'jbiprupperarm', 'upperarmr', 'upperarmright', 'rupperarm', 'bip01rupperarm'],
  rightLowerArm: ['rightforearm', 'rightlowerarm', 'jbiprlowerarm', 'forearmr', 'lowerarmr', 'forearmright', 'rforearm', 'bip01rforearm'],
  rightHand: ['righthand', 'jbiprhand', 'handr', 'handright', 'rhand', 'bip01rhand'],
  neck: ['neck', 'jbipneck', 'neck01', 'bip01neck'],
  head: ['head', 'jbiphead', 'bip01head'],
}

/* Sketchfab exports append a node index ("Bip01_L_UpperArm_0112") — drop it */
const normalizeName = (name: string) =>
  name
    .replace(/_\d+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^mixamorig\d*/, '')

/* exactOnly: no suffix matching — "head" would also hit mesh helpers like
   "geo head" */
const findBone = (root: THREE.Object3D, key: keyof BoneNameOverrides, overrides: BoneNameOverrides, exactOnly = false) => {
  const nodes: THREE.Object3D[] = []
  root.traverse((o) => nodes.push(o))
  const exact = overrides[key]
  if (exact) return nodes.find((o) => o.name === exact) ?? null
  const candidates = BONE_CANDIDATES[key]
  const named = nodes.map((o) => [normalizeName(o.name), o] as const)
  return (
    named.find(([n]) => candidates.includes(n))?.[1] ??
    (exactOnly ? null : named.find(([n]) => candidates.some((c) => n.endsWith(c)))?.[1]) ??
    null
  )
}

const restPoseKeeper = (bones: THREE.Object3D[]) => {
  const rest = bones.map((b) => b.quaternion.clone())
  return () => bones.forEach((b, i) => b.quaternion.copy(rest[i]))
}

/* like restPoseKeeper, the whole local transform — look() rewrites the
   pinned bones' position and scale too */
const restTransformKeeper = (bones: THREE.Object3D[]) => {
  const rest = bones.map((b) => [b.position.clone(), b.quaternion.clone(), b.scale.clone()] as const)
  return () =>
    bones.forEach((b, i) => {
      b.position.copy(rest[i][0])
      b.quaternion.copy(rest[i][1])
      b.scale.copy(rest[i][2])
    })
}

/* bone's world rotation becomes delta * world, about its own origin */
const turnInWorld = (() => {
  const worldQ = new THREE.Quaternion()
  const parentQ = new THREE.Quaternion()
  return (bone: THREE.Object3D, delta: THREE.Quaternion) => {
    bone.getWorldQuaternion(worldQ).premultiply(delta)
    if (bone.parent) bone.parent.getWorldQuaternion(parentQ).invert()
    else parentQ.identity()
    bone.quaternion.copy(parentQ.multiply(worldQ))
    bone.updateMatrixWorld(true)
  }
})()

/* exact normalized names (see normalizeName) for 3ds Max Biped, Mixamo and
   VRM; %/^ = l/r or left/right */
const BEND_BONES = {
  spine: [['bip01spine', 'spine'], ['bip01spine1', 'spine1', 'chest'], ['bip01spine2', 'spine2', 'upperchest']],
  thigh: ['bip01%thigh', '^upleg', '^upperleg'],
  calf: ['bip01%calf', '^leg', '^lowerleg'],
} as const

/** body bending, see CharacterRig.bend */
const buildBend = (model: THREE.Object3D) => {
  const byName = new Map<string, THREE.Object3D>()
  model.traverse((o) => {
    const key = normalizeName(o.name)
    if (!byName.has(key)) byName.set(key, o)
  })
  const pick = (names: readonly string[], side?: 'l' | 'r') => {
    for (const name of names) {
      const hit = byName.get(side ? name.replace('%', side).replace('^', side === 'l' ? 'left' : 'right') : name)
      if (hit) return hit
    }
    return null
  }
  const spine = BEND_BONES.spine.map((names) => pick(names)).filter((b): b is THREE.Object3D => !!b)
  const legs = (['l', 'r'] as const).map((side) => ({ thigh: pick(BEND_BONES.thigh, side), calf: pick(BEND_BONES.calf, side) }))
  /* a Biped's thigh/calf twist bones hang off the spine/thigh rather than
     the bone they twist with — they're made to follow it, like the arms' */
  const followers: { bone: THREE.Object3D; leader: THREE.Object3D; offset: THREE.Matrix4 }[] = []
  model.updateMatrixWorld(true)
  for (const [i, side] of (['l', 'r'] as const).entries()) {
    for (const [part, leader] of [['thigh', legs[i].thigh], ['calf', legs[i].calf]] as const) {
      const bone = byName.get(`bip01${side}${part}twist`)
      if (bone && leader) followers.push({ bone, leader, offset: leader.matrixWorld.clone().invert().multiply(bone.matrixWorld) })
    }
  }
  /* bending the spine mustn't swing legs that hang off it */
  const pinned = [...legs.map((l) => l.thigh), ...followers.map((f) => f.bone)].filter(
    (b): b is THREE.Object3D => !!b && spine.some((s) => b.parent === s),
  )
  const reset = restTransformKeeper([...spine, ...legs.flatMap((l) => [l.thigh, l.calf]), ...followers.map((f) => f.bone)].filter((b): b is THREE.Object3D => !!b))
  const saved = pinned.map(() => new THREE.Matrix4())
  const inv = new THREE.Matrix4()
  const world = new THREE.Matrix4()
  const step = new THREE.Quaternion()
  const IDENTITY = new THREE.Quaternion()

  return {
    reset,
    bend: (spineDelta: THREE.Quaternion, hips: readonly THREE.Quaternion[], knees: readonly THREE.Quaternion[]) => {
      if (spine.length) {
        pinned.forEach((o, i) => saved[i].copy(o.matrixWorld))
        /* the same share at every segment adds up to the whole bend at the top */
        step.slerpQuaternions(IDENTITY, spineDelta, 1 / spine.length)
        for (const bone of spine) turnInWorld(bone, step)
        pinned.forEach((o, i) => {
          if (!o.parent) return
          inv.copy(o.parent.matrixWorld).invert()
          inv.multiply(saved[i]).decompose(o.position, o.quaternion, o.scale)
          o.updateMatrixWorld(true)
        })
      }
      legs.forEach((leg, i) => {
        if (leg.thigh && hips[i]) turnInWorld(leg.thigh, hips[i])
        if (leg.calf && knees[i]) turnInWorld(leg.calf, knees[i])
      })
      for (const f of followers) {
        if (!f.bone.parent) continue
        world.multiplyMatrices(f.leader.matrixWorld, f.offset)
        inv.copy(f.bone.parent.matrixWorld).invert()
        world.premultiply(inv).decompose(f.bone.position, f.bone.quaternion, f.bone.scale)
        f.bone.updateMatrixWorld(true)
      }
    },
  }
}

/** neck/head turning, see CharacterRig.look */
const buildLook = (neck: THREE.Object3D | null, head: THREE.Object3D | null, arms: THREE.Object3D[]) => {
  /* the neck's child on the way to each upper arm (the clavicles, in a
     3ds Max Biped) — pinned in world space while the neck turns */
  const pinned = neck
    ? arms
        .map((bone) => {
          let o: THREE.Object3D | null = bone
          while (o && o.parent !== neck) o = o.parent
          return o
        })
        .filter((o): o is THREE.Object3D => !!o && o !== head)
    : []
  const reset = restTransformKeeper([neck, head, ...pinned].filter((o): o is THREE.Object3D => !!o))
  const saved = pinned.map(() => new THREE.Matrix4())
  const inv = new THREE.Matrix4()

  return {
    reset,
    look: (neckDelta: THREE.Quaternion, headDelta: THREE.Quaternion) => {
      if (neck) {
        pinned.forEach((o, i) => saved[i].copy(o.matrixWorld))
        turnInWorld(neck, neckDelta)
        pinned.forEach((o, i) => {
          inv.copy(neck.matrixWorld).invert()
          inv.multiply(saved[i]).decompose(o.position, o.quaternion, o.scale)
          o.updateMatrixWorld(true)
        })
      }
      if (head) turnInWorld(head, headDelta)
    },
  }
}

const FINGERS = ['Index', 'Middle', 'Ring', 'Little'] as const
const JOINTS = ['Proximal', 'Intermediate', 'Distal'] as const
const THUMB_JOINTS = ['Metacarpal', 'Proximal', 'Distal'] as const
const THUMB_WEIGHT = [1, 1.1, 0.8]

type Side = 'left' | 'right'

/* VRM humanoid finger names -> normalized names in 3ds Max Biped rigs
   (Finger0 = thumb ... Finger4 = little, segments "", "1", "2") and Mixamo */
const HAND_ALIASES: Record<string, string[]> = {}
for (const side of ['left', 'right'] as const) {
  const s = side[0]
  FINGERS.forEach((finger, f) =>
    JOINTS.forEach((joint, j) => {
      HAND_ALIASES[`${side}${finger}${joint}`] = [`bip01${s}finger${f + 1}${j ? j : ''}`, `${side}hand${finger.toLowerCase().replace('little', 'pinky')}${j + 1}`]
    }),
  )
  THUMB_JOINTS.forEach((joint, j) => {
    HAND_ALIASES[`${side}Thumb${joint}`] = [`bip01${s}finger0${j ? j : ''}`, `${side}handthumb${j + 1}`]
  })
}

type BoneResolver = (vrmName: string) => THREE.Object3D | null

const buildHandRig = (bone: BoneResolver, hand: THREE.Object3D, lower: THREE.Object3D, side: Side): HandRig | null => {
  const named = (name: string) => bone(`${side}${name}`)
  if (!named('MiddleProximal') || !named('IndexProximal') || !named('LittleProximal')) return null
  const pos = (o: THREE.Object3D | null, fallback: THREE.Vector3) => (o ? o.getWorldPosition(new THREE.Vector3()) : fallback)
  const wrist = hand.getWorldPosition(new THREE.Vector3())
  const elbowDir = wrist.clone().sub(lower.getWorldPosition(new THREE.Vector3())).normalize()
  const f = pos(named('MiddleProximal'), wrist.clone().add(elbowDir)).sub(wrist).normalize()
  const across = pos(named('IndexProximal'), wrist).sub(pos(named('LittleProximal'), wrist))
  /* index-minus-little mirrors between hands, so the right hand's cross
     product comes out of the back of the hand — flip it back to the palm */
  const n = new THREE.Vector3().crossVectors(f, across).normalize().multiplyScalar(side === 'right' ? -1 : 1)
  /* curling a finger = rotating it from f toward the palm normal */
  const fingerAxis = new THREE.Vector3().crossVectors(f, n).normalize()

  const joints: FingerJoint[] = []
  const worldQ = new THREE.Quaternion()
  const addJoint = (b: THREE.Object3D, axisWorld: THREE.Vector3, joint: number, finger: number, thumb: boolean) => {
    b.getWorldQuaternion(worldQ)
    joints.push({ bone: b, rest: b.quaternion.clone(), axis: axisWorld.clone().applyQuaternion(worldQ.invert()), joint, finger, thumb })
  }
  FINGERS.forEach((finger, f) => {
    JOINTS.forEach((joint, i) => {
      const b = named(`${finger}${joint}`)
      if (b) addJoint(b, fingerAxis, i, f, false)
    })
  })
  const thumbBones = THUMB_JOINTS.map((joint) => named(`Thumb${joint}`)).filter((b): b is THREE.Object3D => !!b)
  if (thumbBones.length >= 2) {
    const thumbDir = pos(thumbBones[thumbBones.length - 1], wrist).sub(pos(thumbBones[0], wrist)).normalize()
    const thumbAxis = new THREE.Vector3().crossVectors(thumbDir, n).normalize()
    thumbBones.forEach((b, i) => addJoint(b, thumbAxis, i, -1, true))
  }

  const q = new THREE.Quaternion()
  /* f, palm-normal and curl axes in the hand bone's local space, for wrist() */
  const restQuat = hand.getWorldQuaternion(new THREE.Quaternion())
  const toLocal = restQuat.clone().invert()
  const localF = f.clone().applyQuaternion(toLocal)
  const localN = n.clone().applyQuaternion(toLocal)
  const localCurl = fingerAxis.clone().applyQuaternion(toLocal)
  /* + turn about the palm normal swings the fingers toward the thumb on
     the left hand, away from it on the mirrored right */
  const thumbSign = side === 'right' ? -1 : 1
  return {
    restQuat,
    restF: f,
    restN: n,
    joints,
    knuckle: named('MiddleProximal'),
    fingerTip: named('MiddleDistal'),
    curl: (fingers, thumb, extra) => {
      for (const j of joints) {
        q.setFromAxisAngle(j.axis, j.thumb ? thumb * THUMB_WEIGHT[j.joint] : fingers[j.joint] + (extra?.[j.finger] ?? 0))
        j.bone.quaternion.copy(j.rest).multiply(q)
      }
    },
    wrist: (bend, sideTilt, twist) => {
      hand.quaternion
        .multiply(q.setFromAxisAngle(localF, twist))
        .multiply(q.setFromAxisAngle(localCurl, bend))
        .multiply(q.setFromAxisAngle(localN, sideTilt * thumbSign))
    },
  }
}

/* Biped-style rigs parent the forearm twist bones to the UPPER arm (the
   game drives them with a controller), so bending only the forearm would
   leave half its skin behind at the elbow. Such bones are re-attached to the
   forearm each frame, keeping their rest offset from it. */
const TWIST = /foretwist|forearmtwist|lowerarmtwist/
const buildTwistFollowers = (arms: ArmChain[]) => {
  const followers: { bone: THREE.Object3D; leader: THREE.Object3D; offset: THREE.Matrix4 }[] = []
  for (const arm of arms) {
    for (const child of arm.upper.children) {
      if (child === arm.lower || !TWIST.test(normalizeName(child.name))) continue
      const offset = arm.lower.matrixWorld.clone().invert().multiply(child.matrixWorld)
      followers.push({ bone: child, leader: arm.lower, offset })
    }
  }
  const world = new THREE.Matrix4()
  const parentInverse = new THREE.Matrix4()
  return () => {
    for (const f of followers) {
      if (!f.bone.parent) continue
      world.multiplyMatrices(f.leader.matrixWorld, f.offset)
      parentInverse.copy(f.bone.parent.matrixWorld).invert()
      world.premultiply(parentInverse).decompose(f.bone.position, f.bone.quaternion, f.bone.scale)
      f.bone.updateMatrixWorld(true)
    }
  }
}

/* VRoid-style blink: closed for ~0.15s every 2-5s */
const createBlinker = (vrm: VRM) => {
  let next = 1 + Math.random() * 3
  let t = 0
  return (dt: number) => {
    t += dt
    const phase = (t - next) / 0.15
    const value = phase > 0 && phase < 1 ? Math.sin(phase * Math.PI) : 0
    if (phase >= 1) next = t + 2 + Math.random() * 3
    vrm.expressionManager?.setValue('blink', value)
  }
}

/* Resolves to null (never rejects) when the file is missing or unusable, so
   the scene just shows the card on its own. A missing file under public/ comes
   back from Vite's SPA fallback as index.html with a 200, hence the
   content-type check rather than relying on res.ok. */
export const loadCharacter = async (url: string, options: LoadOptions): Promise<CharacterRig | null> => {
  const { gradientMap, grade, hiddenMaterials, originalMaterials } = options
  let overrides = options.boneNames ?? {}
  try {
    const res = await fetch(url)
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return null
    const buffer = await res.arrayBuffer()
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    const gltf = await loader.parseAsync(buffer, url.slice(0, url.lastIndexOf('/') + 1))
    const model = gltf.scene
    const vrm = gltf.userData.vrm as VRM | undefined

    if (vrm) {
      VRMUtils.removeUnnecessaryVertices(model)
      VRMUtils.combineSkeletons(model)
      VRMUtils.rotateVRM0(vrm)
      /* IK writes straight to the raw bones — stop vrm.update() from
         overwriting them with the (untouched) normalized pose */
      vrm.humanoid.autoUpdateHumanBones = false
      const raw = (name: Parameters<typeof vrm.humanoid.getRawBoneNode>[0]) => vrm.humanoid.getRawBoneNode(name)?.name
      overrides = {
        leftUpperArm: raw('leftUpperArm'),
        leftLowerArm: raw('leftLowerArm'),
        leftHand: raw('leftHand'),
        rightUpperArm: raw('rightUpperArm'),
        rightLowerArm: raw('rightLowerArm'),
        rightHand: raw('rightHand'),
        neck: raw('neck'),
        head: raw('head'),
        ...overrides,
      }
    }

    const bones = {
      lu: findBone(model, 'leftUpperArm', overrides),
      ll: findBone(model, 'leftLowerArm', overrides),
      lh: findBone(model, 'leftHand', overrides),
      ru: findBone(model, 'rightUpperArm', overrides),
      rl: findBone(model, 'rightLowerArm', overrides),
      rh: findBone(model, 'rightHand', overrides),
    }
    const missing = Object.entries(bones).filter(([, b]) => !b)
    if (missing.length) {
      console.warn('[SocialLinkScene] arm bones not found, pass boneNames to map them:', missing.map(([k]) => k))
      return null
    }
    const { lu, ll, lh, ru, rl, rh } = bones as Record<keyof typeof bones, THREE.Object3D>

    model.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      /* posed skinned meshes drift outside their bind-pose bounds */
      mesh.frustumCulled = false
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (hiddenMaterials && materials.some((m) => hiddenMaterials.test(m.name))) mesh.visible = false
      if (vrm) {
        /* VRM ships its own anime shader (MToon) — keep it, just don't
           stack the scene outline on top of the model's own outline pass */
        for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MToonLike[]) {
          if (m.isOutline) noOutline(m)
          if (/HAIR/i.test(m.name)) {
            m.color?.copy(HAIR_COLOR)
            m.shadeColorFactor?.copy(HAIR_SHADE)
          }
          if (/Tops/i.test(m.name)) {
            m.color?.copy(SHIRT_COLOR)
            m.shadeColorFactor?.copy(SHIRT_SHADE)
            m.map = null
            m.shadeMultiplyTexture = null
            m.needsUpdate = true
          }
          if (/Accessory/i.test(m.name)) mesh.visible = false
          grade.apply(m)
        }
        return
      }
      if (originalMaterials) {
        materials.forEach((m) => grade.apply(m))
        return
      }
      const convert = (m: THREE.Material) => {
        const toon = grade.apply(toonify(m, gradientMap))
        m.dispose()
        return toon
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material)
    })
    if (vrm) addLongCoat(vrm, gradientMap, grade)
    if (!vrm && options.borrowTextures?.length) {
      const materials = new Set<THREE.Material>()
      model.traverse((o) => {
        const material = (o as THREE.Mesh).material
        if (material) (Array.isArray(material) ? material : [material]).forEach((m) => materials.add(m))
      })
      for (const { to, from, offset } of options.borrowTextures) {
        const source = [...materials].find((m) => from.test(m.name) && (m as MToonLike).map) as MToonLike | undefined
        if (!source?.map) continue
        const map = offset ? source.map.clone() : source.map
        if (offset) map.offset.set(offset[0], offset[1])
        for (const m of materials as Set<MToonLike>) {
          if (!to.test(m.name)) continue
          m.map = map
          m.color?.set(1, 1, 1)
          m.needsUpdate = true
        }
      }
    }

    /* VRM 0.x faces -Z, most other exports face +Z — detect from which side
       the left arm ends up on rather than trusting the format */
    const facing = new THREE.Group()
    facing.add(model)
    facing.updateMatrixWorld(true)
    const lx = lu.getWorldPosition(new THREE.Vector3()).x
    const rx = ru.getWorldPosition(new THREE.Vector3()).x
    if (lx < rx) facing.rotation.y = Math.PI

    const root = new THREE.Group()
    root.add(facing)
    root.updateMatrixWorld(true)
    /* only what's shown counts toward height — hidden props (a sheathed
       katana, say) would otherwise shrink the character */
    const box = new THREE.Box3()
    facing.traverseVisible((o) => {
      if ((o as THREE.Mesh).isMesh) box.expandByObject(o)
    })
    const scale = CHARACTER_HEIGHT / Math.max(box.max.y - box.min.y, 1e-3)
    const center = box.getCenter(new THREE.Vector3())
    root.scale.setScalar(scale)
    root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
    const undrawn = options.undrawnMaterials
    if (undrawn) {
      facing.traverse((o) => {
        const material = (o as THREE.Mesh).material
        if (material && (Array.isArray(material) ? material : [material]).some((m) => undrawn.test(m.name))) o.visible = false
      })
    }

    const mixer = !vrm && gltf.animations.length ? new THREE.AnimationMixer(model) : null
    if (mixer) mixer.clipAction(gltf.animations[0]).play()
    const resetArms = restPoseKeeper([lu, ll, lh, ru, rl, rh])
    const bender = vrm ? null : buildBend(model)
    const looker = buildLook(findBone(model, 'neck', overrides, true), findBone(model, 'head', overrides, true), [lu, ru])
    const blink = vrm ? createBlinker(vrm) : null
    /* measured in the normalized rest pose, before anything is posed */
    root.updateMatrixWorld(true)
    const byName = new Map<string, THREE.Object3D>()
    model.traverse((o) => {
      const key = normalizeName(o.name)
      if (!byName.has(key)) byName.set(key, o)
    })
    const resolveHandBone: BoneResolver = (name) => {
      if (vrm) return vrm.humanoid.getRawBoneNode(name as Parameters<typeof vrm.humanoid.getRawBoneNode>[0])
      for (const alias of HAND_ALIASES[name] ?? []) {
        const hit = byName.get(alias)
        if (hit) return hit
      }
      return null
    }
    const cardHand = buildHandRig(resolveHandBone, lh, ll, 'left')
    const otherHand = buildHandRig(resolveHandBone, rh, rl, 'right')
    const cardArm = { upper: lu, lower: ll, hand: lh }
    const otherArm = { upper: ru, lower: rl, hand: rh }
    const followTwists = buildTwistFollowers([cardArm, otherArm])
    /* VRMs sway via their own spring bones */
    const wind = vrm ? null : buildWind(model, root)
    const face = vrm ? null : buildFace(root)
    const defaultMotion: Motion = { wind: POSE.wind }

    return {
      root,
      cardArm,
      otherArm,
      cardHand,
      otherHand,
      look: looker.look,
      bend: (spine, hips, knees) => bender?.bend(spine, hips, knees),
      face,
      update: (dt) => {
        /* always from rest first: wrist() turns the hand relative to its
           current pose, which must not carry over between frames on bones
           an animation clip doesn't key */
        resetArms()
        looker.reset()
        bender?.reset()
        face?.reset()
        mixer?.update(dt)
      },
      postUpdate: (dt, motion = defaultMotion) => {
        followTwists()
        wind?.(dt, motion)
        if (!vrm) return
        blink?.(dt)
        vrm.update(dt)
      },
      dispose: () => VRMUtils.deepDispose(root),
    }
  } catch (err) {
    console.warn('[SocialLinkScene] could not load character model, showing the card alone', err)
    return null
  }
}
