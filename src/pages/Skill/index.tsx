import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { SkillRow } from '../../components/SkillRow'
import { EXPERIENCE } from '../../data/experience'
import { useMenuNavigation } from '../../hooks/MenuNavigation'
import { useSkillContext } from '../SkillLayout'

/* placeholder list page. The background and the 3D character (card held
   in the hand here) belong to SkillLayout; the card shows the row under
   the cursor, and the cursor starts on whichever entry was last open. */
export const Skill = () => {
  const navigate = useNavigate()
  const { active, setActive } = useSkillContext()
  const { selected } = useMenuNavigation(EXPERIENCE.length, active)

  useEffect(() => {
    setActive(selected)
  }, [selected, setActive])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      e.preventDefault()
      /* the "in" cue comes from useNavigationSound once the route changes */
      void navigate(`/skill/${selected}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, selected])

  return (
    <>
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
