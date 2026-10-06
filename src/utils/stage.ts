/* the fixed "laptop" canvas small screens get: the whole app is laid out at
   this size and scaled down to fit, letterboxed, so phones see the desktop
   layout instead of a squeezed one */
export const STAGE = { width: 1600, height: 900 }

/* windows at least this big lay out at their own size, as before */
const FLUID_MIN = { width: 1024, height: 600 }

export type StageFit = { width: number; height: number; scale: number }

let current: StageFit = { width: 0, height: 0, scale: 1 }

export const fitStage = (viewWidth: number, viewHeight: number): StageFit => {
  current =
    viewWidth >= FLUID_MIN.width && viewHeight >= FLUID_MIN.height
      ? { width: viewWidth, height: viewHeight, scale: 1 }
      : { ...STAGE, scale: Math.min(viewWidth / STAGE.width, viewHeight / STAGE.height) }
  return current
}

/** how much the stage is scaled on screen — canvases multiply it into their
    pixel ratio so a scaled-down stage doesn't render pixels nobody sees */
export const stageScale = () => current.scale
