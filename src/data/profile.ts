/* everything on the BUILD / LINKS pages, from the CV
   (david-yappeter.pdf) */

const head = (n: number) => `${import.meta.env.BASE_URL}assets/head_row_${n}_colored.png`

export type Link = { label: string; url: string }

export type Project = {
  /** ribbon on the row's left edge */
  tag: string
  title: string
  summary: string
  stack: string[]
  highlights: string[]
  links: Link[]
  /** small print under the highlights */
  note?: string
  imageSrc: string
}

export const PROJECTS: Project[] = [
  {
    tag: 'Web',
    title: 'Persona Portfolio',
    summary: 'This site, P3 Reload style',
    stack: ['React', 'TypeScript', 'three.js', 'Vite'],
    highlights: [
      'Portfolio styled after the Persona 3 Reload menus, with a posed, toon-shaded 3D model.',
      'Procedural hair / cloth wind, a falling-figure loop and live posing labs.',
    ],
    links: [
      { label: 'Live', url: 'https://david-yappeter.github.io/persona3-porto/' },
      { label: 'GitHub', url: 'https://github.com/david-yappeter/persona3-porto' },
    ],
    note: 'Add ?lab to a page (e.g. /builds?lab) for the posing tools.',
    imageSrc: head(1),
  },
  {
    tag: 'Thesis',
    title: 'POS System',
    summary: 'Building-materials shop POS',
    stack: ['Golang', 'PostgreSQL', 'React', 'Next.js', 'Docker'],
    highlights: [
      'Inventory, sales and reporting modules for a building materials shop.',
      'Deployed on Vercel with a GitLab CI/CD pipeline.',
    ],
    links: [
      { label: 'Live demo', url: 'https://skripsi-setia-abadi.vercel.app/' },
      { label: 'GitLab', url: 'https://gitlab.com/setia-abadi' },
    ],
    note: 'Demo login: super.admin.one / 123456',
    imageSrc: head(9),
  },
  {
    tag: 'Web',
    title: 'Moneta',
    summary: 'Cashflow management',
    stack: ['Golang', 'PostgreSQL', 'React'],
    highlights: ['Personal finance tracking and cashflow management.', 'Transaction categorisation and financial reports.'],
    links: [{ label: 'Live', url: 'https://moneta.mikroskil.com/' }],
    imageSrc: head(10),
  },
  {
    tag: 'Web',
    title: 'Trello Clone',
    summary: 'Kanban board',
    stack: ['Golang', 'PostgreSQL', 'React'],
    highlights: ['Task management with drag-and-drop boards.', 'Real-time updates and collaboration.'],
    links: [
      { label: 'Live', url: 'https://noteapp.mikroskil.com/' },
      { label: 'GitHub', url: 'https://github.com/david-yappeter/noteapp-backend' },
    ],
    imageSrc: head(5),
  },
  {
    tag: 'Mobile',
    title: 'Minister of Finance',
    summary: 'Offline-first money manager',
    stack: ['Flutter', 'SQLite', 'GetX'],
    highlights: ['Offline-first money management app, published on Google Play.', 'Transactions kept locally in SQLite.'],
    links: [{ label: 'GitHub', url: 'https://github.com/david-yappeter/mof' }],
    note: 'Later removed from Google Play after a Play Store policy update.',
    imageSrc: head(6),
  },
  {
    tag: 'Web',
    title: 'CV Website',
    summary: 'The CV as a static site',
    stack: ['HTML', 'CSS', 'Gulp', 'Puppeteer'],
    highlights: ['Static HTML/CSS CV with an automated build.', 'Gulp minifies and processes assets; Puppeteer exports the matching PDF.'],
    links: [
      { label: 'Live', url: 'https://david-yappeter.github.io/CV/' },
      { label: 'GitHub', url: 'https://github.com/david-yappeter/cv' },
    ],
    imageSrc: head(7),
  },
]

export type Contact = { tag: string; title: string; handle: string; url: string; imageSrc: string; blurb: string }

export const CONTACTS: Contact[] = [
  {
    tag: 'Mail',
    title: 'Email',
    handle: 'davidyap11les@gmail.com',
    url: 'mailto:davidyap11les@gmail.com',
    blurb: 'The quickest way to reach me.',
    imageSrc: head(1),
  },
  {
    tag: 'Work',
    title: 'LinkedIn',
    handle: 'in/david-yappeter',
    url: 'https://linkedin.com/in/david-yappeter',
    blurb: 'Career history and recommendations.',
    imageSrc: head(2),
  },
  {
    tag: 'Code',
    title: 'GitHub',
    handle: 'david-yappeter',
    url: 'https://github.com/david-yappeter',
    blurb: 'Side projects and the code behind them.',
    imageSrc: head(5),
  },
  {
    tag: 'Q&A',
    title: 'Stack Overflow',
    handle: 'users/17488015',
    url: 'https://stackoverflow.com/users/17488015/david-yappeter',
    blurb: 'Answers and questions.',
    imageSrc: head(6),
  },
  {
    tag: 'Blog',
    title: 'Medium',
    handle: '@david-yappeter',
    url: 'https://medium.com/@david-yappeter',
    blurb: 'Write-ups and notes.',
    imageSrc: head(7),
  },
  {
    tag: 'CV',
    title: 'CV Website',
    handle: 'david-yappeter.github.io/CV',
    url: 'https://david-yappeter.github.io/CV/',
    blurb: 'The one-page CV, with a PDF export.',
    imageSrc: head(8),
  },
]
