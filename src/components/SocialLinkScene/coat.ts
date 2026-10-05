import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import type { Grade } from './toon'

/* A long open coat generated on top of a VRoid model that doesn't have one:
   the torso (shirt mesh) and arms (skin mesh) are copied and pushed out
   along their normals, keeping their skin weights so they deform with the
   skeleton, then a flared skirt rigged to the hips runs down to the knees.
   All numbers are in the model's own bind-pose metres. */

const COAT_COLOR = 0x18245e
const TORSO_OFFSET = 0.022
const SLEEVE_OFFSET = 0.02
/* open front: narrow at the waist, widening into a V toward the collar */
const OPENING = { waistY: 1.25, collarY: 1.52, waistHalf: 0.045, collarHalf: 0.12 }
/* starts inside the torso shell so the seam is hidden, gap matched to the
   opening's waist width */
const SKIRT = { topY: 1.3, bottomY: 0.55, top: { rx: 0.17, rz: 0.125 }, bottom: { rx: 0.26, rz: 0.2 }, gapTop: 0.27, gapBottom: 0.5 }

type Vec = THREE.Vector3

const dominantBone = (mesh: THREE.SkinnedMesh) => {
  const si = mesh.geometry.getAttribute('skinIndex')
  const sw = mesh.geometry.getAttribute('skinWeight')
  return (i: number) => {
    let best = 0
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k
    return mesh.skeleton.bones[si.getComponent(i, best)]
  }
}

/* normals averaged across split vertices, so the offset shell doesn't tear
   open along UV seams */
