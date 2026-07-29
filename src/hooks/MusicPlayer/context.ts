import { createContext } from 'react'
import type { Track } from '../../data/tracks'

export type MusicPlayerValue = {
  tracks: Track[]
  track: Track
  index: number
  playing: boolean
  currentTime: number
  duration: number
  toggle: () => void
  next: () => void
  prev: () => void
  /** jump to a position given as 0–1 of the track's length */
  seek: (ratio: number) => void
  /** live frequency data for visualisers; null until playback first starts */
  analyser: AnalyserNode | null
}

export const MusicPlayerContext = createContext<MusicPlayerValue | null>(null)
