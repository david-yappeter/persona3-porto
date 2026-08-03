import type { ReactNode, RefObject } from 'react'

/** Which page-to-page transition effect RouteTransition should play. */
export enum RouteTransitionKind {
  /** Two circles grow from the top-right and bottom-left corners, revealing
      the incoming page over the outgoing one. */
  CircleReveal = 'circle-reveal',
  /** Same two origins, but as two staggered ripples 200ms apart: the first
      only flashes a heavy blue overlay over the outgoing page, the second
      chases behind it revealing the incoming page. */
  DoubleRipple = 'double-ripple',
}

export type ExitingRoute = {
  key: string
  node: ReactNode
  /** outgoing page's <video>, if any, currentTime at the moment it was
      captured — lets an effect seek its ghost copy to match instead of
      restarting the video from frame 0 */
  videoTime: number
}

export type RouteTransitionEffectProps = {
  exiting: ExitingRoute
  /** ref to the live/incoming page's wrapper — RouteTransition renders and
      owns this element itself, permanently, so it's never reparented across
      a transition starting or ending. Effects apply their visual (clip-path,
      classes, whatever) to it directly via this ref instead of rendering the
      live content themselves — rendering it a second time, even wrapped
      identically, is a different React parent and forces a real
      unmount/remount of the whole live page on top of the actual route
      change, which is what caused the flicker this replaced. */
  liveRef: RefObject<HTMLDivElement | null>
  /** call once the effect's animation is done, so RouteTransition can drop
      the ghost and go back to rendering the live page plainly */
  onExitComplete: () => void
}

/** Overrides the transition kind for one specific navigation direction —
    "/a" -> "/b" can play something different than "/b" -> "/a". */
export type RouteTransitionRule = {
  from: string
  to: string
  kind: RouteTransitionKind
}
