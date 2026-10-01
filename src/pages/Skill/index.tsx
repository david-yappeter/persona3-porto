import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { MenuBackground } from '../../components/MenuBackground'
import { SkillRow } from '../../components/SkillRow'
import { EXPERIENCE } from '../../data/experience'
import { useMenuNavigation } from '../../hooks/MenuNavigation'

const SOUND_CONFIRM = `${import.meta.env.BASE_URL}sound/deck_ui_into_game_detail.wav`

/* placeholder page, just to exercise the page transition */
export const Skill = () => {
  const navigate = useNavigate()
  const { selected } = useMenuNavigation(EXPERIENCE.length)

  const confirmSoundRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const sound = new Audio(SOUND_CONFIRM)
    sound.preload = 'auto'
    confirmSoundRef.current = sound
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      e.preventDefault()
      const sound = confirmSoundRef.current
      if (sound) {
        sound.currentTime = 0
        void sound.play().catch(() => {})
      }
      void navigate(`/skill/${selected}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, selected])

  return (
    <>
      <MenuBackground flip />
      {/* position+z-index needed so this stacks above MenuBackground's
          un-z-indexed absolute layers, which would otherwise paint over it */}
      <div style={{ position: 'relative', zIndex: 1, height: '100%', padding: '2rem', paddingTop: '7rem' }}>
        {EXPERIENCE.map((exp, i) => (
          <SkillRow key={exp.company} {...exp} selected={i === selected} />
        ))}
        <button
          style={{
            marginTop: '2rem',
            fontSize: '2rem',
            color: '#fff',
            background: 'none',
            border: '1px solid #fff',
            padding: '1em 2em',
          }}
          onClick={() => void navigate('/')}
        >
          SKILL PAGE — back
        </button>
      </div>
    </>
  )
}
