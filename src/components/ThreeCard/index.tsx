import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import './ThreeCard.css'

type ThreeCardProps = {
  title: string
  subtitle: string
  /** transparent logo drawn above the title on the card's face */
  logoSrc?: string
}

/* tarot-card proportions, matching the source UI's card */
const CARD_WIDTH = 2.2
const CARD_HEIGHT = 3.3

/* box the logo is fitted into on the 512x768 face canvas, centered
   horizontally — the title block moves down underneath it when present */
const LOGO_BOX = { width: 340, height: 220, centerY: 210 }
/* vertical center of the title+subtitle block, with and without a logo */
const TEXT_CENTER_WITH_LOGO = 520
const TEXT_CENTER_ALONE = 384

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word
    if (ctx.measureText(attempt).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = attempt
    }
  }
  if (line) lines.push(line)
  return lines
}

/* resolves to null instead of rejecting, so a missing/broken logo just
   leaves the card text-only rather than blocking it from mounting */
const loadImage = (src: string) => {
  const img = new Image()
  img.src = src
  return img
    .decode()
    .then(() => img)
    .catch(() => null)
}

/* draws a face onto a canvas and hands it back as a texture — the back is
   a procedurally drawn placeholder, the face gets the company logo (when
   there is one) above the title */
const makeFaceTexture = (isBack: boolean, title: string, subtitle: string, logo: HTMLImageElement | null) => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 768
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  grad.addColorStop(0, '#1c1c2c')
  grad.addColorStop(1, '#050208')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 10
  ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44)
  ctx.lineWidth = 2
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (isBack) {
    ctx.fillStyle = '#e3123b'
    ctx.font = 'italic 900 220px "Eurostile Extended", Arial, sans-serif'
    ctx.fillText('?', canvas.width / 2, canvas.height / 2)
  } else {
    if (logo) {
      /* contain-fit, never upscaled past 1.5x so small logos don't go soft */
      const scale = Math.min(LOGO_BOX.width / logo.naturalWidth, LOGO_BOX.height / logo.naturalHeight, 1.5)
      const w = logo.naturalWidth * scale
      const h = logo.naturalHeight * scale
      ctx.drawImage(logo, (canvas.width - w) / 2, LOGO_BOX.centerY - h / 2, w, h)
    }

    ctx.font = 'italic 900 56px "Eurostile Extended", Arial, sans-serif'
    const titleLines = wrapLines(ctx, title, canvas.width - 120)
    const lineHeight = 64

    ctx.font = '30px Arial, sans-serif'
    const subtitleLines = wrapLines(ctx, subtitle, canvas.width - 120)
    const subtitleLineHeight = 36

    const gap = 40
    const blockHeight =
      titleLines.length * lineHeight + gap + (subtitleLines.length - 1) * subtitleLineHeight
    const textCenter = logo ? TEXT_CENTER_WITH_LOGO : TEXT_CENTER_ALONE
    const startY = textCenter - blockHeight / 2

    ctx.fillStyle = '#ffffff'
    ctx.font = 'italic 900 56px "Eurostile Extended", Arial, sans-serif'
    titleLines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, startY + i * lineHeight))

    ctx.fillStyle = '#cfcfcf'
    ctx.font = '30px Arial, sans-serif'
    const subtitleStartY = startY + titleLines.length * lineHeight + gap
    subtitleLines.forEach((line, i) =>
      ctx.fillText(line, canvas.width / 2, subtitleStartY + i * subtitleLineHeight),
    )
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/* sets up the scene and its render loop, returns a cleanup function — split
   out so the effect can delay this until the card's font has actually
   loaded (see below) without nesting the whole thing in a .then()) */
