import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** Backspace/Escape navigate back to "/" from any other route — the same
    place the Skill page's own back button goes. No-op on "/" itself, since
    there's nowhere further back to go. */
export const useBackNavigation = () => {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Escape') return
      /* let a focused control (e.g. text input) handle its own Backspace */
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      if (location.pathname === '/') return
      e.preventDefault()
      void navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, location.pathname])
}
