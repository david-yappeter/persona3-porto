import { useEffect, useState } from 'react'
import type { PreloadAsset } from './manifest'

/** flat byte-weight for a font — it has no meaningful content-length to
    stream against, this just keeps it from being invisible in the bar */
const FONT_WEIGHT = 32_000

async function loadFont() {
  await document.fonts.load('900 1em "Eurostile Extended"')
}

/** GETs the file and reads it to completion so it's sitting in the HTTP
    cache by the time a <video>/<audio> element requests the same URL —
    reporting bytes read as it goes, via onBytes */
async function fetchToCache(url: string, onBytes: (loaded: number, total: number) => void) {
  const res = await fetch(url)
  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body?.getReader()
  if (!reader) {
    onBytes(total, total)
    return
  }
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    loaded += value.length
    onBytes(loaded, total)
  }
}

/** 0–1 download progress across `manifest`, and whether every asset has
    settled (loaded or failed — a broken asset shouldn't hang the app on
    the loading screen forever) */
export function usePreloadAssets(manifest: PreloadAsset[]) {
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loaded: number[] = manifest.map(() => 0)
    const total: number[] = manifest.map((a) => (a.kind === 'font' ? FONT_WEIGHT : 0))

    const report = () => {
      if (cancelled) return
      const sumLoaded = loaded.reduce((a, b) => a + b, 0)
      const sumTotal = total.reduce((a, b) => a + b, 0)
      setProgress(sumTotal > 0 ? sumLoaded / sumTotal : 0)
    }

    const settle = (i: number) => {
      loaded[i] = total[i] || loaded[i]
      report()
    }

    const tasks = manifest.map((a, i) =>
      (a.kind === 'font'
        ? loadFont()
        : fetchToCache(a.url, (l, t) => {
            loaded[i] = l
            total[i] = t
            report()
          })
      )
        .catch(() => {})
        .then(() => settle(i)),
    )

    void Promise.all(tasks).then(() => {
      if (!cancelled) setDone(true)
    })

    return () => {
      cancelled = true
    }
    // manifest is a static module-level constant — intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { progress, done }
}
