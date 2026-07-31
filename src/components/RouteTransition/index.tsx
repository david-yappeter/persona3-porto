import { useRef, useState, type ComponentType } from 'react'
import { useLocation, useOutlet } from 'react-router'
import './RouteTransition.css'
import { CircleRevealTransition } from './transitions/CircleReveal'
import {
  RouteTransitionKind,
  type ExitingRoute,
  type RouteTransitionEffectProps,
  type RouteTransitionRule,
} from './types'

export { RouteTransitionKind }
export type { RouteTransitionRule }

type RouteTransitionProps = {
  /** used for any from/to pair not covered by `rules` */
  defaultKind: RouteTransitionKind
  /** per-direction overrides — e.g. "/" -> "/skill" can play a different
      transition than "/skill" -> "/" */
  rules?: RouteTransitionRule[]
}

/* add a new transition: a RouteTransitionKind member + an effect component
   matching RouteTransitionEffectProps, registered here. Nothing else needs
   to change. */
const EFFECTS: Record<RouteTransitionKind, ComponentType<RouteTransitionEffectProps>> = {
  [RouteTransitionKind.CircleReveal]: CircleRevealTransition,
}

type Exiting = ExitingRoute & { kind: RouteTransitionKind }

/*
 * Renders the current route (from useOutlet, in place of <Outlet/>) inside
 * a single ".route-live" div that this component owns and renders itself,
 * unconditionally, for its entire lifetime — effects (./transitions) style
 * it imperatively via `liveRef` rather than rendering it themselves. An
 * earlier version had each effect wrap the live content in its own JSX;
 * that meant the live page briefly had a *different React parent* at the
 * exact moment a transition started or ended, which forces a real
 * unmount/remount of the whole page (and a visible flicker) on top of
 * whatever the actual route change was already doing.
 */
export const RouteTransition = ({ defaultKind, rules }: RouteTransitionProps) => {
  const location = useLocation()
  const outlet = useOutlet()
  const liveRef = useRef<HTMLDivElement>(null)

  const prevPath = useRef(location.pathname)
  const prevKey = useRef(location.key)
  const prevNode = useRef(outlet)
  const [exiting, setExiting] = useState<Exiting | null>(null)

  if (prevKey.current !== location.key) {
    const kind = rules?.find((r) => r.from === prevPath.current && r.to === location.pathname)?.kind ?? defaultKind
    /* the outgoing page's video is about to unmount and remount as the
       ghost copy whichever effect renders — reading its currentTime here,
       before that happens, so the ghost can seek to match instead of
       visibly snapping back to frame 0 */
    const liveVideo = liveRef.current?.querySelector<HTMLVideoElement>('video')
    setExiting({ key: prevKey.current, node: prevNode.current, videoTime: liveVideo?.currentTime ?? 0, kind })
    prevKey.current = location.key
    prevPath.current = location.pathname
  }
  prevNode.current = outlet

  const Effect = exiting ? EFFECTS[exiting.kind] : null

  return (
    <>
      {Effect && exiting && <Effect exiting={exiting} liveRef={liveRef} onExitComplete={() => setExiting(null)} />}
      <div className="route-live" ref={liveRef}>
        {outlet}
      </div>
    </>
  )
}
