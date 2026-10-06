import { useFitText } from '../../hooks/FitText'
import './BasicRow.css'

type BasicRowProps = {
  /** row background, e.g. public/assets/head_row_1_colored.png — head silhouette
      + colored triangle band baked into one image */
  imageSrc: string
  title: string
  /** smaller line under the title */
  subtitle: string
  /** right-hand column (dates, licence) */
  aside: string
  /** ribbon along the left edge, e.g. "Current" */
  tag?: string
  /** red border cursor — true for the row the keyboard selection is on */
  selected?: boolean
  /** mouse hover moves the cursor here */
  onSelect?: () => void
  /** click / tap opens the entry */
  onActivate?: () => void
}

/** P3R list row (the party / social-link list look): black slanted bar with
    a head silhouette, title + subtitle on the right, a right-hand column and
    an optional ribbon tag */
export const BasicRow = ({ imageSrc, title, subtitle, aside, tag, selected, onSelect, onActivate }: BasicRowProps) => {
  const titleRef = useFitText(title)
  const subtitleRef = useFitText(subtitle)

  return (
    <div className={`basic-row${selected ? ' is-selected' : ''}`} onMouseEnter={onSelect} onClick={onActivate}>
      <img className="basic-row-bg" src={imageSrc} alt="" aria-hidden="true" />
      {tag && <span className="basic-row-tag">{tag}</span>}
      <div className="basic-row-content">
        <div className="basic-row-title-group">
          <span ref={titleRef} className="basic-row-name">
            {title}
          </span>
          <span ref={subtitleRef} className="basic-row-subtitle">
            {subtitle}
          </span>
        </div>
        <span className="basic-row-aside">{aside}</span>
      </div>
    </div>
  )
}
