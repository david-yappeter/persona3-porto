import { DEFAULT_FIGURE, FIGURE, FIGURE_LAB } from './figure'
import { R, WORLD_AXES, createLabPanel, freeArm, look, vector, type Range } from './labGui'
import type { AccessoryMotion } from './wind'

/* dev-only slider panel for the figure lab (`/figure-lab`): the character
   alone, every FIGURE value live; saved in localStorage, "Copy config"
   puts it on the clipboard as JSON */

const STORAGE_KEY = 'persona.figureLab'

export const mountFigureLab = () => {
  const gui = createLabPanel('Figure lab', STORAGE_KEY, FIGURE, DEFAULT_FIGURE)
  gui.add(FIGURE_LAB, 'pause').name('pause float + cloth (lab only)')
  gui.add(FIGURE_LAB, 'solid').name('no see-through (lab only)')

  const cam = gui.addFolder('Camera').close()
  vector(cam, FIGURE.camera.pos, 'position', [R(-3, 3), R(-1, 3), R(0.3, 6)], WORLD_AXES)
  vector(cam, FIGURE.camera.target, 'look at', [R(-2, 2), R(-1, 2.5), R(-2, 2)], WORLD_AXES)
  cam.add(FIGURE.camera, 'roll', -180, 180, 0.5).name('roll (°)')
  cam.add(FIGURE.camera, 'fov', 5, 80, 0.5).name('fov (zoom)')

  const body = gui.addFolder('Body orientation')
  body.add(FIGURE.body, 'turn', -180, 180, 0.5).name('turn (° + his left)')
  body.add(FIGURE.body, 'pitch', -180, 180, 0.5).name('pitch (° + lean back)')
  body.add(FIGURE.body, 'roll', -180, 180, 0.5).name('roll (° + onto his right)')
  body.add(FIGURE.body, 'pivot', 0, 1.8, 0.01).name('turns about height (m)')
  vector(body, FIGURE.body.pos, 'position', [R(-2, 2), R(-1, 3), R(-2, 2)], WORLD_AXES).close()

  const float = gui.addFolder('Floating')
  vector(float, FIGURE.float.direction, 'drift direction', [R(-1, 1), R(-1, 1), R(-1, 1)], WORLD_AXES, 0.05)
  float.add(FIGURE.float, 'distance', 0, 0.3, 0.002).name('drift distance (m)')
  float.add(FIGURE.float, 'speed', 0, 2, 0.01).name('drift speed (/s)')
  float.add(FIGURE.float, 'sway', 0, 20, 0.1).name('wobble (°)')

  const gravity = gui.addFolder('Gravity (hair / cloth / accessories)')
  vector(gravity, FIGURE.gravity.direction, 'pulls toward', [R(-1, 1), R(-1, 1), R(-1, 1)], WORLD_AXES, 0.05)
  gravity.add(FIGURE.gravity, 'strength', -1, 1.5, 0.01).name('strength (1 = hang, - = float up)')

  const bend = gui.addFolder('Body bend (spine / legs)')
  bend.add(FIGURE.spine, 'pitch', -60, 90, 0.5).name('spine bend (° + forward)')
  bend.add(FIGURE.spine, 'yaw', -60, 60, 0.5).name('spine twist (° + his left)')
  bend.add(FIGURE.spine, 'roll', -45, 45, 0.5).name('spine side (° + his right)')
  for (const [name, leg] of [['left leg (his)', FIGURE.legs.left], ['right leg (his)', FIGURE.legs.right]] as const) {
    const folder = bend.addFolder(name)
    folder.add(leg, 'lift', -45, 120, 0.5).name('thigh lift (° + forward)')
    folder.add(leg, 'spread', -20, 60, 0.5).name('spread (° + outward)')
    folder.add(leg, 'twist', -45, 45, 0.5).name('twist (° + toes out)')
    folder.add(leg, 'knee', 0, 150, 0.5).name('knee bend (°)')
  }

  look(gui, FIGURE.neck, FIGURE.head, 'Neck & head').close()

  const face = gui.addFolder('Face (eyes / brows)')
  face.add(FIGURE.face, 'gazeYaw', -12, 12, 0.25).name('eyes look (° + his left)')
  face.add(FIGURE.face, 'gazePitch', -10, 10, 0.25).name('eyes look (° + up)')
  face.add(FIGURE.face, 'blinkL', 0, 1, 0.01).name('close left eye (his)')
  face.add(FIGURE.face, 'blinkR', 0, 1, 0.01).name('close right eye (his)')
  face.add(FIGURE.face, 'blinkEvery', 0, 10, 0.1).name('auto blink every (s, 0 = off)')
  face.add(FIGURE.face, 'blinkTime', 0.05, 0.6, 0.01).name('auto blink length (s)')
  face.add(FIGURE.face, 'browL', -1, 1, 0.01).name('left brow (+ raise)')
  face.add(FIGURE.face, 'browR', -1, 1, 0.01).name('right brow (+ raise)')
  face.add(FIGURE.face, 'browTilt', -1, 1, 0.01).name('brow tilt (+ worried, - angry)')
  face.add(FIGURE.face, 'frown', 0, 1, 0.01).name('frown (brows together)')

  const facial = gui.addFolder('Facial figure (mouth / jaw / cheeks)')
  facial.add(FIGURE.facial, 'jawOpen', -5, 30, 0.5).name('jaw open (°)')
  facial.add(FIGURE.facial, 'smile', -1, 1, 0.01).name('smile (- frown)')
  facial.add(FIGURE.facial, 'mouthWide', -1, 1, 0.01).name('mouth width')
  facial.add(FIGURE.facial, 'upperLip', -1, 1, 0.01).name('upper lip lift')
  facial.add(FIGURE.facial, 'cheek', -1, 1, 0.01).name('cheeks raise (squint)')
  facial.add(FIGURE.facial, 'eyeSize', 0.7, 1.4, 0.01).name('eye size')

  /* aim points are from the feet, so they span the whole body */
  const aim: [Range, Range, Range] = [R(-0.8, 0.8), R(-0.5, 2.5), R(-0.8, 0.8)]
  freeArm(gui.addFolder('Left arm (his)').close(), gui.addFolder('Left hand (his)').close(), FIGURE.leftArm, FIGURE.leftHand, FIGURE.leftFingers, aim)
  freeArm(gui.addFolder('Right arm (his)').close(), gui.addFolder('Right hand (his)').close(), FIGURE.rightArm, FIGURE.rightHand, FIGURE.rightFingers, aim)

  const hair = gui.addFolder('Hair strands (lift off the face, sweep aside)')
  for (const [name, strand] of [
    ['front (centre bang)', FIGURE.hair.front],
    ['front, his right', FIGURE.hair.frontRight],
    ['front, his left', FIGURE.hair.frontLeft],
    ['back (all three)', FIGURE.hair.back],
  ] as const) {
    const folder = hair.addFolder(name)
    folder.add(strand, 'lift', -45, 90, 0.5).name('lift (° + away from head)')
    folder.add(strand, 'sweep', -90, 90, 0.5).name('sweep (° + his left)')
    folder.add(strand, 'wind', 0, 3, 0.05).name('wind amount')
  }

  const accessories = gui.addFolder('Ribbon / cord / earphone movement')
  const accessory = (name: string, a: AccessoryMotion) => {
    const folder = accessories.addFolder(name)
    folder.add(a, 'amount', 0, 3, 0.05).name('wind amount')
    folder.add(a, 'swing', 0, 40, 0.5).name('extra swing (°)')
    folder.add(a, 'speed', 0, 3, 0.05).name('swing speed (/s)')
    folder.add(a, 'gravity', -1, 2, 0.05).name('gravity pull')
  }
  accessory('ribbon', FIGURE.accessories.ribbon)
  accessory('cord', FIGURE.accessories.cord)
  accessory('earphone', FIGURE.accessories.earphone)

  const wind = gui.addFolder('Wind (coat / hair)').close()
  wind.add(FIGURE.wind, 'strength', 0, 25, 0.5).name('strength (°)')
  wind.add(FIGURE.wind, 'direction', -180, 180, 1).name('direction (° 0=→ 90=cam)')
  wind.add(FIGURE.wind, 'flare', 0, 15, 0.5).name('hem flare (°)')
  wind.add(FIGURE.wind, 'gust', 0, 1, 0.01).name('gustiness')
  wind.add(FIGURE.wind, 'speed', 0, 3, 0.05).name('speed')
  wind.add(FIGURE.wind, 'tipBoost', 0, 3, 0.05).name('tip boost')
  wind.add(FIGURE.wind, 'coat', 0, 2, 0.05).name('coat amount')
  wind.add(FIGURE.wind, 'hair', 0, 2, 0.05).name('hair amount')

  return () => {
    FIGURE_LAB.pause = false
    FIGURE_LAB.solid = false
    gui.destroy()
  }
}
