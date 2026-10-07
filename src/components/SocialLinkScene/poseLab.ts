import { DEFAULT_POSE, LAB, POSE } from './pose'
import { BODY_AXES, R, WORLD_AXES, createLabPanel, freeArm, look, vector } from './labGui'

/* slider panel over the live scene (`/careers/0?lab`): every change
   writes straight into POSE, survives reloads via localStorage, and "Copy
   config" puts the whole pose on the clipboard as JSON */

const STORAGE_KEY = 'persona.poseLab'

export const mountPoseLab = () => {
  LAB.noParallax = true
  const gui = createLabPanel('Pose lab', STORAGE_KEY, POSE, DEFAULT_POSE)
  gui.add(LAB, 'noParallax').name('freeze mouse sway (lab only)')

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

  freeArm(gui.addFolder('Free arm (his right)'), gui.addFolder('Free hand (his right)'), POSE.otherArm, POSE.otherHand, POSE.otherFingers)

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
  const floatBand = float.addFolder('white band').close()
  floatBand.add(POSE.float.band, 'width', 0, 1.5, 0.005).name('width')
  floatBand.add(POSE.float.band, 'bottom', -0.5, 1.5, 0.005).name('lower edge at bottom (x)')
  floatBand.add(POSE.float.band, 'lean', -2, 2, 0.01).name('slant')
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
  freeArm(
    float.addFolder('free arm (his right)').close(),
    float.addFolder('free hand (his right)').close(),
    POSE.float.otherArm,
    POSE.float.otherHand,
    POSE.float.otherFingers,
  )

  const overlay = gui.addFolder('See-through overlay')
  overlay.add(POSE.overlay, 'enabled').name('on')
  overlay.add(POSE.overlay, 'dark', 0, 1, 0.01).name('dark parts opacity')
  overlay.add(POSE.overlay, 'light', 0, 1, 0.01).name('bright parts opacity')
  overlay.add(POSE.overlay, 'cut', 0, 1, 0.01).name('brightness cut-off')
  overlay.add(POSE.overlay, 'softness', 0, 0.5, 0.01).name('fade softness')
  overlay.add(POSE.overlay, 'hairSolid').name('keep hair solid')
  overlay.add(POSE.overlay, 'outline', ['off', 'bright', 'all']).name('outline (bright = white parts)')
  overlay.add(POSE.overlay, 'outlineWidth', 0, 0.008, 0.0001).name('outline thickness')

  const shading = gui.addFolder('White-part shading')
  shading.add(POSE.shading, 'strength', 0, 1, 0.01).name('strength')
  shading.add(POSE.shading, 'bands', 0, 5, 1).name('cel steps (0 = smooth)')
  shading.add(POSE.shading, 'from', 0, 1, 0.01).name('from brightness')
  vector(shading, POSE.shading.light, 'light comes from', [R(-1, 1), R(-1, 1), R(-1, 1)], WORLD_AXES, 0.05)

  const band = gui.addFolder('White band (list page)')
  band.add(POSE.band, 'width', 0, 1.5, 0.005).name('width')
  band.add(POSE.band, 'bottom', -0.5, 1.5, 0.005).name('lower edge at bottom (x)')
  band.add(POSE.band, 'lean', -2, 2, 0.01).name('slant')
  const shadow = band.addFolder('character shadow on it')
  shadow.add(POSE.shadow, 'strength', 0, 1, 0.01).name('strength')
  shadow.addColor(POSE.shadow, 'color').name('colour')
  shadow.add(POSE.shadow, 'x', -0.3, 0.3, 0.002).name('offset x (+ right)')
  shadow.add(POSE.shadow, 'y', -0.3, 0.3, 0.002).name('offset y (+ down)')

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


  return () => {
    LAB.noParallax = false
    LAB.forceState = ''
    gui.destroy()
  }
}
