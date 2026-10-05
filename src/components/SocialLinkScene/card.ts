import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { noOutline } from './toon'

export type CardFace = {
  /** art for the card window — any image URL */
  image?: string
  /** 'cover' crops to fill (illustrations), 'contain' letterboxes (logos) */
  imageFit?: 'cover' | 'contain'
  title: string
  subtitle?: string
  /** small badge above the title, e.g. arcana numeral "0", "IV" */
  numeral?: string
}

export const CARD_W = 0.09
export const CARD_H = 0.14
const CARD_D = 0.003
const TEX_W = 768
const TEX_H = Math.round((TEX_W * CARD_H) / CARD_W)

export const faceKey = (face: CardFace) =>
  [face.image ?? '', face.imageFit ?? 'cover', face.title, face.subtitle ?? '', face.numeral ?? ''].join('\u0000')

const loadImage = (src: string) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  return img
    .decode()
    .then(() => img)
    .catch(() => null)
}

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/* largest size (down to `min`) at which `text` fits on one line */
const fitFont = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, max: number, min: number, font: (px: number) => string) => {
  let size = max
  ctx.font = font(size)
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2
    ctx.font = font(size)
  }
  return size
}

const TITLE_FONT = (px: number) => `italic 900 ${px}px "Eurostile Extended", Arial, sans-serif`
const SUB_FONT = (px: number) => `600 ${px}px Arial, Helvetica, sans-serif`
const NUMERAL_FONT = (px: number) => `italic 700 ${px}px Georgia, "Times New Roman", serif`

const newCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  return [canvas, canvas.getContext('2d')!] as const
}

const toTexture = (canvas: HTMLCanvasElement, anisotropy: number) => {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = anisotropy
  return texture
}

