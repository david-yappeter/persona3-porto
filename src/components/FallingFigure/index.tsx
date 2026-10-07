import { useEffect, useRef } from 'react'
import { MAKOTO_BRIGHT, MAKOTO_HIDDEN, MAKOTO_MODEL, MAKOTO_TEXTURES, MAKOTO_UNDRAWN, MAKOTO_UNSHADED } from '../../data/makoto'
import '../SocialLinkScene/SocialLinkScene.css'
import './FallingFigure.css'

/* the list-detail pages' band (screen fractions, see FIGURE.band): its
   left edge from 53% across at the top to 36% at the bottom, its right
   edge off screen */
const PAGE_BAND = { bottom: 2, width: 1.64, lean: 0.17 }

/**
 * The list-detail pages' backdrop drawn in one canvas: the white diagonal
 * band, the page name in huge grey type on it (FIGURE.title), and Makoto
 * falling through with the "9" on repeat (FIGURE, figure.ts — the /credits
 * pose), cut out of the band and casting his shadow on it. A layer under
 * the page's list / panel. three.js and the model only download once the
 * page mounts; `?lab` adds the figure lab panel.
 */
export const FallingFigure = ({ title }: { title: string }) => {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let cancelled = false
    let disposeScene: (() => void) | undefined
    let disposeLab: (() => void) | undefined
    void import('../SocialLinkScene/figureScene').then((m) => {
      if (cancelled) return
      disposeScene = m.mountFigureScene(mount, {
        modelSrc: MAKOTO_MODEL,
        hiddenMaterials: MAKOTO_HIDDEN,
        undrawnMaterials: MAKOTO_UNDRAWN,
        brightMaterials: MAKOTO_BRIGHT,
        unshadedMaterials: MAKOTO_UNSHADED,
        borrowTextures: MAKOTO_TEXTURES,
        band: true,
        bandShape: PAGE_BAND,
        bandIn: true,
        title,
      })
    })
    if (new URLSearchParams(window.location.search).has('lab')) {
      void import('../SocialLinkScene/figureLab').then((m) => {
        if (!cancelled) disposeLab = m.mountFigureLab()
      })
    }
    return () => {
      cancelled = true
      disposeLab?.()
      disposeScene?.()
    }
  }, [title])

  return <div ref={mountRef} className="social-link-scene falling-figure" aria-hidden="true" />
}
