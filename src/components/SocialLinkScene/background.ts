import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PALETTE, noOutline } from './toon'

/* deterministic so the skyline is the same on every visit */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

const makeSkyTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(canvas.width * 0.85, 0, canvas.width * 0.2, canvas.height)
  grad.addColorStop(0, PALETTE.skyTop)
  grad.addColorStop(0.45, PALETTE.skyMid)
  grad.addColorStop(1, PALETTE.skyBottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const glow = ctx.createRadialGradient(canvas.width * 0.8, 0, 0, canvas.width * 0.8, 0, canvas.width * 0.7)
  glow.addColorStop(0, 'rgba(170, 255, 255, 0.55)')
  glow.addColorStop(1, 'rgba(170, 255, 255, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/* window grid tile; the border texels are wall colour so roof faces (uv
   collapsed to 0) read as plain wall */
const makeWindowTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#b8c6ff'
  ctx.fillRect(14, 12, 36, 30)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(31, 12, 2, 30)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

const makeSlashTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 160
  const ctx = canvas.getContext('2d')!
  const font = 'italic 900 120px "Eurostile Extended"'
  const draw = () => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#c9cde0'
    ctx.font = `${font}, Arial, sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText('SOCIAL LINK', 40, canvas.height / 2 + 6)
  }
  draw()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  /* canvas has no font-swap; redraw once the webfont is actually in */
  void document.fonts.load(font).then(() => {
    draw()
    texture.needsUpdate = true
  }, () => {})
  return texture
}

const WINDOW_TILE = 1.4

/* BoxGeometry face order is +x,-x,+y,-y,+z,-z, 4 verts each — stretch uvs to
   world size so the window grid tiles at a constant scale on every box */
const buildingGeometry = (w: number, h: number, d: number) => {
  const geometry = new THREE.BoxGeometry(w, h, d)
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
  const faceSize = [[d, h], [d, h], [0, 0], [0, 0], [w, h], [w, h]]
  for (let face = 0; face < 6; face++) {
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v
      uv.setXY(i, (uv.getX(i) * faceSize[face][0]) / WINDOW_TILE, (uv.getY(i) * faceSize[face][1]) / WINDOW_TILE)
    }
  }
  return geometry
}

const pushBoxEdges = (out: number[], x: number, z: number, w: number, h: number, d: number) => {
  const c = [
    [x - w / 2, 0, z - d / 2], [x + w / 2, 0, z - d / 2], [x + w / 2, 0, z + d / 2], [x - w / 2, 0, z + d / 2],
    [x - w / 2, h, z - d / 2], [x + w / 2, h, z - d / 2], [x + w / 2, h, z + d / 2], [x - w / 2, h, z + d / 2],
  ]
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
  for (const [a, b] of edges) out.push(...c[a], ...c[b])
}

export const createBackground = (scene: THREE.Scene) => {
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item)
    return item
  }

  scene.background = track(makeSkyTexture())
  scene.fog = new THREE.Fog(PALETTE.fog, 5, 32)
  const group = new THREE.Group()
  scene.add(group)

  const rand = seeded(7)
  const boxes: THREE.BufferGeometry[] = []
  const edges: number[] = []
  const color = new THREE.Color()
  for (let i = 0; i < 70; i++) {
    const x = (rand() - 0.5) * 36
    const z = -5 - rand() * 26
    /* keep the strip directly behind the character lower so it doesn't
       just read as a wall growing out of their shoulders */
    const nearCenter = Math.abs(x) < 3 && z > -12
    const w = 1.2 + rand() * 3.2
    const d = 1.2 + rand() * 3
    const h = nearCenter ? 1 + rand() * 2.5 : 2 + rand() * 9
    const geometry = buildingGeometry(w, h, d)
    geometry.translate(x, h / 2, z)
    color.setHSL(0.6 + rand() * 0.05, 0.9, 0.5 + rand() * 0.12)
    const count = geometry.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let v = 0; v < count; v++) color.toArray(colors, v * 3)
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    boxes.push(geometry)
    pushBoxEdges(edges, x, z, w, h, d)
  }
  /* long low school-like block across the middle distance */
  const school = buildingGeometry(16, 3.2, 3)
  school.translate(-2, 1.6, -9)
  const schoolColors = new Float32Array(school.getAttribute('position').count * 3)
  color.set(0x6f8cff)
  for (let v = 0; v < schoolColors.length / 3; v++) color.toArray(schoolColors, v * 3)
  school.setAttribute('color', new THREE.BufferAttribute(schoolColors, 3))
  boxes.push(school)
  pushBoxEdges(edges, -2, -9, 16, 3.2, 3)

  const city = track(mergeGeometries(boxes))
  boxes.forEach((b) => b.dispose())
  const windowTexture = track(makeWindowTexture())
  const cityMaterial = track(noOutline(new THREE.MeshBasicMaterial({ map: windowTexture, vertexColors: true })))
  group.add(new THREE.Mesh(city, cityMaterial))

  const edgeGeometry = track(new THREE.BufferGeometry())
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3))
  const edgeMaterial = track(new THREE.LineBasicMaterial({ color: 0xd9f6ff, transparent: true, opacity: 0.55 }))
  group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial))

  const groundGeometry = track(new THREE.PlaneGeometry(200, 200))
  const groundMaterial = track(noOutline(new THREE.MeshBasicMaterial({ color: 0x3b2bc4 })))
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  group.add(ground)

  /* big white diagonal slashes behind the character, unaffected by fog */
  const slashTexture = track(makeSlashTexture())
  const slashGeometry = track(new THREE.PlaneGeometry(1, 1))
  const slashMaterial = track(noOutline(new THREE.MeshBasicMaterial({ map: slashTexture, fog: false })))
  const thinMaterial = track(noOutline(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.85 })))
  const slash = new THREE.Mesh(slashGeometry, slashMaterial)
  slash.position.set(0.95, 1.05, -2.2)
  slash.rotation.z = 1.05
  slash.scale.set(4.5, 0.7, 1)
  group.add(slash)
  const thin = new THREE.Mesh(slashGeometry, thinMaterial)
  thin.position.set(-0.9, 1.5, -2.6)
  thin.rotation.z = 1.05
  thin.scale.set(5, 0.06, 1)
  group.add(thin)

  /* slow rising bubbles — the source's background has that underwater drift */
  const BUBBLES = 140
  const bubblePositions = new Float32Array(BUBBLES * 3)
  const bubbleSpeed = new Float32Array(BUBBLES)
  for (let i = 0; i < BUBBLES; i++) {
    bubblePositions.set([(rand() - 0.5) * 8, rand() * 4, -1.5 - rand() * 6], i * 3)
    bubbleSpeed[i] = 0.05 + rand() * 0.12
  }
  const bubbleGeometry = track(new THREE.BufferGeometry())
  bubbleGeometry.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3))
  const bubbleMaterial = track(
    new THREE.PointsMaterial({ color: 0xc8fbff, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
  )
  const bubbles = new THREE.Points(bubbleGeometry, bubbleMaterial)
  group.add(bubbles)

  return {
    group,
    update: (dt: number) => {
      for (let i = 0; i < BUBBLES; i++) {
        let y = bubblePositions[i * 3 + 1] + bubbleSpeed[i] * dt
        if (y > 4) y = 0
        bubblePositions[i * 3 + 1] = y
      }
      bubbleGeometry.getAttribute('position').needsUpdate = true
    },
    dispose: () => disposables.forEach((d) => d.dispose()),
  }
}