/* tarot-style face: silver frame, art window, name plate at the bottom */
export const drawCardFace = async (face: CardFace, anisotropy: number) => {
  const [image] = await Promise.all([
    face.image ? loadImage(face.image) : null,
    document.fonts.load(TITLE_FONT(64)).catch(() => {}),
  ])
  const [canvas, ctx] = newCanvas()
  const M = 34
  const PLATE_H = face.subtitle ? 236 : 186

  ctx.fillStyle = '#0a0d36'
  ctx.fillRect(0, 0, TEX_W, TEX_H)
  ctx.strokeStyle = '#e9f1ff'
  ctx.lineWidth = 14
  roundRect(ctx, M / 2, M / 2, TEX_W - M, TEX_H - M, 26)
  ctx.stroke()

  const art = { x: M + 18, y: M + 18, w: TEX_W - (M + 18) * 2, h: TEX_H - (M + 18) * 2 - PLATE_H }
  ctx.save()
  roundRect(ctx, art.x, art.y, art.w, art.h, 10)
  ctx.clip()
  const bg = ctx.createLinearGradient(0, art.y, 0, art.y + art.h)
  bg.addColorStop(0, '#2340b8')
  bg.addColorStop(1, '#120a52')
  ctx.fillStyle = bg
  ctx.fillRect(art.x, art.y, art.w, art.h)
  if (image) {
    const cover = (face.imageFit ?? 'cover') === 'cover'
    const pad = cover ? 0 : 60
    const boxW = art.w - pad * 2
    const boxH = art.h - pad * 2
    const ratio = cover
      ? Math.max(boxW / image.naturalWidth, boxH / image.naturalHeight)
      : Math.min(boxW / image.naturalWidth, boxH / image.naturalHeight, 2)
    const w = image.naturalWidth * ratio
    const h = image.naturalHeight * ratio
    ctx.drawImage(image, art.x + (art.w - w) / 2, art.y + (art.h - h) / 2, w, h)
  } else {
    ctx.strokeStyle = 'rgba(160, 230, 255, 0.35)'
    ctx.lineWidth = 3
    for (let r = 40; r < art.w; r += 46) {
      ctx.beginPath()
      ctx.arc(art.x + art.w / 2, art.y + art.h / 2, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()
  ctx.strokeStyle = '#9fb4ff'
  ctx.lineWidth = 4
  roundRect(ctx, art.x, art.y, art.w, art.h, 10)
  ctx.stroke()

  const plate = { x: art.x, y: art.y + art.h + 16, w: art.w, h: PLATE_H - 16 }
  ctx.fillStyle = '#141c68'
  roundRect(ctx, plate.x, plate.y, plate.w, plate.h, 12)
  ctx.fill()
  ctx.strokeStyle = '#e9f1ff'
  ctx.lineWidth = 4
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = TEX_W / 2

  if (face.numeral) {
    const badgeY = plate.y
    ctx.font = NUMERAL_FONT(46)
    const bw = Math.max(70, ctx.measureText(face.numeral).width + 40)
    ctx.fillStyle = '#0a0d36'
    roundRect(ctx, cx - bw / 2, badgeY - 30, bw, 60, 30)
    ctx.fill()
    ctx.strokeStyle = '#e9f1ff'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(face.numeral, cx, badgeY + 2)
  }

  const textMax = plate.w - 48
  const titleY = plate.y + (face.subtitle ? plate.h * 0.42 : plate.h * 0.55)
  fitFont(ctx, face.title, textMax, 64, 30, TITLE_FONT)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(face.title, cx, titleY)

  if (face.subtitle) {
    fitFont(ctx, face.subtitle, textMax, 36, 20, SUB_FONT)
    ctx.fillStyle = '#9fe8ff'
    ctx.fillText(face.subtitle, cx, plate.y + plate.h * 0.76)
  }

  return toTexture(canvas, anisotropy)
}

const drawCardBack = (anisotropy: number) => {
  const [canvas, ctx] = newCanvas()
  ctx.fillStyle = '#0a0d36'
  ctx.fillRect(0, 0, TEX_W, TEX_H)
  ctx.strokeStyle = '#e9f1ff'
  ctx.lineWidth = 14
  roundRect(ctx, 17, 17, TEX_W - 34, TEX_H - 34, 26)
  ctx.stroke()
  const cx = TEX_W / 2
  const cy = TEX_H / 2
  ctx.strokeStyle = '#7fa2ff'
  ctx.lineWidth = 4
  for (let r = 60; r < 330; r += 54) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#9fe8ff'
  ctx.beginPath()
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 46 : 150
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fill()
  return toTexture(canvas, anisotropy)
}

/* card mesh with its origin at the top-centre — the point the lanyard ties
   to — so positioning it is just "put the tie point here" */
export const createCardMesh = (anisotropy: number) => {
  const geometry = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D)
  geometry.translate(0, -CARD_H / 2, 0)
  const edge = noOutline(new THREE.MeshBasicMaterial({ color: 0xc8d4ff }))
  const front = noOutline(new THREE.MeshBasicMaterial({ color: 0xffffff }))
  const backTexture = drawCardBack(anisotropy)
  const back = noOutline(new THREE.MeshBasicMaterial({ map: backTexture }))
  const mesh = new THREE.Mesh(geometry, [edge, edge, edge, edge, front, back])

  return {
    mesh,
    setFrontTexture: (texture: THREE.Texture) => {
      front.map?.dispose()
      front.map = texture
      front.needsUpdate = true
    },
    dispose: () => {
      geometry.dispose()
      edge.dispose()
      front.map?.dispose()
      front.dispose()
      back.dispose()
      backTexture.dispose()
    },
  }
}

/* lanyard as a fixed-count polyline whose vertex buffer is rewritten in
   place each frame — LineSegmentsGeometry.setPositions() allocates a fresh
   GPU buffer per call, which would leak at 60fps */
export const createLanyard = (pointCount: number) => {
  const segments = new Float32Array((pointCount - 1) * 6)
  const geometry = new LineSegmentsGeometry()
  geometry.setPositions(segments)
  const material = new LineMaterial({ color: 0x14123a, linewidth: 2.2, worldUnits: false })
  const line = new LineSegments2(geometry, material)
  line.frustumCulled = false
  const buffer = (geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute).data

  return {
    line,
    material,
    setPoints: (points: THREE.Vector3[]) => {
      const array = buffer.array as Float32Array
      for (let i = 0; i < pointCount - 1; i++) {
        points[i].toArray(array, i * 6)
        points[i + 1].toArray(array, i * 6 + 3)
      }
      buffer.needsUpdate = true
    },
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}
