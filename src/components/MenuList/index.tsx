import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
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
  const navigate = useNavigate()

  /* plain navigate — RouteTransition handles the reveal itself, see
     src/components/RouteTransition */
  const activate = (index: number) => {
    const item = items[index]
    if (item.to) navigate(item.to)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      /* let a focused control (e.g. the volume slider) handle its own Enter */
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      e.preventDefault()
      activate(selected)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, selected, navigate])

  return (
    <nav className="menu-list">
      {items.map((item, i) => (
        <MenuItem
          key={item.label}
          item={item}
          selected={i === selected}
          z={rowZ[i]}
          onSelect={() => onSelect(i)}
          onActivate={item.to ? () => activate(i) : undefined}
        />
      ))}
    </nav>
  )
}
