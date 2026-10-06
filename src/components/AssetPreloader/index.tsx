import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { playSfx, preloadSfx } from '../../utils/sfx'
import { PRELOAD_MANIFEST } from './manifest'
import { usePreloadAssets } from './usePreloadAssets'
import './AssetPreloader.css'

type AssetPreloaderProps = {
  children: ReactNode
}

/** Gates `children` behind every video/sfx/track/font the app plays on its
    first screens actually being downloaded, so nothing pops in or stalls
    decoding mid-animation later (see manifest.ts for what's included) —
    and then, once that hits 100%, behind a single click/keypress. Browsers
    refuse unmuted audio until the visitor has interacted with the page, so
    without this the background music's first play() attempt just fails
    silently; this turns that into an explicit "press start" the visitor
    acts on themselves, rather than a track that never audibly begins. */
export const AssetPreloader = ({ children }: AssetPreloaderProps) => {
  const { progress, done } = usePreloadAssets(PRELOAD_MANIFEST)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!done || started) return
    /* decode the cues now (a suspended context still decodes) so the start
       cue below isn't dropped as late on the first gesture */
    preloadSfx()
    const onGesture = () => {
      playSfx('start')
      setStarted(true)
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [done, started])

  if (!done) {
    const pct = Math.round(progress * 100)
    return (
      <div className="asset-preloader" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="asset-preloader-label">LOADING</div>
        <div className="asset-preloader-bar">
          <div className="asset-preloader-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="asset-preloader-pct">{pct}%</div>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="asset-preloader">
        <div className="asset-preloader-label">READY</div>
        <div className="asset-preloader-prompt">Click or press any key to continue</div>
        <ul className="asset-preloader-guide">
          <li style={{ '--i': 0 } as CSSProperties}>
            <span className="asset-preloader-guide-key">↑ ↓ ← →</span>
            <span className="asset-preloader-guide-label">Navigate</span>
          </li>
          <li style={{ '--i': 1 } as CSSProperties}>
            <span className="asset-preloader-guide-key">Click / Enter</span>
            <span className="asset-preloader-guide-label">Select</span>
          </li>
          <li style={{ '--i': 2 } as CSSProperties}>
            <span className="asset-preloader-guide-key">Esc / Backspace</span>
            <span className="asset-preloader-guide-label">Back</span>
          </li>
        </ul>
      </div>
    )
  }

  return <>{children}</>
}
