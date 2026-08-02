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
  /** bottom-to-top staggered opacity fade-in for the rows — meant only for a
      true page load of "/", not SPA nav back to it, see MainMenu's
      hasPlayedEntrance */
  animateIn?: boolean
}

/** stagger step between adjacent rows, bottom row first */
const INITIAL_ENTER_DELAY = 950
const ENTER_STEP_MS = 50

export const MenuList = ({ items, selected, onSelect, animateIn = false }: MenuListProps) => {
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
    <nav className={`menu-list${animateIn ? ' menu-list--entering' : ''}`}>
      {items.map((item, i) => (
        <MenuItem
          key={item.label}
          item={item}
          selected={i === selected}
          z={rowZ[i]}
          enterDelay={INITIAL_ENTER_DELAY + (items.length - 1 - i) * ENTER_STEP_MS}
          onSelect={() => onSelect(i)}
          onActivate={item.to ? () => activate(i) : undefined}
        />
      ))}
    </nav>
  )
}
