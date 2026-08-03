import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { resumeVideoAt } from '../../resumeVideo'
import type { RouteTransitionEffectProps } from '../../types'
import './DoubleRipple.css'

/* keep in sync with DoubleRipple.css's animation-duration/animation-delay */
const RIPPLE_DURATION_MS = 375
const RIPPLE_STAGGER_MS = 100
const TOTAL_MS = RIPPLE_DURATION_MS + RIPPLE_STAGGER_MS

/*
 * Wobbly closed blob, ~72-118 units from its own center (0,0) — stands in
 * for a plain circle so the ripple reads as an organic "jelly" splash
 * rather than a perfect ring. Generated once via Catmull-Rom smoothing over
 * 8 hand-picked radii (not regenerated at runtime, so the shape is stable).
 */
// const BLOB_PATH =
//   'M 100.00,0.00 C 99.06,19.80 73.24,37.40 56.57,56.57 C 39.90,75.74 17.91,115.94 0.00,115.00 C -17.91,114.06 -32.91,70.08 -50.91,50.91 C -68.91,31.75 -106.82,18.15 -108.00,0.00 C -109.18,-18.15 -75.98,-38.32 -57.98,-57.98 C -39.98,-77.65 -20.03,-117.29 -0.00,-118.00 C 20.03,-118.71 45.56,-81.89 62.23,-62.23 C 78.89,-42.56 100.94,-19.80 100.00,0.00 Z'

const BLOB_PATH = `
M 102 0
C 98 24 78 40 62 56
C 42 78 18 118 -8 122
C -36 126 -82 94 -104 54
C -122 20 -120 -30 -98 -62
C -72 -98 -22 -126 24 -118
C 54 -112 82 -82 98 -48
C 112 -20 112 -8 102 0
Z
`;

/** the blob's narrowest lobe, in the same local units as BLOB_PATH — the
    scale target has to clear the viewport diagonal even along this lobe,
    not just the average radius, or the corner opposite it stays uncovered */
const BLOB_MIN_RADIUS = 72

type Origin = { x: number; y: number; scale: number }

/*
 * SVG <path> data has no percentage-based placement the way <circle>'s
 * cx/cy/r do, so the 20%/20% origin and the "grow past every corner" scale
 * target both have to be resolved from real pixel measurements instead —
 * measured off `liveRef` since it always matches the clip-defs SVG's box.
 */
function measureOrigin(el: HTMLElement): Origin {
  const rect = el.getBoundingClientRect()
  const diagonal = Math.hypot(rect.width, rect.height)
  return {
    x: rect.width * 0.2,
    y: rect.height * 0.2,
    scale: (diagonal / BLOB_MIN_RADIUS) * 1.05,
  }
}

/*
 * Two ripples grown from the same single origin (top-left, 20%/20%),
 * staggered 200ms apart instead of simultaneous:
 *  - the first ripple only clips a heavy blue flash div, painted over the
 *    outgoing (ghost) page — it doesn't touch the incoming page at all
 *  - the second, chasing 200ms behind the first, clips the live/incoming
 *    page in through that flash — same mechanic CircleReveal uses alone
 *
 * Same liveRef-only rule as CircleReveal applies: this never renders the
 * live content itself, only applies clip-path/classes to RouteTransition's
 * permanently-owned node, see types.ts's comment on liveRef for why.
 */
export const DoubleRippleTransition = ({ exiting, liveRef, onExitComplete }: RouteTransitionEffectProps) => {
  const flashClipId = `double-ripple-flash-clip-${exiting.key}`
  const revealClipId = `double-ripple-reveal-clip-${exiting.key}`
  const [origin, setOrigin] = useState<Origin | null>(null)

  useLayoutEffect(() => {
    const live = liveRef.current
    if (!live) return
    setOrigin(measureOrigin(live))
    // re-measure per transition, not just once — a stable liveRef alone
    // wouldn't re-fire this on the next exiting.key
  }, [liveRef, exiting.key])

  useLayoutEffect(() => {
    const live = liveRef.current
    if (!live) return
    live.classList.add('double-ripple-enter')
    live.style.clipPath = `url(#${revealClipId})`
    return () => {
      live.classList.remove('double-ripple-enter')
      live.style.clipPath = ''
    }
  }, [revealClipId, liveRef])

  useEffect(() => {
    resumeVideoAt('.double-ripple-exit-old video', exiting.videoTime)
    const timer = setTimeout(onExitComplete, TOTAL_MS)
    return () => clearTimeout(timer)
    // only the outgoing page's identity should restart this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting.key])

  return (
    <>
      <div className="double-ripple-exit-old" aria-hidden="true">
        {exiting.node}
      </div>

      <div
        className="double-ripple-flash"
        style={{ clipPath: `url(#${flashClipId})` } as CSSProperties}
        aria-hidden="true"
      />

      {origin && (
        <svg className="double-ripple-clip-defs" aria-hidden="true">
          {/*
           * <clipPath> only honors direct shape children in this browser —
           * a <path> wrapped in a <g> (even just for the translate/scale)
           * silently clips away to nothing, no error, no fallback. Confirmed
           * via an isolated test page before landing this. So the origin
           * and scale go on the <path> itself, as CSS custom properties the
           * keyframe below reads, instead of a wrapping transform.
           */}
          <clipPath id={flashClipId}>
            <path
              className="double-ripple-blob double-ripple-blob--flash"
              style={{ '--blob-x': `${origin.x}px`, '--blob-y': `${origin.y}px`, '--blob-scale': origin.scale } as CSSProperties}
              d={BLOB_PATH}
            />
          </clipPath>
          <clipPath id={revealClipId}>
            <path
              className="double-ripple-blob double-ripple-blob--reveal"
              style={{ '--blob-x': `${origin.x}px`, '--blob-y': `${origin.y}px`, '--blob-scale': origin.scale } as CSSProperties}
              d={BLOB_PATH}
            />
          </clipPath>
        </svg>
      )}
    </>
  )
}
