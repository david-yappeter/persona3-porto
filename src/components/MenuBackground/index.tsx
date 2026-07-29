import './MenuBackground.css'

type MenuBackgroundProps = {
  videoSrc?: string
  /** oversized letters bleeding off the left edge */
  decoText?: string
}

export const MenuBackground = ({
  videoSrc = '/assets/persona_3_menu_bg.mp4',
  decoText = 'WA',
}: MenuBackgroundProps) => {
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
