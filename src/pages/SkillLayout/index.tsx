import { useEffect, useMemo, useState } from 'react'
import { Outlet, useOutletContext, useParams } from 'react-router'
import { MenuBackground } from '../../components/MenuBackground'
import { SocialLinkScene, type CardFace } from '../../components/SocialLinkScene'
import { EXPERIENCE } from '../../data/experience'
import './SkillLayout.css'

const MAKOTO_MODEL = `${import.meta.env.BASE_URL}assets/models/makoto/scene.gltf`
/* props and helper geometry bundled with the Sketchfab rip: katana, gun
   holster, evoker, and tiny marker quads parked on the knee/elbow joints */
const MAKOTO_HIDDEN = /^(175_|katana|c0744_gunholder|c0744_syoukanki)/

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
  /** the experience entry the card shows — the list's cursor on /skill,
      the entry being read on /skill/:index */
  active: number
  setActive: (index: number) => void
}

export const useSkillContext = () => useOutletContext<SkillOutletContext>()

const parseIndex = (raw: string | undefined) => {
  const n = Number(raw)
  return raw !== undefined && Number.isInteger(n) && n >= 0 && n < EXPERIENCE.length ? n : null
}

/*
 * Shared shell for /skill and /skill/:index. The menu video and the 3D
 * scene live here, so they stay mounted across the route change (the root
 * RouteTransition plays no effect inside this section) — instead the
 * character animates it: card held in the hand on the list, palm open with
 * the card floating on a detail page, and back.
 */
export const SkillLayout = () => {
  const { index } = useParams<{ index?: string }>()
  const detail = index !== undefined
  const [active, setActive] = useState(() => parseIndex(index) ?? 0)

  /* dev-only pose lab: /skill?lab or /skill/0?lab adds a slider panel that
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
      <MenuBackground flip decoText={detail ? '' : undefined} />
      <SocialLinkScene
        card={card}
        cardState={detail ? 'floating' : 'held'}
        modelSrc={MAKOTO_MODEL}
        backdrop={false}
        hiddenMaterials={MAKOTO_HIDDEN}
        originalMaterials
        menuColors
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
