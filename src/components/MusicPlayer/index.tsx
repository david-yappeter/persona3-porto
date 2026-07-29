import type { CSSProperties } from 'react'
import { playbackControlProps, useMusicPlayer } from '../../hooks/MusicPlayer'
import { Waveform } from './Waveform'
import './MusicPlayer.css'

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export const MusicPlayer = () => {
  const {
    track,
    playing,
    currentTime,
    duration,
    toggle,
    next,
    prev,
    seek,
    volume,
    setVolume,
    muted,
    toggleMute,
  } = useMusicPlayer()
  const ratio = duration > 0 ? currentTime / duration : 0

  return (
    <div className="music-player">
      <span className="music-player-eyebrow">Now Playing</span>
      <span className="music-player-title">{track.title}</span>

      <Waveform />

      <div
        className="music-player-scrub"
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        onClick={(e) => {
          const bar = e.currentTarget.getBoundingClientRect()
          seek((e.clientX - bar.left) / bar.width)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') seek(ratio - 0.05)
          if (e.key === 'ArrowRight') seek(ratio + 0.05)
        }}
      >
        <span className="music-player-scrub-fill" style={{ width: `${ratio * 100}%` }} />
      </div>

      <div className="music-player-row">
        <div className="music-player-controls">
          <button type="button" onClick={prev} aria-label="Previous track">
            &#9664;&#9664;
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
            {...playbackControlProps}
          >
            {playing ? <>&#10074;&#10074;</> : <>&#9654;</>}
          </button>
          <button type="button" onClick={next} aria-label="Next track">
            &#9654;&#9654;
          </button>
        </div>

        <span className="music-player-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div className="music-player-volume">
        <button
          type="button"
          className="music-player-mute"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          aria-pressed={muted}
        >
          <SpeakerIcon muted={muted || volume === 0} />
        </button>

        <input
          className="music-player-volume-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(e.currentTarget.valueAsNumber)}
          /* hand focus back to the page after a drag, so the arrow keys go on
             driving the menu. Pointer-only: keyboard users keep their focus. */
          onPointerUp={(e) => e.currentTarget.blur()}
          aria-label="Volume"
          style={{ '--level': `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
        />
      </div>
    </div>
  )
}

const SpeakerIcon = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
    <path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor" />
    {muted ? (
      <path
        d="M10.5 6.5l3 3M13.5 6.5l-3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    ) : (
      <>
        <path d="M10.5 6a3 3 0 010 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M12.5 4a6 6 0 010 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </>
    )}
  </svg>
)
