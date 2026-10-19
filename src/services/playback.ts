import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Signed Cloudflare Stream playback for one episode. Videos are never public:
 * the backend's playback-token Edge Function checks the caller may watch
 * (free / unlocked / active membership), applies rate limits, and returns an
 * HLS URL carrying a short-lived token (~15 min). See
 * DramaRush-Backend/docs/frontend-api.md §3.
 */
export interface PlaybackGrant {
  episodeId: string;
  hlsUrl: string;
  thumbnailUrl: string;
  /** Epoch ms. */
  expiresAt: number;
  /** The viewer's short code, drawn faintly over the video (leak tracing). */
  watermarkCode: string | null;
  /**
   * Guests (anonymous sessions) only get a preview of free episodes: stop at
   * this many seconds and ask them to link an account. The token itself dies
   * ~15 s later. Absent for members.
   */
  previewSeconds?: number;
}

export type PlaybackErrorCode =
  | 'not_authenticated'
  | 'not_entitled'
  /** A guest asked for a non-free episode or used up today's previews: show the link-account gate, not the paywall. */
  | 'account_required'
  | 'unavailable'
  | 'rate_limited'
  | 'blocked'
  | 'budget'
  | 'server_error'
  | 'network_error';

export type PlaybackResult = { ok: true; grant: PlaybackGrant } | { ok: false; code: PlaybackErrorCode };

/** Treat a token as expired this long before it really is, so playback never starts on a dying token. */
const EXPIRY_MARGIN_MS = 60_000;
const PREVIEW_EXPIRY_MARGIN_MS = 3_000;

const KNOWN_CODES: PlaybackErrorCode[] = [
  'not_authenticated',
  'not_entitled',
  'account_required',
  'unavailable',
  'rate_limited',
  'blocked',
  'budget',
  'server_error',
];

const cache = new Map<string, PlaybackGrant>();

/**
 * Whether `grant` can still start or resume playback. A preview token only
 * lives ~30 s, so the minute-long margin would rule it out before it is
 * even used: the page holding it may resume it until just before expiry
 * (fetchPlayback still never reuses one — see below).
 */
export function isGrantFresh(grant: PlaybackGrant | null | undefined): grant is PlaybackGrant {
  if (!grant) return false;
  const margin = grant.previewSeconds !== undefined ? PREVIEW_EXPIRY_MARGIN_MS : EXPIRY_MARGIN_MS;
  return grant.expiresAt - margin > Date.now();
}

/**
 * Returns a signed playback URL for the episode, reusing a cached one while it
 * is still fresh. Pass `force` to always ask the server (e.g. after a
 * playback error or an unlock).
 */
export async function fetchPlayback(episodeId: string, { force = false } = {}): Promise<PlaybackResult> {
  const cached = cache.get(episodeId);
  if (!force && isGrantFresh(cached)) return { ok: true, grant: cached };

  const { data, error } = await supabase.functions.invoke('playback-token', { body: { episode_id: episodeId } });

  if (error) {
    cache.delete(episodeId);
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      const code = body?.error as PlaybackErrorCode | undefined;
      return { ok: false, code: code && KNOWN_CODES.includes(code) ? code : 'server_error' };
    }
    return { ok: false, code: 'network_error' };
  }

  const grant: PlaybackGrant = {
    episodeId,
    hlsUrl: data.hls_url,
    thumbnailUrl: data.thumbnail_url,
    expiresAt: Date.parse(data.expires_at),
    watermarkCode: data.watermark_code ?? null,
    ...(typeof data.preview_seconds === 'number' ? { previewSeconds: data.preview_seconds } : null),
  };
  // A preview token lives ~30 s, so it would never pass the 60 s margin a
  // cached grant needs (every later call would refetch anyway) — and the
  // backend asks for a new one each time. Only members' grants are cached.
  if (grant.previewSeconds === undefined) cache.set(episodeId, grant);
  else cache.delete(episodeId);
  return { ok: true, grant };
}

/** Drop every cached URL (sign-in / sign-out: entitlements belong to the old user). */
export function clearPlaybackCache(): void {
  cache.clear();
}
