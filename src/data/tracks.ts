export type Track = {
  id: string
  title: string
  src: string
  /** seconds to begin playback from — applied each time the track loads */
  startAt?: number
}

export const TRACKS: Track[] = [
  {
    id: 'changing-seasons-reload',
    title: 'Changing Seasons -Reload-',
    src: '/music/changing-seasons-reload.m4a',
    startAt: 30,
  },
  { id: 'color-your-night', title: 'Color Your Night', src: '/music/color-your-night.m4a' },
  { id: 'its-going-down-now', title: 'It’s Going Down Now', src: '/music/its-going-down-now.m4a' },
  {
    id: 'deep-breath-reincarnation-reload',
    title: 'Deep Breath Deep Breath -Reincarnation Reload-',
    src: '/music/deep-breath-reincarnation-reload.m4a',
  },
]
