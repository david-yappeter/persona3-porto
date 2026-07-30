import './PageTransition.css'

/*
 * Remounted with a fresh `key` on every route change (see RootLayout), which
 * restarts its CSS animations from scratch — that single remount covers both
 * the first page load and every navigation after it.
 *
 * The reveal hole is two circles, not one CSS mask-image: painting two white
 * circles onto the same SVG mask surface is a natural union (either circle
 * punches through). Doing this with layered `mask-image`s instead would need
 * `mask-composite`, whose default compositing gives the *intersection* of
 * the holes, not the union — the cover would stay solid until the circles
 * overlapped.
 */
export const PageTransition = () => {
  return (
    <div className="page-transition" aria-hidden="true">
      <svg className="page-transition-cover" width="100%" height="100%">
        <mask id="page-reveal-mask">
          <rect width="100%" height="100%" fill="white" />
          <circle className="page-reveal-circle page-reveal-circle--1" cx="80%" cy="20%" r="0" fill="black" />
          <circle className="page-reveal-circle page-reveal-circle--2" cx="20%" cy="80%" r="0" fill="black" />
        </mask>
        <rect width="100%" height="100%" fill="#050208" mask="url(#page-reveal-mask)" />
      </svg>
    </div>
  )
}
