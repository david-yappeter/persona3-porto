import type { ReactNode } from 'react'

/** Which page-to-page transition effect RouteTransition should play. */
export enum RouteTransitionKind {
  /** Two circles grow from the top-right and bottom-left corners, revealing
      the incoming page over the outgoing one. */
  CircleReveal = 'circle-reveal',
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
  /** the current/incoming page. Implementations MUST wrap it in an element
      carrying className "route-live" — RouteTransition looks up
      ".route-live video" synchronously right before the *next* navigation
      swaps this out, so every effect needs to expose it under that name. */
  outlet: ReactNode
  exiting: ExitingRoute
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
