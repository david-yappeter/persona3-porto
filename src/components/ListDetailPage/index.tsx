import { useEffect, type ReactNode } from 'react'
import { BasicRow } from '../BasicRow'
import { FallingFigure } from '../FallingFigure'
import { MenuBackground } from '../MenuBackground'
import { useMenuNavigation } from '../../hooks/MenuNavigation'
import { playSfx } from '../../utils/sfx'
import './ListDetailPage.css'

const OCEAN_BG = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg_ocean_seamless.mp4`

export type ListEntry = {
  key: string
  imageSrc: string
  title: string
  subtitle: string
  aside: string
  tag?: string
  /** opened by Enter (and by a click when openOnClick) */
  url?: string
  /** shown on the white band while this row is selected */
  detail: ReactNode
}

export const openUrl = (url?: string) => {
  if (!url) return
  playSfx('activate')
  if (url.startsWith('mailto:')) window.location.href = url
  else window.open(url, '_blank', 'noopener,noreferrer')
}

type ListDetailPageProps = {
  /** huge grey page name along the bottom, like the equip menu's "EQUIP" */
  title: string
  entries: ListEntry[]
  /** a click opens the row's url instead of just selecting it */
  openOnClick?: boolean
}

/**
 * P3R equip-menu layout shared by BUILD / STUDY / LINKS: BasicRow list down
 * the left (arrows / hover move the cursor), the selected row's detail on a
 * white diagonal band to the right with the page name in huge grey type
 * on it, and Makoto falling through (band and name are drawn with him, by
 * FallingFigure).
 */
export const ListDetailPage = ({ title, entries, openOnClick = false }: ListDetailPageProps) => {
  const { selected, moveTo } = useMenuNavigation(entries.length)
  const current = entries[selected]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
      e.preventDefault()
      openUrl(current.url)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current])

  return (
    <>
      <MenuBackground videoSrc={OCEAN_BG} />
      <FallingFigure title={title} />
      <div className="list-detail-list">
        {entries.map((entry, i) => (
          <BasicRow
            key={entry.key}
            imageSrc={entry.imageSrc}
            title={entry.title}
            subtitle={entry.subtitle}
            aside={entry.aside}
            tag={entry.tag}
            selected={i === selected}
            onSelect={() => moveTo(i)}
            onActivate={() => (openOnClick ? openUrl(entry.url) : moveTo(i))}
          />
        ))}
      </div>
      {/* keyed so each entry's detail slides in fresh */}
      <div className="list-detail-panel" key={current.key}>
        {current.detail}
      </div>
    </>
  )
}

/** navy pill label + its lines, like the equip menu's "Weapon" / "Armor" */
export const DetailSection = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="detail-section">
    <h3 className="detail-pill">{label}</h3>
    <div className="detail-body">{children}</div>
  </section>
)

export const DetailHeading = ({ title, sub }: { title: string; sub?: string }) => (
  <header className="detail-heading">
    <h2>{title}</h2>
    {sub && <p>{sub}</p>}
  </header>
)

export const DetailChips = ({ items }: { items: string[] }) => (
  <ul className="detail-chips">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
)

export const DetailLinks = ({ links }: { links: { label: string; url: string }[] }) => (
  <ul className="detail-links">
    {links.map((link) => (
      <li key={link.url}>
        <a
          href={link.url}
          target={link.url.startsWith('mailto:') ? undefined : '_blank'}
          rel="noreferrer"
          onClick={() => playSfx('activate')}
        >
          {link.label} <span aria-hidden="true">↗</span>
        </a>
      </li>
    ))}
  </ul>
)
