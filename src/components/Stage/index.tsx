import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { fitStage } from '../../utils/stage'
import './Stage.css'

const measure = () => fitStage(window.innerWidth, window.innerHeight)

/**
 * The box every page is laid out in. Big windows: the window itself. Small
 * ones (phones): a fixed laptop-sized box scaled to fit and centred, black
 * bars on the leftover sides. Pages size themselves from it with %, or
 * --vw / --vh (1% of its width / height) in place of vw / vh.
 */
export const Stage = ({ children }: { children: ReactNode }) => {
  const [fit, setFit] = useState(measure)

  useLayoutEffect(() => {
    const update = () => setFit(measure())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return (
    <div
      className="stage"
      style={
        {
          width: fit.width,
          height: fit.height,
          transform: `translate(-50%, -50%) scale(${fit.scale})`,
          '--vw': `${fit.width / 100}px`,
          '--vh': `${fit.height / 100}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}
