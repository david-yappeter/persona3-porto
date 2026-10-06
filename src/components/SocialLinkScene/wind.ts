import * as THREE from 'three'
import type { POSE } from './pose'

/* Procedural wind on a rig's cloth chains — the P5R rips ship bone chains
   for the coat tails ("b fr jacket01..04"), hair strands and ribbon/cord
   ends that nothing animates. Each frame every chain is rebuilt from its
   rest pose and each segment swung toward the wind (plus an outward flare),
   more toward the tips, with a ripple travelling down the chain. Stylized,
   not simulated: there's no collision with the body.
   Optionally (Motion) gravity bends every chain toward a world direction,
   and the ribbon / cord / earphone chains get their own extra swing. */

export type Accessory = 'ribbon' | 'cord' | 'earphone'
type Group = 'coat' | 'hair' | Accessory
type Chain = { group: Group; bones: THREE.Object3D[]; rest: THREE.Quaternion[]; phase: number }

export type WindConfig = Omit<typeof POSE.wind, 'accessories'> & {
  /** ribbon / cord / earphone multiplier, when Motion.accessories doesn't set its own */
  accessories?: number
}

export type AccessoryMotion = {
  /** wind multiplier, 0 = still */
  amount: number
  /** extra side-to-side swing of its own, degrees per segment */
  swing: number
  /** swings per second */
  speed: number
  /** how much gravity pulls it, 1 = like the rest of the body */
  gravity: number
}

export type Motion = {
  wind: WindConfig
  /** the character's orientation in the world (default: upright) — the
      axes the swing uses, and the "down" its rest pose was modelled for */
  body?: THREE.Quaternion
  /** pulls chains toward `direction` (world space): strength 1 turns them
      as far as the body is turned away from it, so an upright body under
      straight-down gravity stays as modelled; negative floats them away */
  gravity?: { direction: THREE.Vector3; strength: number }
  accessories?: Record<Accessory, AccessoryMotion>
}

/* "b <side> <kind><segment>_<id>" (GLTFLoader turns the spaces into
   underscores) — the "_end_" leaf nodes don't match */
const CHAIN_BONE = /^b[ _]([a-z]+)[ _](jacket|hair|ribon|himo|earphone)(\d+)_\d+$/
const GROUP_OF: Record<string, Group> = { jacket: 'coat', hair: 'hair', ribon: 'ribbon', himo: 'cord', earphone: 'earphone' }

const deg = THREE.MathUtils.degToRad

