/*
 * Reseeks the <video> under `selector` to `time` and resumes playback.
 *
 * Setting `currentTime` on a video the browser just (re)mounted forces a
 * real decode seek, which isn't instant — for a brief window (~100-150ms
 * here) the video shows nothing, which reads as a hard blip. Fading it out
 * for the duration of the seek and back in once the sought frame is ready
 * turns that into a soft dip instead. Needs `.bg-video`'s opacity
 * transition (see MenuBackground.css) to actually animate.
 */
export function resumeVideoAt(selector: string, time: number) {
  if (time <= 0) return
  const video = document.querySelector<HTMLVideoElement>(selector)
  if (!video) return

  video.style.opacity = '0'
  video.currentTime = time
  void video.play()
  video.addEventListener(
    'seeked',
    () => {
      video.style.opacity = '1'
    },
    { once: true },
  )
}
