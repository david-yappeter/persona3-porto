import * as THREE from 'three'
import { poseToJson } from './pose'
import type { DigitConfig } from './digit'

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
    pos: v3(2.213, -3.349, 5.505),
    target: v3(-0.729, 0.918, 0.53),
    roll: 0,
    fov: 20,
  },
  body: {
    /* turns about `pivot` (a height on the body, metres from the feet), so
       he can lie down mid-air without swinging off screen */
    pivot: 0.9,
    /* + = turn toward his left (screen right) */
    turn: -3.5,
    /* + = lean back (face up) */
    pitch: -29,
    /* + = tip over onto his right side (screen left) */
    roll: -39,
    /* where the pivot sits, world space */
    pos: v3(0, 0.9, 0),
  },
  /* drifts back and forth along `direction` (world space) with a slow
     wobble — 0 distance and 0 sway = standing still */
  float: {
    direction: v3(0, 1, 0),
    distance: 0.02,
    /* cycles per second */
    speed: 0.14,
    /* wobble, degrees */
    sway: 1.5,
  },
  /* a slow fall through the frame, on repeat: he drops along the screen's
     down from just above its top edge to just below its bottom one, at his
     own depth, so the whole body crosses whatever the camera does */
  fall: {
    on: true,
    /* seconds from top to bottom */
    duration: 13,
    /* seconds out of sight below before the next drop */
    gap: 1.5,
    /* how far past each edge he starts / ends, metres (clears the body) */
    margin: 1.4,
    /* drifting side to side on the way down: metres, and swings per fall */
    drift: 0.25,
    swings: 1.5,
    /* slow turn over the fall, degrees from start to end (about the
       screen's depth axis, + = counter-clockwise) */
    tumble: 12,
  },
  /* pulls hair, coat tails and accessories toward `direction` (world
     space). strength 1 = they hang the way gravity points, whatever way the
     body is turned; 0 = they keep the upright pose; negative = they float up */
  gravity: {
    direction: v3(-1, 1, 1),
    strength: 0.32,
  },
  /* bends the upper body over the hips (0 = as modelled): pitch + = bend
     forward, yaw + = twist toward his left, roll + = lean toward his right
     side; spread over the spine's segments, the legs stay put */
  spine: { pitch: 25.5, yaw: 18.5, roll: 0 },
  /* each leg from the hip: lift + = thigh forward (- = back), spread + =
     out to the side, twist + = toes out; knee + = bend */
  legs: {
    left: { lift: 12.5, spread: 22, twist: 18, knee: 30 },
    right: { lift: 69.5, spread: 5.5, twist: 10.5, knee: 82.5 },
  },
  neck: { pitch: 24.5, yaw: 15, roll: 7.5 },
  head: { pitch: 17, yaw: 9, roll: 0 },
  /* eyes and brows (see face.ts) */
  face: {
    gazeYaw: 10.25,
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
  leftArm: { hand: v3(0.38, 0.865, -0.625), elbowAngle: 169, pole: v3(0.3, 0, -0.8) },
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
  rightArm: { hand: v3(-0.675, 1.75, 0.8), elbowAngle: 136, pole: v3(-0.15, 0, -0.8) },
  rightHand: { bend: -6, side: 17, twist: 120 },
  rightFingers: {
    curl: [0.41, 0.98, 0.93] as [number, number, number],
    thumb: 0.08,
    extra: [0.13, 0.54, 0.51, 0.26] as [number, number, number, number],
  },
  /* same meaning as POSE.wind; strength/flare are degrees per segment */
  wind: {
    strength: 12.5,
    direction: -86,
    flare: 15,
    gust: 0.7,
    speed: 0.75,
    tipBoost: 3,
    coat: 1.5,
    hair: 2,
  },
  /* the ribbon, cord and earphone chains: wind amount, an extra swing of
     their own (degrees per segment, swings per second) and how much
     gravity pulls them */
  accessories: {
    /* gravity 0: they keep their modelled hang; with the pull pointing off
       his chest (a lying pose) more would lift them off it into the air */
    ribbon: { amount: 2.05, swing: 6, speed: 0.6, gravity: 0 },
    cord: { amount: 3, swing: 20, speed: 0.5, gravity: 0 },
    earphone: { amount: 1, swing: 13, speed: 0.5, gravity: 0.5 },
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
    front: { lift: -45, sweep: 8, wind: 1.75 },
    frontRight: { lift: 4.5, sweep: 82, wind: 2.15 },
    frontLeft: { lift: 9.5, sweep: 1, wind: 0.2 },
    back: { lift: 11, sweep: -7, wind: 2.2 },
  },
  /* the falling "9" he grabs (see digit.ts): held in a hand, or free */
  digit: {
    show: true,
    hold: 'right' as DigitConfig['hold'],
    size: 0.68,
    depth: 0.04,
    /* by the left end of its foot */
    grip: { x: 0.23, y: 0.1 },
    offset: v3(0.03, 0, 0.076),
    /* for this pose's raised right hand */
    pitch: 157,
    yaw: -168.5,
    roll: 80.5,
    pos: v3(0.3, 1.3, 1),
    spin: 20,
    color: '#9a9da6',
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
