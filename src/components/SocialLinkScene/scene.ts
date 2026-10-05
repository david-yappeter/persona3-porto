import * as THREE from 'three'
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js'
import { createBackground } from './background'
import { CARD_H, CARD_W, createCardMesh, createLanyard, drawCardFace, faceKey, type CardFace } from './card'
import { loadCharacter, type ArmChain, type BoneNameOverrides, type CharacterRig } from './character'
import { solveTwoBoneIK, swingBone } from './ik'
import { LAB, POSE } from './pose'
import { PALETTE, createGrade, createToonGradient } from './toon'

/* floating = the second pose: open palm, card floating and turning in
   front of the chest (see POSE.float) */
export type CardState = 'held' | 'dangling' | 'floating'

export type SceneOptions = {
  modelSrc: string
  boneNames?: BoneNameOverrides
  initialCardState: CardState
  /** false = just the character and card on a transparent canvas: no city
      backdrop, silhouette or P3 colour remap */
  backdrop: boolean
  hiddenMaterials?: RegExp
  originalMaterials?: boolean
  /** P3 menu duotone remap on the character; defaults to on with the backdrop */
  menuColors?: boolean
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/* framing, held pose, hands and grip are all in POSE (pose.ts) */
const deg = THREE.MathUtils.degToRad

/* where the held card floats when no model loaded */
const HELD_FALLBACK = v3(0.05, 1.15, 0.2)
const DANGLE_POSE = { hand: v3(0.12, 1.33, 0.27), pole: v3(0.45, -1, -0.1) }
const POSE_DURATION = 0.6
/* open palm to camera while dangling (f = fingers, n = out of the palm) */
const DANGLE_HAND = { f: v3(0.08, 1, 0.05), n: v3(-0.1, 0, 1) }
const DANGLE_CURL = { fingers: [0.08, 0.08, 0.08] as const, thumb: 0.05 }
/* card placement for rigs without finger bones */
const HELD_CARD = { offset: v3(-0.065, 0.1, 0), alongN: 0.022 }
const HELD_UP = v3(0, 1, 0)
const WORLD_UP = v3(0, 1, 0)

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
  const grade = createGrade(options.menuColors ?? options.backdrop)
  grade.setHeight(renderer.domElement.height)
  const anisotropy = renderer.capabilities.getMaxAnisotropy()

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(POSE.camera.fov, width / height, 0.05, 80)

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
  scene.add(stage)
  const stageQ = new THREE.Quaternion()
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
      if (rig.cardHand) dangleR.copy(handRotation(rig.cardHand.restF, rig.cardHand.restN, DANGLE_HAND))
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
  /* floating starts from held (it's an overlay on it, faded in via floatT) */
  let effective: CardState = targetState === 'dangling' ? 'dangling' : 'held'
  const gateRelease = targetState === 'held'
  let armT = effective === 'held' ? 0 : 1
  let pinned = effective === 'held'
  let grabT = 0
  let grabbing = false
  let releaseBlend = 0
  let initialized = false
  /* held (0) <-> floating (1) blend */
  let floatT = 0

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
  const tmp2 = new THREE.Vector2()
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
  const reachElbow = new THREE.Vector3()
  const reachWrist = new THREE.Vector3()

  /* shoulder-to-wrist distance that closes the elbow to `angle` (law of
     cosines on the real bone lengths); leaves the shoulder in `shoulder` */
  const elbowReach = (arm: ArmChain, angle: number) => {
    arm.upper.getWorldPosition(shoulder)
    const upperLen = shoulder.distanceTo(arm.lower.getWorldPosition(reachElbow))
    const foreLen = reachElbow.distanceTo(arm.hand.getWorldPosition(reachWrist))
    return Math.sqrt(upperLen ** 2 + foreLen ** 2 - 2 * upperLen * foreLen * Math.cos(angle))
  }
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
  const floatWrist = new THREE.Vector3()
  const floatTop = new THREE.Vector3()
  const floatR = new THREE.Quaternion()
  const floatQ = new THREE.Quaternion()

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

    grade.setOverlay(POSE.overlay)
    const cam = POSE.camera
    pointerSmooth.lerp(LAB.noParallax ? tmp2.set(0, 0) : pointer, 1 - Math.exp(-4 * dt))
    camera.position.set(
      cam.pos.x + pointerSmooth.x * cam.parallaxX + Math.sin(elapsed * 0.25) * 0.01,
      cam.pos.y - pointerSmooth.y * cam.parallaxY,
      cam.pos.z,
    )
    camera.lookAt(cam.target)
    camera.rotateZ(deg(cam.roll))
    if (camera.fov !== cam.fov) {
      camera.fov = cam.fov
      camera.updateProjectionMatrix()
    }
    background?.update(dt)

    /* breathing */
    stage.position.y = Math.sin(elapsed * 1.7) * 0.003
    stage.rotation.y = deg(POSE.body.turn)
    stageQ.setFromEuler(stage.rotation)
    if (rig) {
      rig.cardArm.hand.scale.setScalar(POSE.body.cardHandScale)
      if (rig.cardHand) heldR.copy(handRotation(rig.cardHand.restF, rig.cardHand.restN, POSE.cardHand))
    }
    rig?.update(dt)
    stage.updateMatrixWorld(true)

    const releaseAllowed = !gateRelease || (ready && elapsed - readyAt > HOLD_AFTER_READY)
    const wanted: CardState = LAB.forceState || targetState
    /* floating rides on the held state machine (card stays pinned, no
       lanyard) and blends its own pose/card offsets in via floatT */
    const next: CardState = wanted === 'dangling' && releaseAllowed ? 'dangling' : 'held'
    const wantFloat = wanted === 'floating' && releaseAllowed && effective === 'held'
    floatT = THREE.MathUtils.clamp(floatT + (wantFloat ? dt : -dt) / Math.max(POSE.float.duration, 0.05), 0, 1)
    const floatE = smooth(floatT)
    const fl = POSE.float
    if (next !== effective) applyCardState(next)
    card.mesh.visible = ready
    /* the lanyard only reads while the card hangs from it */
    lanyard.line.visible = ready && !pinned

    armT = THREE.MathUtils.clamp(armT + (effective === 'dangling' ? dt : -dt) / POSE_DURATION, 0, 1)
    const armE = smooth(armT)
    /* held reach: from the shoulder along cardArm.dir, exactly as far as
       closes the elbow to cardArm.elbowAngle (law of cosines) */
    if (rig) {
      const reach = elbowReach(rig.cardArm, deg(POSE.cardArm.elbowAngle))
      heldWrist.copy(POSE.cardArm.dir).normalize().applyQuaternion(stageQ).multiplyScalar(reach).add(shoulder)
      if (floatE > 0) {
        const floatReach = elbowReach(rig.cardArm, deg(fl.arm.elbowAngle))
        floatWrist.copy(fl.arm.dir).normalize().applyQuaternion(stageQ).multiplyScalar(floatReach).add(shoulder)
        heldWrist.lerp(floatWrist, floatE)
      }
    } else {
      stage.localToWorld(heldWrist.copy(HELD_FALLBACK))
    }
    handTarget.lerpVectors(heldWrist, stage.localToWorld(tmp.copy(DANGLE_POSE.hand)), armE)
    handTarget.x += Math.sin(elapsed * 0.9) * 0.006 * armE
    handTarget.y += Math.sin(elapsed * 1.3) * 0.005
    heldUp.copy(HELD_UP).applyQuaternion(stageQ)
    if (rig) {
      pole.lerpVectors(POSE.cardArm.pole, fl.arm.pole, floatE).lerp(DANGLE_POSE.pole, armE).applyQuaternion(stageQ)
      const arm = rig.cardArm
      solveTwoBoneIK(arm.upper, arm.lower, arm.hand, handTarget, pole)
      const other = rig.otherArm
      const otherReach = elbowReach(other, deg(POSE.otherArm.elbowAngle))
      stage.localToWorld(elbow.copy(POSE.otherArm.hand))
      elbow.sub(shoulder).setLength(otherReach).add(shoulder)
      solveTwoBoneIK(other.upper, other.lower, other.hand, elbow, tmp.copy(POSE.otherArm.pole).applyQuaternion(stageQ))
      if (rig.otherHand) {
        const oh = POSE.otherHand
        const of = POSE.otherFingers
        rig.otherHand.wrist(deg(oh.bend), deg(oh.side), deg(oh.twist))
        rig.otherHand.curl(of.curl, of.thumb, of.extra)
      }
      arm.hand.getWorldPosition(wrist)
      arm.lower.getWorldPosition(elbow)
      fingerDir.subVectors(wrist, elbow).normalize()
      const hand = rig.cardHand
      if (hand) {
        if (floatE > 0) heldR.slerp(floatR.copy(handRotation(hand.restF, hand.restN, fl.hand)), floatE)
        handR.slerpQuaternions(heldR, dangleR, armE)
        handWorldQ.copy(stageQ).multiply(handR).multiply(hand.restQuat)
        if (arm.hand.parent) arm.hand.parent.getWorldQuaternion(parentQ).invert()
        else parentQ.identity()
        arm.hand.quaternion.copy(parentQ.multiply(handWorldQ))
        arm.hand.updateMatrixWorld(true)
        const f = POSE.fingers
        const lerp = THREE.MathUtils.lerp
        const curlAt = (k: 0 | 1 | 2) => lerp(lerp(f.curl[k], fl.fingers.curl[k], floatE), DANGLE_CURL.fingers[k], armE)
        const extraAt = (k: 0 | 1 | 2 | 3) => lerp(f.extra[k], fl.fingers.extra[k], floatE) * (1 - armE)
        hand.curl(
          [curlAt(0), curlAt(1), curlAt(2)],
          lerp(lerp(f.thumb, fl.fingers.thumb, floatE), DANGLE_CURL.thumb, armE),
          [extraAt(0), extraAt(1), extraAt(2), extraAt(3)],
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
      const kv = CARD_H * POSE.grip.edgeV - (fv / fl) * reach
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
        .addScaledVector(handN, (Number.isFinite(deepest) ? deepest : 0) + POSE.grip.clearance)
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
          .addScaledVector(gripV, -CARD_H / 2 + POSE.thumb.v)
          .addScaledVector(gripU, POSE.thumb.u)
          .addScaledVector(gripW, POSE.thumb.lift)
        thumbFrom.subVectors(thumbTip, thumbBase).normalize()
        thumbTo.subVectors(thumbTarget, thumbBase).normalize().lerp(thumbFrom, Math.max(armE, floatE)).normalize()
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
    /* floating: the card leaves the opening hand (after `release` of the
       blend), drifts to its spot and stays there facing the camera, bobbing —
       it only turns for the face-swap flip; reversed on the way back */
    if (floatT > 0) {
      const fc = fl.card
      const cardE = smooth(THREE.MathUtils.clamp((floatT - fc.release) / Math.max(1 - fc.release, 0.01), 0, 1))
      stage.localToWorld(floatTop.copy(fc.pos))
      floatTop.y += CARD_H / 2 + Math.sin(elapsed * fc.bobSpeed * Math.PI * 2) * fc.bob
      faceCamera(floatQ, floatTop, WORLD_UP, spinYaw)
      cardPos.lerp(floatTop, cardE)
      card.mesh.quaternion.slerp(floatQ, cardE)
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
