import { useEffect, useState } from 'react'
import { MenuBackground } from '../../components/MenuBackground'
import { MenuList } from '../../components/MenuList'
import { MENU_ITEMS } from '../../data/menuItems'
import { useMenuNavigation } from '../../hooks/MenuNavigation'

const ENTRANCE_SRC = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg_entrance.mp4`

/*
 * The browser's actual initial URL, read once when this module first
 * evaluates (i.e. once per real page load/reload) — not the route MainMenu
 * happens to mount on, which can happen later via SPA nav after booting on
 * a different page entirely (e.g. reload on "/careers", then navigate home:
 * MainMenu's first-ever mount this session is on "/", but that's page
 * switching, not a reload of "/", so it must not get the entrance).
 */
const landedOnHomeOnBoot = window.location.pathname === import.meta.env.BASE_URL
let consumed = false

/*
 * The row the cursor was last on, so coming back from a submenu lands on the
 * row that opened it rather than the top. Before any visit to the menu it's
 * the row for the page the site was loaded on (a reload on "/careers/2",
 * then Back, lands on CAREER).
 */
const bootPath = window.location.pathname.slice(import.meta.env.BASE_URL.length - 1)
let lastSelected = Math.max(
  MENU_ITEMS.findIndex((item) => item.to && (bootPath === item.to || bootPath.startsWith(`${item.to}/`))),
  0,
)

export const MainMenu = () => {
  const { selected, moveTo } = useMenuNavigation(MENU_ITEMS.length, lastSelected)
  useEffect(() => {
    lastSelected = selected
  }, [selected])
  const [playEntrance] = useState(() => {
    if (!landedOnHomeOnBoot || consumed) return false
    consumed = true
    return true
  })

  return (
    <>
      <MenuBackground entranceSrc={playEntrance ? ENTRANCE_SRC : undefined} />
      <MenuList items={MENU_ITEMS} selected={selected} onSelect={moveTo} animateIn={playEntrance} />
    </>
  )
}
