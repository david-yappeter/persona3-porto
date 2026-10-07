import * as THREE from 'three'
import { poseToJson } from './pose'

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** The character alone (no card, no band) for the figure lab
    (`/figure-lab` and the /credits background, lab via `/credits?lab`):
    whole-body orientation, floating, gravity on
    the hair and cloth, both arms, the face and the ribbon/cord. Mutable like
    POSE — the lab edits it live and copies it out as JSON. The look (colour
    grade, outline, shading) is shared with POSE. Angles are degrees,
    distances metres; character-space vectors face +Z with his left on +X. */
export const FIGURE = {
  camera: {
    /* world space: +X screen right, +Y up, +Z toward the camera */
    pos: v3(-0.2, -1, 3.78),
    target: v3(0, 0.67, 0.245),
    roll: 71,
    fov: 12,
  },
  body: {
    /* turns about `pivot` (a height on the body, metres from the feet), so
       he can lie down mid-air without swinging off screen */
    pivot: 0.4,
    /* + = turn toward his left (screen right) */
    turn: 67,
    /* + = lean back (face up) */
    pitch: -151,
    /* + = tip over onto his right side (screen left) */
    roll: -33,
    /* where the pivot sits, world space */
    pos: v3(0.175, 1.51, 1.2),
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
    direction: v3(-1, 0.2, -0.75),
    strength: 0.73,
  },
  /* bends the upper body over the hips (0 = as modelled): pitch + = bend
     forward, yaw + = twist toward his left, roll + = lean toward his right
     side; spread over the spine's segments, the legs stay put */
  spine: { pitch: 25.5, yaw: -40, roll: 0 },
  /* each leg from the hip: lift + = thigh forward (- = back), spread + =
     out to the side, twist + = toes out; knee + = bend */
  legs: {
    left: { lift: 112.5, spread: 0, twist: 2, knee: 14 },
    right: { lift: 89, spread: 0.5, twist: 5.5, knee: 7.5 },
  },
  neck: { pitch: -15.5, yaw: -18, roll: 0 },
  head: { pitch: 0, yaw: -18, roll: 0 },
  /* eyes and brows (see face.ts) */
  face: {
    gazeYaw: -7.25,
    gazePitch: 0,
    blinkL: 0,
    blinkR: 0,
    /* automatic blink: one every `blinkEvery` seconds (0 = off), each
       lasting `blinkTime` seconds, on top of blinkL / blinkR */
    blinkEvery: 3.2,
    blinkTime: 0.15,
    browL: 0,
    browR: 0,
    browTilt: 0.07,
    frown: 0,
  },
  /* mouth, jaw, cheeks and eye size */
  facial: {
    jawOpen: 2,
    smile: 0.02,
    mouthWide: 0,
    upperLip: -0.09,
    cheek: 0.01,
    eyeSize: 1.03,
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
  rightArm: { hand: v3(-0.25, 0.68, 0.035), elbowAngle: 71, pole: v3(-0.3, 0, -0.8) },
  rightHand: { bend: -4, side: 0, twist: -25 },
  rightFingers: {
    curl: [0.78, 0.93, 1.02] as [number, number, number],
    thumb: 0.05,
    extra: [0, 0.03, 0.06, 0.1] as [number, number, number, number],
  },
  /* same meaning as POSE.wind; strength/flare are degrees per segment */
  wind: {
    strength: 12.5,
    direction: -86,
    flare: 15,
    gust: 0.38,
    speed: 0.75,
    tipBoost: 2.55,
    coat: 0,
    hair: 2,
  },
  /* the ribbon, cord and earphone chains: wind amount, an extra swing of
     their own (degrees per segment, swings per second) and how much
     gravity pulls them */
  accessories: {
    /* gravity 0: with this pose's pull pointing off his chest they'd lift
       away from it and dangle in the air */
    ribbon: { amount: 2.05, swing: 6, speed: 0.6, gravity: 0 },
    cord: { amount: 3, swing: 20, speed: 0.5, gravity: 0 },
    earphone: { amount: 1, swing: 3, speed: 0.5, gravity: 0 },
  },
  /* the big white band behind him on /credits (screen fractions, x from the
     left, y from the top; see POSE.band): never behind his see-through
     parts, and it catches his shadow */
  band: {
    /* where its lower (right-hand) edge meets the bottom of the screen */
    bottom: 1.15,
    /* horizontal distance between its two edges */
    width: 1.23,
    /* how far right the edges move per screen height going up */
    lean: 0.55,
  },
  /* his flat silhouette on the band, offset like a drop shadow (see POSE.shadow) */
  shadow: {
    strength: 0.66,
    color: '#747781',
    /* screen fractions: x + = right, y + = down */
    x: 0.02,
    y: -0.02,
  },
  /* the huge grey page name on the band (/credits' "CREDITS", like the
     equip menu's "EQUIP"), behind him and under his shadow */
  title: {
    /* left edge and baseline, screen fractions (x from the left, y from the top) */
    x: 0.06,
    y: 0.975,
    /* font size, fraction of the screen height */
    size: 0.3,
    /* 1 = as drawn, < 1 = condensed */
    squeeze: 0.72,
    /* gap between letters, CSS px */
    spacing: 5,
    /* italic lean, degrees */
    slant: 12,
    color: '#a9a9ad',
  },
  /* hair strands styled on top of their modelled shape, in face space
     (follows the head), degrees spread over each strand: lift + = away
     from the head (front ones off the face), sweep + = toward his left,
     wind = that strand's share of wind.hair (0 = still) */
  hair: {
    front: { lift: 45.5, sweep: -40, wind: 1.3 },
    frontRight: { lift: -45, sweep: 17, wind: 2.15 },
    frontLeft: { lift: -45, sweep: 62, wind: 2.15 },
    back: { lift: -7, sweep: -7, wind: 2.2 },
  },
}

export type Figure = typeof FIGURE

/** lab-only switches, never part of the copied config */
export const FIGURE_LAB = {
  /* freezes the float drift and the cloth/hair motion */
  pause: false,
  /* draws him fully opaque (POSE.overlay off), to see the dark parts */
  solid: false,
}

/** the values as written in this file, for the lab's reset */
export const DEFAULT_FIGURE = poseToJson(FIGURE)
