import * as THREE from 'three'

/* The white diagonal band behind the S. Link list, drawn in the canvas
   rather than as a page layer: it's stencilled out wherever the scene has
   drawn (character, card), so the character's see-through parts show the
   page's video behind it, not the band. */

export type BandShape = { bottom: number; width: number; lean: number }

/* shape comes from POSE.band (screen fractions): a strip between two
   parallel edges rising bottom-left to top-right; the GPU clips it to the
   screen, so the quad just runs well past both ends */
const REACH = [-1, 2] as const
/* seconds to slide/fade in or out */
const DURATION = 0.3
/* where it slides off to, as a screen fraction (toward the top-right) */
const SLIDE = 0.04

const smooth = (t: number) => t * t * (3 - 2 * t)

/** marks a material as part of the scene the band must not cover */
export const writeBandStencil = (material: THREE.Material) => {
  material.stencilWrite = true
  material.stencilRef = 1
  material.stencilFunc = THREE.AlwaysStencilFunc
  material.stencilZPass = THREE.ReplaceStencilOp
}

export const createBand = (initiallyShown: boolean) => {
  const geometry = new THREE.BufferGeometry()
  const positions = new THREE.BufferAttribute(new Float32Array(4 * 3), 3)
  geometry.setAttribute('position', positions)
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  /* corners: lower edge at both reaches, then upper edge back */
  const layout = ({ bottom, width, lean }: BandShape) => {
    const corners = [
      [0, REACH[1]],
      [0, REACH[0]],
      [width, REACH[0]],
      [width, REACH[1]],
    ] as const
    corners.forEach(([shift, y], i) => {
      const x = bottom + lean * (1 - y) - shift
      /* screen fraction -> clip space */
      positions.setXYZ(i, x * 2 - 1, 1 - y * 2, 0)
    })
    positions.needsUpdate = true
  }
  const uniforms = { uOpacity: { value: 1 }, uOffset: { value: new THREE.Vector2() } }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform vec2 uOffset;
      void main() { gl_Position = vec4(position.xy + uOffset, 0.0, 1.0); }
    `,
    /* premultiplied white, written over the cleared (transparent) pixels */
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      void main() { gl_FragColor = vec4(vec3(uOpacity), uOpacity); }
    `,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(mesh)
  const camera = new THREE.Camera()

  let shown = initiallyShown
  let t = initiallyShown ? 1 : 0

  return {
    setShown: (value: boolean) => {
      shown = value
    },
    update: (dt: number, shape: BandShape) => {
      layout(shape)
      t = THREE.MathUtils.clamp(t + (shown ? dt : -dt) / DURATION, 0, 1)
      const e = smooth(t)
      uniforms.uOpacity.value = e
      /* screen fraction -> clip space, +y up */
      uniforms.uOffset.value.set((1 - e) * SLIDE * 2, (1 - e) * SLIDE * 2)
    },
    /** call after the scene has drawn (and written the stencil) */
    render: (renderer: THREE.WebGLRenderer) => {
      if (t > 0) renderer.render(scene, camera)
    },
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}
