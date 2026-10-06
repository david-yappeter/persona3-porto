import { useEffect, useState } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { DEFAULT_VOLUME, readStoredVolume, storeVolume } from '../../hooks/MusicPlayer/volume'
import { SpeakerIcon } from '../MusicPlayer/SpeakerIcon'
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

  if (!started) {
    return (
      <PreloaderScreen progress={progress} done={done} onStart={setStarted}>
        <MusicToggle />
      </PreloaderScreen>
    )
  }

  return <>{children}</>
}

/** Mute switch under the prompt, writing the music level the player reads when
    it mounts (0 = muted, otherwise the level from before muting). Stops its
    press from reaching the window, so it never counts as "any key". */
const MusicToggle = () => {
  const [restore] = useState(() => readStoredVolume() || DEFAULT_VOLUME)
  const [on, setOn] = useState(() => readStoredVolume() > 0)

  const flip = () => {
    storeVolume(on ? 0 : restore)
    setOn(!on)
  }
  const swallow = (e: PointerEvent) => e.stopPropagation()

  return (
    <button
      type="button"
      className="asset-preloader-music"
      aria-pressed={!on}
      onPointerDown={swallow}
      onClick={flip}
      /* keyboard presses stay "any key", so it never holds focus */
      tabIndex={-1}
    >
      <SpeakerIcon muted={!on} size={16} />
      <span>{on ? 'Music on' : 'Music off'}</span>
    </button>
  )
}

type PreloaderScreenProps = {
  progress: number
  done: boolean
  onStart: (started: true) => void
  /** shown at the bottom of both the loading and ready screens */
  children: ReactNode
}

const PreloaderScreen = ({ progress, done, onStart, children }: PreloaderScreenProps) => {
  useEffect(() => {
    if (!done) return
    /* decode the cues now (a suspended context still decodes) so the start
       cue below isn't dropped as late on the first gesture */
    preloadSfx()
    const onGesture = () => {
      playSfx('start')
      onStart(true)
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [done, onStart])

  if (!done) {
    const pct = Math.round(progress * 100)
    return (
      <div className="asset-preloader" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="asset-preloader-label">LOADING</div>
        <div className="asset-preloader-bar">
          <div className="asset-preloader-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="asset-preloader-pct">{pct}%</div>
        {children}
      </div>
    )
  }

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
      {children}
    </div>
  )
}
