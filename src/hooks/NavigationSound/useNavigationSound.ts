import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

const SOUND_FLY_IN = `${import.meta.env.BASE_URL}sound/deck_ui_side_menu_fly_in.wav`
const SOUND_FLY_OUT = `${import.meta.env.BASE_URL}sound/deck_ui_side_menu_fly_out.wav`
const HOME_PATH = '/'

/** Plays a fly-in cue leaving the main menu for any inner page, and a
    fly-out cue coming back — keyed off "/" so any future inner page gets
    this for free, no per-page wiring needed. */
export const useNavigationSound = () => {
  const location = useLocation()
  const prevPath = useRef(location.pathname)
  const flyIn = useRef<HTMLAudioElement | null>(null)
  const flyOut = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    flyIn.current = new Audio(SOUND_FLY_IN)
    flyOut.current = new Audio(SOUND_FLY_OUT)
    flyIn.current.preload = 'auto'
    flyOut.current.preload = 'auto'
  }, [])

  useEffect(() => {
    const from = prevPath.current
    const to = location.pathname
    prevPath.current = to
    if (from === to) return

    /* rewind first so rapid nav retriggers instead of being ignored */
    const play = (clip: HTMLAudioElement | null) => {
      if (!clip) return
      clip.currentTime = 0
      void clip.play().catch(() => {})
    }

    if (from === HOME_PATH && to !== HOME_PATH) {
      play(flyIn.current)
    } else if (from !== HOME_PATH && to === HOME_PATH) {
      play(flyOut.current)
    }
  }, [location.pathname])
}
