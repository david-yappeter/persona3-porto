import { useEffect, useRef } from 'react'
import type { CardFace } from './card'
import type { BoneNameOverrides } from './character'
import { mountSocialLinkScene, type CardState, type SocialLinkSceneController } from './scene'
import './SocialLinkScene.css'

export type { CardFace, CardState, BoneNameOverrides }

type SocialLinkSceneProps = {
  card: CardFace
  /** 'held' = gripped at the chest, 'floating' = palm open, card floating
      and turning in front of the chest (POSE.float), 'dangling' = hanging
      off the raised hand on its lanyard; changing it animates between them */
  cardState?: CardState
  /** rigged GLB/glTF/VRM; until it loads only the card is shown */
  modelSrc?: string
  /** exact node names, only needed when auto-detection misses the arm bones */
  boneNames?: BoneNameOverrides
  /** false = character and card only, on a transparent canvas over the page */
  backdrop?: boolean
  /** hide meshes whose material name matches (props, helper geometry) */
  hiddenMaterials?: RegExp
  /** material names of the white parts (skin, shirt) — the only ones
      outlined in POSE.overlay.outline 'bright' mode */
  brightMaterials?: RegExp
  /** material names kept out of the white-part shading (POSE.shading) */
  unshadedMaterials?: RegExp
  /** keep a non-VRM model's own materials instead of toon-converting them */
  originalMaterials?: boolean
  /** recolour the character into the P3 menu duotone (violet > blue > cyan >
      white by brightness); defaults to on with the backdrop */
  menuColors?: boolean
}

const DEFAULT_MODEL = `${import.meta.env.BASE_URL}assets/models/protagonist.glb`

/** P3 Social Link backdrop: stylized city, cel-shaded character and the
    arcana card on its lanyard, rendered full-bleed behind the page UI. The
    scene mounts once; card/cardState changes are fed to it live so the card
    can spin-swap its face and swing instead of remounting. */
export const SocialLinkScene = ({
  card,
  cardState = 'dangling',
  modelSrc = DEFAULT_MODEL,
  boneNames,
  backdrop = true,
  hiddenMaterials,
  brightMaterials,
  unshadedMaterials,
  originalMaterials = false,
  menuColors,
}: SocialLinkSceneProps) => {
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
      backdrop,
      hiddenMaterials,
      brightMaterials,
      unshadedMaterials,
      originalMaterials,
      menuColors,
    })
    controller.setCard(latest.current.card)
    controllerRef.current = controller
    return () => {
      controller.dispose()
      controllerRef.current = null
    }
    /* keyed by content — boneNames is usually an inline object literal */
  }, [modelSrc, JSON.stringify(boneNames ?? {}), backdrop, hiddenMaterials?.source, brightMaterials?.source, unshadedMaterials?.source, originalMaterials, menuColors])

  const { image, imageFit, title, subtitle, numeral } = card
  useEffect(() => {
    controllerRef.current?.setCard({ image, imageFit, title, subtitle, numeral })
  }, [image, imageFit, title, subtitle, numeral])

  useEffect(() => {
    controllerRef.current?.setCardState(cardState)
  }, [cardState])

  return <div ref={mountRef} className="social-link-scene" aria-hidden="true" />
}
