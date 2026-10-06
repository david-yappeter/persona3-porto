/* the Makoto Yuki Sketchfab rip shown on /careers (and in the dev figure lab) */
export const MAKOTO_MODEL = `${import.meta.env.BASE_URL}assets/models/makoto/scene.gltf`
/* props and helper geometry bundled with the Sketchfab rip: katana, gun
   holster, evoker, and tiny marker quads parked on the knee/elbow joints */
export const MAKOTO_HIDDEN = /^(175_|katana|c0744_gunholder|c0744_syoukanki)/
/* the white parts — face/neck skin, hands, shirt — outlined in 'bright' mode */
export const MAKOTO_BRIGHT = /^c0744_(face_skin|face_kubi|body_kubi|body_hand|body_syatu)/
/* the head (face skin, eyes, the face mesh's neck) stays out of the shading */
export const MAKOTO_UNSHADED = /^c0744_face_/