const mountScene = (mount: HTMLDivElement, title: string, subtitle: string, logo: HTMLImageElement | null) => {
  const width = mount.clientWidth
  const height = mount.clientHeight

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100)
  camera.position.set(0, 0, 10)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  mount.appendChild(renderer.domElement)

  const geometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT)
  const frontTexture = makeFaceTexture(false, title, subtitle, logo)
  const backTexture = makeFaceTexture(true, title, subtitle, null)
  const frontMaterial = new THREE.MeshStandardMaterial({ map: frontTexture, side: THREE.FrontSide })
  const backMaterial = new THREE.MeshStandardMaterial({ map: backTexture, side: THREE.BackSide })

  /* two meshes sharing one plane's geometry+transform: FrontSide only
     draws when facing the camera, BackSide only when facing away — so
     together they act like a single double-sided card without needing a
     second, mirrored geometry */
  const group = new THREE.Group()
  group.add(new THREE.Mesh(geometry, frontMaterial))
  group.add(new THREE.Mesh(geometry, backMaterial))
  scene.add(group)

  scene.add(new THREE.AmbientLight(0x8090ff, 1.4))
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(2, 3, 4)
  scene.add(key)

  /* mostly a horizontal (Y-axis) flip, tilted 10% toward diagonal rather
     than dead-straight */
  const FLIP_AXIS = new THREE.Vector3(0.1, 1, 0).normalize()
  const ROLL_AXIS = new THREE.Vector3(0, 0, 1)
  const flipQuat = new THREE.Quaternion()
  const rollQuat = new THREE.Quaternion()
  /* while floating, the card also rocks side to side between -5% and
     +5% of a full turn */
  const ROLL_AMOUNT = Math.PI * 0.05

  let frame = 0
  const start = performance.now()
  const FLIP_DURATION = 1.1
  /* rest height the float bobs around — the whole card sits a bit lower
     than center, and the bob dips further down from there rather than
     rising above it */
  const FLOAT_BASE_Y = -0.15
  const FLOAT_AMOUNT = 0.18

  const tick = (now: number) => {
    const elapsed = (now - start) / 1000

    /* floats continuously, flip included, rather than only once settled —
       biased downward: bob only ever dips below the resting height */
    const bob = -Math.abs(Math.sin(elapsed * 1.1)) * FLOAT_AMOUNT
    group.position.set(0, FLOAT_BASE_Y + bob, 0)

    if (elapsed < FLIP_DURATION) {
      /* back-out ease: overshoots past the resting angle before settling
         back, so the flip has some snap to it instead of gliding to a
         flat stop */
      const t = Math.min(elapsed / FLIP_DURATION, 1)
      const c1 = 1.70158
      const c3 = c1 + 1
      const settle = t - 1
      const eased = 1 + c3 * settle * settle * settle + c1 * settle * settle
      const angle = Math.PI * (1 - eased)
      group.quaternion.setFromAxisAngle(FLIP_AXIS, angle)
    } else {
      const idle = elapsed - FLIP_DURATION
      /* gentle hanging sway once the reveal settles, plus a side-to-side
         rock between -5% and +5% of a full turn */
      flipQuat.setFromAxisAngle(FLIP_AXIS, Math.sin(idle * 0.6) * 0.3)
      rollQuat.setFromAxisAngle(ROLL_AXIS, Math.sin(idle * 0.45) * ROLL_AMOUNT)
      group.quaternion.copy(flipQuat).multiply(rollQuat)
    }

    renderer.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)

  const onResize = () => {
    const w = mount.clientWidth
    const h = mount.clientHeight
    if (w === 0 || h === 0) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  window.addEventListener('resize', onResize)

  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', onResize)
    geometry.dispose()
    frontMaterial.dispose()
    backMaterial.dispose()
    frontTexture.dispose()
    backTexture.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
}

/** P3 Social Link-style card: floats mid-air with a downward-biased bob,
    flips horizontally from its back to its face on mount with a bit of
    overshoot, then settles into a slow horizontal sway — a plain three.js
    scene rendered into its own canvas rather than a DOM element, since the
    request specifically asked for a real 3D card rather than the earlier
    CSS 3D-transform version. */
export const ThreeCard = ({ title, subtitle, logoSrc }: ThreeCardProps) => {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let cancelled = false
    let cleanup = () => {}

    /* canvas text draws synchronously against whatever font is already
       loaded — without waiting here, the first paint silently falls back
       to Arial instead of Eurostile Extended, since the canvas has no
       equivalent of CSS's "swap once the webfont arrives". The logo is
       baked into the same texture, so it's waited on alongside. */
    const fonts = Promise.all([
      document.fonts.load('italic 900 56px "Eurostile Extended"'),
      document.fonts.load('900 220px "Eurostile Extended"'),
    ]).catch(() => {})
    const logo = logoSrc ? loadImage(logoSrc) : Promise.resolve(null)

    void Promise.all([fonts, logo]).then(([, image]) => {
      if (cancelled) return
      cleanup = mountScene(mount, title, subtitle, image)
    })

    return () => {
      cancelled = true
      cleanup()
    }
  }, [title, subtitle, logoSrc])

  return <div ref={mountRef} className="three-card" />
}
