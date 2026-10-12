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
}

export type PlaybackErrorCode =
  | 'not_authenticated'
  | 'not_entitled'
  | 'unavailable'
  | 'rate_limited'
  | 'blocked'
  | 'budget'
  | 'server_error'
  | 'network_error';

export type PlaybackResult = { ok: true; grant: PlaybackGrant } | { ok: false; code: PlaybackErrorCode };

/** Treat a token as expired this long before it really is, so playback never starts on a dying token. */
const EXPIRY_MARGIN_MS = 60_000;

const KNOWN_CODES: PlaybackErrorCode[] = [
  'not_authenticated',
  'not_entitled',
  'unavailable',
  'rate_limited',
  'blocked',
  'budget',
  'server_error',
];

const cache = new Map<string, PlaybackGrant>();

export function isGrantFresh(grant: PlaybackGrant | null | undefined): grant is PlaybackGrant {
  return !!grant && grant.expiresAt - EXPIRY_MARGIN_MS > Date.now();
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
  };
  cache.set(episodeId, grant);
  return { ok: true, grant };
}

/** Drop every cached URL (sign-in / sign-out: entitlements belong to the old user). */
export function clearPlaybackCache(): void {
  cache.clear();
}
