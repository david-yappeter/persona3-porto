export type Track = {
  id: string
  title: string
  src: string
  /** seconds to begin playback from — applied each time the track loads */
  startAt?: number
}

const musicPath = (file: string) => `${import.meta.env.BASE_URL}music/${file}`

export const TRACKS: Track[] = [
  {
    id: 'changing-seasons-reload',
    title: 'Changing Seasons -Reload-',
    src: musicPath('changing-seasons-reload.m4a'),
    startAt: 30,
  },
  { id: 'color-your-night', title: 'Color Your Night', src: musicPath('color-your-night.m4a') },
  { id: 'its-going-down-now', title: 'It’s Going Down Now', src: musicPath('its-going-down-now.m4a') },
  {
    id: 'deep-breath-reincarnation-reload',
    title: 'Deep Breath Deep Breath -Reincarnation Reload-',
    src: musicPath('deep-breath-reincarnation-reload.m4a'),
  },
]
