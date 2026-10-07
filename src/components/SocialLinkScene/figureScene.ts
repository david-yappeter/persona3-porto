import * as THREE from 'three'
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js'
import { loadCharacter, type ArmChain, type CharacterRig, type HandRig, type TextureBorrow } from './character'
import { createBand, writeBandStencil, type BandShape } from './band'
import { createDigit } from './digit'
import { createScreenText } from './screenText'
import { FIGURE, FIGURE_LAB } from './figure'
import { solveTwoBoneIK } from './ik'
import { POSE } from './pose'
import { PALETTE, createGrade, createToonGradient } from './toon'
import type { Motion } from './wind'
import { stageScale } from '../../utils/stage'

/* The character on its own for the figure lab: no card, lanyard or band,
   posed entirely from FIGURE (figure.ts) and drawn with the same look as
   the careers scene (POSE.overlay / POSE.shading). */

export type FigureSceneOptions = {
  modelSrc: string
  hiddenMaterials?: RegExp
  undrawnMaterials?: RegExp
  brightMaterials?: RegExp
  unshadedMaterials?: RegExp
  borrowTextures?: TextureBorrow[]
  /** the big white band behind him (FIGURE.band), cut out wherever he's
      drawn and catching his shadow (FIGURE.shadow) */
  band?: boolean
  /** band only: a fixed shape instead of FIGURE.band (the page's own) */
  bandShape?: BandShape
  /** band only: slides it in once he's loaded, as a page's band does on
      arrival — unless the previous scene's last frame is covering, which
      already shows one */
  bandIn?: boolean
  /** band only: huge menu-name type on the band, behind him (FIGURE.title) */
  title?: string
}

const deg = THREE.MathUtils.degToRad

type Look = { pitch: number; yaw: number; roll: number }
type Arm = { hand: THREE.Vector3; elbowAngle: number; pole: THREE.Vector3 }
type Wrist = { bend: number; side: number; twist: number }
type Fingers = { curl: [number, number, number]; thumb: number; extra: [number, number, number, number] }
type Leg = { lift: number; spread: number; twist: number; knee: number }

/* last frame of a scene that just unmounted, shown by the next mount until
   its model loads — a route transition re-renders the outgoing page as a
   ghost copy, which would otherwise pop in empty (same as scene.ts) */
let handoff: { frame: HTMLCanvasElement; at: number } | null = null
const HANDOFF_TTL = 1000
/* the fall loop's clock (FIGURE.fall), kept across mounts so moving to
   another page with him on it carries on mid-fall instead of restarting */
let fallT = 0

