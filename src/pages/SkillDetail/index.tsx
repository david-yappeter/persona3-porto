import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router'
import { MenuBackground } from '../../components/MenuBackground'
import { ThreeCard } from '../../components/ThreeCard'
import { EXPERIENCE } from '../../data/experience'
import { useFitText } from '../../hooks/FitText'
import './SkillDetail.css'

const SOUND_SWITCH = `${import.meta.env.BASE_URL}sound/deck_ui_volume.wav`

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

  const switchSoundRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const sound = new Audio(SOUND_SWITCH)
    sound.preload = 'auto'
    switchSoundRef.current = sound
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      e.preventDefault()
      setI((current) => (current + (e.key === 'ArrowRight' ? 1 : -1) + EXPERIENCE.length) % EXPERIENCE.length)
      /* rewind first so held/rapid presses retrigger instead of being ignored */
      const sound = switchSoundRef.current
      if (sound) {
        sound.currentTime = 0
        void sound.play().catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const exp = EXPERIENCE[validInitial ? i : 0]
  const positionRef = useFitText(exp.title)

  if (!validInitial) return null

  return (
    <>
      <MenuBackground flip decoText="" />
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

        {/* floating card, center of the screen like the source UI — re-keyed
            per entry so the flip-in replays fresh each time Left/Right cycles */}
        <div className="skill-detail-card-stage">
          <ThreeCard key={i} title={exp.title} subtitle={exp.company} />
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
