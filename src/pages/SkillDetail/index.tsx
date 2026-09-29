import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { MenuBackground } from '../../components/MenuBackground'
import { EXPERIENCE } from '../../data/experience'
import './SkillDetail.css'

const STAR_COUNT = 10

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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!validInitial) return null
  const exp = EXPERIENCE[i]

  return (
    <>
      <MenuBackground flip />
      <div className="skill-detail">
        <div className="skill-detail-header">
          <span className="skill-detail-nav skill-detail-nav--left">◄ L</span>
          <div className="skill-detail-title-wrap">
            <span className="skill-detail-title">SOCIAL LINK</span>
          </div>
          <span className="skill-detail-nav skill-detail-nav--right">R ►</span>
        </div>

        <div className="skill-detail-meta">
          <span className="skill-detail-eyebrow">{exp.company}</span>
          <span className="skill-detail-arcana">{exp.title}</span>
          <div className="skill-detail-rank">
            <span className="skill-detail-rank-label">RANK</span>
            <span className="skill-detail-rank-value">0</span>
          </div>
          <div className="skill-detail-stars" aria-hidden="true">
            {Array.from({ length: STAR_COUNT }, (_, s) => (
              <span key={s} className="skill-detail-star" />
            ))}
          </div>
        </div>

        <div className="skill-detail-body">
          <p className="skill-detail-description">
            Placeholder description text goes here — a short write-up for this entry will go in this spot.
          </p>

          {/* character art slot — left empty on purpose, see feature request */}
          <div className="skill-detail-portrait" aria-hidden="true" />

          <div className="skill-detail-person">
            <span className="skill-detail-person-name">Placeholder Name</span>
            <span className="skill-detail-person-role">Placeholder role description goes here.</span>
          </div>
        </div>
      </div>
    </>
  )
}
