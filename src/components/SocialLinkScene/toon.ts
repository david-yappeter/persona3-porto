import * as THREE from 'three'

export const PALETTE = {
  skyTop: '#46f2ff',
  skyMid: '#2f74ff',
  skyBottom: '#4b1dc9',
  fog: 0x3a5cff,
  keyLight: 0xe8fdff,
  shadowLight: 0x4334e0,
  outline: [0.05, 0.04, 0.2] as [number, number, number],
}

/* 3 hard bands — deep shadow / mid / blown-out highlight, like the source's
   cel shading where lit cloth goes almost pure white */
export const createToonGradient = () => {
  const tones = [55, 150, 255]
  const data = new Uint8Array(tones.length * 4)
  tones.forEach((v, i) => data.set([v, v, v, 255], i * 4))
  const texture = new THREE.DataTexture(data, tones.length, 1, THREE.RGBAFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

type AnyLitMaterial = THREE.Material & {
  color?: THREE.Color
  map?: THREE.Texture | null
  alphaMap?: THREE.Texture | null
  normalMap?: THREE.Texture | null
}

export const toonify = (source: THREE.Material, gradientMap: THREE.Texture) => {
  const src = source as AnyLitMaterial
  const material = new THREE.MeshToonMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    map: src.map ?? null,
    alphaMap: src.alphaMap ?? null,
    normalMap: src.normalMap ?? null,
    gradientMap,
    transparent: src.transparent,
    opacity: src.opacity,
    alphaTest: src.alphaTest,
    side: src.side,
    depthWrite: src.depthWrite,
  })
  material.name = source.name
  return material
}

/* P3 duotone: final colour's luminance remapped onto a violet > blue > cyan >
   white ramp, drifting violet toward the bottom of the screen. Runs after
   colorspace conversion, so the ramp stops are plain sRGB. */
const GRADE_GLSL = /* glsl */ `
  {
    float p3l = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    /* contrast curve: dark cloth sinks into indigo, skin/shirt blow out to
       white-cyan like the menu art */
    p3l = clamp((pow(p3l, 0.85) - 0.08) * 1.35, 0.0, 1.0);
    vec3 p3g;
    if (p3l < 0.25) p3g = mix(vec3(0.16, 0.06, 0.52), vec3(0.17, 0.32, 0.93), p3l / 0.25);
    else if (p3l < 0.5) p3g = mix(vec3(0.17, 0.32, 0.93), vec3(0.08, 0.78, 0.97), (p3l - 0.25) / 0.25);
    else if (p3l < 0.75) p3g = mix(vec3(0.08, 0.78, 0.97), vec3(0.74, 0.98, 1.0), (p3l - 0.5) / 0.25);
    else p3g = mix(vec3(0.74, 0.98, 1.0), vec3(1.0), (p3l - 0.75) / 0.25);
    float p3v = clamp(gl_FragCoord.y / p3ResolutionY, 0.0, 1.0);
    p3g = mix(p3g, p3g * vec3(0.72, 0.55, 1.05), (1.0 - p3v) * 0.55 * (1.0 - p3l * 0.8));
    /* see-through overlay: dark areas let the page behind the canvas show
       through, bright ones stay solid. Opaque materials draw unblended into
       a premultiplied-alpha canvas, so their colour is premultiplied here;
       blended ones keep straight colour and just scale their alpha */
    float p3a = mix(p3AlphaDark, p3AlphaLight, smoothstep(p3AlphaCut - p3AlphaSoft, p3AlphaCut + p3AlphaSoft, p3l));
    p3a = mix(p3a, max(p3a, p3AlphaLight), P3_HAIR * p3HairSolid);
    p3a = mix(1.0, p3a, p3OverlayOn);
    #ifdef OPAQUE
      gl_FragColor = vec4(p3g * p3a, p3a);
    #else
      gl_FragColor = vec4(p3g, gl_FragColor.a * p3a);
    #endif
  }
`

export type Overlay = { enabled: boolean; dark: number; light: number; cut: number; softness: number; hairSolid: boolean }

/** `enabled: false` gives a no-op grade, for showing a model in its own colours */
export const createGrade = (enabled = true) => {
  const resolutionY = { value: 1 }
  /* shared by every graded material, so one update restyles them all */
  const overlay = {
    p3OverlayOn: { value: 0 },
    p3AlphaDark: { value: 1 },
    p3AlphaLight: { value: 1 },
    p3AlphaCut: { value: 0.5 },
    p3AlphaSoft: { value: 0.2 },
    p3HairSolid: { value: 0 },
  }
  const apply = <T extends THREE.Material>(material: T) => {
    if (!enabled) return material
    /* VRM meshes share material instances — only wrap each one once */
    if (material.userData.p3Graded) return material
    material.userData.p3Graded = true
    /* hair can opt out of the see-through overlay */
    const hair = /hair/i.test(material.name)
    const previous = material.onBeforeCompile.bind(material)
    material.onBeforeCompile = (shader, renderer) => {
      previous(shader, renderer)
      shader.uniforms.p3ResolutionY = resolutionY
      Object.assign(shader.uniforms, overlay)
      const header = [
        'uniform float p3ResolutionY;',
        ...Object.keys(overlay).map((name) => `uniform float ${name};`),
        `#define P3_HAIR ${hair ? '1.0' : '0.0'}`,
      ].join('\n')
      shader.fragmentShader = `${header}\n${shader.fragmentShader}`.replace(
        '#include <dithering_fragment>',
        `${GRADE_GLSL}\n#include <dithering_fragment>`,
      )
    }
    const previousKey = material.customProgramCacheKey.bind(material)
    material.customProgramCacheKey = () => `${previousKey()}|p3grade${hair ? '-hair' : ''}`
    material.needsUpdate = true
    return material
  }
  return {
    apply,
    /** drawing-buffer height in px, for the bottom-of-screen violet drift */
    setHeight: (px: number) => {
      resolutionY.value = px
    },
    setOverlay: (o: Overlay) => {
      overlay.p3OverlayOn.value = o.enabled ? 1 : 0
      overlay.p3AlphaDark.value = o.dark
      overlay.p3AlphaLight.value = o.light
      overlay.p3AlphaCut.value = o.cut
      overlay.p3AlphaSoft.value = Math.max(o.softness, 0.001)
      overlay.p3HairSolid.value = o.hairSolid ? 1 : 0
    },
  }
}

export type Grade = ReturnType<typeof createGrade>

export const noOutline = <T extends THREE.Material>(material: T) => {
  material.userData.outlineParameters = { visible: false }
  return material
}
