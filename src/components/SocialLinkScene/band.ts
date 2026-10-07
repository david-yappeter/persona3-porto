import * as THREE from 'three'

/* The white diagonal band behind the S. Link list, drawn in the canvas
   rather than as a page layer: it's stencilled out wherever the scene has
   drawn (character, card), so the character's see-through parts show the
   page's video behind it, not the band. */

export type BandShape = { bottom: number; width: number; lean: number }

/** a round window cut out of the band, the page's video showing through:
    centre in screen fractions (x from the left, y from the top), radius
    as a fraction of the screen height (the vertical one, for an oval) —
    with one the band fills the whole screen around it instead of running
    as a strip. stretch: width over height (1 = circle, 2 = twice as wide);
    tilt: degrees, + = clockwise */
export type BandHole = { x: number; y: number; radius: number; stretch: number; tilt: number }

/** the character's flat silhouette cast on the band (POSE.shadow) */
export type BandShadow = { strength: number; color: string; x: number; y: number }

/* shape comes from POSE.band (screen fractions): a strip between two
   parallel edges rising bottom-left to top-right; the GPU clips it to the
   screen, so the quad just runs well past both ends */
const REACH = [-1, 2] as const
/* seconds to slide/fade in or out */
const DURATION = 0.3
/* where it slides off to, as a screen fraction (toward the top-right) */
const SLIDE = 0.04

