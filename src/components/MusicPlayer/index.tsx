import { useMusicPlayer } from '../../hooks/MusicPlayer'
import { Waveform } from './Waveform'
import './MusicPlayer.css'

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export const MusicPlayer = () => {
  const { track, playing, currentTime, duration, toggle, next, prev, seek } = useMusicPlayer()
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
    </div>
  )
}
