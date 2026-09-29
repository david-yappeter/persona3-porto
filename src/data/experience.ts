export type Experience = {
  headSrc: string
  title: string
  company: string
  period: string
  current?: boolean
}

export const EXPERIENCE: Experience[] = [
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_1_colored.png`,
    title: 'Software Development Engineer',
    company: 'GDP Labs, Jakarta',
    period: 'Jun 2025 - Now',
    current: true,
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
