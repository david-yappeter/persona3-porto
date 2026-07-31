import { useNavigate } from 'react-router'
import { MenuBackground } from '../../components/MenuBackground'

/* placeholder page, just to exercise the page transition */
export const Skill = () => {
  const navigate = useNavigate()

  return (
    <>
      <MenuBackground flip />
      {/* position+z-index needed so this stacks above MenuBackground's
          un-z-indexed absolute layers, which would otherwise paint over it */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <button
          style={{ fontSize: '2rem', color: '#fff', background: 'none', border: '1px solid #fff', padding: '1em 2em' }}
          onClick={() => void navigate('/')}
        >
          SKILL PAGE — back
        </button>
      </div>
    </>
  )
}
