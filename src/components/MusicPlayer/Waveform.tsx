import { useEffect, useRef } from 'react'
import { useMusicPlayer } from '../../hooks/MusicPlayer'

const BARS = 32
/*
 * Only the lower slice of the spectrum is worth drawing — the top bins are
 * mostly air and would sit dead flat. This keeps the bars responding to the
 * drums and bass, which is what reads as "on the beat".
 */
const SPECTRUM_USED = 0.55

export const Waveform = () => {
  const { analyser, playing } = useMusicPlayer()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
    }
    resize()

    const bins = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    const usable = bins ? Math.floor(bins.length * SPECTRUM_USED) : 0
    /* idle bars decay toward the floor instead of snapping flat on pause */
    const levels = new Float32Array(BARS)

    let frame = 0
    const draw = () => {
      const { width, height } = canvas
      context.clearRect(0, 0, width, height)

      if (analyser && bins && playing) {
        analyser.getByteFrequencyData(bins)
      }

      const gap = 2 * dpr
      const barWidth = (width - gap * (BARS - 1)) / BARS
      const gradient = context.createLinearGradient(0, height, 0, 0)
      gradient.addColorStop(0, '#ff0099')
      gradient.addColorStop(1, '#59d8f2')
      context.fillStyle = gradient

      for (let i = 0; i < BARS; i += 1) {
        let target = 0

        if (analyser && bins && playing) {
          /* average the bins that fall into this bar */
          const from = Math.floor((i / BARS) * usable)
          const to = Math.max(from + 1, Math.floor(((i + 1) / BARS) * usable))
          let sum = 0
          for (let b = from; b < to; b += 1) sum += bins[b]
          target = sum / (to - from) / 255
        }

        /* ease toward the target so the bars glide rather than jitter */
        levels[i] += (target - levels[i]) * 0.35

        const barHeight = Math.max(1.5 * dpr, levels[i] * height)
        context.fillRect(i * (barWidth + gap), height - barHeight, barWidth, barHeight)
      }

      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [analyser, playing])

  return <canvas ref={canvasRef} className="music-player-wave" aria-hidden="true" />
}
