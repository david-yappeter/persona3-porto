import * as THREE from 'three'

/* Huge menu-name type ("CREDITS", like the equip menu's "EQUIP") drawn in
   the canvas between the white band and the shadow pass, and only where
   the character didn't draw — so he stays in front of it and his shadow
   falls across it, which an HTML layer over the canvas can't do. */

export type ScreenTextStyle = {
  /** left edge and baseline, screen fractions (x from the left, y from the top) */
  x: number
  y: number
  /** font size as a fraction of the screen height */
  size: number
  /** horizontal squeeze, 1 = as drawn */
  squeeze: number
  /** gap between letters, CSS px */
  spacing: number
  /** italic lean, degrees (a drawn slant — the face has no italic) */
  slant: number
  color: string
}

/* the site's own heaviest face (Eurostile Extended Black, see fonts.css) */
const FAMILY = 'Eurostile Extended'
const FONT = `900 PX '${FAMILY}', 'Arial Black', Arial, sans-serif`

export const createScreenText = (text: string) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  /* drawn premultiplied; colours pass through as written, like the band's white */
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
    /* same test as the band: only where the scene left stencil bit 0
       clear; marks its pixels 2 so the shadow pass covers it too */
    stencilWrite: true,
    stencilRef: 2,
    stencilFuncMask: 1,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  mesh.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(mesh)
  const camera = new THREE.Camera()
  const size = new THREE.Vector2()
  let drawn = ''

  /* the canvas only uses a web font once it has loaded — redraw then */
  let fontReady = document.fonts.check(`900 16px '${FAMILY}'`)
  if (!fontReady) void document.fonts.load(`900 16px '${FAMILY}'`).then(() => (fontReady = true))

  const draw = (w: number, h: number, pixelRatio: number, s: ScreenTextStyle) => {
    if (!context) return
    canvas.width = w
    canvas.height = h
    context.clearRect(0, 0, w, h)
    context.font = FONT.replace('PX', `${Math.round(s.size * h)}px`)
    context.fillStyle = s.color
    context.textBaseline = 'alphabetic'
    context.save()
    context.translate(s.x * w, s.y * h)
    /* lean the letters forward from the baseline, then condense */
    context.transform(1, 0, -Math.tan(THREE.MathUtils.degToRad(s.slant)), 1, 0, 0)
    context.scale(s.squeeze, 1)
    /* letter by letter for the spacing (kept in screen px under the squeeze) */
    const gap = (s.spacing * pixelRatio) / Math.max(s.squeeze, 0.01)
    let x = 0
    for (const letter of text) {
      context.fillText(letter, x, 0)
      x += context.measureText(letter).width + gap
    }
    context.restore()
    texture.needsUpdate = true
  }

  return {
    render: (renderer: THREE.WebGLRenderer, style: ScreenTextStyle) => {
      renderer.getDrawingBufferSize(size)
      const key = `${size.x}x${size.y} ${fontReady} ${JSON.stringify(style)}`
      if (key !== drawn) {
        draw(size.x, size.y, renderer.getPixelRatio(), style)
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
