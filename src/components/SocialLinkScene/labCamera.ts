import * as THREE from 'three'
import type GUI from 'lil-gui'

/* Mouse camera controls for the labs, editing the config's camera in place
   (so its sliders and the copied JSON follow):
   - right-drag: orbit around the look-at point (turntable: left/right about
     world up, up/down over the top)
   - wheel: dolly in / out toward the look-at point
   - space + move, or middle-drag: pan (camera and look-at slide together)
   Anything over the lab panel is left alone. */

export type LabCamera = { pos: THREE.Vector3; target: THREE.Vector3; roll: number; fov: number }

/* radians per pixel dragged */
const ORBIT_SPEED = 0.006
/* dolly factor per wheel pixel */
const ZOOM_SPEED = 0.0015
const MIN_DISTANCE = 0.1
const MAX_DISTANCE = 40
/* keeps the camera off the poles, where looking straight down flips it */
const POLE_MARGIN = 0.02

const deg = THREE.MathUtils.degToRad
const UP = new THREE.Vector3(0, 1, 0)

/** `folder` = the camera sliders, refreshed as the mouse moves them;
    `changed` saves the config. Returns the cleanup. */
export const attachLabCamera = (cam: LabCamera, folder: GUI, changed: () => void) => {
  const offset = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  const spherical = new THREE.Spherical()
  const basis = new THREE.Object3D()

  const commit = () => {
    folder.controllersRecursive().forEach((c) => c.updateDisplay())
    changed()
  }
  /* the screen's right / up in the world, as the scenes aim it (look at,
     then roll) */
  const screenAxes = () => {
    basis.position.copy(cam.pos)
    basis.up.copy(UP)
    basis.lookAt(cam.target)
    /* Object3D.lookAt points +Z at the target; a camera looks down -Z */
    basis.rotateY(Math.PI)
    basis.rotateZ(deg(cam.roll))
    right.set(1, 0, 0).applyQuaternion(basis.quaternion)
    up.set(0, 1, 0).applyQuaternion(basis.quaternion)
  }

  const orbit = (dx: number, dy: number) => {
    offset.subVectors(cam.pos, cam.target)
    spherical.setFromVector3(offset)
    spherical.theta -= dx * ORBIT_SPEED
    spherical.phi = THREE.MathUtils.clamp(spherical.phi - dy * ORBIT_SPEED, POLE_MARGIN, Math.PI - POLE_MARGIN)
    cam.pos.copy(cam.target).add(offset.setFromSpherical(spherical))
  }
  const pan = (dx: number, dy: number) => {
    screenAxes()
    /* metres per pixel at the look-at point's depth */
    const scale = (2 * cam.pos.distanceTo(cam.target) * Math.tan(deg(cam.fov) / 2)) / Math.max(window.innerHeight, 1)
    offset.copy(right).multiplyScalar(-dx * scale).addScaledVector(up, dy * scale)
    cam.pos.add(offset)
    cam.target.add(offset)
  }
  const dolly = (delta: number) => {
    offset.subVectors(cam.pos, cam.target)
    const distance = THREE.MathUtils.clamp(offset.length() * Math.exp(delta * ZOOM_SPEED), MIN_DISTANCE, MAX_DISTANCE)
    cam.pos.copy(cam.target).add(offset.setLength(distance))
  }

  const overPanel = (e: Event) => e.target instanceof Element && !!e.target.closest('.lil-gui')
  const typing = () => document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement

  let dragging: 'orbit' | 'pan' | null = null
  let space = false
  let last: { x: number; y: number } | null = null

  const onPointerDown = (e: PointerEvent) => {
    if (overPanel(e)) return
    if (e.button === 2) dragging = 'orbit'
    else if (e.button === 1) dragging = 'pan'
    else return
    e.preventDefault()
    last = { x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: PointerEvent) => {
    const prev = last
    last = { x: e.clientX, y: e.clientY }
    const mode = dragging ?? (space ? 'pan' : null)
    if (!mode || !prev) return
    const dx = e.clientX - prev.x
    const dy = e.clientY - prev.y
    if (dx === 0 && dy === 0) return
    if (mode === 'orbit') orbit(dx, dy)
    else pan(dx, dy)
    commit()
  }
  const onPointerUp = (e: PointerEvent) => {
    if ((e.button === 2 && dragging === 'orbit') || (e.button === 1 && dragging === 'pan')) dragging = null
  }
  const onWheel = (e: WheelEvent) => {
    if (overPanel(e)) return
    e.preventDefault()
    /* lines / pages (Firefox) to roughly pixels */
    dolly(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1))
    commit()
  }
  /* no browser menu after an orbit */
  const onContextMenu = (e: MouseEvent) => {
    if (!overPanel(e)) e.preventDefault()
  }
  /* space is the pan key, not a click on whatever button has focus */
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || typing()) return
    e.preventDefault()
    e.stopPropagation()
    space = true
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') space = false
  }
  const onBlur = () => {
    space = false
    dragging = null
  }

  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  return () => {
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
  }
}
