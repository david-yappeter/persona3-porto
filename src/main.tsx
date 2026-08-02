import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AssetPreloader } from './components/AssetPreloader'
import { MusicPlayerProvider } from './hooks/MusicPlayer'
import { router } from './router'
import './fonts.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AssetPreloader>
      <MusicPlayerProvider>
        <RouterProvider router={router} />
      </MusicPlayerProvider>
    </AssetPreloader>
  </StrictMode>,
)
