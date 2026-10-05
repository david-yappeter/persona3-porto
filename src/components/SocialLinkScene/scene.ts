import * as THREE from 'three'
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js'
import { createBackground } from './background'
import { CARD_H, createCardMesh, createLanyard, drawCardFace, faceKey, type CardFace } from './card'
import { loadCharacter, type BoneNameOverrides, type CharacterRig } from './character'
import { solveTwoBoneIK } from './ik'
import { PALETTE, createToonGradient } from './toon'

export type CardState = 'held' | 'dangling'

export type SceneOptions = {
  modelSrc: string
  boneNames?: BoneNameOverrides
  initialCardState: CardState
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/* framing: chest-up, cropped around the mouth like the source */
const CAMERA_POS = v3(-0.1, 1.16, 1.8)
const CAMERA_TARGET = v3(-0.1, 1.08, 0)
const PARALLAX = { x: 0.07, y: 0.035 }

/* wrist targets in character space (metres, facing +Z, left hand on +X);
   pole = which way the elbow points */
const HELD_POSE = { hand: v3(0.04, 1.19, 0.25), pole: v3(0.7, -0.7, -0.3) }
const DANGLE_POSE = { hand: v3(0.12, 1.33, 0.27), pole: v3(0.45, -1, -0.1) }
const OTHER_ARM = { hand: v3(-0.27, 0.87, 0.06), pole: v3(-0.2, 0, -1) }
const POSE_DURATION = 0.6

/* wrist-to-fingertip / wrist-to-grip distances along the forearm direction */
const FINGERTIP = 0.15
const GRIP = 0.07

const STRING_LEN = 0.17
const GRAVITY = v3(0, -6.5, 0)
const DAMPING = 2.4
const STEP = 1 / 120
/* keeps the card in front of the chest instead of swinging through it */
const BODY_FRONT_Z = 0.19

const RELEASE_BLEND = 0.35
const GRAB_DURATION = 0.4
const SPIN_DURATION = 0.6
/* how long the card stays gripped once the character is on screen, before
   the drop onto the lanyard */
const HOLD_AFTER_READY = 0.8

/* P3-style over-ear headphones resting around the neck */
const createHeadphones = (gradientMap: THREE.Texture) => {
  const dark = new THREE.MeshToonMaterial({ color: 0x23263a, gradientMap })
  const accent = new THREE.MeshToonMaterial({ color: 0xd8dce8, gradientMap })
  const R = 0.098
  const group = new THREE.Group()
  const tilt = new THREE.Group()
  /* back of the band rides higher than the cups on the collarbones */
  tilt.rotation.x = 0.45
  group.add(tilt)
  const band = new THREE.Mesh(new THREE.TorusGeometry(R, 0.008, 8, 32, Math.PI), dark)
  band.rotation.x = -Math.PI / 2
  tilt.add(band)
  for (const side of [1, -1]) {
    const cup = new THREE.Group()
    cup.position.set(side * (R + 0.006), 0, 0.012)
    cup.rotation.set(0, side * 0.55, side * 0.25)
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.026, 28), dark)
    shell.rotation.z = Math.PI / 2
    cup.add(shell)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 28), accent)
    ring.rotation.y = Math.PI / 2
    ring.position.x = side * 0.014
    cup.add(ring)
    tilt.add(cup)
  }
  return group
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export const mountSocialLinkScene = (mount: HTMLElement, options: SceneOptions) => {
  const width = Math.max(mount.clientWidth, 1)
  const height = Math.max(mount.clientHeight, 1)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  mount.appendChild(renderer.domElement)
  const effect = new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: PALETTE.outline })
  const anisotropy = renderer.capabilities.getMaxAnisotropy()

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, width / height, 0.05, 80)
  camera.position.copy(CAMERA_POS)
  camera.lookAt(CAMERA_TARGET)

  const background = createBackground(scene)

  scene.add(new THREE.AmbientLight(PALETTE.shadowLight, 0.9))
  const key = new THREE.DirectionalLight(PALETTE.keyLight, 2)
  key.position.set(-1.4, 2.4, 2.6)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x7ff6ff, 1.6)
  rim.position.set(2, 1.4, -1.6)
  scene.add(rim)

  const gradient = createToonGradient()
  const stage = new THREE.Group()
  scene.add(stage)
  let rig: CharacterRig | null = null
  const headphones = createHeadphones(gradient)
  headphones.visible = false
  stage.add(headphones)

  /* card stays hidden until the model resolves (or fails), so it never
     floats alone and the hold-then-drop happens with the character there */
  let ready = false
  let readyAt = 0
  let disposed = false
  void loadCharacter(options.modelSrc, gradient, options.boneNames).then((loaded) => {
    if (disposed) {
      loaded?.dispose()
      return
    }
    if (loaded) {
      rig = loaded
      stage.add(rig.root)
      headphones.visible = !!rig.neck
    }
    ready = true
    readyAt = elapsed
  })

  const card = createCardMesh(anisotropy)
  scene.add(card.mesh)
  const CARD_POINTS = 14
  const TAIL_POINTS = 10
  const lanyard = createLanyard(CARD_POINTS + TAIL_POINTS - 1)
  lanyard.material.resolution.set(width, height)
  scene.add(lanyard.line)
  const lanyardPoints = Array.from({ length: CARD_POINTS + TAIL_POINTS - 1 }, () => new THREE.Vector3())

  /* --- card state: targetState is what was asked for, effective is what's
     playing (held until the character is ready) --- */
  let targetState: CardState = options.initialCardState
  let effective: CardState = targetState
  const gateRelease = targetState === 'held'
  let armT = effective === 'held' ? 0 : 1
  let pinned = effective === 'held'
  let grabT = 0
  let grabbing = false
  let releaseBlend = 0
  let initialized = false

  const p = new THREE.Vector3()
  const pPrev = new THREE.Vector3()
  const smoothUp = v3(0, 1, 0)

  /* --- face swap: spin a full turn, swap texture when edge-on/back-facing --- */
  let hasFace = false
  let lastKey = ''
  let request = 0
  let spinStart = -1
  let spinSwapped = true
  let spinPending: THREE.Texture | null = null
  let queued: THREE.Texture | null = null
  let elapsed = 0

  const startSpin = (texture: THREE.Texture) => {
    spinStart = elapsed
    spinSwapped = false
    spinPending = texture
    /* sideways nudge so the swap also sets the card swinging */
    pPrev.x -= 0.004
  }

  const setCard = (face: CardFace) => {
    const keyNow = faceKey(face)
    if (keyNow === lastKey) return
    lastKey = keyNow
    const id = ++request
    void drawCardFace(face, anisotropy).then((texture) => {
      if (disposed || id !== request) {
        texture.dispose()
        return
      }
      if (!hasFace) {
        card.setFrontTexture(texture)
        hasFace = true
      } else if (spinStart >= 0 && !spinSwapped) {
        spinPending?.dispose()
        spinPending = texture
      } else if (spinStart >= 0) {
        queued?.dispose()
        queued = texture
      } else {
        startSpin(texture)
      }
    })
  }

  const setCardState = (state: CardState) => {
    targetState = state
  }

  const applyCardState = (state: CardState) => {
    effective = state
    if (state === 'dangling') {
      pinned = false
      grabbing = false
      releaseBlend = 1
    } else {
      grabbing = true
      grabT = 0
    }
  }

  /* --- pointer parallax --- */
  const pointer = new THREE.Vector2()
  const pointerSmooth = new THREE.Vector2()
  const onPointer = (e: PointerEvent) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
  }
  window.addEventListener('pointermove', onPointer)

  /* scratch */
  const handTarget = new THREE.Vector3()
  const pole = new THREE.Vector3()
  const wrist = new THREE.Vector3()
  const elbow = new THREE.Vector3()
  const fingerDir = new THREE.Vector3()
  const anchor = new THREE.Vector3()
  const heldTop = new THREE.Vector3()
  const heldUp = v3(-0.16, 1, 0).normalize()
  const cardPos = new THREE.Vector3()
  const upTarget = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const center = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const basis = new THREE.Matrix4()
  const yawQ = new THREE.Quaternion()
  const heldQ = new THREE.Quaternion()
  const dangleQ = new THREE.Quaternion()
  const control = new THREE.Vector3()

  const faceCamera = (out: THREE.Quaternion, top: THREE.Vector3, up: THREE.Vector3, yaw: number) => {
    center.copy(top).addScaledVector(up, -CARD_H / 2)
    forward.subVectors(camera.position, center)
    forward.addScaledVector(up, -forward.dot(up)).normalize()
    right.crossVectors(up, forward).normalize()
    basis.makeBasis(right, up, forward)
    out.setFromRotationMatrix(basis)
    yawQ.setFromAxisAngle(up, yaw)
    return out.premultiply(yawQ)
  }

  const bezier = (from: THREE.Vector3, ctrl: THREE.Vector3, to: THREE.Vector3, t: number, out: THREE.Vector3) => {
    const u = 1 - t
    return out
      .copy(from)
      .multiplyScalar(u * u)
      .addScaledVector(ctrl, 2 * u * t)
      .addScaledVector(to, t * t)
  }

  const stepPhysics = (pinTo: THREE.Vector3 | null) => {
    if (pinTo) {
      pPrev.copy(p)
      p.copy(pinTo)
      return
    }
    tmp.subVectors(p, pPrev).multiplyScalar(Math.exp(-DAMPING * STEP))
    pPrev.copy(p)
    p.add(tmp).addScaledVector(GRAVITY, STEP * STEP)
    tmp.subVectors(p, anchor)
    const len = tmp.length()
    if (len > STRING_LEN) p.copy(anchor).addScaledVector(tmp, STRING_LEN / len)
    if (p.z < BODY_FRONT_Z) p.z = BODY_FRONT_Z
  }

  let accumulator = 0
  let last = performance.now()

  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    elapsed += dt

    pointerSmooth.lerp(pointer, 1 - Math.exp(-4 * dt))
    camera.position.set(
      CAMERA_POS.x + pointerSmooth.x * PARALLAX.x + Math.sin(elapsed * 0.25) * 0.01,
      CAMERA_POS.y - pointerSmooth.y * PARALLAX.y,
      CAMERA_POS.z,
    )
    camera.lookAt(CAMERA_TARGET)
    background.update(dt)

    /* breathing */
    stage.position.y = Math.sin(elapsed * 1.7) * 0.003
    rig?.update(dt)
    stage.updateMatrixWorld(true)

    const releaseAllowed = !gateRelease || (ready && elapsed - readyAt > HOLD_AFTER_READY)
    const next: CardState = targetState === 'dangling' && releaseAllowed ? 'dangling' : 'held'
    if (next !== effective) applyCardState(next)
    card.mesh.visible = ready
    lanyard.line.visible = ready

    armT = THREE.MathUtils.clamp(armT + (effective === 'dangling' ? dt : -dt) / POSE_DURATION, 0, 1)
    const armE = smooth(armT)
    handTarget.lerpVectors(HELD_POSE.hand, DANGLE_POSE.hand, armE)
    handTarget.x += Math.sin(elapsed * 0.9) * 0.006 * armE
    handTarget.y += Math.sin(elapsed * 1.3) * 0.005
    stage.localToWorld(handTarget)
    if (rig) {
      pole.lerpVectors(HELD_POSE.pole, DANGLE_POSE.pole, armE)
      const arm = rig.cardArm
      solveTwoBoneIK(arm.upper, arm.lower, arm.hand, handTarget, pole)
      const other = rig.otherArm
      solveTwoBoneIK(other.upper, other.lower, other.hand, stage.localToWorld(elbow.copy(OTHER_ARM.hand)), OTHER_ARM.pole)
      arm.hand.getWorldPosition(wrist)
      arm.lower.getWorldPosition(elbow)
      fingerDir.subVectors(wrist, elbow).normalize()
      rig.postUpdate(dt)
      if (rig.neck) {
        rig.neck.getWorldPosition(headphones.position)
        stage.worldToLocal(headphones.position).add(tmp.set(0, 0.03, 0.015))
      }
    } else {
      /* no model: the card hangs from where the hand would be */
      wrist.copy(handTarget)
      fingerDir.set(0, 1, 0)
    }
    anchor.copy(wrist).addScaledVector(fingerDir, FINGERTIP)
    heldTop
      .copy(wrist)
      .addScaledVector(fingerDir, GRIP)
      .add(tmp.set(0, 0, 0.03))
      .addScaledVector(heldUp, CARD_H * 0.78)

    if (!initialized) {
      initialized = true
      if (pinned) p.copy(heldTop)
      else p.copy(anchor).add(tmp.set(0, -STRING_LEN, 0))
      pPrev.copy(p)
    }

    if (grabbing) {
      grabT = Math.min(grabT + dt / GRAB_DURATION, 1)
      if (grabT >= 1) {
        grabbing = false
        pinned = true
      }
    }
    releaseBlend = Math.max(releaseBlend - dt / RELEASE_BLEND, 0)

    accumulator += dt
    while (accumulator >= STEP) {
      stepPhysics(pinned ? heldTop : null)
      accumulator -= STEP
    }

    /* spin progress */
    let spinYaw = 0
    if (spinStart >= 0) {
      const s = (elapsed - spinStart) / SPIN_DURATION
      if (s >= 1) {
        spinStart = -1
        if (queued) {
          startSpin(queued)
          queued = null
        }
      } else {
        spinYaw = easeInOutCubic(s) * Math.PI * 2
        if (!spinSwapped && spinYaw >= Math.PI && spinPending) {
          card.setFrontTexture(spinPending)
          spinPending = null
          spinSwapped = true
        }
      }
    }

    /* only a taut string dictates the card's tilt — while slack (falling
       off the hand) it keeps hanging roughly upright instead of flipping
       toward a string that may be pointing down */
    upTarget.subVectors(anchor, p)
    const taut = THREE.MathUtils.clamp((upTarget.length() / STRING_LEN - 0.7) / 0.3, 0, 1)
    upTarget.normalize().lerp(heldUp, 1 - taut).normalize()
    smoothUp.lerp(upTarget, 1 - Math.exp(-14 * dt)).normalize()

    const idleYaw = Math.sin(elapsed * 0.8) * 0.28 + Math.sin(elapsed * 1.7) * 0.08
    faceCamera(dangleQ, p, smoothUp, idleYaw + spinYaw)
    faceCamera(heldQ, heldTop, heldUp, Math.sin(elapsed * 0.6) * 0.08 + spinYaw)

    if (pinned) {
      cardPos.copy(heldTop)
      card.mesh.quaternion.copy(heldQ)
    } else if (grabbing) {
      const g = smooth(grabT)
      cardPos.lerpVectors(p, heldTop, g)
      card.mesh.quaternion.slerpQuaternions(dangleQ, heldQ, g)
    } else {
      cardPos.copy(p)
      card.mesh.quaternion.slerpQuaternions(dangleQ, heldQ, releaseBlend * releaseBlend)
    }
    card.mesh.position.copy(cardPos)

    /* lanyard: card tie point > fingertips (sagging when slack) > tail down */
    const slack = Math.max(0, STRING_LEN - cardPos.distanceTo(anchor))
    control.addVectors(cardPos, anchor).multiplyScalar(0.5).add(tmp.set(0, -slack * 0.9, 0.01))
    for (let i = 0; i < CARD_POINTS; i++) bezier(cardPos, control, anchor, i / (CARD_POINTS - 1), lanyardPoints[i])
    const tailEnd = tmp.copy(anchor).add(center.set(-0.1, -0.55, -0.06))
    control.copy(anchor).add(forward.set(0.03, -0.2, 0.02))
    for (let i = 1; i < TAIL_POINTS; i++) bezier(anchor, control, tailEnd, i / (TAIL_POINTS - 1), lanyardPoints[CARD_POINTS - 1 + i])
    lanyard.setPoints(lanyardPoints)

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
    lanyard.material.resolution.set(w, h)
  })
  resize.observe(mount)

  return {
    setCard,
    setCardState,
    dispose: () => {
      disposed = true
      renderer.setAnimationLoop(null)
      resize.disconnect()
      window.removeEventListener('pointermove', onPointer)
      rig?.dispose()
      headphones.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      })
      gradient.dispose()
      card.dispose()
      spinPending?.dispose()
      queued?.dispose()
      lanyard.dispose()
      background.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}

export type SocialLinkSceneController = ReturnType<typeof mountSocialLinkScene>
