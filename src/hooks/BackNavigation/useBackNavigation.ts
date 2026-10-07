import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** Goes back one level — real browser history back when this tab actually
    navigated here in-app (so /careers/2 -> /careers -> / unwinds the same
    way it was entered), or up to the parent path when there's no such
    history (a reload or direct link landed straight on this route). No-op
    on "/" itself, since there's nowhere further back to go. Shared by the
    keys, the touch Back button and the back swipe. */
export const useGoBack = () => {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    if (location.pathname === '/') return
    /* the "out" cue comes from useNavigationSound once the route changes */
    if (location.key === 'default') {
      const parent = location.pathname.replace(/\/[^/]+\/?$/, '') || '/'
      void navigate(parent, { replace: true })
    } else {
      void navigate(-1)
    }
  }, [navigate, location.pathname, location.key])
}

/** Backspace/Escape go back one level (see useGoBack) */
export const useBackNavigation = () => {
  const goBack = useGoBack()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Escape') return
      /* let a focused control (e.g. text input) handle its own Backspace */
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      e.preventDefault()
      goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goBack])
}
