import { useMemo } from 'react'
import type { MenuEntry } from '../../data/menuItems'
import { MenuItem } from '../MenuItem'
import { stackingOrder } from './stacking'
import './MenuList.css'

type MenuListProps = {
  items: MenuEntry[]
  selected: number
  onSelect: (index: number) => void
}

export const MenuList = ({ items, selected, onSelect }: MenuListProps) => {
  const rowZ = useMemo(() => stackingOrder(items), [items])

  return (
    <nav className="menu-list">
      {items.map((item, i) => (
        <MenuItem
          key={item.label}
          item={item}
          selected={i === selected}
          z={rowZ[i]}
          onSelect={() => onSelect(i)}
        />
      ))}
    </nav>
  )
}
