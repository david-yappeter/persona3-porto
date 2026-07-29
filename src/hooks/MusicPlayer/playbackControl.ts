/*
 * Marks a control that starts playback on its own, so the global
 * start-on-first-gesture fallback knows to stay out of its way.
 * The two exports are a pair — keep the attribute name in sync.
 */
export const playbackControlProps = { 'data-playback-control': '' }
export const PLAYBACK_CONTROL_SELECTOR = '[data-playback-control]'
