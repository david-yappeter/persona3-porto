import { CommandHint } from './components/CommandHint'
import { MenuBackground } from './components/MenuBackground'
import { MenuList } from './components/MenuList'
import { MusicPlayer } from './components/MusicPlayer'
import { WalletBox } from './components/WalletBox'
import { MENU_ITEMS } from './data/menuItems'
import { useMenuNavigation } from './hooks/MenuNavigation'
import './App.css'

export const App = () => {
  const { selected, setSelected } = useMenuNavigation(MENU_ITEMS.length)

  return (
    <div className="menu-screen">
      <MenuBackground />
      <WalletBox amount="¥47,407" />
      <MenuList items={MENU_ITEMS} selected={selected} onSelect={setSelected} />
      <MusicPlayer />
      <CommandHint title="Use a Skill" />
    </div>
  )
}
