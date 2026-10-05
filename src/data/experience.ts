export type Experience = {
  headSrc: string
  title: string
  company: string
  period: string
  current?: boolean
  description: string[]
  /** full-body portrait shown on the detail page — only cropped for a few
      entries so far, see public/assets/head_row_*_portrait.png */
  portraitSrc?: string
  /** transparent company logo drawn on the 3D card's face, see ThreeCard */
  logoSrc?: string
}

export const EXPERIENCE: Experience[] = [
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_1_colored.png`,
    title: 'Software Development Engineer',
    company: 'GDP Labs, Jakarta',
    logoSrc: `${import.meta.env.BASE_URL}assets/company_logo/gdp-labs.webp`,
    period: 'Jun 2025 - Now',
    current: true,
    description: [
      'Backend engineer on an enterprise multi-tenant agentic AI chatbot platform.',
      'Wired up RAG pipelines, document processing, AI agents, and connectors.',
      'Built a Golang + React workflow to automate coding-test grading.',
    ],
    portraitSrc: `${import.meta.env.BASE_URL}assets/head_row_1_portrait.png`,
  },
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_2_colored.png`,
    title: 'Backend Developer',
    company: 'GWS Medika (Sinarmas Group), Medan',
    logoSrc: `${import.meta.env.BASE_URL}assets/company_logo/gws-medika.webp`,
    period: 'Oct 2022 - Feb 2025',
    description: [
      'Built a full-stack clinic management system from scratch.',
      'Covered patient registration, queue management, appointment scheduling, billing, and medical records.',
      'Shipped a bilingual CMS for the landing page.',
    ],
  },
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_3_colored.png`,
    title: 'Software Development Engineer',
    company: 'Two Miner Pte. Ltd., Medan',
    logoSrc: `${import.meta.env.BASE_URL}assets/company_logo/two-miner.webp`,
    period: 'Jan 2022 - Sep 2022',
    description: [
      'Developed fitness website features and an appointment booking system using Next.js.',
      'Customized WordPress sites to match client requirements.',
    ],
  },
  {
    headSrc: `${import.meta.env.BASE_URL}assets/head_row_4_colored.png`,
    title: 'Backend Developer',
    company: 'PT. Pundi Mas Berjaya, Medan',
    logoSrc: `${import.meta.env.BASE_URL}assets/company_logo/pt_pundi_mas_berjaya_logo.webp`,
    period: 'Jul 2020 - Jan 2022',
    description: [
      'Built an accounting module on a microservices architecture with gRPC.',
      'Built a POS system exposing both REST and GraphQL APIs.',
      'Integrated third-party APIs and optimized SQL queries for data transport.',
    ],
  },
]
