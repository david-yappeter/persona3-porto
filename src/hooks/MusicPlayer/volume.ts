const VOLUME_KEY = 'persona:volume'
/** level until the visitor moves the slider */
export const DEFAULT_VOLUME = 0.5

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)

/* in-memory copy, so a level chosen before the player mounts (the loading
   screen's mute) still reaches it when storage is unavailable */
let session: number | null = null

/* localStorage throws in private modes and sandboxed frames, so every access
   is guarded — a failure just means the level isn't remembered */
export const readStoredVolume = () => {
  if (session !== null) return session
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw === null) return DEFAULT_VOLUME
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? clamp01(parsed) : DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME
  }
}

export const storeVolume = (level: number) => {
  session = clamp01(level)
  try {
    localStorage.setItem(VOLUME_KEY, String(session))
  } catch {
    /* storage unavailable — the level just won't survive a reload */
  }
}
