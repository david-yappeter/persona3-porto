import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { TRACKS, type Track } from '../../data/tracks'
import { MusicPlayerContext, type MusicPlayerValue } from './context'
import { PLAYBACK_CONTROL_SELECTOR } from './playbackControl'

type MusicPlayerProviderProps = {
  children: ReactNode
  tracks?: Track[]
}

/** seconds spent ramping up when playback starts */
const FADE_IN = 2.5
/** seconds spent ramping down into the end of a track */
const FADE_OUT = 4

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1)

const VOLUME_KEY = 'persona:volume'

/* localStorage throws in private modes and sandboxed frames, so every access
   is guarded — a failure just means the level isn't remembered */
const readStoredVolume = () => {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    if (raw === null) return 1
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? clamp01(parsed) : 1
  } catch {
    return 1
  }
}

export const MusicPlayerProvider = ({ children, tracks = TRACKS }: MusicPlayerProviderProps) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  /* mirrors `playing` so callbacks can read it without going stale */
  const playingRef = useRef(false)
  /* set when skipping tracks, so the next one starts once its metadata lands */
  const resumeOnLoad = useRef(false)
  /* wall-clock start of the current fade-in — wall-clock, not media time, so
     seeking during the ramp doesn't throw the curve off */
  const fadeInFrom = useRef(0)
  const audioContext = useRef<AudioContext | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  /* mirrors `volume` so the per-frame envelope can read it without re-running */
  const volumeRef = useRef(readStoredVolume())

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(readStoredVolume)
  const [muted, setMuted] = useState(false)

  const track = tracks[index]

  const markPlaying = useCallback((value: boolean) => {
    playingRef.current = value
    setPlaying(value)
  }, [])

  const step = useCallback(
    (delta: number, forceResume = false) => {
      resumeOnLoad.current = forceResume || playingRef.current
      setCurrentTime(0)
      setIndex((i) => (i + delta + tracks.length) % tracks.length)
    },
    [tracks.length],
  )

  const next = useCallback(() => step(1), [step])
  const prev = useCallback(() => step(-1), [step])

  /* Roll into the next track when one finishes. Resume is forced rather than
     read from playingRef, because reaching the end pauses the element first. */
  const advance = useCallback(() => step(1, true), [step])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play().catch(() => {})
    else audio.pause()
  }, [])

  const seek = useCallback((ratio: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = Math.min(Math.max(ratio, 0), 1) * audio.duration
  }, [])

  const setVolume = useCallback((level: number) => {
    const next = clamp01(level)
    volumeRef.current = next
    setVolumeState(next)
    /* raising the level is an implicit un-mute */
    if (next > 0) setMuted(false)

    /* while paused nothing drives the envelope, so apply it directly */
    const audio = audioRef.current
    if (audio && !playingRef.current) audio.volume = next

    try {
      localStorage.setItem(VOLUME_KEY, String(next))
    } catch {
      /* storage unavailable — the level just won't survive a reload */
    }
  }, [])

  /* apply the remembered level to the element before anything plays */
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volumeRef.current
  }, [])

  const toggleMute = useCallback(() => setMuted((value) => !value), [])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.muted = muted
  }, [muted])

  /*
   * Tap the element into a Web Audio graph so visualisers can read the live
   * spectrum. createMediaElementSource can only ever be called once per
   * element, and from that point the element's output routes exclusively
   * through this graph — so the analyser must stay connected to destination or
   * playback goes silent. Built on first play, then reused.
   */
  const ensureAnalyser = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!audioContext.current) {
      try {
        const context = new AudioContext()
        const node = context.createAnalyser()
        node.fftSize = 128
        node.smoothingTimeConstant = 0.75

        context.createMediaElementSource(audio).connect(node)
        node.connect(context.destination)

        audioContext.current = context
        setAnalyser(node)
      } catch {
        /* no Web Audio available — playback still works, just no visualiser */
        return
      }
    }

    /* contexts start suspended until a gesture; harmless to call repeatedly */
    void audioContext.current?.resume().catch(() => {})
  }, [])

  /*
   * Volume envelope, driven per animation frame while playing.
   *
   * timeupdate only fires a few times a second, which is far too coarse to
   * ramp against — the fade would come out as audible steps. Both ends are
   * recomputed from scratch each frame rather than accumulated, so a pause,
   * seek or track change can't leave the volume stranded part-way.
   */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !playing) return

    let frame = 0
    const tick = () => {
      const elapsed = (performance.now() - fadeInFrom.current) / 1000
      let envelope = clamp01(elapsed / FADE_IN)

      const remaining = audio.duration - audio.currentTime
      if (Number.isFinite(remaining)) {
        envelope = Math.min(envelope, clamp01(remaining / FADE_OUT))
      }

      /* the fade is a multiplier on the listener's own level, never a
         replacement for it — otherwise every frame would undo the slider */
      audio.volume = envelope * volumeRef.current
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  /*
   * Start playing on load.
   *
   * Browsers refuse unmuted audio until the visitor has interacted with the
   * page, and a reload resets that — so the first attempt usually fails and
   * there is no way around it. We then listen for any gesture and retry, and
   * keep the listeners armed until a play() actually succeeds (a gesture the
   * browser doesn't count, like a stray wheel event, shouldn't burn the retry).
   */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const GESTURES = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    let settled = false

    const attach = () => {
      for (const type of GESTURES) window.addEventListener(type, start)
    }
    const detach = () => {
      for (const type of GESTURES) window.removeEventListener(type, start)
    }

    function start(event: Event) {
      if (settled) return

      /*
       * Skip controls that drive playback themselves. play() flips `paused` to
       * false synchronously, so without this a single click on the play button
       * runs both paths: this fallback starts it on pointerdown, then the
       * button's own onClick sees a playing element and pauses it again.
       */
      if (event.target instanceof Element && event.target.closest(PLAYBACK_CONTROL_SELECTOR)) {
        return
      }

      /* claim the attempt before awaiting, so a burst of events can't stack up */
      settled = true
      detach()
      void audio!.play().catch(() => {
        /* still blocked — put the listeners back for the next gesture */
        settled = false
        attach()
      })
    }

    void audio
      .play()
      .then(() => {
        settled = true
      })
      .catch(() => {
        if (!settled) attach()
      })

    return () => {
      settled = true
      detach()
    }
  }, [])

  const value = useMemo<MusicPlayerValue>(
    () => ({
      tracks,
      track,
      index,
      playing,
      currentTime,
      duration,
      toggle,
      next,
      prev,
      seek,
      analyser,
      volume,
      setVolume,
      muted,
      toggleMute,
    }),
    [
      tracks,
      track,
      index,
      playing,
      currentTime,
      duration,
      toggle,
      next,
      prev,
      seek,
      analyser,
      volume,
      setVolume,
      muted,
      toggleMute,
    ],
  )

  return (
    <MusicPlayerContext value={value}>
      <audio
        ref={audioRef}
        src={track.src}
        preload="auto"
        autoPlay
        onPlay={(e) => {
          /* silence it in the same tick playback begins, so the ramp has
             somewhere to start from and no full-volume frame slips out */
          e.currentTarget.volume = 0
          fadeInFrom.current = performance.now()
          ensureAnalyser()
          markPlaying(true)
        }}
        onPause={() => markPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget
          setDuration(audio.duration)

          /* Tracks can declare their own entry point (skipping an intro, say).
             Applied here rather than on play, so a later pause/resume keeps its
             position instead of snapping back. */
          if (track.startAt != null && track.startAt < audio.duration) {
            audio.currentTime = track.startAt
            setCurrentTime(track.startAt)
          }

          if (resumeOnLoad.current) {
            resumeOnLoad.current = false
            void audio.play().catch(() => {})
          }
        }}
        onEnded={advance}
      />
      {children}
    </MusicPlayerContext>
  )
}
