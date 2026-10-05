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

export const noOutline = <T extends THREE.Material>(material: T) => {
  material.userData.outlineParameters = { visible: false }
  return material
}
