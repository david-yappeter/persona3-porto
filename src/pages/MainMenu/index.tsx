import { MenuList } from '../../components/MenuList'
import { MENU_ITEMS } from '../../data/menuItems'
import { useMenuNavigation } from '../../hooks/MenuNavigation'

export const MainMenu = () => {
  const { selected, setSelected } = useMenuNavigation(MENU_ITEMS.length)

  return <MenuList items={MENU_ITEMS} selected={selected} onSelect={setSelected} />
}
