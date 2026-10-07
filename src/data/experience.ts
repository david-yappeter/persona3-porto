export type Experience = {
  headSrc: string
  title: string
  company: string
  period: string
  current?: boolean
  description: string[]
  /** P3R social-link bust-up shown bottom-right on the detail page: a
      2048² canvas with the character in its lower right, see SkillDetail.css */
  bustupSrc: string
  /** the name + description box over the bust-up: the company, in a line */
  about: { name: string; text: string }
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
    bustupSrc: `${import.meta.env.BASE_URL}assets/T_UI_Camp_Commu_Bustup_0400.png`,
    about: {
      name: 'GDP Labs',
      text: 'GDP Labs is a portfolio company of GDP Venture (Djarum). Its product focused on AI-Driven Product.',
    },
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
    bustupSrc: `${import.meta.env.BASE_URL}assets/T_UI_Camp_Commu_Bustup_0600.png`,
    about: {
      name: 'GWS Medika',
      text: 'GWS Medika is part of Sinarmas Subsidiary. Its focus is on the part of healthcare nobody puts on a billboard: the weeks after the hospital discharges you.',
    },
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
    bustupSrc: `${import.meta.env.BASE_URL}assets/T_UI_Camp_Commu_Bustup_0700.png`,
    about: {
      name: 'Two Miner',
      text: 'Two Miner Pte. Ltd., Medan. A software house serving clients primarily from Singapore.',
    },
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
    bustupSrc: `${import.meta.env.BASE_URL}assets/T_UI_Camp_Commu_Bustup_1400.png`,
    about: {
      name: 'Pundi Mas Berjaya',
      text: 'PT. Pundi Mas Berjaya, Medan. A software company serving both internal and external client products.',
    },
  },
]