export const mountFigureScene = (mount: HTMLElement, options: FigureSceneOptions) => {
  const width = Math.max(mount.clientWidth, 1)
  const height = Math.max(mount.clientHeight, 1)

  /* stencil: the band is cut out wherever he drew */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio * stageScale(), 2))
  renderer.setSize(width, height)
  mount.appendChild(renderer.domElement)
  const taken = handoff && performance.now() - handoff.at < HANDOFF_TTL ? handoff : null
  handoff = null
  if (taken) {
    taken.frame.className = 'social-link-scene-handoff'
    mount.appendChild(taken.frame)
  }
  const slideIn = !!options.bandIn && !taken
  const band = options.band ? createBand(!slideIn) : null
  const title = band && options.title ? createScreenText(options.title) : null
  const drawTitle = () => title?.render(renderer, FIGURE.title)
  const effect = new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: PALETTE.outline })
  /* frames are composed from two passes (him, then the band), cleared once by hand */
  renderer.autoClear = false
  effect.autoClear = false
  const grade = createGrade(true, options.unshadedMaterials)
  grade.setHeight(renderer.domElement.height)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FIGURE.camera.fov, width / height, 0.05, 80)
  scene.add(new THREE.AmbientLight(PALETTE.shadowLight, 0.9))
  const key = new THREE.DirectionalLight(PALETTE.keyLight, 2)
  key.position.set(-1.4, 2.4, 2.6)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x7ff6ff, 1.6)
  rim.position.set(2, 1.4, -1.6)
  scene.add(rim)

  /* body: sits at FIGURE.body.pos and turns about it; feet: the
     character's own frame (origin at the feet), hung `pivot` below */
  const body = new THREE.Group()
  const feet = new THREE.Group()
  body.add(feet)
  scene.add(body)
  const bodyQ = new THREE.Quaternion()

  const gradient = createToonGradient()
  const digit = createDigit()
  digit.group.visible = false
  scene.add(digit.group)
  if (band) digit.materials.forEach(writeBandStencil)
  let rig: CharacterRig | null = null
  const outlined: { material: THREE.Material; bright: boolean }[] = []
  let disposed = false
  let ready = false
  void loadCharacter(options.modelSrc, {
    gradientMap: gradient,
    grade,
    hiddenMaterials: options.hiddenMaterials,
    undrawnMaterials: options.undrawnMaterials,
    originalMaterials: true,
    borrowTextures: options.borrowTextures,
  }).then((loaded) => {
    if (disposed) {
      loaded?.dispose()
      return
    }
    ready = true
    taken?.frame.remove()
    if (slideIn) band?.setShown(true)
    if (!loaded) return
    rig = loaded
    feet.add(rig.root)
    const seen = new Set<THREE.Material>()
    rig.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (band) writeBandStencil(material)
        if (seen.has(material) || material.userData.outlineParameters?.visible === false) continue
        seen.add(material)
        outlined.push({ material, bright: !!options.brightMaterials?.test(material.name) })
      }
    })
    for (const material of digit.materials) outlined.push({ material, bright: true })
  })

  /* scratch */
  const shoulder = new THREE.Vector3()
  const elbowAt = new THREE.Vector3()
  const wristAt = new THREE.Vector3()
  const aim = new THREE.Vector3()
  const pole = new THREE.Vector3()
  const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  const lookQ = new THREE.Quaternion()
  const invQ = new THREE.Quaternion()
  const neckQ = new THREE.Quaternion()
  const headQ = new THREE.Quaternion()
  const spineQ = new THREE.Quaternion()
  const hipQ = [new THREE.Quaternion(), new THREE.Quaternion()]
  const kneeQ = [new THREE.Quaternion(), new THREE.Quaternion()]
  const legQ = new THREE.Quaternion()
  const axisQ = new THREE.Quaternion()
  const X = new THREE.Vector3(1, 0, 0)
  const Y = new THREE.Vector3(0, 1, 0)
  const Z = new THREE.Vector3(0, 0, 1)
  const bodyEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  const drift = new THREE.Vector3()
  const screenUp = new THREE.Vector3()
  const screenRight = new THREE.Vector3()
  const screenIn = new THREE.Vector3()
  const toBody = new THREE.Vector3()
  const tumbleQ = new THREE.Quaternion()
  const shadeLight = new THREE.Vector3()
  const gravityDir = new THREE.Vector3()
  const motion: Motion = {
    wind: FIGURE.wind,
    body: bodyQ,
    gravity: { direction: gravityDir, strength: 0 },
    accessories: FIGURE.accessories,
    hair: FIGURE.hair,
  }

  /* a neck/head turn in character-space degrees, as the world-space
     rotation rig.look() takes */
  const lookDelta = (out: THREE.Quaternion, l: Look) => {
    lookQ.setFromEuler(lookEuler.set(deg(l.pitch), deg(l.yaw), deg(l.roll)))
    return out.copy(bodyQ).multiply(lookQ).multiply(invQ.copy(bodyQ).invert())
  }

  /* character space -> the world-space rotation the rig takes */
  const toWorld = (q: THREE.Quaternion) => q.premultiply(bodyQ).multiply(invQ.copy(bodyQ).invert())
  /* a leg's hip turn (twist, then lift, then spread; mirrored so + means
     the same on both sides) and its knee hinge, which turns with the thigh */
  const legDelta = (hip: THREE.Quaternion, knee: THREE.Quaternion, l: Leg, side: 1 | -1) => {
    legQ.setFromAxisAngle(Z, side * deg(l.spread))
    legQ.multiply(axisQ.setFromAxisAngle(X, -deg(l.lift))).multiply(axisQ.setFromAxisAngle(Y, side * deg(l.twist)))
    knee.copy(legQ).multiply(axisQ.setFromAxisAngle(X, deg(l.knee))).multiply(invQ.copy(legQ).invert())
    toWorld(hip.copy(legQ))
    toWorld(knee)
  }

  /* reach from the shoulder toward the aim point, exactly as far as closes
     the elbow to `elbowAngle` (law of cosines on the real bone lengths) */
  const poseArm = (arm: ArmChain, p: Arm) => {
    arm.upper.getWorldPosition(shoulder)
    const upperLen = shoulder.distanceTo(arm.lower.getWorldPosition(elbowAt))
    const foreLen = elbowAt.distanceTo(arm.hand.getWorldPosition(wristAt))
    const reach = Math.sqrt(upperLen ** 2 + foreLen ** 2 - 2 * upperLen * foreLen * Math.cos(deg(p.elbowAngle)))
    feet.localToWorld(aim.copy(p.hand)).sub(shoulder).setLength(reach).add(shoulder)
    solveTwoBoneIK(arm.upper, arm.lower, arm.hand, aim, pole.copy(p.pole).applyQuaternion(bodyQ))
  }
  const poseHand = (hand: HandRig | null, w: Wrist, f: Fingers) => {
    if (!hand) return
    hand.wrist(deg(w.bend), deg(w.side), deg(w.twist))
    hand.curl(f.curl, f.thumb, f.extra)
  }

  let floatT = 0
  /* the face as posed, plus the automatic blink */
  const face = { ...FIGURE.face }
  let last = performance.now()

  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const motionDt = FIGURE_LAB.pause ? 0 : dt
    floatT += motionDt
    fallT += motionDt

    const ov = POSE.overlay
    grade.setOverlay(FIGURE_LAB.solid ? { ...ov, enabled: false } : ov)
    effect.enabled = ov.outline !== 'off'
    for (const { material, bright } of outlined) {
      material.userData.outlineParameters = { visible: ov.outline === 'all' || bright, thickness: ov.outlineWidth }
    }

    const cam = FIGURE.camera
    camera.position.copy(cam.pos)
    camera.lookAt(cam.target)
    camera.rotateZ(deg(cam.roll))
    if (camera.fov !== cam.fov) {
      camera.fov = cam.fov
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()
    grade.setShading(POSE.shading, shadeLight.copy(POSE.shading.light).transformDirection(camera.matrixWorldInverse))

    /* body orientation, plus the float: a drift along its direction and a
       slow wobble on two axes */
    const b = FIGURE.body
    const fl = FIGURE.float
    const phase = floatT * fl.speed * Math.PI * 2
    const wobble = deg(fl.sway)
    bodyEuler.set(deg(b.pitch) + Math.sin(phase * 0.7 + 1) * wobble, deg(b.turn), deg(b.roll) + Math.sin(phase) * wobble)
    body.quaternion.setFromEuler(bodyEuler)
    bodyQ.copy(body.quaternion)
    drift.copy(fl.direction)
    if (drift.lengthSq() > 1e-8) drift.normalize()
    body.position.copy(b.pos).addScaledVector(drift, Math.sin(phase) * fl.distance)
    const fa = FIGURE.fall
    if (fa.on && fa.duration > 0) {
      /* top to bottom of the frame at his depth: half its height there,
         plus the margin that takes the whole body out of sight */
      screenUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
      screenRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
      camera.getWorldDirection(screenIn)
      const depth = Math.max(screenIn.dot(toBody.subVectors(b.pos, camera.position)), 0.1)
      const reach = depth * Math.tan(deg(camera.fov) / 2) + fa.margin
      const p = Math.min((fallT % (fa.duration + Math.max(fa.gap, 0))) / fa.duration, 1)
      body.position
        .addScaledVector(screenUp, reach * (1 - 2 * p))
        .addScaledVector(screenRight, Math.sin(p * Math.PI * 2 * fa.swings) * fa.drift)
      body.quaternion.premultiply(tumbleQ.setFromAxisAngle(screenIn, -deg(fa.tumble) * (p - 0.5)))
      bodyQ.copy(body.quaternion)
    }
    feet.position.set(0, -b.pivot, 0)

    if (rig) {
      rig.cardArm.hand.scale.setScalar(1)
      rig.update(dt)
      body.updateMatrixWorld(true)
      legDelta(hipQ[0], kneeQ[0], FIGURE.legs.left, 1)
      legDelta(hipQ[1], kneeQ[1], FIGURE.legs.right, -1)
      rig.bend(lookDelta(spineQ, FIGURE.spine), hipQ, kneeQ)
      rig.look(lookDelta(neckQ, FIGURE.neck), lookDelta(headQ, FIGURE.head))
      poseArm(rig.cardArm, FIGURE.leftArm)
      poseArm(rig.otherArm, FIGURE.rightArm)
      poseHand(rig.cardHand, FIGURE.leftHand, FIGURE.leftFingers)
      poseHand(rig.otherHand, FIGURE.rightHand, FIGURE.rightFingers)
      Object.assign(face, FIGURE.face)
      const { blinkEvery, blinkTime } = FIGURE.face
      if (blinkEvery > 0) {
        /* shut and open again over blinkTime, at the start of every period */
        const phase = (floatT % Math.max(blinkEvery, blinkTime)) / Math.max(blinkTime, 0.01)
        const shut = phase < 1 ? Math.sin(phase * Math.PI) : 0
        face.blinkL = Math.max(face.blinkL, shut)
        face.blinkR = Math.max(face.blinkR, shut)
      }
      rig.face?.apply(face, FIGURE.facial)
      gravityDir.copy(FIGURE.gravity.direction)
      motion.gravity!.strength = FIGURE.gravity.strength
      rig.postUpdate(motionDt, motion)
      const d = FIGURE.digit
      digit.update(motionDt, d, d.hold === 'right' ? rig.otherArm.hand : d.hold === 'left' ? rig.cardArm.hand : null)
    }

    band?.update(dt, options.bandShape ?? FIGURE.band)
    renderFrame()
  }
  const renderFrame = () => {
    renderer.clear()
    effect.render(scene, camera)
    /* not before he's there to cut his hole */
    if (ready) band?.render(renderer, scene, camera, FIGURE.shadow, drawTitle)
  }
  renderer.setAnimationLoop(tick)

  const resize = new ResizeObserver(() => {
    const w = mount.clientWidth
    const h = mount.clientHeight
    if (w === 0 || h === 0) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    grade.setHeight(renderer.domElement.height)
  })
  resize.observe(mount)

  return () => {
    disposed = true
    renderer.setAnimationLoop(null)
    if (ready) {
      /* copied in the same task as the render, while the drawing buffer
         still holds it */
      renderFrame()
      const frame = document.createElement('canvas')
      frame.width = renderer.domElement.width
      frame.height = renderer.domElement.height
      frame.getContext('2d')?.drawImage(renderer.domElement, 0, 0)
      handoff = { frame, at: performance.now() }
    } else if (taken) {
      /* unmounted before loading (StrictMode's dev double mount) */
      taken.frame.remove()
      handoff = taken
    }
    resize.disconnect()
    band?.dispose()
    title?.dispose()
    digit.dispose()
    rig?.dispose()
    gradient.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }
}
