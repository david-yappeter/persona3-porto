import * as THREE from 'three'
import { poseToJson } from './pose'

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** The character alone (no card, no band) for the figure lab
    (`/figure-lab`, dev only): whole-body orientation, floating, gravity on
    the hair and cloth, both arms, the face and the ribbon/cord. Mutable like
    POSE — the lab edits it live and copies it out as JSON. The look (colour
    grade, outline, shading) is shared with POSE. Angles are degrees,
    distances metres; character-space vectors face +Z with his left on +X. */
export const FIGURE = {
  camera: {
    /* world space: +X screen right, +Y up, +Z toward the camera */
    pos: v3(0, 1.3, 3.2),
    target: v3(0, 1.05, 0),
    roll: 0,
    fov: 30,
  },
  body: {
    /* turns about `pivot` (a height on the body, metres from the feet), so
       he can lie down mid-air without swinging off screen */
    pivot: 1,
    /* + = turn toward his left (screen right) */
    turn: -15,
    /* + = lean back (face up) */
    pitch: 0,
    /* + = tip over onto his right side (screen left) */
    roll: 0,
    /* where the pivot sits, world space */
    pos: v3(0, 1, 0),
  },
  /* drifts back and forth along `direction` (world space) with a slow
     wobble — 0 distance and 0 sway = standing still */
  float: {
    direction: v3(0, 1, 0),
    distance: 0.02,
    /* cycles per second */
    speed: 0.25,
    /* wobble, degrees */
    sway: 1.5,
  },
  /* pulls hair, coat tails and accessories toward `direction` (world
     space). strength 1 = they hang the way gravity points, whatever way the
     body is turned; 0 = they keep the upright pose; negative = they float up */
  gravity: {
    direction: v3(0, -1, 0),
    strength: 1,
  },
  /* bends the upper body over the hips (0 = as modelled): pitch + = bend
     forward, yaw + = twist toward his left, roll + = lean toward his right
     side; spread over the spine's segments, the legs stay put */
  spine: { pitch: 0, yaw: 0, roll: 0 },
  /* each leg from the hip: lift + = thigh forward (- = back), spread + =
     out to the side, twist + = toes out; knee + = bend */
  legs: {
    left: { lift: 0, spread: 0, twist: 0, knee: 0 },
    right: { lift: 0, spread: 0, twist: 0, knee: 0 },
  },
  neck: { pitch: 0, yaw: 0, roll: 0 },
  head: { pitch: 0, yaw: 0, roll: 0 },
  /* eyes and brows (see face.ts) */
  face: {
    gazeYaw: 0,
    gazePitch: 0,
    blinkL: 0,
    blinkR: 0,
    browL: 0,
    browR: 0,
    browTilt: 0,
    frown: 0,
  },
  /* mouth, jaw, cheeks and eye size */
  facial: {
    jawOpen: 0,
    smile: 0,
    mouthWide: 0,
    upperLip: 0,
    cheek: 0,
    eyeSize: 1,
  },
  /* each arm reaches from its shoulder toward `hand` (an aim point,
     character space from the feet) only as far as bends the elbow to
     `elbowAngle` (180 = straight); pole = which way the elbow points */
  leftArm: { hand: v3(0.3, 0.6, 0.05), elbowAngle: 160, pole: v3(0.3, 0, -0.8) },
  /* wrist relative to the forearm: bend + = toward the palm, side + =
     toward the thumb, twist = around the fingers' axis */
  leftHand: { bend: 0, side: 0, twist: 0 },
  /* curl per joint (knuckle, middle, tip), thumb, and extra per finger
     (index, middle, ring, little) */
  leftFingers: {
    curl: [0.2, 0.2, 0.2] as [number, number, number],
    thumb: 0.05,
    extra: [0, 0.03, 0.06, 0.1] as [number, number, number, number],
  },
  rightArm: { hand: v3(-0.3, 0.6, 0.05), elbowAngle: 160, pole: v3(-0.3, 0, -0.8) },
  rightHand: { bend: 0, side: 0, twist: 0 },
  rightFingers: {
    curl: [0.2, 0.2, 0.2] as [number, number, number],
    thumb: 0.05,
    extra: [0, 0.03, 0.06, 0.1] as [number, number, number, number],
  },
  /* same meaning as POSE.wind; strength/flare are degrees per segment */
  wind: {
    strength: 8,
    direction: -65,
    flare: 6,
    gust: 0.4,
    speed: 1.2,
    tipBoost: 1.7,
    coat: 1,
    hair: 1,
  },
  /* the ribbon, cord and earphone chains: wind amount, an extra swing of
     their own (degrees per segment, swings per second) and how much
     gravity pulls them */
  accessories: {
    ribbon: { amount: 1, swing: 6, speed: 0.6, gravity: 1 },
    cord: { amount: 1, swing: 4, speed: 0.45, gravity: 1 },
    earphone: { amount: 1, swing: 3, speed: 0.5, gravity: 1 },
  },
}

export type Figure = typeof FIGURE

/** dev-only switches, never part of the copied config */
export const FIGURE_LAB = {
  /* freezes the float drift and the cloth/hair motion */
  pause: false,
  /* draws him fully opaque (POSE.overlay off), to see the dark parts */
  solid: false,
}

/** the values as written in this file, for the lab's reset */
export const DEFAULT_FIGURE = poseToJson(FIGURE)
