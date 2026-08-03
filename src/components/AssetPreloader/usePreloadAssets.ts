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
async function fetchToCache(url: string, onBytes: (loaded: number) => void) {
  const res = await fetch(url)
  const reader = res.body?.getReader()
  if (!reader) return
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    loaded += value.length
    onBytes(loaded)
  }
}

async function contentLengthOf(asset: PreloadAsset): Promise<number> {
  if (asset.kind === 'font') return FONT_WEIGHT
  try {
    const res = await fetch(asset.url, { method: 'HEAD' })
    return Number(res.headers.get('content-length')) || 0
  } catch {
    return 0
  }
}

function makeProgressSetter(loaded: number[], i: number, report: () => void) {
  return (l: number) => {
    loaded[i] = l
    report()
  }
}

/** downloads one asset, calling onProgress(loadedBytes) as it streams in */
async function loadOne(asset: PreloadAsset, onProgress: (loaded: number) => void, total: number) {
  try {
    if (asset.kind === 'font') await loadFont()
    else await fetchToCache(asset.url, onProgress)
  } catch {
    // a broken asset shouldn't hang the loading screen forever
  }
  onProgress(total)
}

/** 0–1 download progress across `manifest`, and whether every asset has
    settled (loaded or failed) */
export function usePreloadAssets(manifest: PreloadAsset[]) {
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      /*
       * Resolve every total up front via HEAD, before any GET starts — the
       * bar's denominator has to be fixed from the first render, or else it
       * keeps growing as each file's headers trickle in, which makes the
       * ratio visibly dip/reset every time a new file joins the total.
       */
      const totals = await Promise.all(manifest.map(contentLengthOf))
      if (cancelled) return

      const loaded: number[] = manifest.map(() => 0)
      const report = () => {
        if (cancelled) return
        const sumLoaded = loaded.reduce((a, b) => a + b, 0)
        const sumTotal = totals.reduce((a, b) => a + b, 0)
        setProgress(sumTotal > 0 ? sumLoaded / sumTotal : 0)
      }

      await Promise.all(
        manifest.map((asset, i) =>
          loadOne(asset, makeProgressSetter(loaded, i, report), totals[i]),
        ),
      )
      if (!cancelled) setDone(true)
    }

    void run()

    return () => {
      cancelled = true
    }
    // manifest is a static module-level constant — intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { progress, done }
}