export const buildWind = (model: THREE.Object3D) => {
  const nodes: THREE.Object3D[] = []
  model.traverse((o) => nodes.push(o))
  const found = new Map<string, { group: Group; segments: [number, THREE.Object3D][] }>()
  for (const o of nodes) {
    const m = CHAIN_BONE.exec(o.name)
    if (!m) continue
    const key = `${m[1]} ${m[2]}`
    const entry = found.get(key) ?? { group: GROUP_OF[m[2]], segments: [] }
    entry.segments.push([Number(m[3]), o])
    found.set(key, entry)
  }
  if (!found.size) return null
  const center = nodes.find((o) => /^Bip01[ _]Pelvis/.test(o.name)) ?? model

  const chains: Chain[] = [...found.values()].map(({ group, segments }, i) => {
    const bones = segments.sort((a, b) => a[0] - b[0]).map(([, bone]) => bone)
    return { group, bones, rest: bones.map((b) => b.quaternion.clone()), phase: i * 1.7 }
  })

  const pos = new THREE.Vector3()
  const next = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const wind = new THREE.Vector3()
  const out = new THREE.Vector3()
  const hub = new THREE.Vector3()
  const spin = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const worldQ = new THREE.Quaternion()
  const q = new THREE.Quaternion()
  const restDown = new THREE.Vector3()
  const pull = new THREE.Vector3()
  const side = new THREE.Vector3()
  const front = new THREE.Vector3()
  const swingAxis = new THREE.Vector3()
  const UPRIGHT = new THREE.Quaternion()
  let t = 0
  let swingT = 0

  /* turns `bone` by a world-space rotation vector (axis * angle) */
  const spinBy = (bone: THREE.Object3D, v: THREE.Vector3) => {
    const angle = v.length()
    if (angle < 1e-6) return
    bone.getWorldQuaternion(worldQ)
    v.divideScalar(angle).applyQuaternion(worldQ.invert())
    bone.quaternion.multiply(q.setFromAxisAngle(v, angle))
  }

  return (dt: number, motion: Motion) => {
    const w = motion.wind
    t += dt * w.speed
    swingT += dt
    /* 0° blows toward screen right, 90° toward the camera */
    wind.set(Math.cos(deg(w.direction)), 0, Math.sin(deg(w.direction)))
    center.getWorldPosition(hub)
    const body = motion.body ?? UPRIGHT
    side.set(1, 0, 0).applyQuaternion(body)
    front.set(0, 0, 1).applyQuaternion(body)
    /* gravity: the whole turn from the body's own down to the pull, spread
       evenly over each chain's segments (they add up toward the tip) */
    const g = motion.gravity
    let pullAngle = 0
    if (g && g.strength !== 0 && g.direction.lengthSq() > 1e-8) {
      restDown.set(0, -1, 0).applyQuaternion(body)
      pull.crossVectors(restDown, tmp.copy(g.direction).normalize())
      const sin = pull.length()
      pullAngle = Math.atan2(sin, restDown.dot(tmp)) * g.strength
      if (sin > 1e-6) pull.divideScalar(sin)
      else pullAngle = 0
    }

    for (const chain of chains) {
      const acc = chain.group === 'coat' || chain.group === 'hair' ? null : (motion.accessories?.[chain.group] ?? null)
      const amount = chain.group === 'coat' || chain.group === 'hair' ? w[chain.group] : (acc?.amount ?? w.accessories ?? 0)
      const gravity = pullAngle * (acc?.gravity ?? 1)
      const swing = acc ? deg(acc.swing) : 0
      const n = chain.bones.length
      chain.bones[0].getWorldPosition(out).sub(hub).setY(0)
      if (out.lengthSq() > 1e-8) out.normalize()

      chain.bones.forEach((bone, k) => {
        bone.quaternion.copy(chain.rest[k])
        if (gravity !== 0) spinBy(bone, spin.copy(pull).multiplyScalar(gravity / n))
        if (swing !== 0 && acc) {
          /* pendulum, rippling down the chain, a little forward-back too */
          const ph = swingT * acc.speed * Math.PI * 2 + chain.phase - k * 0.6
          const reach = (0.4 + (0.6 * k) / Math.max(n - 1, 1)) * swing
          bone.getWorldPosition(pos)
          const child = chain.bones[k + 1] ?? bone.children[0]
          if (child) {
            dir.subVectors(child.getWorldPosition(next), pos).normalize()
            swingAxis.crossVectors(dir, side).multiplyScalar(Math.sin(ph) * reach)
            spinBy(bone, swingAxis.add(tmp.crossVectors(dir, front).multiplyScalar(0.4 * Math.cos(ph) * reach)))
          }
        }
        if (amount === 0) return
        /* steady push + flutter rippling down the chain, under a slow gust
           envelope; gust 0 = steady breeze, 1 = mostly gusts */
        const ph = chain.phase
        const flutter = 0.6 * Math.sin(t * 1.1 + ph - k * 0.55) + 0.4 * Math.sin(t * 2.3 + ph * 1.9 - k * 0.8)
        const envelope = 1 - w.gust + w.gust * (0.2 + 1.4 * Math.max(0, Math.sin(t * 0.37 + ph * 0.6)))
        const push = envelope * (0.7 + (0.2 + 0.3 * w.gust) * flutter)
        /* top segments barely turn — the front panels' first bone sits up on
           the chest, so swinging it would peel the whole panel open */
        const weight = amount * (0.3 + (w.tipBoost * k) / Math.max(n - 1, 1))

        /* the segment's current direction, toward its child */
        bone.getWorldPosition(pos)
        const child = chain.bones[k + 1] ?? bone.children[0]
        if (!child) return
        child.getWorldPosition(next)
        dir.subVectors(next, pos)
        if (dir.lengthSq() < 1e-10) return
        dir.normalize()

        /* turning `dir` about dir × v swings it toward v */
        spin
          .crossVectors(dir, wind)
          .multiplyScalar(deg(w.strength) * weight * push)
          .add(tmp.crossVectors(dir, out).multiplyScalar(deg(w.flare) * weight * (0.7 + 0.3 * push)))
        spinBy(bone, spin)
      })
    }
  }
}
