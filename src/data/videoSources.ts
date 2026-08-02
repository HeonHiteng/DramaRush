/**
 * Prototype-only sample video sources.
 * These are publicly hosted, openly-licensed reference clips used for player
 * testing/demos: Google's official ExoPlayer/Media3 test-media bucket, the
 * long-standing W3Schools HTML5 video tutorial clips (Big Buck Bunny, a
 * Blender Foundation CC-BY film), and a Mozilla-hosted CC0 clip used in the
 * MDN <video> docs. They are landscape source clips rendered inside a
 * portrait 9:16 player frame for this prototype — in production these would
 * be replaced by original vertically-shot drama footage delivered through a
 * real CDN.
 */
export const SAMPLE_VIDEO_SOURCES = [
  'https://storage.googleapis.com/exoplayer-test-media-0/BigBuckBunny_320x180.mp4',
  'https://www.w3schools.com/html/mov_bbb.mp4',
  'https://www.w3schools.com/html/movie.mp4',
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
] as const;

export function videoForIndex(index: number): string {
  return SAMPLE_VIDEO_SOURCES[index % SAMPLE_VIDEO_SOURCES.length];
}
