export type Experience = {
  headSrc: string
  title: string
  company: string
  period: string
  current?: boolean
  /** full-body portrait shown on the detail page — only cropped for a few
      entries so far, see public/assets/head_row_*_portrait.png */
  portraitSrc?: string
}

export const EXPERIENCE: Experience[] = [
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_1_colored.png`,
    title: 'Software Development Engineer',
    company: 'GDP Labs, Jakarta',
    period: 'Jun 2025 - Now',
    current: true,
    portraitSrc: `${import.meta.env.BASE_URL}assets/head_row_1_portrait.png`,
  },
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_2_colored.png`,
    title: 'Backend Developer',
    company: 'GWS Medika (Sinarmas Group), Medan',
    period: 'Oct 2022 - Feb 2025',
  },
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_3_colored.png`,
    title: 'Software Development Engineer',
    company: 'Two Miner Pte. Ltd., Medan',
    period: 'Jan 2022 - Sep 2022',
  },
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_4_colored.png`,
    title: 'Backend Developer',
    company: 'PT. Pundi Mas Berjaya, Medan',
    period: 'Jul 2020 - Jan 2022',
  },
]
