import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

const SOUND_BACK = `${import.meta.env.BASE_URL}sound/deck_ui_out_of_game_detail.wav`

/** Backspace/Escape go back one level — real browser history back when this
    tab actually navigated here in-app (so /skill/2 -> /skill -> / unwinds
    the same way it was entered), or up to the parent path when there's no
    such history (a reload or direct link landed straight on this route).
    No-op on "/" itself, since there's nowhere further back to go. */
export const useBackNavigation = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const backSoundRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const sound = new Audio(SOUND_BACK)
    sound.preload = 'auto'
    backSoundRef.current = sound
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Escape') return
      /* let a focused control (e.g. text input) handle its own Backspace */
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      if (location.pathname === '/') return
      e.preventDefault()

      const sound = backSoundRef.current
      if (sound) {
        sound.currentTime = 0
        void sound.play().catch(() => {})
      }

      if (location.key === 'default') {
        const parent = location.pathname.replace(/\/[^/]+\/?$/, '') || '/'
        void navigate(parent, { replace: true })
      } else {
        void navigate(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, location.pathname, location.key])
}
