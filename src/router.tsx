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
        {
          path: 'careers',
          /* shared shell holding the background + 3D scene, so they persist
             between the list and a detail page. three.js (~500KB) is only
             needed here — code-split so "/" doesn't pay for it upfront */
          lazy: () => import('./pages/SkillLayout').then((m) => ({ Component: m.SkillLayout })),
          children: [
            { index: true, Component: Skill },
            {
              path: ':index',
              lazy: () => import('./pages/SkillDetail').then((m) => ({ Component: m.SkillDetail })),
            },
          ],
        },
      ],
    },
  ],
  /* Vite serves under a sub-path in production (see vite.config.ts), so the
     router has to be told about it or every route 404s on the deployed build. */
  { basename: import.meta.env.BASE_URL },
)
