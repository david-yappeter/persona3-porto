import * as THREE from 'three'
import type { BandHole } from './band'

/* Huge black type wrapped around the band's round window (the system
   menu's "SYSTEM" curling round its circle): each letter stands on the
   circle's outside with its top toward the centre, reading round it
   counter-clockwise — or, flipped, with its foot on the circle and its top
   out, reading clockwise. Drawn like screenText.ts — in the canvas, between the
   band and the shadow pass — but only on the band itself, so the window
   cuts whatever part of a letter crosses into it, and he stays in front. */

export type RingTextStyle = {
  /** font size as a fraction of the screen height */
  size: number
  /** the letters' inner side (tops, or feet when flipped) from the
      circle's edge, screen heights (- = tucked under it) */
  offset: number
  /** false: tops toward the centre, reading counter-clockwise; true: tops
      outward, reading clockwise */
  flip: boolean
  /** where the first letter sits, degrees round the centre: 0 = right,
      90 = below, 180 = left, 270 = above (round an oval: before its tilt,
      as if it were a circle) */
  start: number
  /** gap between letters, CSS px */
  spacing: number
  /** horizontal squeeze, 1 = as drawn */
  squeeze: number
  color: string
}

const FAMILY = 'Eurostile Extended'
const FONT = `900 PX '${FAMILY}', 'Arial Black', Arial, sans-serif`
/* how much of the font size a capital stands, to put its top on the ring */
const CAP_HEIGHT = 0.72

const deg = THREE.MathUtils.degToRad

export const createRingText = (text: string) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.premultiplyAlpha = true
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: texture } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec2 vUv;
      void main() { gl_FragColor = texture2D(map, vUv); }
    `,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    /* band pixels only (marked 2 by the band): not in the window, not on him */
    stencilWrite: true,
    stencilRef: 2,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  mesh.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(mesh)
  const camera = new THREE.Camera()
  const size = new THREE.Vector2()
  let drawn = ''

  let fontReady = document.fonts.check(`900 16px '${FAMILY}'`)
  if (!fontReady) void document.fonts.load(`900 16px '${FAMILY}'`).then(() => (fontReady = true))

  const draw = (w: number, h: number, pixelRatio: number, hole: BandHole, s: RingTextStyle) => {
    if (!context) return
    canvas.width = w
    canvas.height = h
    context.clearRect(0, 0, w, h)
    const fontPx = Math.round(s.size * h)
    context.font = FONT.replace('PX', `${fontPx}px`)
    context.fillStyle = s.color
    context.textBaseline = 'alphabetic'
    const cx = hole.x * w
    const cy = hole.y * h
    /* the oval's half-axes, px, and its tilt */
    const rx = Math.max(hole.radius * hole.stretch * h, 1)
    const ry = Math.max(hole.radius * h, 1)
    const cos = Math.cos(deg(hole.tilt))
    const sin = Math.sin(deg(hole.tilt))
    /* the baseline runs a capital's height outside the letters' tops, or
       on the inner side itself when they stand on it */
    const out = s.offset * h + (s.flip ? 0 : fontPx * CAP_HEIGHT)
    /* the baseline point at parameter t (writes x, y) and its outward
       normal (nx, ny) */
    let x = 0
    let y = 0
    let nx = 0
    let ny = 0
    const at = (t: number) => {
      const ex = rx * Math.cos(t)
      const ey = ry * Math.sin(t)
      let mx = ry * Math.cos(t)
      let my = rx * Math.sin(t)
      const len = Math.hypot(mx, my) || 1
      mx /= len
      my /= len
      nx = cos * mx - sin * my
      ny = sin * mx + cos * my
      x = cx + cos * ex - sin * ey + nx * out
      y = cy + sin * ex + cos * ey + ny * out
    }
    const gap = s.spacing * pixelRatio
    /* parameters grow clockwise on screen (y down) */
    const turn = s.flip ? 1 : -1
    const STEP = 0.002
    let t = deg(s.start)
    for (const letter of text) {
      const advance = context.measureText(letter).width * s.squeeze + gap
      at(t)
      context.save()
      context.translate(x, y)
      /* top toward the centre (or away), along the normal; reading on round it */
      context.rotate(s.flip ? Math.atan2(nx, -ny) : Math.atan2(-nx, ny))
      context.scale(s.squeeze, 1)
      context.fillText(letter, 0, 0)
      context.restore()
      /* walk the baseline until it has run the letter's width */
      let run = 0
      let px = x
      let py = y
      for (let i = 0; run < advance && i < 20000; i++) {
        t += turn * STEP
        at(t)
        run += Math.hypot(x - px, y - py)
        px = x
        py = y
      }
    }
    texture.needsUpdate = true
  }

  return {
    render: (renderer: THREE.WebGLRenderer, hole: BandHole, style: RingTextStyle) => {
      renderer.getDrawingBufferSize(size)
      const key = `${size.x}x${size.y} ${fontReady} ${JSON.stringify(hole)} ${JSON.stringify(style)}`
      if (key !== drawn) {
        draw(size.x, size.y, renderer.getPixelRatio(), hole, style)
        drawn = key
      }
      renderer.render(scene, camera)
    },
    dispose: () => {
      texture.dispose()
      material.dispose()
      mesh.geometry.dispose()
    },
  }
}
