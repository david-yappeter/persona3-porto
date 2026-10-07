import { useEffect, useRef } from 'react'
import { BasicRow } from '../../components/BasicRow'
import { MenuBackground } from '../../components/MenuBackground'
import { CREDITS_FIGURE } from '../../components/SocialLinkScene/figure'
import { mountFigureScene } from '../../components/SocialLinkScene/figureScene'
import { CREDIT_HEADS, CREDITS } from '../../data/credits'
import { MAKOTO_BRIGHT, MAKOTO_HIDDEN, MAKOTO_MODEL, MAKOTO_TEXTURES, MAKOTO_UNDRAWN, MAKOTO_UNSHADED } from '../../data/makoto'
import { useMenuNavigation } from '../../hooks/MenuNavigation'
import '../../components/SocialLinkScene/SocialLinkScene.css'
import './Credits.css'

const OCEAN_BG = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg_ocean_seamless.mp4`

const open = (url?: string) => {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

/** /credits: who made what the site is built from, as a P3R equip-menu
    style list over Makoto floating on the big white band (posed by
    CREDITS_FIGURE, figure.ts). /credits?lab adds the figure lab panel. */
export const Credits = () => {
  const mountRef = useRef<HTMLDivElement>(null)
  const { selected, moveTo } = useMenuNavigation(CREDITS.length)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const disposeScene = mountFigureScene(mount, {
      modelSrc: MAKOTO_MODEL,
      hiddenMaterials: MAKOTO_HIDDEN,
      undrawnMaterials: MAKOTO_UNDRAWN,
      brightMaterials: MAKOTO_BRIGHT,
      unshadedMaterials: MAKOTO_UNSHADED,
      borrowTextures: MAKOTO_TEXTURES,
      /* its own pose, apart from the falling one on the other pages */
      figure: CREDITS_FIGURE,
      band: true,
      /* huge grey page name on the band, behind him (FIGURE.title) */
      title: 'CREDITS',
    })
    /* figure lab — public, for reference; its code only downloads when asked for */
    let disposeLab: (() => void) | undefined
    let cancelled = false
    const query = new URLSearchParams(window.location.search)
    if (query.has('lab') || query.has('labs')) {
      void import('../../components/SocialLinkScene/figureLab').then((m) => {
        if (!cancelled) disposeLab = m.mountFigureLab('credits')
      })
    }
    return () => {
      cancelled = true
      disposeLab?.()
      disposeScene()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      e.preventDefault()
      open(CREDITS[selected].url)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  return (
    <>
      <MenuBackground videoSrc={OCEAN_BG} />
      <div ref={mountRef} className="social-link-scene" />
      <div className="credits-list">
        {CREDITS.map((credit, i) => (
          <BasicRow
            key={credit.title}
            imageSrc={CREDIT_HEADS[i % CREDIT_HEADS.length]}
            title={credit.title}
            subtitle={credit.author}
            aside={credit.license}
            tag={credit.tag}
            selected={i === selected}
            onSelect={() => moveTo(i)}
            onActivate={() => open(credit.url)}
          />
        ))}
      </div>
    </>
  )
}
