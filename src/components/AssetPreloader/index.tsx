import type { ReactNode } from 'react'
import { PRELOAD_MANIFEST } from './manifest'
import { usePreloadAssets } from './usePreloadAssets'
import './AssetPreloader.css'

type AssetPreloaderProps = {
  children: ReactNode
}

/** Gates `children` behind every video/sfx/track/font the app plays on its
    first screens actually being downloaded, so nothing pops in or stalls
    decoding mid-animation later. See manifest.ts for what's included. */
export const AssetPreloader = ({ children }: AssetPreloaderProps) => {
  const { progress, done } = usePreloadAssets(PRELOAD_MANIFEST)

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

  return <>{children}</>
}
