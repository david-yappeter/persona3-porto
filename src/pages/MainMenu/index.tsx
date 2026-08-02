import { useState } from 'react'
import { MenuBackground } from '../../components/MenuBackground'
import { MenuList } from '../../components/MenuList'
import { MENU_ITEMS } from '../../data/menuItems'
import { useMenuNavigation } from '../../hooks/MenuNavigation'

const ENTRANCE_SRC = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg_entrance.mp4`

/* module scope survives MainMenu unmounting/remounting as you navigate away
   from "/" and back (SPA nav) — only a real page reload resets it, since
   that re-evaluates the module. That's what makes the entrance clip a
   true-first-load-only thing rather than a "/" thing. */
let hasPlayedEntrance = false

export const MainMenu = () => {
  const { selected, setSelected } = useMenuNavigation(MENU_ITEMS.length)
  const [playEntrance] = useState(() => {
    if (hasPlayedEntrance) return false
    hasPlayedEntrance = true
    return true
  })

  return (
    <>
      <MenuBackground entranceSrc={playEntrance ? ENTRANCE_SRC : undefined} />
      <MenuList items={MENU_ITEMS} selected={selected} onSelect={setSelected} animateIn={playEntrance} />
    </>
  )
}
