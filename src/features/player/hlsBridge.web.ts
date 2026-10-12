// hls.js documents the default-export API (Hls.isSupported, Hls.Events); its typings don't
// declare those as named exports, so the import plugin's named-export hints don't apply here.
/* eslint-disable import/no-named-as-default, import/no-named-as-default-member */
import Hls from 'hls.js';
import type { VideoPlayer } from 'expo-video';

/**
 * hls.js for every web browser except Apple's (see needsHlsJs): Chrome,
 * Android Chrome, Edge, Firefox. Safari / iOS play the signed .m3u8 natively.
 *
 * Instead of giving expo-video the .m3u8 (which those browsers can't play),
 * hls.js is attached to the <video> element(s) expo-video has mounted for the
 * player. The player's own listeners stay on that element, so play/pause,
 * seeking, time updates and status events keep working unchanged. The
 * player's `src` is left empty, so React never overwrites the MediaSource URL
 * hls.js sets.
 */
export interface HlsAttachment {
  destroy(): void;
}

let supportDecision: boolean | null = null;

const FORCE_KEY = 'keybox.forceHlsJs';

/**
 * Dev-only switch to exercise this path in a browser that has native HLS:
 * open the app with ?hlsjs once (remembered for the tab, since in-app
 * navigation drops the query string).
 */
function forcedInDev(): boolean {
  if (!__DEV__ || typeof location === 'undefined') return false;
  try {
    if (new URLSearchParams(location.search).has('hlsjs')) sessionStorage.setItem(FORCE_KEY, '1');
    return sessionStorage.getItem(FORCE_KEY) === '1';
  } catch {
    return false;
  }
}
const FORCED = forcedInDev();

/**
 * Apple's own HLS player (Safari, and every browser on iOS) is the reference
 * implementation — use it there. Elsewhere use hls.js whenever it can run:
 * Chrome's built-in HLS (Android in particular) reports support but fails on
 * Cloudflare Stream's fMP4 renditions with a separate audio group, loading
 * the manifest and then erroring.
 */
function isApplePlayer(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const desktopSafari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(ua);
  return iOS || desktopSafari;
}

export function needsHlsJs(): boolean {
  if (supportDecision !== null) return supportDecision;
  const nativeHls =
    typeof document !== 'undefined' && document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '';
  const preferNative = nativeHls && isApplePlayer() && !FORCED;
  supportDecision = Hls.isSupported() && !preferNative;
  return supportDecision;
}

/**
 * expo-video 57's web player keeps its <video> elements in the private
 * `_mountedVideos` set. Re-check this after upgrading expo-video.
 */
function mountedVideos(player: VideoPlayer): HTMLVideoElement[] {
  const set = (player as unknown as { _mountedVideos?: Set<HTMLVideoElement> })._mountedVideos;
  return set ? [...set] : [];
}

/** Size of the picture actually being decoded, once known (overrides the stored size). */
export function renderedVideoSize(player: VideoPlayer): { width: number; height: number } | null {
  const video = mountedVideos(player).find((v) => v.videoWidth > 0 && v.videoHeight > 0);
  return video ? { width: video.videoWidth, height: video.videoHeight } : null;
}

export async function attachHls(player: VideoPlayer, url: string, onFatalError: () => void): Promise<HlsAttachment> {
  // The VideoView may mount a moment after the source is ready.
  let videos = mountedVideos(player);
  for (let i = 0; videos.length === 0 && i < 40; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    videos = mountedVideos(player);
  }
  if (videos.length === 0) throw new Error('no video element mounted for this player');

  const instances = videos.map((video) => {
    const hls = new Hls({ enableWorker: true });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      // Non-fatal errors are retried by hls.js itself. A fatal one is most
      // often an expired token (401): let the player fetch a fresh URL.
      if (data.fatal) onFatalError();
    });
    hls.attachMedia(video);
    hls.loadSource(url);
    return hls;
  });

  return {
    destroy: () => instances.forEach((hls) => hls.destroy()),
  };
}
