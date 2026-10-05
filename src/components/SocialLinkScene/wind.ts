import * as THREE from 'three'
import { POSE } from './pose'

/* Procedural wind on a rig's cloth chains — the P5R rips ship bone chains
   for the coat tails ("b fr jacket01..04"), hair strands and ribbon/cord
   ends that nothing animates. Each frame every chain is rebuilt from its
   rest pose and each segment swung toward the wind (plus an outward flare),
   more toward the tips, with a ripple travelling down the chain. Stylized,
   not simulated: there's no collision with the body. */

type Group = 'coat' | 'hair' | 'accessories'
type Chain = { group: Group; bones: THREE.Object3D[]; rest: THREE.Quaternion[]; phase: number }

/* "b <side> <kind><segment>_<id>" (GLTFLoader turns the spaces into
   underscores) — the "_end_" leaf nodes don't match */
const CHAIN_BONE = /^b[ _]([a-z]+)[ _](jacket|hair|ribon|himo|earphone)(\d+)_\d+$/
const GROUP_OF: Record<string, Group> = { jacket: 'coat', hair: 'hair', ribon: 'accessories', himo: 'accessories', earphone: 'accessories' }

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
  let t = 0

  return (dt: number) => {
    const w = POSE.wind
    t += dt * w.speed
    /* 0° blows toward screen right, 90° toward the camera */
    wind.set(Math.cos(deg(w.direction)), 0, Math.sin(deg(w.direction)))
    center.getWorldPosition(hub)

    for (const chain of chains) {
      const amount = w[chain.group]
      const n = chain.bones.length
      chain.bones[0].getWorldPosition(out).sub(hub).setY(0)
      if (out.lengthSq() > 1e-8) out.normalize()

      chain.bones.forEach((bone, k) => {
        bone.quaternion.copy(chain.rest[k])
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
        const angle = spin.length()
        if (angle < 1e-6) return
        bone.getWorldQuaternion(worldQ)
        spin.divideScalar(angle).applyQuaternion(worldQ.invert())
        bone.quaternion.multiply(q.setFromAxisAngle(spin, angle))
      })
    }
  }
}
