import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { useGoBack } from '../../hooks/BackNavigation'
import { useSwipe } from '../../hooks/Swipe'
import './TouchControls.css'

/* /careers/:index has its own left/right swipe (switches entry) */
const OWN_SWIPES = /^\/careers\/[^/]+/

/**
 * What Esc / Backspace do, for touch screens: a Back button in the top-right
 * corner (touch-sized — portalled out of the scaled Stage, so it doesn't
 * shrink with the page on a phone; shown only on coarse pointers, see the
 * CSS) and a right swipe anywhere. Neither exists on "/".
 */
export const TouchControls = () => {
  const location = useLocation()
  const goBack = useGoBack()
  const home = location.pathname === '/'

  useSwipe((direction) => {
    if (direction === 'right' && !OWN_SWIPES.test(location.pathname)) goBack()
  }, !home)

  if (home) return null
  return createPortal(
    <button type="button" className="touch-back" onClick={goBack} aria-label="Back">
      <span className="touch-back-arrow" aria-hidden="true" />
      BACK
    </button>,
    document.body,
  )
}
