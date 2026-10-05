const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

/* the wav files themselves are loudness-matched (~-24 LUFS, peaks under
   -3 dBFS), so every cue plays at the same perceived level and this table
   is just names — no per-clip gain fudging needed here */
export const SFX = {
  slideUp: asset('sound/deck_ui_slider_up.wav'),
  slideDown: asset('sound/deck_ui_slider_down.wav'),
  flyIn: asset('sound/deck_ui_side_menu_fly_in.wav'),
  flyOut: asset('sound/deck_ui_side_menu_fly_out.wav'),
  intoDetail: asset('sound/deck_ui_into_game_detail.wav'),
  outOfDetail: asset('sound/deck_ui_out_of_game_detail.wav'),
  switchEntry: asset('sound/deck_ui_volume.wav'),
} as const

export type SfxName = keyof typeof SFX

/** overall sfx level, kept under the music so cues sit on top of it
    instead of punching through */
const MASTER_GAIN = 0.7
/** the same cue firing again inside this window is treated as one press —
    swallows key auto-repeat bursts and hover/keyboard double-triggers */
const RETRIGGER_GUARD = 0.035
/** fade applied when a newer play of the same cue cuts off the old one, so
    the cut doesn't click */
const CUT_FADE = 0.015
/** a cue whose buffer is still decoding gets dropped if it would land later
    than this — a late click is worse than a missing one */
const MAX_LATE = 0.12

type Voice = { source: AudioBufferSourceNode; gain: GainNode }

let context: AudioContext | null = null
let master: GainNode | null = null
const buffers = new Map<SfxName, Promise<AudioBuffer | null>>()
const voices = new Map<SfxName, Voice>()
/* context time of the last accepted request per cue — set synchronously,
   unlike `voices`, which only fills once the buffer promise resolves */
const lastRequest = new Map<SfxName, number>()

/*
 * Web Audio instead of one <audio> element per cue: decoded buffers start
 * sample-accurately with no media-element seek, every play gets a fresh
 * source node (so rapid presses never get swallowed by a pending rewind),
 * and one shared context means one autoplay unlock for every cue.
 */
const getContext = () => {
  if (context) return context
  try {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(context.destination)
  } catch {
    /* no Web Audio — sfx just stay silent, nothing else depends on them */
    context = null
  }
  return context
}

const load = (name: SfxName) => {
  const cached = buffers.get(name)
  if (cached) return cached
  const ctx = getContext()
  const pending: Promise<AudioBuffer | null> = ctx
    ? fetch(SFX[name])
        .then((res) => res.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => {
          /* forget the failure so a later play can retry the fetch */
          buffers.delete(name)
          return null
        })
    : Promise.resolve(null)
  buffers.set(name, pending)
  return pending
}

/** fetch + decode every cue up front so the first press isn't the one that waits */
export const preloadSfx = () => {
  for (const name of Object.keys(SFX) as SfxName[]) void load(name)
}

export const playSfx = (name: SfxName) => {
  const ctx = getContext()
  if (!ctx || !master) return
  /* the context starts suspended until the page has had a user gesture —
     every cue comes from one, so resuming here is what unlocks it */
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})

  /* performance.now, not ctx.currentTime — a suspended context's clock
     stands still, which would make every request look like a retrigger */
  const requestedAt = performance.now() / 1000
  const previous = lastRequest.get(name)
  if (previous !== undefined && requestedAt - previous < RETRIGGER_GUARD) return
  lastRequest.set(name, requestedAt)

  void load(name).then((buffer) => {
    if (!buffer || !master) return
    if (performance.now() / 1000 - requestedAt > MAX_LATE) return
    const now = ctx.currentTime

    /* one voice per cue — a held arrow key retriggers the click cleanly
       instead of stacking copies of it into a louder, smeared mess */
    const old = voices.get(name)
    if (old) {
      old.gain.gain.setValueAtTime(old.gain.gain.value, now)
      old.gain.gain.linearRampToValueAtTime(0, now + CUT_FADE)
      old.source.stop(now + CUT_FADE)
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    source.connect(gain).connect(master)
    const voice: Voice = { source, gain }
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      if (voices.get(name) === voice) voices.delete(name)
    }
    voices.set(name, voice)
    source.start(now)
  })
}
