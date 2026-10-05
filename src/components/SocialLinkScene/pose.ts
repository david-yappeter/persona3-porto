import * as THREE from 'three'

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** Every hand-tuned number of the framing and held pose, in one mutable
    object. The scene reads it each frame, so the dev pose lab
    (`/skill/0?lab`) can edit it live and copy it out as JSON.
    Angles are degrees, distances metres. Character-space vectors face +Z
    with the card (left) hand on +X. */
export const POSE = {
  camera: {
    /* world space: +X screen right, +Y up, +Z toward the camera */
    pos: v3(-0.065, 1.5, 0.86),
    target: v3(0.05, 1.3, -0.025),
    /* dutch tilt — the source frame leans with the head to the right */
    roll: 11.46,
    fov: 28,
    parallaxX: 0.02,
    parallaxY: 0.02,
  },
  body: {
    /* slight turn toward screen-left, bringing the card arm forward */
    turn: -25,
    /* >1 exaggerates the card hand for an anime close-up; 1 = as modelled */
    cardHandScale: 1.1,
  },
  /* held: elbow bent to `elbowAngle` (180 = straight) and tucked against the
     side, the hand reaching from the shoulder along `dir` — the reach length
     comes from the real bone lengths, so the angle is exact; pole = which
     way the elbow points */
  cardArm: { dir: v3(-0.12, -0.12, 0.23), elbowAngle: 52, pole: v3(0.85, -0.55, -0.6) },
  /* card hand orientation: f = where the fingers point, n = out of the palm
     (back of the hand to camera, thumb behind the card) */
  cardHand: { f: v3(-1.2, 1, 0.1), n: v3(0.1, 0.2, -1) },
  fingers: {
    /* curl per joint (knuckle, middle, tip), all four fingers */
    curl: [0.05, 0.01, 0.46] as [number, number, number],
    thumb: 0.33,
    /* extra curl per finger (index, middle, ring, little) */
    extra: [0.06, 0.13, 0.19, 0.33] as [number, number, number, number],
  },
  grip: {
    /* where the middle finger's last joint lands on the card's left edge, as
       a fraction of card height from centre */
    edgeV: 0,
    /* finger thickness plus half the card: the card stays at least this far
       behind every finger joint over it */
    clearance: 0.015,
  },
  /* where the thumb tip presses, in card coordinates from its centre (u
     right, v up); negative lift = behind the card */
  thumb: { u: 0.013, v: 0.019, lift: -0.043 },
  /* free arm: reaches from the shoulder toward `hand` (an aim point) only as
     far as bends the elbow to `elbowAngle`; pole -X swings the elbow out */
  otherArm: { hand: v3(-0.24, 0.4, 0.03), elbowAngle: 140, pole: v3(0, 0.05, -0.85) },
  /* free hand, relative to the forearm (0 = as modelled): bend = flex
     toward the palm (- = back), side = tilt toward the thumb (- = little
     finger), twist = roll around the fingers' axis */
  otherHand: { bend: 6, side: -12, twist: 16 },
  /* free hand fingers, same layout as `fingers` (0 = as modelled) */
  otherFingers: {
    curl: [0.3, 0.26, 0.27] as [number, number, number],
    thumb: 0.01,
    extra: [0.05, -0.02, -0.01, -0.01] as [number, number, number, number],
  },
  /* wind on the rig's cloth chains (coat tails, hair, ribbon/cord); rigs
     without them ignore it. strength/flare are degrees per chain segment */
  wind: {
    strength: 20.5,
    /* 0 = blows toward screen right, 90 = toward the camera, 180 = left */
    direction: -65,
    /* outward lift of the hem all round, independent of direction */
    flare: 11.5,
    /* 0 = steady breeze, 1 = mostly gusts */
    gust: 0.43,
    speed: 1.85,
    /* how much more the lower segments swing than the top one */
    tipBoost: 1.7,
    /* per-group multipliers, 0 = still */
    coat: 1,
    hair: 1.05,
    accessories: 0,
  },
  /* see-through look over the page (needs the menu colours on): opacity
     follows brightness — dark cloth lets the background show through, bright
     skin/shirt stay solid. Outlines and the card stay opaque. */
  overlay: {
    enabled: true,
    /* opacity of the darkest / brightest parts, 0..1 */
    dark: 0.4,
    light: 0.95,
    /* brightness (0..1) where it switches, and how gradually */
    cut: 0.45,
    softness: 0.25,
    /* keep dark hair solid instead of fading it with the jacket */
    hairSolid: false,
  },
  /* second state ("floating"): the card arm lifts with the palm open toward
     the camera while the card leaves the hand and floats in front of the
     chest, facing the camera (it only flips when the face changes). Same
     meaning as cardArm / cardHand / fingers. */
  float: {
    /* seconds to blend between held and floating, either way */
    duration: 0.3,
    arm: { dir: v3(0.07, -0.01, 1), elbowAngle: 115, pole: v3(0.2, -0.75, -0.5) },
    hand: { f: v3(0.25, 0.4, 0.55), n: v3(-0.85, -0.55, -0.85) },
    fingers: {
      curl: [0.07, 0.03, -0.07] as [number, number, number],
      thumb: -0.03,
      extra: [0.02, 0, 0.03, 0.29] as [number, number, number, number],
    },
    card: {
      /* card centre, character space */
      pos: v3(0.035, 1.395, -0.1),
      /* up-down drift: metres, cycles per second */
      bob: 0.014,
      bobSpeed: 0.2,
      /* how late in the blend the card leaves the hand (0 = at once) */
      release: 0,
    },
  },
}

export type Pose = typeof POSE

/** dev-only switches, never part of the copied config */
export const LAB = {
  noParallax: false,
  /* overrides the page's cardState while previewing */
  forceState: '' as '' | 'held' | 'floating',
}

type Json = number | boolean | number[] | { [key: string]: Json }

const round = (n: number) => Math.round(n * 1000) / 1000

const toJson = (value: unknown): Json => {
  if (value instanceof THREE.Vector3) return [round(value.x), round(value.y), round(value.z)]
  if (Array.isArray(value)) return value.map(round)
  if (typeof value === 'number') return round(value)
  if (typeof value === 'boolean') return value
  const out: { [key: string]: Json } = {}
  for (const [k, v] of Object.entries(value as object)) out[k] = toJson(v)
  return out
}

/** the pose as pretty JSON, number arrays kept on one line */
export const poseToJson = (pose: Pose = POSE) =>
  JSON.stringify(toJson(pose), null, 2).replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (_, inner: string) => `[${inner.split(/,\s*/).join(', ')}]`)

/** writes a (possibly partial) JSON pose into POSE in place; unknown keys
    and mismatched shapes are skipped */
export const applyPose = (data: unknown, target: Record<string, unknown> = POSE) => {
  if (!data || typeof data !== 'object') return
  for (const [k, v] of Object.entries(data)) {
    const current = target[k]
    if (current instanceof THREE.Vector3) {
      if (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) current.set(v[0], v[1], v[2])
    } else if (Array.isArray(current)) {
      if (Array.isArray(v)) v.forEach((n, i) => i < current.length && Number.isFinite(n) && (current[i] = n))
    } else if (typeof current === 'number') {
      if (Number.isFinite(v)) target[k] = v
    } else if (typeof current === 'boolean') {
      if (typeof v === 'boolean') target[k] = v
    } else if (current && typeof current === 'object') {
      applyPose(v, current as Record<string, unknown>)
    }
  }
}

/** the values as written in this file, for the lab's reset */
export const DEFAULT_POSE = poseToJson()
