import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'
import { noOutline, toonify, type Grade } from './toon'
import { addLongCoat } from './coat'

export type ArmChain = { upper: THREE.Object3D; lower: THREE.Object3D; hand: THREE.Object3D }

type FingerJoint = { bone: THREE.Object3D; rest: THREE.Quaternion; axis: THREE.Vector3; joint: number; thumb: boolean }

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
      one value spread over the thumb */
  curl: (fingers: readonly [number, number, number], thumb: number) => void
}

export type CharacterRig = {
  root: THREE.Object3D
  /* character's left = screen right when facing the camera — this is the
     arm that holds / dangles the card */
  cardArm: ArmChain
  otherArm: ArmChain
  /** null for non-VRM models — no finger bones to drive */
  cardHand: HandRig | null
  /** before IK: reset arms to rest / advance animation */
  update: (dt: number) => void
  /** after IK: hair/cloth physics, blinking */
  postUpdate: (dt: number) => void
  dispose: () => void
}

export type BoneNameOverrides = Partial<Record<'leftUpperArm' | 'leftLowerArm' | 'leftHand' | 'rightUpperArm' | 'rightLowerArm' | 'rightHand', string>>

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
}

const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^mixamorig\d*/, '')

const findBone = (root: THREE.Object3D, key: keyof BoneNameOverrides, overrides: BoneNameOverrides) => {
  const nodes: THREE.Object3D[] = []
  root.traverse((o) => nodes.push(o))
  const exact = overrides[key]
  if (exact) return nodes.find((o) => o.name === exact) ?? null
  const candidates = BONE_CANDIDATES[key]
  const named = nodes.map((o) => [normalizeName(o.name), o] as const)
  return (
    named.find(([n]) => candidates.includes(n))?.[1] ??
    named.find(([n]) => candidates.some((c) => n.endsWith(c)))?.[1] ??
    null
  )
}

const restPoseKeeper = (bones: THREE.Object3D[]) => {
  const rest = bones.map((b) => b.quaternion.clone())
  return () => bones.forEach((b, i) => b.quaternion.copy(rest[i]))
}

const FINGERS = ['Index', 'Middle', 'Ring', 'Little'] as const
const JOINTS = ['Proximal', 'Intermediate', 'Distal'] as const
const THUMB = ['leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal'] as const
const THUMB_WEIGHT = [1, 1.1, 0.8]

const buildHandRig = (vrm: VRM, hand: THREE.Object3D, lower: THREE.Object3D): HandRig => {
  type BoneName = Parameters<typeof vrm.humanoid.getRawBoneNode>[0]
  const bone = (name: string) => vrm.humanoid.getRawBoneNode(name as BoneName)
  const pos = (o: THREE.Object3D | null, fallback: THREE.Vector3) => (o ? o.getWorldPosition(new THREE.Vector3()) : fallback)
  const wrist = hand.getWorldPosition(new THREE.Vector3())
  const elbowDir = wrist.clone().sub(lower.getWorldPosition(new THREE.Vector3())).normalize()
  const f = pos(bone('leftMiddleProximal'), wrist.clone().add(elbowDir)).sub(wrist).normalize()
  const side = pos(bone('leftIndexProximal'), wrist).sub(pos(bone('leftLittleProximal'), wrist))
  const n = new THREE.Vector3().crossVectors(f, side).normalize()
  /* curling a finger = rotating it from f toward the palm normal */
  const fingerAxis = new THREE.Vector3().crossVectors(f, n).normalize()

  const joints: FingerJoint[] = []
  const worldQ = new THREE.Quaternion()
  const addJoint = (b: THREE.Object3D, axisWorld: THREE.Vector3, joint: number, thumb: boolean) => {
    b.getWorldQuaternion(worldQ)
    joints.push({ bone: b, rest: b.quaternion.clone(), axis: axisWorld.clone().applyQuaternion(worldQ.invert()), joint, thumb })
  }
  for (const finger of FINGERS) {
    JOINTS.forEach((joint, i) => {
      const b = bone(`left${finger}${joint}`)
      if (b) addJoint(b, fingerAxis, i, false)
    })
  }
  const thumbBones = THUMB.map((name) => bone(name)).filter((b): b is THREE.Object3D => !!b)
  if (thumbBones.length >= 2) {
    const thumbDir = pos(thumbBones[thumbBones.length - 1], wrist).sub(pos(thumbBones[0], wrist)).normalize()
    const thumbAxis = new THREE.Vector3().crossVectors(thumbDir, n).normalize()
    thumbBones.forEach((b, i) => addJoint(b, thumbAxis, i, true))
  }

  const q = new THREE.Quaternion()
  return {
    restQuat: hand.getWorldQuaternion(new THREE.Quaternion()),
    restF: f,
    restN: n,
    joints,
    knuckle: bone('leftMiddleProximal'),
    fingerTip: bone('leftMiddleDistal'),
    curl: (fingers, thumb) => {
      for (const j of joints) {
        q.setFromAxisAngle(j.axis, j.thumb ? thumb * THUMB_WEIGHT[j.joint] : fingers[j.joint])
        j.bone.quaternion.copy(j.rest).multiply(q)
      }
    },
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
export const loadCharacter = async (
  url: string,
  gradientMap: THREE.Texture,
  grade: Grade,
  boneNames: BoneNameOverrides = {},
): Promise<CharacterRig | null> => {
  let overrides = boneNames
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
      const convert = (m: THREE.Material) => {
        const toon = grade.apply(toonify(m, gradientMap))
        m.dispose()
        return toon
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material)
    })
    if (vrm) addLongCoat(vrm, gradientMap, grade)

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
    const box = new THREE.Box3().setFromObject(facing)
    const scale = CHARACTER_HEIGHT / Math.max(box.max.y - box.min.y, 1e-3)
    const center = box.getCenter(new THREE.Vector3())
    root.scale.setScalar(scale)
    root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)

    const mixer = !vrm && gltf.animations.length ? new THREE.AnimationMixer(model) : null
    if (mixer) mixer.clipAction(gltf.animations[0]).play()
    const resetArms = restPoseKeeper([lu, ll, lh, ru, rl, rh])
    const blink = vrm ? createBlinker(vrm) : null
    /* measured in the normalized rest pose, before anything is posed */
    root.updateMatrixWorld(true)
    const cardHand = vrm ? buildHandRig(vrm, lh, ll) : null

    return {
      root,
      cardArm: { upper: lu, lower: ll, hand: lh },
      otherArm: { upper: ru, lower: rl, hand: rh },
      cardHand,
      update: (dt) => {
        if (mixer) mixer.update(dt)
        else resetArms()
      },
      postUpdate: (dt) => {
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
