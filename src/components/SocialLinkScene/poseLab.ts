import GUI from 'lil-gui'
import type * as THREE from 'three'
import { DEFAULT_POSE, LAB, POSE, applyPose, poseToJson } from './pose'

/* dev-only slider panel over the live scene (`/skill/0?lab`): every change
   writes straight into POSE, survives reloads via localStorage, and "Copy
   config" puts the whole pose on the clipboard as JSON */

const STORAGE_KEY = 'persona.poseLab'

type Range = [min: number, max: number]

const WORLD_AXES = ['x (+ screen right)', 'y (+ up)', 'z (+ toward camera)']
const BODY_AXES = ['x (+ his left)', 'y (+ up)', 'z (+ forward)']

const vector = (parent: GUI, v: THREE.Vector3, title: string, ranges: [Range, Range, Range], labels = BODY_AXES, step = 0.005) => {
  const folder = parent.addFolder(title)
  ;(['x', 'y', 'z'] as const).forEach((axis, i) => folder.add(v, axis, ranges[i][0], ranges[i][1], step).name(labels[i]))
  return folder
}

type Look = { pitch: number; yaw: number; roll: number }
const look = (parent: GUI, neck: Look, head: Look, title: string) => {
  const folder = parent.addFolder(title)
  ;([['neck', neck], ['head', head]] as const).forEach(([name, o]) => {
    folder.add(o, 'pitch', -60, 60, 0.5).name(`${name} pitch (° + nod down)`)
    folder.add(o, 'yaw', -80, 80, 0.5).name(`${name} yaw (° + his left)`)
    folder.add(o, 'roll', -45, 45, 0.5).name(`${name} roll (° + his right)`)
  })
  return folder
}

type FreeArm = Pick<typeof POSE, 'otherArm' | 'otherHand' | 'otherFingers'>
/* free arm + hand controls, shared by the held pose and the floating one */
const freeArm = (armFolder: GUI, handFolder: GUI, p: FreeArm) => {
  const R = (min: number, max: number): Range => [min, max]
  armFolder.add(p.otherArm, 'elbowAngle', 20, 180, 1).name('elbow (° 180=straight)')
  vector(armFolder, p.otherArm.hand, 'wrist aim', [R(-0.5, 0.2), R(0.4, 1.5), R(-0.3, 0.4)])
  vector(armFolder, p.otherArm.pole, 'elbow points', [R(-1.5, 1.5), R(-1.5, 1.5), R(-1.5, 1.5)], BODY_AXES, 0.05)
  handFolder.add(p.otherHand, 'bend', -90, 90, 1).name('wrist bend (° + palm)')
  handFolder.add(p.otherHand, 'side', -60, 60, 1).name('wrist side (° + thumb)')
  handFolder.add(p.otherHand, 'twist', -120, 120, 1).name('wrist twist (°)')
  ;['knuckle', 'middle joint', 'tip joint'].forEach((name, i) => handFolder.add(p.otherFingers.curl, i, -0.5, 1.5, 0.01).name(`curl ${name}`))
  ;['index', 'middle', 'ring', 'little'].forEach((name, i) => handFolder.add(p.otherFingers.extra, i, -0.5, 1.5, 0.01).name(`extra ${name}`))
  handFolder.add(p.otherFingers, 'thumb', -0.5, 1.5, 0.01).name('thumb curl')
}

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, poseToJson())
  } catch {
    /* storage blocked — tweaks just won't survive a reload */
  }
}

