/**
 * Prototype-only sample video sources.
 * These are publicly hosted, openly-licensed reference clips widely used for
 * player testing/demos (Blender Foundation open movies + Google Play sample
 * trailers). They are landscape source clips rendered inside a portrait 9:16
 * player frame for this prototype — in production these would be replaced by
 * original vertically-shot drama footage delivered through a real CDN.
 */
export const SAMPLE_VIDEO_SOURCES = [
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
] as const;

export function videoForIndex(index: number): string {
  return SAMPLE_VIDEO_SOURCES[index % SAMPLE_VIDEO_SOURCES.length];
}
