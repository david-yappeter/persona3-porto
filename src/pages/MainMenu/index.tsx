import { useState } from 'react'
import { MenuBackground } from '../../components/MenuBackground'
import { MenuList } from '../../components/MenuList'
import { MENU_ITEMS } from '../../data/menuItems'
import { useMenuNavigation } from '../../hooks/MenuNavigation'

const ENTRANCE_SRC = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg_entrance.mp4`

/*
 * The browser's actual initial URL, read once when this module first
 * evaluates (i.e. once per real page load/reload) — not the route MainMenu
 * happens to mount on, which can happen later via SPA nav after booting on
 * a different page entirely (e.g. reload on "/skill", then navigate home:
 * MainMenu's first-ever mount this session is on "/", but that's page
 * switching, not a reload of "/", so it must not get the entrance).
 */
const landedOnHomeOnBoot = window.location.pathname === import.meta.env.BASE_URL
let consumed = false

export const MainMenu = () => {
  const { selected, setSelected } = useMenuNavigation(MENU_ITEMS.length)
  const [playEntrance] = useState(() => {
    if (!landedOnHomeOnBoot || consumed) return false
    consumed = true
    return true
  })

  return (
    <>
      <MenuBackground entranceSrc={playEntrance ? ENTRANCE_SRC : undefined} />
      <MenuList items={MENU_ITEMS} selected={selected} onSelect={setSelected} animateIn={playEntrance} />
    </>
  )
}