const WHITE = new THREE.Color(1, 1, 1)

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
  const layout = ({ bottom, width, lean }: BandShape, hole: BandHole | null) => {
    if (hole) {
      /* the whole screen, the window cut in the fragment shader */
      ;[[-1, 1], [-1, -1], [1, -1], [1, 1]].forEach(([x, y], i) => positions.setXYZ(i, x, y, 0))
      positions.needsUpdate = true
      return
    }
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
  const uniforms = {
    uOpacity: { value: 1 },
    uOffset: { value: new THREE.Vector2() },
    /* x, y, radius (see BandHole); radius 0 = no window */
    uHole: { value: new THREE.Vector3() },
    /* stretch, tilt (radians) */
    uHoleShape: { value: new THREE.Vector2(1, 0) },
    uResolution: { value: new THREE.Vector2(1, 1) },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform vec2 uOffset;
      void main() { gl_Position = vec4(position.xy + uOffset, 0.0, 1.0); }
    `,
    /* premultiplied white, written over the cleared (transparent) pixels */
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uHole;
      uniform vec2 uHoleShape;
      uniform vec2 uResolution;
      void main() {
        float a = uOpacity;
        if (uHole.z > 0.0) {
          /* in screen-height units from the window's centre (y down) */
          vec2 p = vec2(gl_FragCoord.x / uResolution.x, 1.0 - gl_FragCoord.y / uResolution.y);
          vec2 d = (p - uHole.xy) * vec2(uResolution.x / uResolution.y, 1.0);
          /* into the oval's own axes (untilted), then squashed to a circle */
          float c = cos(uHoleShape.y);
          float s = sin(uHoleShape.y);
          d = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
          d.x /= max(uHoleShape.x, 0.01);
          /* a soft edge about a pixel wide (measured across the short side) */
          float px = 1.0 / (uResolution.y * min(uHoleShape.x, 1.0));
          float cover = smoothstep(uHole.z - px, uHole.z + px, length(d));
          if (cover <= 0.0) discard;
          a *= cover;
        }
        gl_FragColor = vec4(vec3(a), a);
      }
    `,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    /* draws where the scene didn't (stencil bit 0 clear) and marks its
       pixels 2, so the shadow pass lands on the band only */
    stencilWrite: true,
    stencilRef: 2,
    stencilFuncMask: 1,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(mesh)
  const camera = new THREE.Camera()

  /* shadow: every scene material drawn again as a flat colour (keeping its
     texture's cut-outs) from a camera shifted on screen, only on band pixels */
  const shadowUniforms = { p3ShadowColor: { value: new THREE.Color() }, p3ShadowOpacity: { value: 1 } }
  const shadowMaterials = new WeakMap<THREE.Material, THREE.Material>()
  const shadowOf = (material: THREE.Material) => {
    let shadow = shadowMaterials.get(material)
    if (!shadow) {
      const map = (material as THREE.MeshBasicMaterial).map ?? null
      shadow = new THREE.MeshBasicMaterial({
        map,
        alphaTest: map ? 0.5 : 0,
        side: material.side,
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
        stencilWrite: true,
        stencilRef: 2,
        stencilFunc: THREE.EqualStencilFunc,
        stencilFail: THREE.KeepStencilOp,
        stencilZPass: THREE.KeepStencilOp,
      })
      /* the texture only decides coverage; colour and alpha are the shadow's */
      shadow.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, shadowUniforms)
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', 'uniform vec3 p3ShadowColor;\nuniform float p3ShadowOpacity;\nvoid main() {')
          .replace(
            '#include <alphatest_fragment>',
            '#include <alphatest_fragment>\n  diffuseColor = vec4(p3ShadowColor, p3ShadowOpacity);',
          )
      }
      shadowMaterials.set(material, shadow)
    }
    return shadow
  }
  const shadowColor = new THREE.Color()
  const shift = new THREE.Matrix4()
  const savedProjection = new THREE.Matrix4()
  const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = []
  const hidden: THREE.Object3D[] = []
  const renderShadow = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, s: BandShadow, e: number) => {
    if (s.strength <= 0) return
    /* premultiplied: white mixed toward the colour, scaled by the band's fade */
    shadowColor.set(s.color)
    shadowColor.convertLinearToSRGB().lerpColors(WHITE, shadowColor, s.strength).multiplyScalar(e)
    shadowUniforms.p3ShadowColor.value.setRGB(shadowColor.r, shadowColor.g, shadowColor.b, THREE.SRGBColorSpace)
    shadowUniforms.p3ShadowOpacity.value = e
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.material || !o.visible) return
      if ((mesh.material as THREE.Material & { isLineMaterial?: boolean }).isLineMaterial) {
        hidden.push(o)
        o.visible = false
        return
      }
      swapped.push([mesh, mesh.material])
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(shadowOf) : shadowOf(mesh.material)
    })
    /* screen fractions (y down) -> a clip-space shift */
    savedProjection.copy(camera.projectionMatrix)
    camera.projectionMatrix.premultiply(shift.makeTranslation(s.x * 2, -s.y * 2, 0))
    renderer.render(scene, camera)
    camera.projectionMatrix.copy(savedProjection)
    for (const [mesh, material] of swapped) mesh.material = material
    for (const o of hidden) o.visible = true
    swapped.length = 0
    hidden.length = 0
  }

  let shown = initiallyShown
  let t = initiallyShown ? 1 : 0

  return {
    setShown: (value: boolean) => {
      shown = value
    },
    update: (dt: number, shape: BandShape, hole: BandHole | null = null) => {
      layout(shape, hole)
      if (hole) {
        uniforms.uHole.value.set(hole.x, hole.y, Math.max(hole.radius, 1e-4))
        uniforms.uHoleShape.value.set(hole.stretch, THREE.MathUtils.degToRad(hole.tilt))
      } else uniforms.uHole.value.set(0, 0, 0)
      t = THREE.MathUtils.clamp(t + (shown ? dt : -dt) / DURATION, 0, 1)
      const e = smooth(t)
      uniforms.uOpacity.value = e
      /* screen fraction -> clip space, +y up */
      uniforms.uOffset.value.set((1 - e) * SLIDE * 2, (1 - e) * SLIDE * 2)
    },
    /** call after the scene has drawn (and written the stencil); the
        shadow redraws `world` from `view`. `decorate` draws on top of the
        band before the shadow falls on both (see screenText.ts) */
    render: (renderer: THREE.WebGLRenderer, world: THREE.Scene, view: THREE.Camera, shadow: BandShadow, decorate?: () => void) => {
      if (t <= 0) return
      renderer.getDrawingBufferSize(uniforms.uResolution.value)
      renderer.render(scene, camera)
      decorate?.()
      renderShadow(renderer, world, view, shadow, uniforms.uOpacity.value)
    },
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}
