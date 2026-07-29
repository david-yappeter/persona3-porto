import { use } from 'react'
import { MusicPlayerContext } from './context'

export const useMusicPlayer = () => {
  const player = use(MusicPlayerContext)
  if (!player) throw new Error('useMusicPlayer must be used inside <MusicPlayerProvider>')
  return player
}
