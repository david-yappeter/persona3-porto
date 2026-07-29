import type { CSSProperties } from 'react'
import type { MenuEntry } from '../../data/menuItems'
import './MenuItem.css'

type MenuItemProps = {
  item: MenuEntry
  selected: boolean
  /** paint order among the overlapping rows — see stackingOrder in MenuList */
  z: number
  onSelect: () => void
}

export const MenuItem = ({ item, selected, z, onSelect }: MenuItemProps) => {
  const vars = {
    '--indent': `${item.indent}em`,
    '--scale': item.scale,
    '--rot': `${item.rot}deg`,
    '--skew': `${item.skew}deg`,
    '--row-color': item.tint,
    '--row-alpha': item.alpha,
    '--row-z': z,
  } as CSSProperties

  return (
    <button
      className={`menu-item${selected ? ' is-selected' : ''}`}
      style={vars}
      onMouseEnter={onSelect}
      onFocus={onSelect}
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
