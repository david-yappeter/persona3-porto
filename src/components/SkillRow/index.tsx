import { useFitText } from '../../hooks/FitText'
import './SkillRow.css'

type SkillRowProps = {
  /** row background, e.g. public/assets/head_row_1_colored.png — head silhouette
      + colored triangle band baked into one image */
  headSrc: string
  title: string
  company: string
  period: string
  /** shows the "Current" ribbon along the left edge — the job in progress */
  current?: boolean
  /** red border cursor — true for the row the keyboard selection is on */
  selected?: boolean
}

export const SkillRow = ({ headSrc, title, company, period, current, selected }: SkillRowProps) => {
  const titleRef = useFitText(title)
  const companyRef = useFitText(company)

  return (
    <div className={`skill-row${selected ? ' is-selected' : ''}`}>
      <img className="skill-row-bg" src={headSrc} alt="" aria-hidden="true" />
      {current && <span className="skill-row-tag">Current</span>}
      <div className="skill-row-content">
        <div className="skill-row-title-group">
          <span ref={titleRef} className="skill-row-name">
            {title}
          </span>
          <span ref={companyRef} className="skill-row-company">
            {company}
          </span>
        </div>
        <span className="skill-row-period">{period}</span>
      </div>
    </div>
  )
}
