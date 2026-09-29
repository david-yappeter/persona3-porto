import { useEffect, useRef, useState } from 'react'

const SOUND_DOWN = `${import.meta.env.BASE_URL}sound/deck_ui_slider_down.wav`
const SOUND_UP = `${import.meta.env.BASE_URL}sound/deck_ui_slider_up.wav`

/** Arrow-key selection over a list of `count` entries, with the P3 click sounds. */
export const useMenuNavigation = (count: number) => {
  const [selected, setSelected] = useState(0)
  const soundsRef = useRef<{ down: HTMLAudioElement; up: HTMLAudioElement } | null>(null)

  useEffect(() => {
    const moveDown = new Audio(SOUND_DOWN)
    const moveUp = new Audio(SOUND_UP)
    moveDown.preload = 'auto'
    moveUp.preload = 'auto'
    soundsRef.current = { down: moveDown, up: moveUp }
  }, [])

  /* rewind first so held/rapid presses retrigger instead of being ignored */
  const play = (clip: HTMLAudioElement) => {
    clip.currentTime = 0
    void clip.play().catch(() => {})
  }

  /** move the cursor straight to `index` — used for mouse hover, which jumps
      to an arbitrary row rather than stepping one at a time, so it gets the
      same up/down click feedback keyboard movement gets, picked by whether
      the target is below or above the current row */
  const moveTo = (index: number) => {
    setSelected((current) => {
      if (index === current) return current
      const sounds = soundsRef.current
      if (sounds) play(index > current ? sounds.down : sounds.up)
      return index
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* let a focused control have its own arrow keys — on a range input they
         adjust the value, and the menu shouldn't move at the same time */
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return

      const sounds = soundsRef.current
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((i) => (i + 1) % count)
        if (sounds) play(sounds.down)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((i) => (i - 1 + count) % count)
        if (sounds) play(sounds.up)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count])

  return { selected, setSelected, moveTo }
}
