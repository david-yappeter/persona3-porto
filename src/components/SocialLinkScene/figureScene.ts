import * as THREE from 'three'
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js'
import { loadCharacter, type ArmChain, type CharacterRig, type HandRig } from './character'
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
  brightMaterials?: RegExp
  unshadedMaterials?: RegExp
}

const deg = THREE.MathUtils.degToRad

type Look = { pitch: number; yaw: number; roll: number }
type Arm = { hand: THREE.Vector3; elbowAngle: number; pole: THREE.Vector3 }
type Wrist = { bend: number; side: number; twist: number }
type Fingers = { curl: [number, number, number]; thumb: number; extra: [number, number, number, number] }
type Leg = { lift: number; spread: number; twist: number; knee: number }

export const mountFigureScene = (mount: HTMLElement, options: FigureSceneOptions) => {
  const width = Math.max(mount.clientWidth, 1)
  const height = Math.max(mount.clientHeight, 1)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio * stageScale(), 2))
  renderer.setSize(width, height)
  mount.appendChild(renderer.domElement)
  const effect = new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: PALETTE.outline })
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
  let rig: CharacterRig | null = null
  const outlined: { material: THREE.Material; bright: boolean }[] = []
  let disposed = false
  void loadCharacter(options.modelSrc, {
    gradientMap: gradient,
    grade,
    hiddenMaterials: options.hiddenMaterials,
    originalMaterials: true,
  }).then((loaded) => {
    if (disposed) {
      loaded?.dispose()
      return
    }
    if (!loaded) return
    rig = loaded
    feet.add(rig.root)
    const seen = new Set<THREE.Material>()
    rig.root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (seen.has(material) || material.userData.outlineParameters?.visible === false) continue
        seen.add(material)
        outlined.push({ material, bright: !!options.brightMaterials?.test(material.name) })
      }
    })
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
  const shadeLight = new THREE.Vector3()
  const gravityDir = new THREE.Vector3()
  const motion: Motion = {
    wind: FIGURE.wind,
    body: bodyQ,
    gravity: { direction: gravityDir, strength: 0 },
    accessories: FIGURE.accessories,
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
  let last = performance.now()

  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const motionDt = FIGURE_LAB.pause ? 0 : dt
    floatT += motionDt

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
      rig.face?.apply(FIGURE.face, FIGURE.facial)
      gravityDir.copy(FIGURE.gravity.direction)
      motion.gravity!.strength = FIGURE.gravity.strength
      rig.postUpdate(motionDt, motion)
    }

    renderer.clear()
    effect.render(scene, camera)
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
    resize.disconnect()
    rig?.dispose()
    gradient.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }
}
