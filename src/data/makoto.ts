import type { TextureBorrow } from '../components/SocialLinkScene/character'

/* the Makoto Yuki Sketchfab rip shown on /careers (and in the dev figure lab) */
export const MAKOTO_MODEL = `${import.meta.env.BASE_URL}assets/models/makoto/scene.gltf`
/* props and helper geometry bundled with the Sketchfab rip: katana, gun
   holster, evoker, and tiny marker quads parked on the knee/elbow joints */
export const MAKOTO_HIDDEN = /^(175_|katana|c0744_gunholder|c0744_syoukanki)/
/* the katana's sword-swing effect plane ("01 - Default"): fully transparent,
   but it still cut a hole in the white bands and cast a shadow on them.
   Not drawn, but still counted in the model's sizing — every camera
   framing was tuned with it there */
export const MAKOTO_UNDRAWN = /^01_-_Default/
/* the white parts — face/neck skin, hands, shirt — outlined in 'bright' mode */
export const MAKOTO_BRIGHT = /^c0744_(face_skin|face_kubi|body_kubi|body_hand|body_syatu)/
/* the head (face skin, eyes, the face mesh's neck) stays out of the shading */
export const MAKOTO_UNSHADED = /^c0744_face_/
/* the rip left the right eye (hidden under the fringe in the game) a flat
   near-black. The left eye's texture holds both irises — the right eye's
   half drawn darker — so the right eye reads the left eye's half instead
   (its UVs shifted across; both eyes' UVs run outward, so it comes out a
   mirror image) */
export const MAKOTO_TEXTURES: TextureBorrow[] = [{ to: /^c0744_face_eye\.004/, from: /^c0744_face_eye\.005/, offset: [0.43, 0] }]
