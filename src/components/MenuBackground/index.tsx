import './MenuBackground.css'

type MenuBackgroundProps = {
  videoSrc?: string
  /** oversized letters bleeding off the left edge */
  decoText?: string

  flip?: boolean
}

export const MenuBackground = ({
  videoSrc = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg.mp4`,
  decoText = 'WA',
  flip = false,
}: MenuBackgroundProps) => {
  if (flip) videoSrc = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg_flip.mp4`

  return (
    <>
      <video className="bg-video" src={videoSrc} autoPlay loop muted playsInline />
      <div className="bg-wash" />
      <div className="bg-glow" />

      <div className="deco-type" aria-hidden="true">
        {decoText}
      </div>
    </>
  )
}
