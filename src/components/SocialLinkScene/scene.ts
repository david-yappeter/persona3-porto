import * as THREE from 'three'
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js'
import { createBackground } from './background'
import { CARD_H, CARD_W, createCardMesh, createLanyard, drawCardFace, faceKey, type CardFace } from './card'
import { loadCharacter, type BoneNameOverrides, type CharacterRig } from './character'
import { solveTwoBoneIK, swingBone } from './ik'
import { PALETTE, createGrade, createToonGradient } from './toon'

export type CardState = 'held' | 'dangling'

export type SceneOptions = {
  modelSrc: string
  boneNames?: BoneNameOverrides
  initialCardState: CardState
  /** false = just the character and card on a transparent canvas: no city
      backdrop, silhouette or P3 colour remap */
  backdrop: boolean
  hiddenMaterials?: RegExp
  originalMaterials?: boolean
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/* framing: chest-up, cropped around the mouth like the source */
const CAMERA_POS = v3(-0.13, 1.14, 1.25)
const CAMERA_TARGET = v3(-0.13, 1.12, 0)
/* dutch tilt, radians — the source frame leans with the head to the right */
const CAMERA_ROLL = 0.2
const PARALLAX = { x: 0.04, y: 0.02 }

/* wrist targets in character space (metres, facing +Z, left hand on +X);
   pole = which way the elbow points */
/* held: elbow bent to `elbowAngle` and tucked against the side (pole down
   and slightly back), the hand reaching from the shoulder along `dir` — the
   reach length comes from the real bone lengths, so the angle is exact */
const HELD_POSE = { dir: v3(-0.12, -0.15, 0.21), elbowAngle: THREE.MathUtils.degToRad(80), pole: v3(0.2, -1, -0.3) }
/* where the held card floats when no model loaded */
const HELD_FALLBACK = v3(0.05, 1.15, 0.2)
const DANGLE_POSE = { hand: v3(0.12, 1.33, 0.27), pole: v3(0.45, -1, -0.1) }
const OTHER_ARM = { hand: v3(-0.24, 0.78, 0.02), pole: v3(-0.3, 0, -1) }
const POSE_DURATION = 0.6
/* slight turn toward screen-left, bringing the card arm forward */
const BODY_TURN = -0.2

/* hand orientation per pose, in character space: f = where the fingers
   point, n = out of the palm. Held = back of the hand to camera, fingers
   across the card's face, thumb behind it; dangling = open palm to camera. */
const HELD_HAND = { f: v3(-1.2, 1, 0.1), n: v3(0.1, 0.2, -1) }
const DANGLE_HAND = { f: v3(0.08, 1, 0.05), n: v3(-0.1, 0, 1) }
/* fingers lie across the card's face, tips easing around its left edge */
const HELD_CURL = { fingers: [0.06, 0.12, 0.4] as const, thumb: 0.1 }
/* extra curl per finger (index, middle, ring, little) while holding: the
   ring and little fingers fold in a bit more, like a relaxed real grip */
const HELD_FINGER_EXTRA = [0.1, 0.1, 0.15, 0.25] as const
/* >1 exaggerates the card hand for an anime close-up; 1 = as modelled */
const CARD_HAND_SCALE = 1
const DANGLE_CURL = { fingers: [0.08, 0.08, 0.08] as const, thumb: 0.05 }
/* grip layout, from the middle finger: its last joint lands on the card's
   left edge at `edgeV` (fraction of card height from centre), and the card
   sits `depth` behind the fingers along the palm normal */
const GRIP = { edgeV: -0.02 }
/* finger thickness (at the scaled-up hand) plus half the card's thickness:
   the card is kept at least this far behind every finger joint over it */
const FINGER_CLEARANCE = 0.012
/* where the thumb tip presses, in card coordinates from its centre (u right,
   v up); negative lift = behind the card. u just past the right edge so the
   tip peeks out around it */
const THUMB_PRESS = { u: 0.033, v: 0.0, lift: -0.04 }
/* card placement for rigs without finger bones */
const HELD_CARD = { offset: v3(-0.065, 0.1, 0), alongN: 0.022 }
const HELD_UP = v3(0, 1, 0)

/* flat offset copy of the character behind it, like the source's grey
   silhouette — done by re-rendering the character from a shifted camera */
const SILHOUETTE = { color: 0xc9cbdf, shiftX: 0.075, shiftY: 0.035 }

const basisQuat = (f: THREE.Vector3, n: THREE.Vector3) => {
  const F = f.clone().normalize()
  const N = n.clone().addScaledVector(F, -n.dot(F)).normalize()
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(F, N, new THREE.Vector3().crossVectors(F, N)))
}
/* rotation taking the hand's rest (f, n) onto a target (f, n) */
const handRotation = (restF: THREE.Vector3, restN: THREE.Vector3, target: { f: THREE.Vector3; n: THREE.Vector3 }) =>
  basisQuat(target.f, target.n).multiply(basisQuat(restF, restN).invert())

