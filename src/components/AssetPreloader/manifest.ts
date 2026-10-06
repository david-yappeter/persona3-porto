import { EXPERIENCE } from '../../data/experience'

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

export type PreloadAsset =
  | { url: string; kind: 'fetch' }
  /** fonts don't expose byte-level download progress, so they're weighted
      as a flat guess instead of a real content-length, see usePreloadAssets */
  | { url: string; kind: 'font' }
  /** a code-split chunk, pulled in by running its dynamic import — the
      hashed file name isn't known here, so it too gets a flat byte weight */
  | { kind: 'module'; load: () => Promise<unknown>; weight: number }

/* everything GLTFLoader requests for the /experiences character: the .gltf, its
   buffer and every texture it references (the hidden props' included —
   the loader fetches those regardless) */
const MAKOTO = 'assets/models/makoto/'
const MAKOTO_FILES = [
  'scene.gltf',
  'scene.bin',
  'textures/01_-_Default.002_baseColor.png',
  'textures/01_-_Default.002_emissive.png',
  'textures/c0744_body_hand.002_emissive.png',
  'textures/c0744_body_jyake.004_baseColor.png',
  'textures/c0744_body_jyake.004_emissive.png',
  'textures/c0744_face_eye.005_baseColor.png',
  'textures/c0744_gunholder.002_baseColor.png',
  'textures/c0744_hair.002_baseColor.png',
  'textures/c0744_nasi.002_baseColor.png',
  'textures/c0744_nasi_ago.002_baseColor.png',
  'textures/c0744_syoukanki.005_baseColor.png',
  'textures/katana744_b.002_baseColor.png',
]

/* row heads, card logos and detail portraits, straight from the data so a
   new entry is covered without touching this list */
const EXPERIENCE_IMAGES = [
  ...new Set(EXPERIENCE.flatMap((e) => [e.headSrc, e.logoSrc, e.portraitSrc]).filter((u): u is string => !!u)),
]

/*
 * What the app plays on the menu and the /experiences pages — the background
 * videos, every sfx in utils/sfx.ts, the first music track, the font, the
 * /experiences 3D character with its three.js code, and the experience images.
 * Deliberately excludes the other three music tracks (9MB combined), which
 * load on demand, and files nothing references (protagonist.glb, the flip
 * video, head_0*.png, the unused deck_ui_* sounds).
 */
export const PRELOAD_MANIFEST: PreloadAsset[] = [
  { url: asset('assets/persona_3_menu_bg.mp4'), kind: 'fetch' },
  { url: asset('assets/persona_3_menu_bg_ocean_seamless.mp4'), kind: 'fetch' },
  { url: asset('assets/persona_3_menu_bg_entrance.mp4'), kind: 'fetch' },
  { url: asset('sound/deck_ui_slider_up.wav'), kind: 'fetch' },
  { url: asset('sound/deck_ui_slider_down.wav'), kind: 'fetch' },
  { url: asset('sound/deck_ui_into_game_detail.wav'), kind: 'fetch' },
  { url: asset('sound/deck_ui_default_activation.wav'), kind: 'fetch' },
  { url: asset('sound/deck_ui_side_menu_fly_out.wav'), kind: 'fetch' },
  { url: asset('sound/deck_ui_out_of_game_detail.wav'), kind: 'fetch' },
  { url: asset('sound/deck_ui_volume.wav'), kind: 'fetch' },
  { url: asset('music/changing-seasons-reload.m4a'), kind: 'fetch' },
  { url: asset('fonts/EurostileExtendedBlack.ttf'), kind: 'font' },
  ...MAKOTO_FILES.map((f) => ({ url: asset(MAKOTO + f), kind: 'fetch' as const })),
  { url: asset('assets/UI_camp_1.png'), kind: 'fetch' },
  ...EXPERIENCE_IMAGES.map((url) => ({ url, kind: 'fetch' as const })),
  /* the same chunks router.tsx lazy-loads; weights ≈ their gzipped size */
  { kind: 'module', load: () => import('../../pages/SkillLayout'), weight: 240_000 },
  { kind: 'module', load: () => import('../../pages/SkillDetail'), weight: 5_000 },
]
