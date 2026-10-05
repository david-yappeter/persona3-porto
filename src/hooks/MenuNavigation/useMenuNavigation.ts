import { useEffect, useRef, useState } from 'react'
import { playSfx } from '../../utils/sfx'

/** Arrow-key selection over a list of `count` entries, with the P3 click sounds. */
export const useMenuNavigation = (count: number) => {
  const [selected, setSelected] = useState(0)
  /* mirrors `selected` so moveTo can pick its sound outside the state
     updater — StrictMode runs updaters twice, which would double the click */
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  /** move the cursor straight to `index` — used for mouse hover, which jumps
      to an arbitrary row rather than stepping one at a time, so it gets the
      same up/down click feedback keyboard movement gets, picked by whether
      the target is below or above the current row */
  const moveTo = (index: number) => {
    const current = selectedRef.current
    if (index === current) return
    selectedRef.current = index
    setSelected(index)
    playSfx(index > current ? 'slideDown' : 'slideUp')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* let a focused control have its own arrow keys — on a range input they
         adjust the value, and the menu shouldn't move at the same time */
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((i) => (i + 1) % count)
        playSfx('slideDown')
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((i) => (i - 1 + count) % count)
        playSfx('slideUp')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count])

  return { selected, setSelected, moveTo }
}
