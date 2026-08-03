import { useState } from 'react'
import { useLocation } from 'react-router'
import { CommandHint } from '../../components/CommandHint'
import { MusicPlayer } from '../../components/MusicPlayer'
import { PageTransition } from '../../components/PageTransition'
import { RouteTransition, RouteTransitionKind } from '../../components/RouteTransition'
import { WalletBox } from '../../components/WalletBox'
import { useNavigationSound } from '../../hooks/NavigationSound'
import './RootLayout.css'

/*
 * Persistent chrome. Everything here sits outside RouteTransition, so it
 * survives navigation untouched — the wallet and music player keep their
 * position across page changes. MenuBackground is deliberately NOT here —
 * each page (MainMenu, Skill) renders its own, so it's captured as part of
 * that page's exit snapshot in RouteTransition.
 */
export const RootLayout = () => {
  useNavigationSound()
  const location = useLocation()
  /* "/" has its own reveal now — the entrance video + menu row fade-in
     (see MainMenu) — so the ripple only plays landing cold on any other
     route. Captured once at mount; RootLayout never remounts on SPA nav, so
     this can't flip mid-session. */
  const [showRipple] = useState(() => location.pathname !== '/')

  return (
    <div className="menu-screen">
      {/* only plays once, for the very first paint of a non-"/" route —
          there's no previous page to reveal from before that */}
      {showRipple && <PageTransition />}

      <main className="route-view">
        {/* rules lets any specific from->to pair play a different kind —
            anything not listed falls back to defaultKind */}
        <RouteTransition
          defaultKind={RouteTransitionKind.CircleReveal}
          rules={[{ from: '/', to: '/skill', kind: RouteTransitionKind.DoubleRipple }]}
        />
      </main>

      <WalletBox amount="¥47,407" />
      <MusicPlayer />
      <CommandHint title="Use a Skill" />
    </div>
  )
}
