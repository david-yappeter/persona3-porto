const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

export type PreloadAsset = {
  url: string
  /** fonts don't expose byte-level download progress, so they're weighted
      as a flat guess instead of a real content-length, see usePreloadAssets */
  kind: 'fetch' | 'font'
}

/*
 * Only what the app actually plays on the very first screens — the menu
 * background videos, the sfx MenuList/useNavigationSound fire, the first
 * music track, and the custom font. Deliberately excludes the still-unused
 * head_*.png files and the other three music tracks (10MB+ combined) —
 * those load on demand same as before, this just removes the pop-in/decode
 * stalls for what's guaranteed to play immediately.
 */
export const PRELOAD_MANIFEST: PreloadAsset[] = [
  { url: asset('assets/persona_3_menu_bg.mp4'), kind: 'fetch' },
  { url: asset('assets/persona_3_menu_bg_flip.mp4'), kind: 'fetch' },
  { url: asset('assets/persona_3_menu_bg_entrance.mp4'), kind: 'fetch' },
  { url: asset('sound/deck_ui_slider_up.wav'), kind: 'fetch' },
  { url: asset('sound/deck_ui_slider_down.wav'), kind: 'fetch' },
  { url: asset('sound/deck_ui_side_menu_fly_in.wav'), kind: 'fetch' },
  { url: asset('sound/deck_ui_side_menu_fly_out.wav'), kind: 'fetch' },
  { url: asset('music/changing-seasons-reload.m4a'), kind: 'fetch' },
  { url: asset('fonts/EurostileExtendedBlack.ttf'), kind: 'font' },
]
