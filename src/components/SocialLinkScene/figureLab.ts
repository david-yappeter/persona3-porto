import { CREDITS_FIGURE, DEFAULT_CREDITS_FIGURE, DEFAULT_FIGURE, FIGURE, FIGURE_LAB } from './figure'
import { R, WORLD_AXES, createLabPanel, freeArm, look, vector, type Range } from './labGui'
import { attachLabCamera } from './labCamera'
import type { AccessoryMotion } from './wind'

/* slider panel for the figure lab: the character alone, every value of
   its figure config live; saved in localStorage, "Copy config" puts it on
   the clipboard as JSON. FIGURE (`/figure-lab`, `/builds?lab`, ...) and
   CREDITS_FIGURE (`/credits?lab`) are saved apart. */

const CONFIGS = {
  falling: { figure: FIGURE, defaults: DEFAULT_FIGURE, storageKey: 'persona.figureLab' },
  credits: { figure: CREDITS_FIGURE, defaults: DEFAULT_CREDITS_FIGURE, storageKey: 'persona.creditsLab' },
}

export const mountFigureLab = (which: keyof typeof CONFIGS = 'falling') => {
  const { figure, defaults, storageKey } = CONFIGS[which]
  const gui = createLabPanel(which === 'credits' ? 'Figure lab (credits)' : 'Figure lab', storageKey, figure, defaults)
  gui.add(FIGURE_LAB, 'pause').name('pause float + cloth (lab only)')
  gui.add(FIGURE_LAB, 'solid').name('no see-through (lab only)')

  const cam = gui.addFolder('Camera (right-drag orbit · wheel zoom · space / middle-drag pan)').close()
  vector(cam, figure.camera.pos, 'position', [R(-3, 3), R(-1, 3), R(0.3, 6)], WORLD_AXES)
  vector(cam, figure.camera.target, 'look at', [R(-2, 2), R(-1, 2.5), R(-2, 2)], WORLD_AXES)
  cam.add(figure.camera, 'roll', -180, 180, 0.5).name('roll (°)')
  cam.add(figure.camera, 'fov', 5, 80, 0.5).name('fov (zoom)')
  const detachCamera = attachLabCamera(figure.camera, cam, gui.persist)

  const body = gui.addFolder('Body orientation')
  body.add(figure.body, 'turn', -180, 180, 0.5).name('turn (° + his left)')
  body.add(figure.body, 'pitch', -180, 180, 0.5).name('pitch (° + lean back)')
  body.add(figure.body, 'roll', -180, 180, 0.5).name('roll (° + onto his right)')
  body.add(figure.body, 'pivot', 0, 1.8, 0.01).name('turns about height (m)')
  vector(body, figure.body.pos, 'position', [R(-2, 2), R(-1, 3), R(-2, 2)], WORLD_AXES).close()

  const float = gui.addFolder('Floating')
  vector(float, figure.float.direction, 'drift direction', [R(-1, 1), R(-1, 1), R(-1, 1)], WORLD_AXES, 0.05)
  float.add(figure.float, 'distance', 0, 0.3, 0.002).name('drift distance (m)')
  float.add(figure.float, 'speed', 0, 2, 0.01).name('drift speed (/s)')
  float.add(figure.float, 'sway', 0, 20, 0.1).name('wobble (°)')

  const fall = gui.addFolder('Falling loop (top to bottom of the screen)')
  fall.add(figure.fall, 'on').name('on (off to pose him in place)')
  fall.add(figure.fall, 'duration', 1, 30, 0.1).name('fall time (s)')
  fall.add(figure.fall, 'gap', 0, 10, 0.1).name('pause below before next (s)')
  fall.add(figure.fall, 'margin', 0, 4, 0.05).name('starts / ends past edge (m)')
  fall.add(figure.fall, 'drift', 0, 1.5, 0.01).name('side drift (m)')
  fall.add(figure.fall, 'swings', 0, 5, 0.05).name('drift swings per fall')
  fall.add(figure.fall, 'tumble', -180, 180, 0.5).name('turn over the fall (°)')

  const gravity = gui.addFolder('Gravity (hair / cloth / accessories)')
  vector(gravity, figure.gravity.direction, 'pulls toward', [R(-1, 1), R(-1, 1), R(-1, 1)], WORLD_AXES, 0.05)
  gravity.add(figure.gravity, 'strength', -1, 1.5, 0.01).name('strength (1 = hang, - = float up)')

  const bend = gui.addFolder('Body bend (spine / legs)')
  bend.add(figure.spine, 'pitch', -60, 90, 0.5).name('spine bend (° + forward)')
  bend.add(figure.spine, 'yaw', -60, 60, 0.5).name('spine twist (° + his left)')
  bend.add(figure.spine, 'roll', -45, 45, 0.5).name('spine side (° + his right)')
  for (const [name, leg] of [['left leg (his)', figure.legs.left], ['right leg (his)', figure.legs.right]] as const) {
    const folder = bend.addFolder(name)
    folder.add(leg, 'lift', -45, 120, 0.5).name('thigh lift (° + forward)')
    folder.add(leg, 'spread', -20, 60, 0.5).name('spread (° + outward)')
    folder.add(leg, 'twist', -45, 45, 0.5).name('twist (° + toes out)')
    folder.add(leg, 'knee', 0, 150, 0.5).name('knee bend (°)')
  }

  look(gui, figure.neck, figure.head, 'Neck & head').close()

  const face = gui.addFolder('Face (eyes / brows)')
  face.add(figure.face, 'gazeYaw', -12, 12, 0.25).name('eyes look (° + his left)')
  face.add(figure.face, 'gazePitch', -10, 10, 0.25).name('eyes look (° + up)')
  face.add(figure.face, 'blinkL', 0, 1, 0.01).name('close left eye (his)')
  face.add(figure.face, 'blinkR', 0, 1, 0.01).name('close right eye (his)')
  face.add(figure.face, 'blinkEvery', 0, 10, 0.1).name('auto blink every (s, 0 = off)')
  face.add(figure.face, 'blinkTime', 0.05, 0.6, 0.01).name('auto blink length (s)')
  face.add(figure.face, 'browL', -1, 1, 0.01).name('left brow (+ raise)')
  face.add(figure.face, 'browR', -1, 1, 0.01).name('right brow (+ raise)')
  face.add(figure.face, 'browTilt', -1, 1, 0.01).name('brow tilt (+ worried, - angry)')
  face.add(figure.face, 'frown', 0, 1, 0.01).name('frown (brows together)')

  const facial = gui.addFolder('Facial figure (mouth / jaw / cheeks)')
  facial.add(figure.facial, 'jawOpen', -5, 30, 0.5).name('jaw open (°)')
  facial.add(figure.facial, 'smile', -1, 1, 0.01).name('smile (- frown)')
  facial.add(figure.facial, 'mouthWide', -1, 1, 0.01).name('mouth width')
  facial.add(figure.facial, 'upperLip', -1, 1, 0.01).name('upper lip lift')
  facial.add(figure.facial, 'cheek', -1, 1, 0.01).name('cheeks raise (squint)')
  facial.add(figure.facial, 'eyeSize', 0.7, 1.4, 0.01).name('eye size')

  /* aim points are from the feet, so they span the whole body */
  const aim: [Range, Range, Range] = [R(-0.8, 0.8), R(-0.5, 2.5), R(-0.8, 0.8)]
  freeArm(gui.addFolder('Left arm (his)').close(), gui.addFolder('Left hand (his)').close(), figure.leftArm, figure.leftHand, figure.leftFingers, aim)
  freeArm(gui.addFolder('Right arm (his)').close(), gui.addFolder('Right hand (his)').close(), figure.rightArm, figure.rightHand, figure.rightFingers, aim)

  const hair = gui.addFolder('Hair strands (lift off the face, sweep aside)')
  for (const [name, strand] of [
    ['front (centre bang)', figure.hair.front],
    ['front, his right', figure.hair.frontRight],
    ['front, his left', figure.hair.frontLeft],
    ['back (all three)', figure.hair.back],
  ] as const) {
    const folder = hair.addFolder(name)
    folder.add(strand, 'lift', -45, 90, 0.5).name('lift (° + away from head)')
    folder.add(strand, 'sweep', -90, 90, 0.5).name('sweep (° + his left)')
    folder.add(strand, 'wind', 0, 3, 0.05).name('wind amount')
  }

  const band = gui.addFolder('White band (/credits)').close()
  band.add(figure.band, 'width', 0, 2, 0.005).name('width')
  band.add(figure.band, 'bottom', -0.5, 2.5, 0.005).name('lower edge at bottom (x)')
  band.add(figure.band, 'lean', -2, 2, 0.01).name('slant')
  const title = band.addFolder('page name on it')
  title.add(figure.title, 'x', -0.5, 1, 0.005).name('left edge (x)')
  title.add(figure.title, 'y', 0, 1.5, 0.005).name('baseline (y from top)')
  title.add(figure.title, 'size', 0.05, 1, 0.005).name('size (× screen height)')
  title.add(figure.title, 'squeeze', 0.4, 1.5, 0.01).name('width squeeze')
  title.add(figure.title, 'spacing', -20, 60, 0.5).name('letter gap (px)')
  title.add(figure.title, 'slant', -30, 40, 0.5).name('italic lean (°)')
  title.addColor(figure.title, 'color').name('colour')
  const circle = gui.addFolder('Circle band (/builds)').close()
  circle.add(figure.circle, 'x', -0.5, 1.5, 0.005).name('centre x')
  circle.add(figure.circle, 'y', -0.5, 1.5, 0.005).name('centre y (from top)')
  circle.add(figure.circle, 'radius', 0.05, 1.5, 0.005).name('radius (× screen height)')
  circle.add(figure.circle, 'stretch', 0.3, 3, 0.01).name('oval: width ÷ height (1 = circle)')
  circle.add(figure.circle, 'tilt', -90, 90, 0.5).name('oval tilt (° + clockwise)')
  circle.add(figure.circle, 'size', 0.05, 1, 0.005).name('text size (× screen height)')
  circle.add(figure.circle, 'offset', -0.5, 0.5, 0.005).name('text from edge (- = under)')
  circle.add(figure.circle, 'flip').name('flip (tops out, reads clockwise)')
  circle.add(figure.circle, 'start', -360, 360, 0.5).name('text starts at (° 0 right, 90 below)')
  circle.add(figure.circle, 'spacing', -40, 80, 0.5).name('letter gap (px)')
  circle.add(figure.circle, 'squeeze', 0.4, 1.5, 0.01).name('width squeeze')
  circle.addColor(figure.circle, 'color').name('text colour')
  const shadow = band.addFolder('his shadow on it')
  shadow.add(figure.shadow, 'strength', 0, 1, 0.01).name('strength')
  shadow.addColor(figure.shadow, 'color').name('colour')
  shadow.add(figure.shadow, 'x', -0.3, 0.3, 0.002).name('offset x (+ right)')
  shadow.add(figure.shadow, 'y', -0.3, 0.3, 0.002).name('offset y (+ down)')

  const digit = gui.addFolder('The "9" he grabs')
  digit.add(figure.digit, 'show').name('show')
  digit.add(figure.digit, 'hold', { 'his right hand': 'right', 'his left hand': 'left', 'nobody (floats free)': 'none' }).name('held by')
  digit.add(figure.digit, 'size', 0.1, 1.5, 0.01).name('height (m)')
  digit.add(figure.digit, 'depth', 0.02, 0.5, 0.005).name('thickness (× height)')
  digit.add(figure.digit.grip, 'x', 0, 1, 0.01).name('grip point x (0 left, 1 right)')
  digit.add(figure.digit.grip, 'y', 0, 1, 0.01).name('grip point y (0 foot, 1 top)')
  vector(digit, figure.digit.offset, 'offset from wrist (hand axes)', [R(-0.3, 0.3), R(-0.3, 0.3), R(-0.3, 0.3)], ['x', 'y', 'z'], 0.002)
  digit.add(figure.digit, 'pitch', -180, 180, 0.5).name('pitch (°)')
  digit.add(figure.digit, 'yaw', -180, 180, 0.5).name('yaw (°)')
  digit.add(figure.digit, 'roll', -180, 180, 0.5).name('roll (°)')
  vector(digit, figure.digit.pos, 'free: position', [R(-2, 2), R(-1, 3), R(-2, 2)], WORLD_AXES).close()
  digit.add(figure.digit, 'spin', -180, 180, 1).name('free: tumble (°/s)')
  digit.addColor(figure.digit, 'color').name('colour')

  const accessories = gui.addFolder('Ribbon / cord / earphone movement')
  const accessory = (name: string, a: AccessoryMotion) => {
    const folder = accessories.addFolder(name)
    folder.add(a, 'amount', 0, 3, 0.05).name('wind amount')
    folder.add(a, 'swing', 0, 40, 0.5).name('extra swing (°)')
    folder.add(a, 'speed', 0, 3, 0.05).name('swing speed (/s)')
    folder.add(a, 'gravity', -1, 2, 0.05).name('gravity pull')
  }
  accessory('ribbon', figure.accessories.ribbon)
  accessory('cord', figure.accessories.cord)
  accessory('earphone', figure.accessories.earphone)

  const wind = gui.addFolder('Wind (coat / hair)').close()
  wind.add(figure.wind, 'strength', 0, 25, 0.5).name('strength (°)')
  wind.add(figure.wind, 'direction', -180, 180, 1).name('direction (° 0=→ 90=cam)')
  wind.add(figure.wind, 'flare', 0, 15, 0.5).name('hem flare (°)')
  wind.add(figure.wind, 'gust', 0, 1, 0.01).name('gustiness')
  wind.add(figure.wind, 'speed', 0, 3, 0.05).name('speed')
  wind.add(figure.wind, 'tipBoost', 0, 3, 0.05).name('tip boost')
  wind.add(figure.wind, 'coat', 0, 2, 0.05).name('coat amount')
  wind.add(figure.wind, 'hair', 0, 2, 0.05).name('hair amount')

  return () => {
    FIGURE_LAB.pause = false
    FIGURE_LAB.solid = false
    detachCamera()
    gui.destroy()
  }
}