const weldedNormals = (geometry: THREE.BufferGeometry) => {
  const pos = geometry.getAttribute('position')
  const nrm = geometry.getAttribute('normal')
  const key = (i: number) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`
  const sums = new Map<string, Vec>()
  for (let i = 0; i < pos.count; i++) {
    const k = key(i)
    const sum = sums.get(k) ?? new THREE.Vector3()
    sum.x += nrm.getX(i)
    sum.y += nrm.getY(i)
    sum.z += nrm.getZ(i)
    sums.set(k, sum)
  }
  sums.forEach((v) => v.normalize())
  return (i: number) => sums.get(key(i))!
}

const shell = (
  source: THREE.SkinnedMesh,
  offset: number,
  keep: (a: number, b: number, c: number, centroid: Vec) => boolean,
  material: THREE.Material,
  /** optional per-vertex adjustment of the offset position */
  snap?: (p: Vec, centroid: Vec) => void,
) => {
  const g = source.geometry
  const pos = g.getAttribute('position')
  const si = g.getAttribute('skinIndex')
  const sw = g.getAttribute('skinWeight')
  const normalAt = weldedNormals(g)
  const index = g.index
  const triCount = index ? index.count / 3 : pos.count / 3
  const vert = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k)

  const positions: number[] = []
  const normals: number[] = []
  const skinIndices: number[] = []
  const skinWeights: number[] = []
  const centroid = new THREE.Vector3()
  const out = new THREE.Vector3()
  for (let t = 0; t < triCount; t++) {
    const a = vert(t, 0)
    const b = vert(t, 1)
    const c = vert(t, 2)
    centroid
      .set(pos.getX(a) + pos.getX(b) + pos.getX(c), pos.getY(a) + pos.getY(b) + pos.getY(c), pos.getZ(a) + pos.getZ(b) + pos.getZ(c))
      .divideScalar(3)
    if (!keep(a, b, c, centroid)) continue
    for (const i of [a, b, c]) {
      const n = normalAt(i)
      out.set(pos.getX(i) + n.x * offset, pos.getY(i) + n.y * offset, pos.getZ(i) + n.z * offset)
      snap?.(out, centroid)
      positions.push(out.x, out.y, out.z)
      normals.push(n.x, n.y, n.z)
      for (let k = 0; k < 4; k++) {
        skinIndices.push(si.getComponent(i, k))
        skinWeights.push(sw.getComponent(i, k))
      }
    }
  }
  if (!positions.length) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4))
  return attachLike(source, geometry, material)
}

const attachLike = (source: THREE.SkinnedMesh, geometry: THREE.BufferGeometry, material: THREE.Material) => {
  const mesh = new THREE.SkinnedMesh(geometry, material)
  mesh.position.copy(source.position)
  mesh.quaternion.copy(source.quaternion)
  mesh.scale.copy(source.scale)
  mesh.frustumCulled = false
  source.parent?.add(mesh)
  mesh.bind(source.skeleton, source.bindMatrix)
  return mesh
}

const skirt = (source: THREE.SkinnedMesh, hips: THREE.Bone, frontSign: number, material: THREE.Material) => {
  const hipIndex = source.skeleton.bones.indexOf(hips)
  if (hipIndex < 0) return null
  const ROWS = 14
  const COLS = 48
  const positions: number[] = []
  const indices: number[] = []
  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS
    /* flare eases out toward the hem */
    const flare = t * t * (3 - 2 * t)
    const y = THREE.MathUtils.lerp(SKIRT.topY, SKIRT.bottomY, t)
    const rx = THREE.MathUtils.lerp(SKIRT.top.rx, SKIRT.bottom.rx, flare)
    const rz = THREE.MathUtils.lerp(SKIRT.top.rz, SKIRT.bottom.rz, flare)
    const gap = THREE.MathUtils.lerp(SKIRT.gapTop, SKIRT.gapBottom, t)
    for (let c = 0; c <= COLS; c++) {
      const theta = gap + ((Math.PI * 2 - gap * 2) * c) / COLS
      positions.push(Math.sin(theta) * rx, y, Math.cos(theta) * rz * frontSign)
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = r * (COLS + 1) + c
      const b = a + COLS + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const count = positions.length / 3
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0).map((_, i) => (i % 4 === 0 ? hipIndex : 0)), 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(count * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4))
  return attachLike(source, geometry, material)
}

export const addLongCoat = (vrm: VRM, gradientMap: THREE.Texture, grade: Grade) => {
  const meshes: THREE.SkinnedMesh[] = []
  vrm.scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh)
  })
  const materialName = (m: THREE.SkinnedMesh) => (Array.isArray(m.material) ? m.material[0] : m.material).name
  const tops = meshes.find((m) => /Tops/i.test(materialName(m)))
  const skins = meshes.filter((m) => /Body.*SKIN/i.test(materialName(m)))
  const hips = vrm.humanoid.getRawBoneNode('hips') as THREE.Bone | null
  if (!tops || !hips) return

  const material = grade.apply(new THREE.MeshToonMaterial({ color: COAT_COLOR, gradientMap, side: THREE.DoubleSide }))
  /* VRM 0.x is authored facing -Z, VRM 1.0 facing +Z */
  const frontSign = vrm.meta.metaVersion === '0' ? -1 : 1

  const openingHalf = (y: number) =>
    THREE.MathUtils.lerp(OPENING.waistHalf, OPENING.collarHalf, THREE.MathUtils.clamp((y - OPENING.waistY) / (OPENING.collarY - OPENING.waistY), 0, 1))
  shell(
    tops,
    TORSO_OFFSET,
    (_a, _b, _c, p) => p.z * frontSign <= 0 || Math.abs(p.x) > openingHalf(p.y),
    material,
    /* kept triangles that poke into the opening get their inner vertices
       pulled onto the opening line, so the front edge runs straight instead
       of stair-stepping along whole triangles */
    (p, centroid) => {
      if (p.z * frontSign <= 0) return
      const half = openingHalf(p.y)
      if (Math.abs(p.x) < half) p.x = Math.sign(centroid.x || 1) * half
    },
  )

  const armBones = new Set(
    (['leftShoulder', 'rightShoulder', 'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm'] as const)
      .map((name) => vrm.humanoid.getRawBoneNode(name))
      .filter((b): b is THREE.Object3D => !!b),
  )
  const hands = new Set([vrm.humanoid.getRawBoneNode('leftHand'), vrm.humanoid.getRawBoneNode('rightHand')])
  /* VRoid weights much of the forearm to secondary twist bones (J_Sec_*)
     parented under the arm bones — count those as arm too */
  const isArm = (b: THREE.Object3D) => armBones.has(b) || (!!b.parent && armBones.has(b.parent) && !hands.has(b))
  for (const skin of skins) {
    const dominant = dominantBone(skin)
    shell(skin, SLEEVE_OFFSET, (a, b, c) => isArm(dominant(a)) && isArm(dominant(b)) && isArm(dominant(c)), material)
  }

  skirt(tops, hips, frontSign, material)
}
