export type Credit = {
  /** ribbon on the row's left edge */
  tag: string
  title: string
  /** who made it */
  author: string
  license: string
  url?: string
}

const head = (n: number) => `${import.meta.env.BASE_URL}assets/head_row_${n}_colored.png`
/* the party heads the list rows wear, cycled down the list (the careers
   list uses rows 1–4) */
export const CREDIT_HEADS = [5, 6, 7, 8, 9, 10, 1, 2, 3, 4].map(head)

/** what the site is built from — artwork, sound and code by other people */
export const CREDITS: Credit[] = [
  {
    tag: 'Model',
    title: 'Makoto Yuki 3D model',
    author: '雨宮レン · Sketchfab',
    license: 'CC BY 4.0',
    url: 'https://sketchfab.com/3d-models/makoto-yuki-persona-5-royal-dlc-batlle-bundle-3db577331f5442c79ec7cd0ac181adf2',
  },
  {
    tag: 'Art',
    title: 'Persona 3 Reload menus',
    author: 'ATLUS · menu videos, portraits, UI art',
    license: '© ATLUS / SEGA',
    url: 'https://www.atlus.com/',
  },
  {
    tag: 'Music',
    title: 'Persona 3 Reload OST',
    author: 'ATLUS Sound Team',
    license: '© ATLUS / SEGA',
    url: 'https://www.atlus.com/',
  },
  {
    tag: 'Sound',
    title: 'Steam Deck UI sounds',
    author: 'Valve',
    license: '© Valve',
    url: 'https://www.steamdeck.com/',
  },
]
