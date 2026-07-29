import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MusicPlayerProvider } from './hooks/MusicPlayer'
import { App } from './App'
import './fonts.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MusicPlayerProvider>
      <App />
    </MusicPlayerProvider>
  </StrictMode>,
)
