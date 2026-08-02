import { useEffect, useRef, useState } from 'react'
import './MenuBackground.css'

type MenuBackgroundProps = {
  videoSrc?: string
  /** oversized letters bleeding off the left edge */
  decoText?: string

  flip?: boolean
  /** plays once, non-looping; once it ends this swaps to the normal looping
      videoSrc. Omit for a plain loop from the start. */
  entranceSrc?: string
}

export const MenuBackground = ({
  videoSrc = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg.mp4`,
  decoText = 'WA',
  flip = false,
  entranceSrc,
}: MenuBackgroundProps) => {
  if (flip) videoSrc = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg_flip.mp4`

  const videoRef = useRef<HTMLVideoElement>(null)
  const [showEntrance, setShowEntrance] = useState(!!entranceSrc)

  /* switching src away from the entrance clip doesn't reliably autoplay on
     its own across browsers, so drive it explicitly */
  useEffect(() => {
    if (!entranceSrc || showEntrance) return
    const video = videoRef.current
    if (!video) return
    video.load()
    void video.play()
  }, [entranceSrc, showEntrance])

  return (
    <>
      <video
        ref={videoRef}
        className="bg-video"
        src={showEntrance ? entranceSrc : videoSrc}
        autoPlay
        loop={!showEntrance}
        muted
        playsInline
        onEnded={() => setShowEntrance(false)}
      />

      <div className="deco-type" aria-hidden="true">
        {decoText}
      </div>
    </>
  )
}
