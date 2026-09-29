import { useLayoutEffect, useRef } from 'react'

let measureCanvas: HTMLCanvasElement | null = null

const measureTextWidth = (text: string, font: string) => {
  measureCanvas ??= document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = font
  return ctx.measureText(text).width
}

/** Shrinks a text element's font-size, down from whatever the CSS gave it,
    just enough that `text` fits its parent's width instead of overflowing or
    wrapping onto the next row. Re-measures on resize since the row scales
    with the viewport, and different rows carry very different text lengths
    (e.g. "Backend Developer" vs "Software Development Engineer") so each
    needs its own size rather than one fixed value for the whole list. */
export const useFitText = (text: string) => {
  const ref = useRef<HTMLSpanElement>(null)
  const maxPxRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return

    /* captured once, before any shrinking, so it's always the CSS-authored
       ceiling rather than a previously-shrunk value */
    if (maxPxRef.current === null) {
      el.style.fontSize = ''
      maxPxRef.current = parseFloat(getComputedStyle(el).fontSize)
    }
    const maxPx = maxPxRef.current

    const fit = () => {
      const available = parent.clientWidth
      if (available <= 0) return
      const style = getComputedStyle(el)
      const font = `${style.fontWeight} ${style.fontStyle} ${maxPx}px ${style.fontFamily}`
      const widthAtMax = measureTextWidth(text, font)
      el.style.fontSize = widthAtMax > available ? `${Math.max(10, (available / widthAtMax) * maxPx)}px` : ''
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [text])

  return ref
}