/* wrist-to-fingertip distance, where the lanyard loops over the hand */
const FINGERTIP = 0.15

const STRING_LEN = 0.17
const GRAVITY = v3(0, -6.5, 0)
const DAMPING = 2.4
const STEP = 1 / 120
/* keeps the card in front of the chest instead of swinging through it */
const BODY_FRONT_Z = 0.19

const RELEASE_BLEND = 0.35
const GRAB_DURATION = 0.4
const SPIN_DURATION = 0.6
/* to flip, a gripped card slides up out of the pinch (clear of both the
   thumb in front and the fingertips behind), turns, and slides back */
const SPIN_SLIDE = 0.1
/* how long the card stays gripped once the character is on screen, before
   the drop onto the lanyard */
const HOLD_AFTER_READY = 0.8

const smooth = (t: number) => t * t * (3 - 2 * t)
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export const mountSocialLinkScene = (mount: HTMLElement, options: SceneOptions) => {
  const width = Math.max(mount.clientWidth, 1)
  const height = Math.max(mount.clientHeight, 1)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !options.backdrop })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  mount.appendChild(renderer.domElement)
  const effect = new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: PALETTE.outline })
  /* frames are composed from several passes, cleared once by hand */
  renderer.autoClear = false
  effect.autoClear = false
  const grade = createGrade(options.backdrop)
  grade.setHeight(renderer.domElement.height)
  const anisotropy = renderer.capabilities.getMaxAnisotropy()

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, width / height, 0.05, 80)
  camera.position.copy(CAMERA_POS)
  camera.lookAt(CAMERA_TARGET)
  camera.rotateZ(CAMERA_ROLL)

  const background = options.backdrop ? createBackground(scene) : null

  scene.add(new THREE.AmbientLight(PALETTE.shadowLight, 0.9))
  const key = new THREE.DirectionalLight(PALETTE.keyLight, 2)
  key.position.set(-1.4, 2.4, 2.6)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x7ff6ff, 1.6)
  rim.position.set(2, 1.4, -1.6)
  scene.add(rim)

  const gradient = createToonGradient()
  const stage = new THREE.Group()
  stage.rotation.y = BODY_TURN
  scene.add(stage)
  const stageQ = new THREE.Quaternion().setFromEuler(stage.rotation)
  let rig: CharacterRig | null = null
  const heldR = new THREE.Quaternion()
  const dangleR = new THREE.Quaternion()

  /* card stays hidden until the model resolves (or fails), so it never
     floats alone and the hold-then-drop happens with the character there */
  let ready = false
  let readyAt = 0
  let disposed = false
  void loadCharacter(options.modelSrc, {
    gradientMap: gradient,
    grade,
    boneNames: options.boneNames,
    hiddenMaterials: options.hiddenMaterials,
    originalMaterials: options.originalMaterials,
  }).then((loaded) => {
    if (disposed) {
      loaded?.dispose()
      return
    }
    if (loaded) {
      rig = loaded
      stage.add(rig.root)
      rig.cardArm.hand.scale.setScalar(CARD_HAND_SCALE)
      if (rig.cardHand) {
        heldR.copy(handRotation(rig.cardHand.restF, rig.cardHand.restN, HELD_HAND))
        dangleR.copy(handRotation(rig.cardHand.restF, rig.cardHand.restN, DANGLE_HAND))
      }
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
  const shoulder = new THREE.Vector3()
  const heldWrist = new THREE.Vector3()
  const pole = new THREE.Vector3()
  const wrist = new THREE.Vector3()
  const elbow = new THREE.Vector3()
  const fingerDir = new THREE.Vector3()
  const anchor = new THREE.Vector3()
  const heldTop = new THREE.Vector3()
  const heldUp = new THREE.Vector3()
  const handF = new THREE.Vector3()
  const heldTie = new THREE.Vector3()
  const knuckle = new THREE.Vector3()
  const fingerTip = new THREE.Vector3()
  const gripU = new THREE.Vector3()
  const gripV = new THREE.Vector3()
  const gripW = new THREE.Vector3()
  const heldBaseQ = new THREE.Quaternion()
  const cardCenter = new THREE.Vector3()
  const thumbBase = new THREE.Vector3()
  const thumbTip = new THREE.Vector3()
  const thumbTarget = new THREE.Vector3()
  const thumbFrom = new THREE.Vector3()
  const thumbTo = new THREE.Vector3()
  const jointPos = new THREE.Vector3()
  const rel = new THREE.Vector3()
  const handN = new THREE.Vector3()
  const handR = new THREE.Quaternion()
  const handWorldQ = new THREE.Quaternion()
  const parentQ = new THREE.Quaternion()
  const silhouetteCam = new THREE.PerspectiveCamera()
  const silhouetteMaterial = new THREE.MeshBasicMaterial({ color: SILHOUETTE.color, fog: false })
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
    camera.rotateZ(CAMERA_ROLL)
    background?.update(dt)

    /* breathing */
    stage.position.y = Math.sin(elapsed * 1.7) * 0.003
    rig?.update(dt)
    stage.updateMatrixWorld(true)

    const releaseAllowed = !gateRelease || (ready && elapsed - readyAt > HOLD_AFTER_READY)
    const next: CardState = targetState === 'dangling' && releaseAllowed ? 'dangling' : 'held'
    if (next !== effective) applyCardState(next)
    card.mesh.visible = ready
    /* the lanyard only reads while the card hangs from it */
    lanyard.line.visible = ready && !pinned

    armT = THREE.MathUtils.clamp(armT + (effective === 'dangling' ? dt : -dt) / POSE_DURATION, 0, 1)
    const armE = smooth(armT)
    /* held reach: from the shoulder along HELD_POSE.dir, exactly as far as
       closes the elbow to HELD_POSE.elbowAngle (law of cosines) */
    if (rig) {
      const a = rig.cardArm
      a.upper.getWorldPosition(shoulder)
      const upperLen = shoulder.distanceTo(a.lower.getWorldPosition(tmp))
      const foreLen = tmp.distanceTo(a.hand.getWorldPosition(heldWrist))
      const reach = Math.sqrt(upperLen ** 2 + foreLen ** 2 - 2 * upperLen * foreLen * Math.cos(HELD_POSE.elbowAngle))
      heldWrist.copy(HELD_POSE.dir).normalize().applyQuaternion(stageQ).multiplyScalar(reach).add(shoulder)
    } else {
      stage.localToWorld(heldWrist.copy(HELD_FALLBACK))
    }
    handTarget.lerpVectors(heldWrist, stage.localToWorld(tmp.copy(DANGLE_POSE.hand)), armE)
    handTarget.x += Math.sin(elapsed * 0.9) * 0.006 * armE
    handTarget.y += Math.sin(elapsed * 1.3) * 0.005
    heldUp.copy(HELD_UP).applyQuaternion(stageQ)
    if (rig) {
      pole.lerpVectors(HELD_POSE.pole, DANGLE_POSE.pole, armE).applyQuaternion(stageQ)
      const arm = rig.cardArm
      solveTwoBoneIK(arm.upper, arm.lower, arm.hand, handTarget, pole)
      const other = rig.otherArm
      solveTwoBoneIK(
        other.upper,
        other.lower,
        other.hand,
        stage.localToWorld(elbow.copy(OTHER_ARM.hand)),
        tmp.copy(OTHER_ARM.pole).applyQuaternion(stageQ),
      )
      arm.hand.getWorldPosition(wrist)
      arm.lower.getWorldPosition(elbow)
      fingerDir.subVectors(wrist, elbow).normalize()
      const hand = rig.cardHand
      if (hand) {
        handR.slerpQuaternions(heldR, dangleR, armE)
        handWorldQ.copy(stageQ).multiply(handR).multiply(hand.restQuat)
        if (arm.hand.parent) arm.hand.parent.getWorldQuaternion(parentQ).invert()
        else parentQ.identity()
        arm.hand.quaternion.copy(parentQ.multiply(handWorldQ))
        arm.hand.updateMatrixWorld(true)
        const curlAt = (k: 0 | 1 | 2) => THREE.MathUtils.lerp(HELD_CURL.fingers[k], DANGLE_CURL.fingers[k], armE)
        hand.curl(
          [curlAt(0), curlAt(1), curlAt(2)],
          THREE.MathUtils.lerp(HELD_CURL.thumb, DANGLE_CURL.thumb, armE),
          [0, 0, HELD_FINGER_EXTRA[2] * (1 - armE), HELD_FINGER_EXTRA[3] * (1 - armE)],
        )
        arm.hand.updateMatrixWorld(true)
        handF.copy(hand.restF).applyQuaternion(handR).applyQuaternion(stageQ)
        handN.copy(hand.restN).applyQuaternion(handR).applyQuaternion(stageQ)
        fingerDir.copy(handF)
      } else {
        handF.copy(fingerDir)
        handN.set(0, 0, -1).applyQuaternion(stageQ)
      }
      rig.postUpdate(dt)
    } else {
      /* no model: the card hangs from where the hand would be */
      wrist.copy(handTarget)
      fingerDir.set(0, 1, 0)
      handF.set(0, 1, 0)
      handN.set(0, 0, -1)
    }
    anchor.copy(wrist).addScaledVector(fingerDir, FINGERTIP)
    const gripHand = rig?.cardHand
    let gripped = false
    if (gripHand?.knuckle && gripHand.fingerTip) {
      /* card plane parallel to the palm, upright within that plane */
      gripHand.knuckle.getWorldPosition(knuckle)
      gripHand.fingerTip.getWorldPosition(fingerTip)
      const reach = knuckle.distanceTo(fingerTip)
      /* card face toward the camera, whichever way the palm points */
      gripW.copy(handN)
      if (gripW.dot(tmp.subVectors(camera.position, knuckle)) < 0) gripW.negate()
      gripV.copy(heldUp).addScaledVector(handN, -heldUp.dot(handN)).normalize()
      gripU.crossVectors(gripV, gripW).normalize()
      const fu = handF.dot(gripU)
      const fv = handF.dot(gripV)
      const fl = Math.hypot(fu, fv) || 1
      /* knuckle position in card coordinates, so the finger's last joint
         lands on the left edge */
      const ku = -CARD_W / 2 - (fu / fl) * reach
      const kv = CARD_H * GRIP.edgeV - (fv / fl) * reach
      /* card centre before choosing its depth behind the fingers */
      cardCenter.copy(knuckle).addScaledVector(gripU, -ku).addScaledVector(gripV, -kv)
      /* the hand is arched, so the knuckles and tips sit at different
         depths — push the card back past the deepest finger point that's
         actually over its face (tips are extrapolated past the last joint) */
      let deepest = -Infinity
      const consider = (point: THREE.Vector3) => {
        rel.subVectors(point, cardCenter)
        if (Math.abs(rel.dot(gripU)) > CARD_W / 2 || Math.abs(rel.dot(gripV)) > CARD_H / 2) return
        deepest = Math.max(deepest, rel.dot(handN))
      }
      for (const joint of gripHand.joints) {
        if (joint.thumb) continue
        joint.bone.getWorldPosition(jointPos)
        consider(jointPos)
        if (joint.joint === 2 && joint.bone.parent) {
          joint.bone.parent.getWorldPosition(tmp)
          consider(jointPos.addScaledVector(tmp.subVectors(jointPos, tmp), 0.8))
        }
      }
      heldTop
        .copy(cardCenter)
        .addScaledVector(gripV, CARD_H / 2)
        .addScaledVector(handN, (Number.isFinite(deepest) ? deepest : 0) + FINGER_CLEARANCE)
      basis.makeBasis(gripU, gripV, gripW)
      heldBaseQ.setFromRotationMatrix(basis)
      gripped = true

      /* swing the thumb so its tip presses the card (behind it, opposing the
         fingers) — a curl angle alone leaves it poking out */
      const thumbs = gripHand.joints.filter((j) => j.thumb)
      const lastThumb = thumbs[thumbs.length - 1]?.bone
      if (thumbs.length >= 2 && lastThumb?.parent) {
        thumbs[0].bone.getWorldPosition(thumbBase)
        lastThumb.getWorldPosition(thumbTip)
        lastThumb.parent.getWorldPosition(tmp)
        thumbTip.addScaledVector(tmp.subVectors(thumbTip, tmp), 0.8)
        thumbTarget
          .copy(heldTop)
          .addScaledVector(gripV, -CARD_H / 2 + THUMB_PRESS.v)
          .addScaledVector(gripU, THUMB_PRESS.u)
          .addScaledVector(gripW, THUMB_PRESS.lift)
        thumbFrom.subVectors(thumbTip, thumbBase).normalize()
        thumbTo.subVectors(thumbTarget, thumbBase).normalize().lerp(thumbFrom, armE).normalize()
        swingBone(thumbs[0].bone, thumbFrom, thumbTo)
      }
    } else {
      heldTop
        .copy(wrist)
        .add(center.copy(HELD_CARD.offset).applyQuaternion(stageQ))
        .addScaledVector(handN, HELD_CARD.alongN)
        .addScaledVector(heldUp, CARD_H / 2)
    }

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
    let spinSlide = 0
    if (spinStart >= 0) {
      const s = (elapsed - spinStart) / SPIN_DURATION
      spinSlide = Math.sin(Math.PI * Math.min(s, 1)) * SPIN_SLIDE
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
    if (gripped) heldQ.setFromAxisAngle(gripV, spinYaw).multiply(heldBaseQ)
    else faceCamera(heldQ, heldTop, heldUp, Math.sin(elapsed * 0.6) * 0.08 + spinYaw)

    if (pinned) {
      cardPos.copy(heldTop)
      if (gripped) cardPos.addScaledVector(gripV, spinSlide)
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
    card.mesh.updateMatrixWorld()
    /* while gripped, the lanyard leaves from the card's left edge */
    card.mesh.localToWorld(heldTie.set(-CARD_W / 2, -CARD_H * 0.45, 0))

    /* lanyard: card tie point > fingertips (sagging when slack) > tail down.
       While gripped it just hangs from the wrist instead of crossing the
       card's face. */
    const tieFrom = pinned ? heldTie : cardPos
    const tieTo = pinned ? heldTie : anchor
    const slack = Math.max(0, STRING_LEN - tieFrom.distanceTo(tieTo))
    control.addVectors(tieFrom, tieTo).multiplyScalar(0.5).add(tmp.set(0, -slack * 0.9, 0.01))
    for (let i = 0; i < CARD_POINTS; i++) bezier(tieFrom, control, tieTo, i / (CARD_POINTS - 1), lanyardPoints[i])
    const tailEnd = tmp.copy(tieTo).add(center.set(-0.2, -0.5, -0.02).applyQuaternion(stageQ))
    control.copy(tieTo).add(forward.set(0.03, -0.2, 0.02))
    for (let i = 1; i < TAIL_POINTS; i++) bezier(tieTo, control, tailEnd, i / (TAIL_POINTS - 1), lanyardPoints[CARD_POINTS - 1 + i])
    lanyard.setPoints(lanyardPoints)

    renderFrame()
  }

  /* 1) background  2) flat silhouette of the character from a shifted
     camera  3) depth cleared, character + card with outlines on top */
  const renderFrame = () => {
    renderer.clear()
    if (!background) {
      effect.render(scene, camera)
      return
    }
    const sky = scene.background
    const cardVisible = card.mesh.visible
    const lanyardVisible = lanyard.line.visible

    stage.visible = false
    card.mesh.visible = false
    lanyard.line.visible = false
    renderer.render(scene, camera)

    scene.background = null
    background.group.visible = false
    stage.visible = true
    if (rig) {
      silhouetteCam.copy(camera)
      silhouetteCam.translateX(-SILHOUETTE.shiftX)
      silhouetteCam.translateY(-SILHOUETTE.shiftY)
      scene.overrideMaterial = silhouetteMaterial
      renderer.render(scene, silhouetteCam)
      scene.overrideMaterial = null
    }

    renderer.clearDepth()
    card.mesh.visible = cardVisible
    lanyard.line.visible = lanyardVisible
    effect.render(scene, camera)

    background.group.visible = true
    scene.background = sky
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
    grade.setHeight(renderer.domElement.height)
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
      gradient.dispose()
      silhouetteMaterial.dispose()
      card.dispose()
      spinPending?.dispose()
      queued?.dispose()
      lanyard.dispose()
      background?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}

export type SocialLinkSceneController = ReturnType<typeof mountSocialLinkScene>
