import type { MenuEntry } from '../../data/menuItems'

/** perceived brightness of a #rrggbb colour, 0–255 */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
}

/*
 * The rows overlap, so paint order decides which one wins along the seams.
 * Rank them by how bright they actually appear (tint luminance scaled by the
 * row's opacity) and hand out z-index in that order — brightest on top.
 */
export function stackingOrder(items: MenuEntry[]): number[] {
  const z: number[] = []
  items
    .map((item, i) => ({ i, brightness: luminance(item.tint) * item.alpha }))
    .sort((a, b) => a.brightness - b.brightness)
    .forEach((row, rank) => {
      z[row.i] = rank + 1
    })
  return z
}
