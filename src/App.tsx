import { useEffect, useState } from 'react'
import './App.css'

type MenuEntry = {
  label: string
  /** hand-placed horizontal offset, in em, to fake the scattered P3 layout */
  indent: number
  /** per-item size multiplier */
  scale: number
  /** baseline tilt in degrees — deliberately uneven, like the game's hand-set type */
  rot: number
  /** glyph lean in degrees, also varied per row */
  skew: number
  /** cyan shade for this row — kept within a narrow band so rows read as one set */
  tint: string
  /** row opacity, another small nudge in apparent brightness */
  alpha: number
}

const MENU_ITEMS: MenuEntry[] = [
  { label: 'SKILL', indent: 0.35, scale: 1.0, rot: -7, skew: -14, tint: '#4fe0f8', alpha: 0.98 },
  { label: 'ITEM', indent: 0.3, scale: 1.02, rot: -11, skew: -9, tint: '#3ccfec', alpha: 1 },
  { label: 'EQUIP', indent: 0.4, scale: 1.0, rot: -6, skew: -16, tint: '#58e6fb', alpha: 0.93 },
  { label: 'PERSONA', indent: 0.0, scale: 1.06, rot: -9, skew: -11, tint: '#35c6e4', alpha: 1 },
  { label: 'STATS', indent: 0.6, scale: 0.98, rot: -13, skew: -13, tint: '#4adcf6', alpha: 0.96 },
  { label: 'QUEST', indent: 0.3, scale: 0.98, rot: -7, skew: -17, tint: '#2fbcd9', alpha: 1 },
  {
    label: 'SOCIAL LINK',
    indent: 0.4,
    scale: 1.04,
    rot: -10,
    skew: -10,
    tint: '#52e2f8',
    alpha: 0.92,
  },
  { label: 'CALENDAR', indent: 0.1, scale: 1.04, rot: -6, skew: -15, tint: '#3ad2ef', alpha: 1 },
  { label: 'SYSTEM', indent: 0.45, scale: 1.0, rot: -12, skew: -12, tint: '#62eaff', alpha: 0.97 },
]

export default function App() {
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setSelected((i) => (i + 1) % MENU_ITEMS.length)
      } else if (e.key === 'ArrowUp') {
        setSelected((i) => (i - 1 + MENU_ITEMS.length) % MENU_ITEMS.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="menu-screen">
      <video
        className="bg-video"
        src="/assets/persona_3_menu_bg.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="bg-wash" />
      <div className="bg-glow" />

      <div className="deco-type" aria-hidden="true">
        WA
      </div>

      <div className="wallet-box">
        <span className="wallet-amount">¥47,407</span>
        <span className="wallet-label">current wallet</span>
      </div>

      <nav className="menu-list">
        {MENU_ITEMS.map((item, i) => (
          <button
            key={item.label}
            className={`menu-item${i === selected ? ' is-selected' : ''}`}
            style={
              {
                '--indent': `${item.indent}em`,
                '--scale': item.scale,
                '--rot': `${item.rot}deg`,
                '--skew': `${item.skew}deg`,
                '--row-color': item.tint,
                '--row-alpha': item.alpha,
              } as React.CSSProperties
            }
            onMouseEnter={() => setSelected(i)}
            onFocus={() => setSelected(i)}
          >
            {i === selected && (
              <span className="menu-item-slash" aria-hidden="true">
                <span className="slash-tri slash-tri--magenta" />
                <span className="slash-tri slash-tri--white" />
              </span>
            )}
            <span className="menu-item-label">{item.label}</span>
            {i === selected && (
              <span className="menu-item-label-overlay" aria-hidden="true">
                <span className="menu-item-label-overlay-text">{item.label}</span>
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="command-hint">
        <span className="command-hint-title">Use a Skill</span>
        <span className="command-hint-sub">Command</span>
      </div>
    </div>
  )
}
