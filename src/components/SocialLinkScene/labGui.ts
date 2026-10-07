import GUI from 'lil-gui'
import type * as THREE from 'three'
import { applyPose, poseToJson } from './pose'

/* shared by the dev slider panels (poseLab, figureLab): a lil-gui panel
   whose every change writes straight into a config object, survives
   reloads via localStorage, and copies out / loads in as JSON */

export type Range = [min: number, max: number]
export const R = (min: number, max: number): Range => [min, max]

export const WORLD_AXES = ['x (+ screen right)', 'y (+ up)', 'z (+ toward camera)']
export const BODY_AXES = ['x (+ his left)', 'y (+ up)', 'z (+ forward)']

export const vector = (parent: GUI, v: THREE.Vector3, title: string, ranges: [Range, Range, Range], labels = BODY_AXES, step = 0.005) => {
  const folder = parent.addFolder(title)
  ;(['x', 'y', 'z'] as const).forEach((axis, i) => folder.add(v, axis, ranges[i][0], ranges[i][1], step).name(labels[i]))
  return folder
}

type Look = { pitch: number; yaw: number; roll: number }
export const look = (parent: GUI, neck: Look, head: Look, title: string) => {
  const folder = parent.addFolder(title)
  ;([['neck', neck], ['head', head]] as const).forEach(([name, o]) => {
    folder.add(o, 'pitch', -60, 60, 0.5).name(`${name} pitch (° + nod down)`)
    folder.add(o, 'yaw', -80, 80, 0.5).name(`${name} yaw (° + his left)`)
    folder.add(o, 'roll', -45, 45, 0.5).name(`${name} roll (° + his right)`)
  })
  return folder
}

type Arm = { hand: THREE.Vector3; elbowAngle: number; pole: THREE.Vector3 }
type Wrist = { bend: number; side: number; twist: number }
type Fingers = { curl: number[]; thumb: number; extra: number[] }
/* an arm aimed at a point (elbow angle, wrist aim, pole) and its hand */
export const freeArm = (armFolder: GUI, handFolder: GUI, arm: Arm, hand: Wrist, fingers: Fingers, aimRanges = [R(-0.5, 0.2), R(0.4, 1.5), R(-0.3, 0.4)] as [Range, Range, Range]) => {
  armFolder.add(arm, 'elbowAngle', 20, 180, 1).name('elbow (° 180=straight)')
  vector(armFolder, arm.hand, 'wrist aim', aimRanges)
  vector(armFolder, arm.pole, 'elbow points', [R(-1.5, 1.5), R(-1.5, 1.5), R(-1.5, 1.5)], BODY_AXES, 0.05)
  handFolder.add(hand, 'bend', -90, 90, 1).name('wrist bend (° + palm)')
  handFolder.add(hand, 'side', -60, 60, 1).name('wrist side (° + thumb)')
  handFolder.add(hand, 'twist', -120, 120, 1).name('wrist twist (°)')
  ;['knuckle', 'middle joint', 'tip joint'].forEach((name, i) => handFolder.add(fingers.curl, i, -0.5, 1.5, 0.01).name(`curl ${name}`))
  ;['index', 'middle', 'ring', 'little'].forEach((name, i) => handFolder.add(fingers.extra, i, -0.5, 1.5, 0.01).name(`extra ${name}`))
  handFolder.add(fingers, 'thumb', -0.5, 1.5, 0.01).name('thumb curl')
}

/** the panel with its copy / load / reset buttons; `defaults` is the
    config as written in its file (JSON) */
export const createLabPanel = (title: string, storageKey: string, target: Record<string, unknown>, defaults: string) => {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) applyPose(JSON.parse(saved), target)
  } catch {
    /* unreadable or blocked storage — start from the file's values */
  }
  const save = () => {
    try {
      localStorage.setItem(storageKey, poseToJson(target))
    } catch {
      /* storage blocked — tweaks just won't survive a reload */
    }
  }

  const gui = new GUI({ title, width: 480 })
  gui.domElement.style.zIndex = '10000'
  /* long sliders: narrower label column and number box than lil-gui's
     45% / 27% defaults, the rest goes to the track */
  gui.domElement.style.setProperty('--name-width', '32%')
  gui.domElement.style.setProperty('--slider-input-width', '16%')

  /* buttons first, so they stay reachable above the long slider list */
  const refresh = () => gui.controllersRecursive().forEach((c) => c.updateDisplay())
  const flash = (name: string, message: string, label: string) => {
    const controller = gui.controllers.find((c) => c.property === name)
    controller?.name(message)
    window.setTimeout(() => controller?.name(label), 1400)
  }
  const actions = {
    copy: () => {
      navigator.clipboard.writeText(poseToJson(target)).then(
        () => flash('copy', '✓ copied', 'Copy config'),
        () => flash('copy', '✗ clipboard blocked', 'Copy config'),
      )
    },
    paste: () => {
      navigator.clipboard.readText().then(
        (text) => {
          try {
            applyPose(JSON.parse(text), target)
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
    /* back to the values as written in the config file */
    reset: () => {
      applyPose(JSON.parse(defaults), target)
      refresh()
      try {
        localStorage.removeItem(storageKey)
      } catch {
        /* storage blocked — nothing saved to clear */
      }
      flash('reset', '✓ reset', 'Reset to default')
    },
  }
  gui.add(actions, 'copy').name('Copy config')
  gui.add(actions, 'paste').name('Load config from clipboard')
  gui.add(actions, 'reset').name('Reset to default')
  /* fires for every controller in the panel and its folders */
  gui.onChange(save)
  /* for edits made outside the sliders (labCamera.ts) */
  return Object.assign(gui, { persist: save })
}
