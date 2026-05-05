export const FPS = 30;
export const INTRO_DURATION_SEC = 4;
export const SLEEP_SEC = 2;
export const SLEEP_FRAMES = SLEEP_SEC * FPS;

export function exampleSlideDurationFrames(audioDurationEnSec: number, audioDurationJaSec: number): number {
  const enFrames = Math.ceil(audioDurationEnSec * FPS);
  const jaFrames = Math.ceil(audioDurationJaSec * FPS);
  // EN → sleep → JA×1 → sleep → JA×2 → sleep（末尾）
  return enFrames + SLEEP_FRAMES + jaFrames + SLEEP_FRAMES + jaFrames + SLEEP_FRAMES;
}

export function wordSectionFrames(examples: Array<{ audioDurationEnSec: number; audioDurationJaSec: number }>): number {
  const introFrames = INTRO_DURATION_SEC * FPS;
  const exFrames = examples.reduce(
    (sum, ex) => sum + exampleSlideDurationFrames(ex.audioDurationEnSec, ex.audioDurationJaSec),
    0
  );
  return introFrames + exFrames;
}
