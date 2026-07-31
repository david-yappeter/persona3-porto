import { useEffect, useLayoutEffect, type CSSProperties } from 'react'
import { resumeVideoAt } from '../../resumeVideo'
import type { RouteTransitionEffectProps } from '../../types'
import './CircleReveal.css'

/*
 * Renders the outgoing page behind, fully visible and unclipped, and clips
 * the live/incoming page (RouteTransition's own ".route-live" node, via
 * liveRef) down to the union of two circles that grow from 0 to full-cover
 * — so it looks like the old page gets progressively painted over by the
 * new one, revealed through the growing circles.
 *
 * This clips the INCOMING page rather than masking the OUTGOING one because
 * `mask-image` silently breaks compositing for anything on its own GPU
 * layer inside the masked subtree — a <video>, or MenuItem's animated
 * clip-path slash highlight, would just fail to paint at all. `clip-path`
 * doesn't have that problem, but it also can't easily express "everywhere
 * except these two circles" (that's a donut shape, needs even-odd fill-rule
 * path math); clipping the live page to "just these two circles" is the
 * same visual result and is simple geometry.
 */
export const CircleRevealTransition = ({ exiting, liveRef, onExitComplete }: RouteTransitionEffectProps) => {
  const clipId = `route-enter-clip-${exiting.key}`

  useLayoutEffect(() => {
    const live = liveRef.current
    if (!live) return
    live.classList.add('route-enter')
    live.style.clipPath = `url(#${clipId})`
    return () => {
      live.classList.remove('route-enter')
      live.style.clipPath = ''
    }
  }, [clipId, liveRef])

  useEffect(() => {
    resumeVideoAt('.route-exit-old video', exiting.videoTime)
    // keep in sync with route-enter-grow's duration in CircleReveal.css
    const timer = setTimeout(onExitComplete, 750)
    return () => clearTimeout(timer)
    // only the outgoing page's identity should restart this — onExitComplete
    // and videoTime are stable for the lifetime of a given exiting.key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting.key])

  return (
    <>
      <div className="route-exit-old" aria-hidden="true">
        {exiting.node}
      </div>

      <svg className="route-enter-clip-defs" aria-hidden="true">
        <clipPath id={clipId}>
          <circle className="route-enter-circle" style={{ cx: '80%', cy: '20%', r: 0 } as CSSProperties} />
          <circle className="route-enter-circle" style={{ cx: '20%', cy: '80%', r: 0 } as CSSProperties} />
        </clipPath>
      </svg>
    </>
  )
}
