import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation, useOutlet } from 'react-router'
import './RouteTransition.css'

type Exiting = { key: string; node: ReactNode }

/*
 * Renders the current route (from useOutlet, in place of <Outlet/>) and,
 * for a moment after every navigation, the *previous* route sitting behind
 * it, fully visible and unclipped. The live/incoming page is clip-path'd
 * down to the union of two circles that grow from 0 to full-cover — so it
 * looks like the old page (behind, plain) gets progressively painted over
 * by the new page, revealed through the growing circles.
 *
 * This clips the INCOMING page rather than masking the OUTGOING one (an
 * earlier version did it that way round) because `mask-image` silently
 * breaks compositing for anything on its own GPU layer inside the masked
 * subtree — a <video>, or MenuItem's animated clip-path slash highlight,
 * would just fail to paint at all. `clip-path` doesn't have that problem,
 * but it also can't easily express "everywhere except these two circles"
 * (that's a donut shape, needs even-odd fill-rule path math); clipping the
 * live page to "just these two circles" is the same visual result and is
 * simple geometry.
 */
export const RouteTransition = () => {
  const location = useLocation()
  const outlet = useOutlet()

  const prevKey = useRef(location.key)
  const prevNode = useRef(outlet)
  const [exiting, setExiting] = useState<Exiting | null>(null)

  if (prevKey.current !== location.key) {
    setExiting({ key: prevKey.current, node: prevNode.current })
    prevKey.current = location.key
  }
  prevNode.current = outlet

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(() => setExiting(null), 950)
    return () => clearTimeout(timer)
  }, [exiting])

  const clipId = exiting ? `route-enter-clip-${exiting.key}` : null

  return (
    <>
      {exiting && (
        <div className="route-exit-old" aria-hidden="true">
          {exiting.node}
        </div>
      )}

      <div className="route-enter" style={clipId ? ({ clipPath: `url(#${clipId})` } as CSSProperties) : undefined}>
        {outlet}
      </div>

      {clipId && (
        <svg className="route-enter-clip-defs" aria-hidden="true">
          <clipPath id={clipId}>
            <circle className="route-enter-circle" style={{ cx: '80%', cy: '20%', r: 0 } as CSSProperties} />
            <circle className="route-enter-circle" style={{ cx: '20%', cy: '80%', r: 0 } as CSSProperties} />
          </clipPath>
        </svg>
      )}
    </>
  )
}