export const mountPoseLab = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) applyPose(JSON.parse(saved))
  } catch {
    /* unreadable or blocked storage — start from the file's values */
  }
  LAB.noParallax = true

  const gui = new GUI({ title: 'Pose lab', width: 480 })
  gui.domElement.style.zIndex = '10000'
  /* long sliders: narrower label column and number box than lil-gui's
     45% / 27% defaults, the rest goes to the track */
  gui.domElement.style.setProperty('--name-width', '32%')
  gui.domElement.style.setProperty('--slider-input-width', '16%')
  const R = (min: number, max: number): Range => [min, max]

  /* buttons first, so they stay reachable above the long slider list */
  const refresh = () => gui.controllersRecursive().forEach((c) => c.updateDisplay())
  const flash = (name: string, message: string, label: string) => {
    const controller = gui.controllers.find((c) => c.property === name)
    controller?.name(message)
    window.setTimeout(() => controller?.name(label), 1400)
  }

  const actions = {
    copy: () => {
      navigator.clipboard.writeText(poseToJson()).then(
        () => flash('copy', '✓ copied', 'Copy config'),
        () => flash('copy', '✗ clipboard blocked', 'Copy config'),
      )
    },
    paste: () => {
      navigator.clipboard.readText().then(
        (text) => {
          try {
            applyPose(JSON.parse(text))
          } catch {
            flash('paste', '✗ not valid JSON', 'Load config from clipboard')
            return
          }
          refresh()
          save()
          flash('paste', '✓ loaded', 'Load config from clipboard')
        },
        () => flash('paste', '✗ clipboard blocked', 'Load config from clipboard'),
      )
    },
    /* back to POSE as written in pose.ts — what the page shows without ?lab */
    reset: () => {
      applyPose(JSON.parse(DEFAULT_POSE))
      refresh()
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* storage blocked — nothing saved to clear */
      }
      flash('reset', '✓ reset', 'Reset to default (current page)')
    },
  }
  gui.add(LAB, 'noParallax').name('freeze mouse sway (lab only)')
  gui.add(actions, 'copy').name('Copy config')
  gui.add(actions, 'paste').name('Load config from clipboard')
  gui.add(actions, 'reset').name('Reset to default (current page)')

  const cam = gui.addFolder('Camera')
  vector(cam, POSE.camera.pos, 'position', [R(-1, 1), R(0.5, 2.5), R(0.2, 3)], WORLD_AXES)
  vector(cam, POSE.camera.target, 'look at', [R(-1, 1), R(0.5, 2), R(-1, 1)], WORLD_AXES)
  cam.add(POSE.camera, 'roll', -30, 30, 0.1).name('roll (°)')
  cam.add(POSE.camera, 'fov', 10, 60, 0.5).name('fov (zoom)')
  cam.add(POSE.camera, 'parallaxX', 0, 0.15, 0.005).name('mouse sway x')
  cam.add(POSE.camera, 'parallaxY', 0, 0.15, 0.005).name('mouse sway y')

  const body = gui.addFolder('Body')
  body.add(POSE.body, 'turn', -60, 60, 0.5).name('turn (°)')
  body.add(POSE.body, 'cardHandScale', 0.8, 1.5, 0.01).name('card hand scale')

  look(gui, POSE.neck, POSE.head, 'Neck & head')

  const cardArm = gui.addFolder('Card arm (his left)')
  cardArm.add(POSE.cardArm, 'elbowAngle', 20, 180, 1).name('elbow (° 180=straight)')
  vector(cardArm, POSE.cardArm.dir, 'wrist direction', [R(-1, 1), R(-1, 1), R(-1, 1)], BODY_AXES, 0.01)
  vector(cardArm, POSE.cardArm.pole, 'elbow points', [R(-1.5, 1.5), R(-1.5, 1.5), R(-1.5, 1.5)], BODY_AXES, 0.05)

  const cardHand = gui.addFolder('Card hand rotation').close()
  vector(cardHand, POSE.cardHand.f, 'fingers point', [R(-2, 2), R(-2, 2), R(-2, 2)], BODY_AXES, 0.05)
  vector(cardHand, POSE.cardHand.n, 'palm faces', [R(-2, 2), R(-2, 2), R(-2, 2)], BODY_AXES, 0.05)

  const fingers = gui.addFolder('Fingers').close()
  ;['knuckle', 'middle joint', 'tip joint'].forEach((name, i) => fingers.add(POSE.fingers.curl, i, 0, 1.5, 0.01).name(`curl ${name}`))
  ;['index', 'middle', 'ring', 'little'].forEach((name, i) => fingers.add(POSE.fingers.extra, i, 0, 1.5, 0.01).name(`extra ${name}`))
  fingers.add(POSE.fingers, 'thumb', 0, 1.5, 0.01).name('thumb curl')

  const thumb = gui.addFolder('Thumb tip on card').close()
  thumb.add(POSE.thumb, 'u', -0.08, 0.08, 0.001).name('u (+ card right)')
  thumb.add(POSE.thumb, 'v', -0.1, 0.1, 0.001).name('v (+ card up)')
  thumb.add(POSE.thumb, 'lift', -0.08, 0.04, 0.001).name('lift (- behind card)')

  const grip = gui.addFolder('Grip').close()
  grip.add(POSE.grip, 'edgeV', -0.5, 0.5, 0.005).name('finger height on card')
  grip.add(POSE.grip, 'clearance', 0, 0.04, 0.001).name('card behind fingers')

  freeArm(gui.addFolder('Free arm (his right)'), gui.addFolder('Free hand (his right)'), POSE)

  /* second pose: preview button flips the page between held and floating */
  const float = gui.addFolder('Floating pose (2nd state)')
  const preview = {
    toggle: () => {
      LAB.forceState = LAB.forceState === 'floating' ? 'held' : 'floating'
      toggleButton.name(LAB.forceState === 'floating' ? '▶ Back to held' : '▶ Play floating')
    },
  }
  const toggleButton = float.add(preview, 'toggle').name('▶ Play floating')
  float.add(POSE.float, 'duration', 0.1, 3, 0.05).name('blend time (s)')
  float.add(POSE.float.body, 'turn', -60, 60, 0.5).name('body turn (°)')
  look(float, POSE.float.neck, POSE.float.head, 'neck & head').close()
  const floatArm = float.addFolder('arm')
  floatArm.add(POSE.float.arm, 'elbowAngle', 20, 180, 1).name('elbow (° 180=straight)')
  vector(floatArm, POSE.float.arm.dir, 'wrist direction', [R(-1, 1), R(-1, 1), R(-1, 1)], BODY_AXES, 0.01)
  vector(floatArm, POSE.float.arm.pole, 'elbow points', [R(-1.5, 1.5), R(-1.5, 1.5), R(-1.5, 1.5)], BODY_AXES, 0.05)
  const floatHand = float.addFolder('hand rotation').close()
  vector(floatHand, POSE.float.hand.f, 'fingers point', [R(-2, 2), R(-2, 2), R(-2, 2)], BODY_AXES, 0.05)
  vector(floatHand, POSE.float.hand.n, 'palm faces', [R(-2, 2), R(-2, 2), R(-2, 2)], BODY_AXES, 0.05)
  const floatFingers = float.addFolder('fingers').close()
  ;['knuckle', 'middle joint', 'tip joint'].forEach((name, i) => floatFingers.add(POSE.float.fingers.curl, i, -0.5, 1.5, 0.01).name(`curl ${name}`))
  ;['index', 'middle', 'ring', 'little'].forEach((name, i) => floatFingers.add(POSE.float.fingers.extra, i, -0.5, 1.5, 0.01).name(`extra ${name}`))
  floatFingers.add(POSE.float.fingers, 'thumb', -0.5, 1.5, 0.01).name('thumb curl')
  const floatCard = float.addFolder('floating card')
  vector(floatCard, POSE.float.card.pos, 'position', [R(-0.5, 0.5), R(0.8, 1.8), R(-0.1, 0.6)])
  floatCard.add(POSE.float.card, 'bob', 0, 0.05, 0.001).name('bob height (m)')
  floatCard.add(POSE.float.card, 'bobSpeed', 0, 3, 0.05).name('bob speed (/s)')
  floatCard.add(POSE.float.card, 'release', 0, 0.9, 0.01).name('leaves hand at')
  freeArm(float.addFolder('free arm (his right)').close(), float.addFolder('free hand (his right)').close(), POSE.float)

  const overlay = gui.addFolder('See-through overlay')
  overlay.add(POSE.overlay, 'enabled').name('on')
  overlay.add(POSE.overlay, 'dark', 0, 1, 0.01).name('dark parts opacity')
  overlay.add(POSE.overlay, 'light', 0, 1, 0.01).name('bright parts opacity')
  overlay.add(POSE.overlay, 'cut', 0, 1, 0.01).name('brightness cut-off')
  overlay.add(POSE.overlay, 'softness', 0, 0.5, 0.01).name('fade softness')
  overlay.add(POSE.overlay, 'hairSolid').name('keep hair solid')

  const wind = gui.addFolder('Wind (coat / hair)')
  wind.add(POSE.wind, 'strength', 0, 25, 0.5).name('strength (°)')
  wind.add(POSE.wind, 'direction', -180, 180, 1).name('direction (° 0=→ 90=cam)')
  wind.add(POSE.wind, 'flare', 0, 15, 0.5).name('hem flare (°)')
  wind.add(POSE.wind, 'gust', 0, 1, 0.01).name('gustiness')
  wind.add(POSE.wind, 'speed', 0, 3, 0.05).name('speed')
  wind.add(POSE.wind, 'tipBoost', 0, 3, 0.05).name('tip boost')
  wind.add(POSE.wind, 'coat', 0, 2, 0.05).name('coat amount')
  wind.add(POSE.wind, 'hair', 0, 2, 0.05).name('hair amount')
  wind.add(POSE.wind, 'accessories', 0, 2, 0.05).name('ribbon / cord amount')

  gui.onChange(save)

  return () => {
    LAB.noParallax = false
    LAB.forceState = ''
    gui.destroy()
  }
}
