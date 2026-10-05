import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router'
import { SocialLinkScene, type CardFace, type CardState } from '../../components/SocialLinkScene'
import { EXPERIENCE } from '../../data/experience'
import { useFitText } from '../../hooks/FitText'
import { playSfx } from '../../utils/sfx'
import './SkillDetail.css'

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

/* text content is all placeholder for now — layout/style only, see the
   feature request. Cycling (Left/Right) is real, just doesn't change what's
   shown yet. The URL param only seeds which entry to open on — cycling
   afterwards is local state, not a route change, so it doesn't re-trigger
   RouteTransition/re-mount the page on every press. */
export const SkillDetail = () => {
  const navigate = useNavigate()
  const { index } = useParams<{ index: string }>()
  const initial = Number(index)
  const validInitial = Number.isInteger(initial) && initial >= 0 && initial < EXPERIENCE.length
  const [i, setI] = useState(() => (validInitial ? initial : 0))

  useEffect(() => {
    if (!validInitial) void navigate('/skill', { replace: true })
  }, [validInitial, navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      e.preventDefault()
      setI((current) => (current + (e.key === 'ArrowRight' ? 1 : -1) + EXPERIENCE.length) % EXPERIENCE.length)
      playSfx('switchEntry')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* card starts gripped at the chest, then drops onto its lanyard — the
     list-to-detail moment from the source. Delayed past the route
     transition's reveal so the drop is actually on screen. */
  const [cardState, setCardState] = useState<CardState>('held')
  useEffect(() => {
    const id = window.setTimeout(() => setCardState('dangling'), 900)
    return () => window.clearTimeout(id)
  }, [])

  const exp = EXPERIENCE[validInitial ? i : 0]
  const positionRef = useFitText(exp.title)
  const cardIndex = validInitial ? i : 0
  const card = useMemo<CardFace>(
    () => ({
      image: exp.logoSrc,
      imageFit: 'contain',
      title: exp.title,
      subtitle: exp.company,
      numeral: toNumeral(cardIndex),
    }),
    [exp, cardIndex],
  )

  if (!validInitial) return null

  return (
    <>
      <SocialLinkScene card={card} cardState={cardState} />
      <div className="skill-detail">
        <div className="skill-detail-header">
          <span className="skill-detail-nav">
            <span className="skill-detail-nav-arrow skill-detail-nav-arrow--left" aria-hidden="true" />
            <span>L</span>
          </span>

          <span className="skill-detail-title">SOCIAL LINK</span>

          <span className="skill-detail-nav">
            <span>R</span>
            <span className="skill-detail-nav-arrow" aria-hidden="true" />
          </span>
        </div>

        {/* skewed two-tone panel: black category strip on top, white accent
            strip below — one clipped shape rather than two separately-skewed
            boxes, so the cut edge lines up across both */}
        <div className="skill-detail-panel">
          <div className="skill-detail-panel-top">
            <span className="skill-detail-eyebrow" key={i}>
              {exp.company}
            </span>
          </div>
          <div className="skill-detail-panel-bottom">
            <div className="skill-detail-panel-bottom-content" key={i}>
              <span ref={positionRef} className="skill-detail-position">
                {exp.title}
              </span>
              <span className="skill-detail-period">{exp.period}</span>
            </div>
          </div>
        </div>


        <div className="skill-detail-body">
          <ul className="skill-detail-description" key={i}>
            {exp.description.map((line, lineIndex) => (
              <li key={lineIndex} style={{ '--i': lineIndex } as CSSProperties}>
                {line}
              </li>
            ))}
          </ul>

          {/* character art slot — empty dashed placeholder until an entry
              has its own cropped portrait, see data/experience.ts */}
          {exp.portraitSrc ? (
            <img className="skill-detail-portrait-img" src={exp.portraitSrc} alt="" aria-hidden="true" />
          ) : (
            <div className="skill-detail-portrait" aria-hidden="true" />
          )}

          <div className="skill-detail-person">
            <span className="skill-detail-person-name">Placeholder Name</span>
            <span className="skill-detail-person-role">Placeholder role description goes here.</span>
          </div>
        </div>
      </div>
    </>
  )
}
