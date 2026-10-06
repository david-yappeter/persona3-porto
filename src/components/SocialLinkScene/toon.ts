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
    /* see-through alpha below follows the unshaded brightness, so the
       extra shading darkens the white parts without making them see-through */
    float p3la = p3l;
    /* extra form shading on the bright parts the curve blows out (skin,
       shirt): lambert from a fixed view-space light, optionally cut into
       cel bands, fading in from p3ShadeFrom brightness up */
    #if P3_SHADE
      float p3s = clamp(dot(P3_NORMAL, p3LightDir), 0.0, 1.0);
      if (p3ShadeBands >= 2.0) p3s = min(floor(p3s * p3ShadeBands) / (p3ShadeBands - 1.0), 1.0);
      p3l *= mix(1.0, p3s, p3ShadeStrength * smoothstep(p3ShadeFrom, 1.0, p3la));
    #endif
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
    float p3a = mix(p3AlphaDark, p3AlphaLight, smoothstep(p3AlphaCut - p3AlphaSoft, p3AlphaCut + p3AlphaSoft, p3la));
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
export type Shading = { strength: number; bands: number; from: number }

/* built-in lit materials, whose fragment shader has a view-space `normal`
   in scope where the grade runs */
const LIT = new Set(['MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshToonMaterial', 'MeshPhongMaterial', 'MeshLambertMaterial'])
/* unlit glTFs (KHR_materials_unlit) load as MeshBasicMaterial, which has no
   fragment normal — the vertex shader hands one over instead: the skinned
   view-space normal it already computes for skinned meshes, else its own */
const BASIC_NORMAL_VERTEX = /* glsl */ `
  #include <project_vertex>
  #if defined( USE_ENVMAP ) || defined( USE_SKINNING )
    p3vNormal = transformedNormal;
  #else
    p3vNormal = normalMatrix * normal;
  #endif
`

/** `enabled: false` gives a no-op grade, for showing a model in its own colours */
/** `unshaded`: material names kept out of the white-part shading */
export const createGrade = (enabled = true, unshaded?: RegExp) => {
  const resolutionY = { value: 1 }
  /* shared by every graded material, so one update restyles them all */
  const overlay = {
    p3OverlayOn: { value: 0 },
    p3AlphaDark: { value: 1 },
    p3AlphaLight: { value: 1 },
    p3AlphaCut: { value: 0.5 },
    p3AlphaSoft: { value: 0.2 },
    p3HairSolid: { value: 0 },
    p3ShadeStrength: { value: 0 },
    p3ShadeBands: { value: 0 },
    p3ShadeFrom: { value: 0.5 },
  }
  const lightDir = { value: new THREE.Vector3(0, 0, 1) }
  const apply = <T extends THREE.Material>(material: T) => {
    if (!enabled) return material
    /* VRM meshes share material instances — only wrap each one once */
    if (material.userData.p3Graded) return material
    material.userData.p3Graded = true
    /* hair can opt out of the see-through overlay */
    const hair = /hair/i.test(material.name)
    const lit = LIT.has(material.type)
    const basic = material.type === 'MeshBasicMaterial'
    const shade = (lit || basic) && !unshaded?.test(material.name)
    const previous = material.onBeforeCompile.bind(material)
    material.onBeforeCompile = (shader, renderer) => {
      previous(shader, renderer)
      shader.uniforms.p3ResolutionY = resolutionY
      shader.uniforms.p3LightDir = lightDir
      Object.assign(shader.uniforms, overlay)
      const header = [
        'uniform float p3ResolutionY;',
        'uniform vec3 p3LightDir;',
        ...Object.keys(overlay).map((name) => `uniform float ${name};`),
        `#define P3_HAIR ${hair ? '1.0' : '0.0'}`,
        `#define P3_SHADE ${shade ? 1 : 0}`,
        basic ? 'varying vec3 p3vNormal;' : '',
        lit ? '#define P3_NORMAL normalize(normal)' : '',
        basic ? '#define P3_NORMAL (normalize(p3vNormal) * (gl_FrontFacing ? 1.0 : -1.0))' : '',
      ].join('\n')
      if (basic) {
        shader.vertexShader = `varying vec3 p3vNormal;\n${shader.vertexShader}`.replace('#include <project_vertex>', BASIC_NORMAL_VERTEX)
      }
      shader.fragmentShader = `${header}\n${shader.fragmentShader}`.replace(
        '#include <dithering_fragment>',
        `${GRADE_GLSL}\n#include <dithering_fragment>`,
      )
    }
    const previousKey = material.customProgramCacheKey.bind(material)
    material.customProgramCacheKey = () => `${previousKey()}|p3grade${hair ? '-hair' : ''}${shade ? '-shade' : ''}`
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
    /** lightViewDir: direction toward the light, in camera space */
    setShading: (s: Shading, lightViewDir: THREE.Vector3) => {
      overlay.p3ShadeStrength.value = s.strength
      overlay.p3ShadeBands.value = s.bands
      overlay.p3ShadeFrom.value = s.from
      lightDir.value.copy(lightViewDir).normalize()
    },
  }
}

export type Grade = ReturnType<typeof createGrade>

export const noOutline = <T extends THREE.Material>(material: T) => {
  material.userData.outlineParameters = { visible: false }
  return material
}
