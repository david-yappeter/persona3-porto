import { useEffect, useRef, useState, type ComponentType } from 'react'
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
 * Renders the current route (from useOutlet, in place of <Outlet/>) and
 * owns the "what was the previous page, and which effect should play"
 * bookkeeping generically — the actual per-kind visuals live in ./transitions
 * and only see { outlet, exiting, onExitComplete } as props.
 */
export const RouteTransition = ({ defaultKind, rules }: RouteTransitionProps) => {
  const location = useLocation()
  const outlet = useOutlet()

  const prevPath = useRef(location.pathname)
  const prevKey = useRef(location.key)
  const prevNode = useRef(outlet)
  const [exiting, setExiting] = useState<Exiting | null>(null)

  /* mirror of the videoTime capture below, but for the *other* remount
     boundary: when the transition ends, the dispatcher swaps from
     whichever Effect was rendering ".route-live" back to rendering it
     directly — a different parent component, so React remounts the live
     page (and its <video>) right then too. Captured in handleExitComplete,
     applied once the plain wrapper is back in the DOM. */
  const resumeVideoTime = useRef(0)

  useEffect(() => {
    if (exiting) return
    const video = document.querySelector<HTMLVideoElement>('.route-live video')
    if (video && resumeVideoTime.current > 0) {
      video.currentTime = resumeVideoTime.current
      void video.play()
    }
  }, [exiting])

  if (prevKey.current !== location.key) {
    const kind = rules?.find((r) => r.from === prevPath.current && r.to === location.pathname)?.kind ?? defaultKind
    /* the outgoing page's video is about to unmount and remount as the
       ghost copy whichever effect renders — reading its currentTime here,
       before that happens, so the ghost can seek to match instead of
       visibly snapping back to frame 0. Every effect exposes its live
       content under ".route-live", so this selector holds regardless of
       which kind was active for the *previous* transition. */
    const liveVideo = document.querySelector<HTMLVideoElement>('.route-live video')
    setExiting({ key: prevKey.current, node: prevNode.current, videoTime: liveVideo?.currentTime ?? 0, kind })
    prevKey.current = location.key
    prevPath.current = location.pathname
  }
  prevNode.current = outlet

  if (!exiting) {
    return <div className="route-live">{outlet}</div>
  }

  const handleExitComplete = () => {
    const video = document.querySelector<HTMLVideoElement>('.route-live video')
    resumeVideoTime.current = video?.currentTime ?? 0
    setExiting(null)
  }

  const Effect = EFFECTS[exiting.kind]
  return <Effect outlet={outlet} exiting={exiting} onExitComplete={handleExitComplete} />
}
