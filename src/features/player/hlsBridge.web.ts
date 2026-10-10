// hls.js documents the default-export API (Hls.isSupported, Hls.Events); its typings don't
// declare those as named exports, so the import plugin's named-export hints don't apply here.
/* eslint-disable import/no-named-as-default, import/no-named-as-default-member */
import Hls from 'hls.js';
import type { VideoPlayer } from 'expo-video';

/**
 * hls.js fallback for browsers without native HLS (Firefox, older Chrome).
 * Safari and Chrome 142+ play the signed .m3u8 natively and never use it.
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

export function needsHlsJs(): boolean {
  if (supportDecision !== null) return supportDecision;
  const forced = FORCED;
  const nativeHls =
    typeof document !== 'undefined' && document.createElement('video').canPlayType('application/vnd.apple.mpegurl') !== '';
  supportDecision = Hls.isSupported() && (forced || !nativeHls);
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
