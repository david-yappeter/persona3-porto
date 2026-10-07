import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router'
import { EXPERIENCE } from '../../data/experience'
import { useFitText } from '../../hooks/FitText'
import { useSwipe } from '../../hooks/Swipe'
import { playSfx } from '../../utils/sfx'
import { useSkillContext } from '../SkillLayout'
import './SkillDetail.css'

/* text content is all placeholder for now — layout/style only, see the
   feature request. The URL param only seeds which entry to open on —
   cycling (Left/Right) afterwards moves SkillLayout's `active` entry, not
   the route, so it doesn't remount anything; the 3D card flips to match.
   The background and 3D scene belong to SkillLayout. */
export const SkillDetail = () => {
  const navigate = useNavigate()
  const { index } = useParams<{ index: string }>()
  const initial = Number(index)
  const validInitial = Number.isInteger(initial) && initial >= 0 && initial < EXPERIENCE.length
  const { active, setActive } = useSkillContext()

  useEffect(() => {
    if (!validInitial) void navigate('/careers', { replace: true })
    else setActive(initial)
  }, [validInitial, initial, navigate, setActive])

  /* next / previous entry: Left/Right, a tap on the L/R badges, or a swipe
     (left = next, like turning a page) */
  const step = (by: 1 | -1) => {
    setActive((active + by + EXPERIENCE.length) % EXPERIENCE.length)
    playSfx('switchEntry')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const focused = document.activeElement
      if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) return
      e.preventDefault()
      step(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useSwipe((direction) => {
    if (direction === 'left') step(1)
    else if (direction === 'right') step(-1)
  })

  const i = active
  const exp = EXPERIENCE[i]
  const positionRef = useFitText(exp.title)

  if (!validInitial) return null

  return (
    <>
      <div className="skill-detail">
        <div className="skill-detail-header">
          <button type="button" className="skill-detail-nav" onClick={() => step(-1)} aria-label="Previous experience">
            <span className="skill-detail-nav-arrow skill-detail-nav-arrow--left" aria-hidden="true" />
            <span>L</span>
          </button>

          <span className="skill-detail-title">EXPERIENCE</span>

          <button type="button" className="skill-detail-nav" onClick={() => step(1)} aria-label="Next experience">
            <span>R</span>
            <span className="skill-detail-nav-arrow" aria-hidden="true" />
          </button>
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
        </div>

        {/* the entry's social-link bust-up over the band, and the name +
            description box across its chest; keyed so both replay on
            every Left/Right cycle */}
        <img className="skill-detail-bustup" key={`bustup-${i}`} src={exp.bustupSrc} alt="" aria-hidden="true" />
        <div className="skill-detail-about" key={`about-${i}`}>
          <span className="skill-detail-about-name">{exp.about.name}</span>
          <p className="skill-detail-about-text">{exp.about.text}</p>
        </div>
      </div>
    </>
  )
}
