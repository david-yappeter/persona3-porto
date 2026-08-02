import type { CSSProperties } from 'react'
import type { MenuEntry } from '../../data/menuItems'
import './MenuItem.css'

type MenuItemProps = {
  item: MenuEntry
  selected: boolean
  /** paint order among the overlapping rows — see stackingOrder in MenuList */
  z: number
  onSelect: () => void
  /** omitted for rows that don't lead anywhere yet */
  onActivate?: () => void
  /** stagger offset (ms) for MenuList's initial-load fade-in — see animateIn
      on MenuList */
  enterDelay?: number
}

export const MenuItem = ({ item, selected, z, onSelect, onActivate, enterDelay = 0 }: MenuItemProps) => {
  const vars = {
    '--indent': `${item.indent}em`,
    '--scale': item.scale,
    '--rot': `${item.rot}deg`,
    '--skew': `${item.skew}deg`,
    '--row-color': item.tint,
    '--row-alpha': item.alpha,
    '--row-z': z,
    '--enter-delay': `${enterDelay}ms`,
  } as CSSProperties

  return (
    <button
      className={`menu-item${selected ? ' is-selected' : ''}`}
      style={vars}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      onClick={onActivate}
    >
      {selected && (
        <span className="menu-item-slash" aria-hidden="true">
          <span className="slash-tri slash-tri--magenta" />
          <span className="slash-tri slash-tri--white" />
        </span>
      )}
      <span className="menu-item-label">{item.label}</span>
      {selected && (
        <span className="menu-item-label-overlay" aria-hidden="true">
          <span className="menu-item-label-overlay-text">{item.label}</span>
        </span>
      )}
    </button>
  )
}
