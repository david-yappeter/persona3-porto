import { useEffect, useRef } from 'react'
import { MenuBackground } from '../../components/MenuBackground'
import { mountFigureLab } from '../../components/SocialLinkScene/figureLab'
import { mountFigureScene } from '../../components/SocialLinkScene/figureScene'
import { MAKOTO_BRIGHT, MAKOTO_HIDDEN, MAKOTO_MODEL, MAKOTO_TEXTURES, MAKOTO_UNDRAWN, MAKOTO_UNSHADED } from '../../data/makoto'
import '../../components/SocialLinkScene/SocialLinkScene.css'

const OCEAN_BG = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg_ocean_seamless.mp4`

/** /figure-lab: the character alone over the menu video, with
    the figure lab panel — body orientation, floating, gravity, face, arms,
    ribbon/cord (FIGURE in figure.ts) */
export const FigureLab = () => {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const disposeScene = mountFigureScene(mount, {
      modelSrc: MAKOTO_MODEL,
      hiddenMaterials: MAKOTO_HIDDEN,
      undrawnMaterials: MAKOTO_UNDRAWN,
      brightMaterials: MAKOTO_BRIGHT,
      unshadedMaterials: MAKOTO_UNSHADED,
      borrowTextures: MAKOTO_TEXTURES,
    })
    const disposeLab = mountFigureLab()
    return () => {
      disposeLab()
      disposeScene()
    }
  }, [])

  return (
    <>
      <MenuBackground videoSrc={OCEAN_BG} />
      <div ref={mountRef} className="social-link-scene" />
    </>
  )
}
