import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/* GitHub Pages has no SPA fallback: reloading a deep link like
   /persona3-porto/careers/0 asks for a file that doesn't exist and gets
   Pages' own 404. Pages serves the site's 404.html for any missing path, so
   a copy of index.html there boots the app on every route and React Router
   takes it from the URL. */
const spaFallback = (): Plugin => {
  let outDir = 'dist'
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle: () => copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html')),
  }
}

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/persona3-porto/' : '/',
  plugins: [react(), spaFallback()],
}))
