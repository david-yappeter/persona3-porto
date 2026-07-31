import { createBrowserRouter } from 'react-router'
import { RootLayout } from './layouts/RootLayout'
import { MainMenu } from './pages/MainMenu'
import { Skill } from './pages/Skill'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      Component: RootLayout,
      children: [
        { index: true, Component: MainMenu },
        { path: 'skill', Component: Skill },
      ],
    },
  ],
  /* Vite serves under a sub-path in production (see vite.config.ts), so the
     router has to be told about it or every route 404s on the deployed build. */
  { basename: import.meta.env.BASE_URL },
)
