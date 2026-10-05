import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm'
import { noOutline, toonify } from './toon'

export type ArmChain = { upper: THREE.Object3D; lower: THREE.Object3D; hand: THREE.Object3D }

export type CharacterRig = {
  root: THREE.Object3D
  /* character's left = screen right when facing the camera — this is the
     arm that holds / dangles the card */
  cardArm: ArmChain
  otherArm: ArmChain
  /** headphones hang off this */
  neck: THREE.Object3D | null
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

type MToonLike = THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color; isOutline?: boolean }

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
        }
        return
      }
      const convert = (m: THREE.Material) => {
        const toon = toonify(m, gradientMap)
        m.dispose()
        return toon
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material)
    })

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

    return {
      root,
      cardArm: { upper: lu, lower: ll, hand: lh },
      otherArm: { upper: ru, lower: rl, hand: rh },
      neck: vrm?.humanoid.getRawBoneNode('neck') ?? model.getObjectByName('neck') ?? null,
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
