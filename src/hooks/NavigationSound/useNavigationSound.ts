import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { playSfx, preloadSfx } from '../../utils/sfx'

const HOME_PATH = '/'

const depth = (path: string) => path.split('/').filter(Boolean).length

/** The one place route changes make a sound — going a level deeper plays an
    "in" cue, coming back up plays an "out" cue (the side-menu fly variants
    when leaving/returning to "/"). Keyed off path depth so it covers Enter,
    mouse clicks and Backspace alike, and any future inner page gets it for
    free. Keeping it here, rather than also in the key handlers that trigger
    the navigation, is what stops a single press from firing two cues. */
export const useNavigationSound = () => {
  const location = useLocation()
  const prevPath = useRef(location.pathname)

  useEffect(() => {
    preloadSfx()
  }, [])

  useEffect(() => {
    const from = prevPath.current
    const to = location.pathname
    prevPath.current = to
    if (from === to) return

    const delta = depth(to) - depth(from)
    if (delta > 0) {
      playSfx(from === HOME_PATH ? 'flyIn' : 'intoDetail')
    } else if (delta < 0) {
      playSfx(to === HOME_PATH ? 'flyOut' : 'outOfDetail')
    }
  }, [location.pathname])
}
