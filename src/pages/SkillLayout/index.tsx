import { useEffect, useMemo, useState } from 'react'
import { Outlet, useOutletContext, useParams } from 'react-router'
import { MenuBackground } from '../../components/MenuBackground'
import { SocialLinkScene, type CardFace } from '../../components/SocialLinkScene'
import { EXPERIENCE } from '../../data/experience'
import { MAKOTO_BRIGHT, MAKOTO_HIDDEN, MAKOTO_MODEL, MAKOTO_TEXTURES, MAKOTO_UNSHADED } from '../../data/makoto'
import './SkillLayout.css'

/* seamless ocean loop behind the character on both the list and detail pages */
const OCEAN_BG = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg_ocean_seamless.mp4`
const ROMAN: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
/* arcana numbering starts at 0 (The Fool) */
const toNumeral = (n: number) => {
  if (n === 0) return '0'
  let out = ''
  for (const [value, glyph] of ROMAN) {
    while (n >= value) {
      out += glyph
      n -= value
    }
  }
  return out
}

export type SkillOutletContext = {
  /** the experience entry the card shows — the list's cursor on /careers,
      the entry being read on /careers/:index */
  active: number
  setActive: (index: number) => void
}

export const useSkillContext = () => useOutletContext<SkillOutletContext>()

const parseIndex = (raw: string | undefined) => {
  const n = Number(raw)
  return raw !== undefined && Number.isInteger(n) && n >= 0 && n < EXPERIENCE.length ? n : null
}

/*
 * Shared shell for /careers and /careers/:index. The menu video and the 3D
 * scene live here, so they stay mounted across the route change (the root
 * RouteTransition plays no effect inside this section) — instead the
 * character animates it: card held in the hand on the list, palm open with
 * the card floating on a detail page, and back.
 */
export const SkillLayout = () => {
  const { index } = useParams<{ index?: string }>()
  const detail = index !== undefined
  const [active, setActive] = useState(() => parseIndex(index) ?? 0)

  /* dev-only pose lab: /careers?lab or /careers/0?lab adds a slider panel that
     edits the character's pose live (stripped from production builds) */
  useEffect(() => {
    if (!import.meta.env.DEV || !new URLSearchParams(window.location.search).has('lab')) return
    let dispose: (() => void) | undefined
    let cancelled = false
    void import('../../components/SocialLinkScene/poseLab').then((m) => {
      if (!cancelled) dispose = m.mountPoseLab()
    })
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [])

  const exp = EXPERIENCE[active]
  const card = useMemo<CardFace>(
    () => ({
      image: exp.logoSrc,
      imageFit: 'contain',
      title: exp.title,
      subtitle: exp.company,
      numeral: toNumeral(active),
    }),
    [exp, active],
  )

  return (
    <>
      <MenuBackground videoSrc={OCEAN_BG} />
      <SocialLinkScene
        card={card}
        cardState={detail ? 'floating' : 'held'}
        modelSrc={MAKOTO_MODEL}
        backdrop={false}
        hiddenMaterials={MAKOTO_HIDDEN}
        brightMaterials={MAKOTO_BRIGHT}
        unshadedMaterials={MAKOTO_UNSHADED}
        originalMaterials
        borrowTextures={MAKOTO_TEXTURES}
        menuColors
        /* the S. Link white diagonal band; its shape moves with the pose
           (POSE.band -> POSE.float.band) */
        band
      />
      <Outlet context={{ active, setActive } satisfies SkillOutletContext} />

      {/* CC BY 4.0 requires crediting the model's author */}
      <a
        className="skill-credit"
        href="https://sketchfab.com/3d-models/makoto-yuki-persona-5-royal-dlc-batlle-bundle-3db577331f5442c79ec7cd0ac181adf2"
        target="_blank"
        rel="noreferrer"
      >
        3D model: "Makoto Yuki (Persona 5 Royal, DLC Batlle Bundle)" by 雨宮レン · CC BY 4.0
      </a>
    </>
  )
}
