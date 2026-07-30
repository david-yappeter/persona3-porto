import { Outlet, useLocation } from 'react-router'
import { CommandHint } from '../../components/CommandHint'
import { MenuBackground } from '../../components/MenuBackground'
import { MusicPlayer } from '../../components/MusicPlayer'
import { PageTransition } from '../../components/PageTransition'
import { WalletBox } from '../../components/WalletBox'
import './RootLayout.css'

/*
 * Persistent chrome. Everything here sits outside the <Outlet>, so it survives
 * navigation untouched — the background video never reloads and the music
 * player keeps its position across page changes.
 */
export const RootLayout = () => {
  const { pathname } = useLocation()

  return (
    <div className="menu-screen">
      {/* keying on pathname remounts this on every navigation (and on first
          load), restarting the ripple-reveal animation each time */}
      <PageTransition key={pathname} />
      <MenuBackground />
      <WalletBox amount="¥47,407" />

      {/* only this subtree is captured by the view transition */}
      <main className="route-view">
        <Outlet />
      </main>

      <MusicPlayer />
      <CommandHint title="Use a Skill" />
    </div>
  )
}
