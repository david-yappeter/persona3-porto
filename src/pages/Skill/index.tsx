import { useNavigate } from 'react-router'
import { MenuBackground } from '../../components/MenuBackground'
import { SkillRow } from '../../components/SkillRow'

/* placeholder page, just to exercise the page transition */
export const Skill = () => {
  const navigate = useNavigate()

  return (
    <>
      <MenuBackground flip />
      {/* position+z-index needed so this stacks above MenuBackground's
          un-z-indexed absolute layers, which would otherwise paint over it */}
      <div style={{ position: 'relative', zIndex: 1, height: '100%', padding: '2rem', paddingTop: '7rem' }}>
        <SkillRow headSrc="/assets/head_row_1_colored.png" name="Makoto" level={42} hp={395} sp={235} tag="leader" />
        <SkillRow headSrc="/assets/head_row_2_colored.png" name="Yukari" level={40} hp={293} sp={261} />
        <SkillRow headSrc="/assets/head_row_3_colored.png" name="Junpei" level={39} hp={338} sp={194} />
        <SkillRow headSrc="/assets/head_row_4_colored.png" name="Akihiko" level={38} hp={362} sp={209} tag="party" />
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
