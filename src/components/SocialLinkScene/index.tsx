import { useEffect, useRef } from 'react'
import type { CardFace } from './card'
import type { BoneNameOverrides } from './character'
import { mountSocialLinkScene, type CardState, type SocialLinkSceneController } from './scene'
import './SocialLinkScene.css'

export type { CardFace, CardState, BoneNameOverrides }

type SocialLinkSceneProps = {
  card: CardFace
  /** 'held' = gripped at the chest, 'dangling' = hanging off the raised hand
      on its lanyard; changing it animates between the two */
  cardState?: CardState
  /** rigged GLB/VRM; until it exists a procedural stand-in is shown */
  modelSrc?: string
  /** exact node names, only needed when auto-detection misses the arm bones */
  boneNames?: BoneNameOverrides
}

const DEFAULT_MODEL = `${import.meta.env.BASE_URL}assets/models/protagonist.glb`

/** P3 Social Link backdrop: stylized city, cel-shaded character and the
    arcana card on its lanyard, rendered full-bleed behind the page UI. The
    scene mounts once; card/cardState changes are fed to it live so the card
    can spin-swap its face and swing instead of remounting. */
export const SocialLinkScene = ({ card, cardState = 'dangling', modelSrc = DEFAULT_MODEL, boneNames }: SocialLinkSceneProps) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<SocialLinkSceneController | null>(null)
  const latest = useRef({ card, cardState })

  useEffect(() => {
    latest.current = { card, cardState }
  })

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const controller = mountSocialLinkScene(mount, {
      modelSrc,
      boneNames,
      initialCardState: latest.current.cardState,
    })
    controller.setCard(latest.current.card)
    controllerRef.current = controller
    return () => {
      controller.dispose()
      controllerRef.current = null
    }
    /* keyed by content — boneNames is usually an inline object literal */
  }, [modelSrc, JSON.stringify(boneNames ?? {})])

  const { image, imageFit, title, subtitle, numeral } = card
  useEffect(() => {
    controllerRef.current?.setCard({ image, imageFit, title, subtitle, numeral })
  }, [image, imageFit, title, subtitle, numeral])

  useEffect(() => {
    controllerRef.current?.setCardState(cardState)
  }, [cardState])

  return <div ref={mountRef} className="social-link-scene" aria-hidden="true" />
}
