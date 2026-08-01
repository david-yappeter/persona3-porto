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

  return (
    <div className="menu-screen">
      {/* only plays once, for the very first paint — there's no previous
          page to reveal from before that */}
      <PageTransition />

      <main className="route-view">
        {/* rules lets any specific from->to pair play a different kind,
            e.g. [{ from: '/', to: '/skill', kind: RouteTransitionKind.X }] —
            anything not listed falls back to defaultKind */}
        <RouteTransition defaultKind={RouteTransitionKind.CircleReveal} />
      </main>

      <WalletBox amount="¥47,407" />
      <MusicPlayer />
      <CommandHint title="Use a Skill" />
    </div>
  )
}
