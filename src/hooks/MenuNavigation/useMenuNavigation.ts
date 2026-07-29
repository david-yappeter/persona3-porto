import { useEffect, useState } from 'react'

const SOUND_DOWN = '/sound/deck_ui_slider_down.wav'
const SOUND_UP = '/sound/deck_ui_slider_up.wav'

/** Arrow-key selection over a list of `count` entries, with the P3 click sounds. */
export const useMenuNavigation = (count: number) => {
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    const moveDown = new Audio(SOUND_DOWN)
    const moveUp = new Audio(SOUND_UP)
    moveDown.preload = 'auto'
    moveUp.preload = 'auto'

    /* rewind first so held/rapid presses retrigger instead of being ignored */
    const play = (clip: HTMLAudioElement) => {
      clip.currentTime = 0
      void clip.play().catch(() => {})
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((i) => (i + 1) % count)
        play(moveDown)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((i) => (i - 1 + count) % count)
        play(moveUp)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count])

  return { selected, setSelected }
}
