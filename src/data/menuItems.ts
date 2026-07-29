export type MenuEntry = {
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

export const MENU_ITEMS: MenuEntry[] = [
  { label: 'SKILL', indent: 0.35, scale: 1.0, rot: -7, skew: -20, tint: '#4fe0f8', alpha: 0.98 },
  { label: 'ITEM', indent: 0.3, scale: 1.02, rot: -11, skew: -18, tint: '#3ccfec', alpha: 1 },
  { label: 'EQUIP', indent: 0.4, scale: 1.0, rot: -6, skew: -22, tint: '#58e6fb', alpha: 0.93 },
  { label: 'PERSONA', indent: 0.0, scale: 1.06, rot: -9, skew: -19, tint: '#35c6e4', alpha: 1 },
  { label: 'STATS', indent: 0.6, scale: 0.98, rot: -13, skew: -21, tint: '#4adcf6', alpha: 0.96 },
  { label: 'QUEST', indent: 0.3, scale: 0.98, rot: -7, skew: -20, tint: '#2fbcd9', alpha: 1 },
  {
    label: 'SOCIAL LINK',
    indent: 0.4,
    scale: 1.04,
    rot: -10,
    skew: -18,
    tint: '#52e2f8',
    alpha: 0.92,
  },
  { label: 'CALENDAR', indent: 0.1, scale: 1.04, rot: -6, skew: -21, tint: '#3ad2ef', alpha: 1 },
  { label: 'SYSTEM', indent: 0.45, scale: 1.0, rot: -12, skew: -19, tint: '#62eaff', alpha: 0.97 },
]
