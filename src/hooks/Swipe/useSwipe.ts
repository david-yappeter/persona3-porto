import { useEffect, useRef } from 'react'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

/* a quick, mostly straight one-finger flick */
const MIN_DISTANCE = 60
const MAX_TIME = 700
/* the main axis has to beat the other by this much */
const DOMINANCE = 1.5

/** set while a lab's touch camera owns one-finger drags (labCamera.ts) */
export const SWIPE_BLOCKED_ATTR = 'data-swipe-blocked'

/* touches that belong to a control: sliders, inputs, the lab panel */
const ownedByControl = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('input, textarea, select, .lil-gui, [data-no-swipe]')

/** Calls `onSwipe` for one-finger flicks anywhere on the page (touch
    only — a mouse drag never counts). The latest callback is used, so it
    can close over fresh state without re-binding. */
export const useSwipe = (onSwipe: (direction: SwipeDirection) => void, enabled = true) => {
  const callback = useRef(onSwipe)
  callback.current = onSwipe

  useEffect(() => {
    if (!enabled) return
    let start: { x: number; y: number; t: number } | null = null
    const onStart = (e: TouchEvent) => {
      start =
        e.touches.length === 1 && !ownedByControl(e.target) && !document.body.hasAttribute(SWIPE_BLOCKED_ATTR)
          ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() }
          : null
    }
    const onEnd = (e: TouchEvent) => {
      const s = start
      start = null
      if (!s || e.changedTouches.length !== 1 || performance.now() - s.t > MAX_TIME) return
      const dx = e.changedTouches[0].clientX - s.x
      const dy = e.changedTouches[0].clientY - s.y
      if (Math.abs(dx) >= MIN_DISTANCE && Math.abs(dx) > DOMINANCE * Math.abs(dy)) {
        callback.current(dx > 0 ? 'right' : 'left')
      } else if (Math.abs(dy) >= MIN_DISTANCE && Math.abs(dy) > DOMINANCE * Math.abs(dx)) {
        callback.current(dy > 0 ? 'down' : 'up')
      }
    }
    const onCancel = () => {
      start = null
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onCancel)
    }
  }, [enabled])
}
