import type { VideoPlayer } from 'expo-video';

/**
 * Native (iOS / Android) players play HLS themselves, so hls.js is never
 * needed or bundled here. The web implementation is hlsBridge.web.ts.
 */
export interface HlsAttachment {
  destroy(): void;
}

export function needsHlsJs(): boolean {
  return false;
}

/** Size of the picture actually being decoded, once known (overrides the stored size). */
export function renderedVideoSize(player: VideoPlayer): { width: number; height: number } | null {
  const size = player.videoTrack?.size;
  return size && size.width > 0 && size.height > 0 ? { width: size.width, height: size.height } : null;
}

export async function attachHls(_player: VideoPlayer, _url: string, _onFatalError: () => void): Promise<HlsAttachment> {
  throw new Error('hls.js is only used on web');
}
