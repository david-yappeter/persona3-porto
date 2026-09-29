import { useNavigate } from 'react-router'
import { MenuBackground } from '../../components/MenuBackground'
import { SkillRow } from '../../components/SkillRow'
import { useMenuNavigation } from '../../hooks/MenuNavigation'

type Experience = {
  headSrc: string
  title: string
  company: string
  period: string
  current?: boolean
}

const EXPERIENCE: Experience[] = [
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_1_colored.png`,
    title: 'Software Development Engineer',
    company: 'GDP Labs, Jakarta',
    period: 'Jun 2025 - Now',
    current: true,
  },
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_2_colored.png`,
    title: 'Backend Developer',
    company: 'GWS Medika (Sinarmas Group), Medan',
    period: 'Oct 2022 - Feb 2025',
  },
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_3_colored.png`,
    title: 'Software Development Engineer',
    company: 'Two Miner Pte. Ltd., Medan',
    period: 'Jan 2022 - Sep 2022',
  },
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_4_colored.png`,
    title: 'Backend Developer',
    company: 'PT. Pundi Mas Berjaya, Medan',
    period: 'Jul 2020 - Jan 2022',
  },
]

/* placeholder page, just to exercise the page transition */
export const Skill = () => {
  const navigate = useNavigate()
  const { selected } = useMenuNavigation(EXPERIENCE.length)

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
