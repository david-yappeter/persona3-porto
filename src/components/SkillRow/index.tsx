import './SkillRow.css'

type SkillRowProps = {
  /** row background, e.g. public/assets/head_row_1_colored.png — head silhouette
      + colored triangle band baked into one image */
  headSrc: string
  name: string
  level: number
  hp: number
  sp: number
  /** vertical ribbon label along the left edge, matching the source UI's
      LEADER/PARTY tags — omit for rows that get neither */
  tag?: 'leader' | 'party'
}

export const SkillRow = ({ headSrc, name, level, hp, sp, tag }: SkillRowProps) => {
  return (
    <div className={`skill-row${tag === 'leader' ? ' is-leader' : ''}`}>
      <img className="skill-row-bg" src={headSrc} alt="" aria-hidden="true" />
      {tag && <span className="skill-row-tag">{tag}</span>}
      <div className="skill-row-content">
        <span className="skill-row-name">{name}</span>
        <span className="skill-row-level">
          <span className="skill-row-level-label">Lv</span>
          {level}
        </span>
        <span className="skill-row-stat skill-row-stat--hp">
          <span className="skill-row-stat-label">HP</span>
          {hp}
        </span>
        <span className="skill-row-stat skill-row-stat--sp">
          <span className="skill-row-stat-label">SP</span>
          {sp}
        </span>
      </div>
    </div>
  )
}
