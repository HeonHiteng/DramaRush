import { create } from 'zustand';
import type { AdRewardResult } from '@/types';
import { supabase } from '@/lib/supabase';
import { useUserStore } from './userStore';
import { useWalletStore } from './walletStore';

export interface EpisodeProgress {
  positionSec: number;
  durationSec: number;
  completed: boolean;
  updatedAt: string;
}

export interface HistoryEntry {
  episodeId: string;
  seriesId: string;
  watchedAt: string;
}

/** At most one progress upsert per episode in this window; flushProgress() writes the latest at once. */
export const PROGRESS_WRITE_INTERVAL_MS = 5000;

interface LibraryState {
  favoriteSeriesIds: string[];
  unlockedEpisodeIds: string[];
  history: HistoryEntry[];
  progress: Record<string, EpisodeProgress>;
  isHydrated: boolean;
  /** Message of the last failed hydrate (the previous data is kept), or null. */
  hydrateError: string | null;
  /** Epoch ms of the last successful hydrate, for refreshIfStale(). */
  lastHydratedAt: number | null;

  toggleFavorite: (seriesId: string) => Promise<void>;
  isFavorite: (seriesId: string) => boolean;
  removeFavorite: (seriesId: string) => Promise<void>;

  isUnlocked: (episodeId: string) => boolean;
  /** Calls the unlock_episode_with_coins() RPC: atomic, idempotent, deducts from the real wallet. */
  unlockEpisodeWithCoins: (episodeId: string) => Promise<boolean>;
  /** Calls the redeem_ad_reward() RPC after the rewarded-ad simulation completes. */
  redeemAdReward: (episodeId: string) => Promise<AdRewardResult>;
  /** Demo Controls only (admin accounts) — removes every unlock, no coin refund. */
  lockAllPremium: () => Promise<void>;
  /** Demo Controls only (admin accounts) — unlocks every paid episode for free. */
  unlockAll: () => Promise<void>;

  /**
   * Updates the position locally at once; the server copy is written at most
   * every PROGRESS_WRITE_INTERVAL_MS per episode (the player reports time
   * every 0.4 s — writing each one was ~3 requests a second).
   */
  setProgress: (episodeId: string, positionSec: number, durationSec: number) => void;
  /** Writes any not-yet-sent position now (pause, page change, app backgrounded). All episodes when omitted. */
  flushProgress: (episodeId?: string) => void;
  getProgress: (episodeId: string) => EpisodeProgress | undefined;

  recordHistory: (episodeId: string, seriesId: string) => void;
  removeHistoryEntry: (episodeId: string) => Promise<void>;
  clearHistory: () => Promise<void>;

  hydrateFromServer: () => Promise<void>;
  /** hydrateFromServer() unless the last successful one is younger than `maxAgeMs`. */
  refreshIfStale: (maxAgeMs: number) => Promise<void>;
  resetLocal: () => void;
}

const EMPTY_STATE = {
  favoriteSeriesIds: [] as string[],
  unlockedEpisodeIds: [] as string[],
  history: [] as HistoryEntry[],
  progress: {} as Record<string, EpisodeProgress>,
  hydrateError: null as string | null,
  lastHydratedAt: null as number | null,
};

/** The signed-in user as AuthListener last saw it — no auth network call. */
function currentUserId(): string | null {
  return useUserStore.getState().user?.id ?? null;
}

interface PendingProgress {
  userId: string;
  progress: EpisodeProgress;
}

/** Latest unsent position per episode, with the account it belongs to. */
const pendingProgress = new Map<string, PendingProgress>();
const lastProgressWrite = new Map<string, number>();
const progressTimers = new Map<string, ReturnType<typeof setTimeout>>();

function writeProgress(episodeId: string) {
  const timer = progressTimers.get(episodeId);
  if (timer) clearTimeout(timer);
  progressTimers.delete(episodeId);
  const pending = pendingProgress.get(episodeId);
  if (!pending) return;
  pendingProgress.delete(episodeId);
  lastProgressWrite.set(episodeId, Date.now());
  // Recorded for an account that has since signed out: not ours to write.
  if (pending.userId !== currentUserId()) return;
  const { positionSec, durationSec, completed, updatedAt } = pending.progress;
  supabase
    .from('progress')
    .upsert(
      {
        user_id: pending.userId,
        episode_id: episodeId,
        position_sec: positionSec,
        duration_sec: durationSec,
        completed,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id,episode_id' }
    )
    .then(({ error }) => error && console.warn('setProgress sync failed', error));
}

function dropPendingProgress() {
  progressTimers.forEach((timer) => clearTimeout(timer));
  progressTimers.clear();
  pendingProgress.clear();
  lastProgressWrite.clear();
}

function addUnlocked(state: LibraryState, episodeId: string) {
  return state.unlockedEpisodeIds.includes(episodeId) ? state : { unlockedEpisodeIds: [...state.unlockedEpisodeIds, episodeId] };
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  ...EMPTY_STATE,
  isHydrated: false,

  toggleFavorite: async (seriesId) => {
    const userId = currentUserId();
    if (!userId) return;
    const isFav = get().favoriteSeriesIds.includes(seriesId);
    set((state) => ({
      favoriteSeriesIds: isFav
        ? state.favoriteSeriesIds.filter((id) => id !== seriesId)
        : [seriesId, ...state.favoriteSeriesIds],
    }));
    const { error } = isFav
      ? await supabase.from('favorites').delete().eq('user_id', userId).eq('series_id', seriesId)
      : await supabase.from('favorites').insert({ user_id: userId, series_id: seriesId });
    if (error && currentUserId() === userId) {
      console.warn('toggleFavorite failed, reverting', error);
      set((state) => ({
        favoriteSeriesIds: isFav
          ? [seriesId, ...state.favoriteSeriesIds]
          : state.favoriteSeriesIds.filter((id) => id !== seriesId),
      }));
    }
  },
  isFavorite: (seriesId) => get().favoriteSeriesIds.includes(seriesId),
  removeFavorite: async (seriesId) => {
    const userId = currentUserId();
    set((state) => ({
      favoriteSeriesIds: state.favoriteSeriesIds.filter((id) => id !== seriesId),
    }));
    if (userId) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('series_id', seriesId);
    }
  },

  isUnlocked: (episodeId) => get().unlockedEpisodeIds.includes(episodeId),

  unlockEpisodeWithCoins: async (episodeId) => {
    const userId = currentUserId();
    const { data, error } = await supabase.rpc('unlock_episode_with_coins', { p_episode_id: episodeId });
    if (error) {
      console.warn('unlockEpisodeWithCoins failed', error);
      return false;
    }
    if (data && currentUserId() === userId) {
      set((state) => addUnlocked(state, episodeId));
      // Coins were deducted on the server; pull the new balance + transaction.
      await useWalletStore.getState().hydrateFromServer();
    }
    return Boolean(data);
  },

  redeemAdReward: async (episodeId) => {
    const userId = currentUserId();
    const { data, error } = await supabase.rpc('redeem_ad_reward', { p_episode_id: episodeId });
    if (error) {
      console.warn('redeemAdReward failed', error);
      return error.message === 'account_required' ? 'account_required' : 'failed';
    }
    // false = today's ad-unlock cap (app_config.ad_unlocks_per_day) is used up.
    if (!data) return 'cap_reached';
    if (currentUserId() === userId) set((state) => addUnlocked(state, episodeId));
    return 'unlocked';
  },

  lockAllPremium: async () => {
    const { error } = await supabase.rpc('demo_set_all_unlocked', { p_unlocked: false });
    if (error) {
      console.warn('lockAllPremium failed (admin accounts only)', error);
      return;
    }
    set({ unlockedEpisodeIds: [] });
  },
  unlockAll: async () => {
    const { error } = await supabase.rpc('demo_set_all_unlocked', { p_unlocked: true });
    if (error) {
      console.warn('unlockAll failed (admin accounts only)', error);
      return;
    }
    const userId = currentUserId();
    if (!userId) return;
    const { data } = await supabase.from('unlocks').select('episode_id').eq('user_id', userId);
    if (currentUserId() !== userId) return;
    set({ unlockedEpisodeIds: (data ?? []).map((r) => r.episode_id) });
  },

  setProgress: (episodeId, positionSec, durationSec) => {
    const completed = durationSec > 0 && positionSec / durationSec >= 0.9;
    const progress: EpisodeProgress = { positionSec, durationSec, completed, updatedAt: new Date().toISOString() };
    set((state) => ({ progress: { ...state.progress, [episodeId]: progress } }));

    const userId = currentUserId();
    if (!userId) return;
    pendingProgress.set(episodeId, { userId, progress });
    const sinceLastWrite = Date.now() - (lastProgressWrite.get(episodeId) ?? 0);
    if (sinceLastWrite >= PROGRESS_WRITE_INTERVAL_MS) {
      writeProgress(episodeId);
    } else if (!progressTimers.has(episodeId)) {
      // Trailing write, so the last position of a burst isn't lost even if
      // nobody calls flushProgress().
      progressTimers.set(
        episodeId,
        setTimeout(() => writeProgress(episodeId), PROGRESS_WRITE_INTERVAL_MS - sinceLastWrite)
      );
    }
  },
  flushProgress: (episodeId) => {
    if (episodeId) writeProgress(episodeId);
    else Array.from(pendingProgress.keys()).forEach(writeProgress);
  },
  getProgress: (episodeId) => get().progress[episodeId],

  recordHistory: (episodeId, seriesId) => {
    const watchedAt = new Date().toISOString();
    set((state) => ({
      history: [{ episodeId, seriesId, watchedAt }, ...state.history.filter((h) => h.episodeId !== episodeId)].slice(0, 100),
    }));
    const userId = currentUserId();
    if (!userId) return;
    supabase
      .from('watch_history')
      .upsert({ user_id: userId, episode_id: episodeId, series_id: seriesId, watched_at: watchedAt }, { onConflict: 'user_id,episode_id' })
      .then(({ error }) => error && console.warn('recordHistory sync failed', error));
  },
  removeHistoryEntry: async (episodeId) => {
    const userId = currentUserId();
    set((state) => ({ history: state.history.filter((h) => h.episodeId !== episodeId) }));
    if (userId) {
      await supabase.from('watch_history').delete().eq('user_id', userId).eq('episode_id', episodeId);
    }
  },
  clearHistory: async () => {
    const userId = currentUserId();
    set({ history: [] });
    if (userId) {
      await supabase.from('watch_history').delete().eq('user_id', userId);
    }
  },

  hydrateFromServer: async () => {
    const userId = currentUserId();
    if (!userId) {
      set({ ...EMPTY_STATE, isHydrated: true });
      return;
    }

    const [favoritesRes, unlocksRes, historyRes, progressRes] = await Promise.all([
      supabase.from('favorites').select('series_id').eq('user_id', userId),
      supabase.from('unlocks').select('episode_id').eq('user_id', userId),
      supabase
        .from('watch_history')
        .select('episode_id, series_id, watched_at')
        .eq('user_id', userId)
        .order('watched_at', { ascending: false })
        .limit(100),
      supabase.from('progress').select('episode_id, position_sec, duration_sec, completed, updated_at').eq('user_id', userId),
    ]);
    // Another account signed in meanwhile: this is the previous one's data.
    if (currentUserId() !== userId) return;

    const error = favoritesRes.error ?? unlocksRes.error ?? historyRes.error ?? progressRes.error;
    if (error) console.warn('library hydrate failed', error);

    let progress: Record<string, EpisodeProgress> | undefined;
    if (!progressRes.error) {
      progress = {};
      for (const row of progressRes.data ?? []) {
        progress[row.episode_id] = {
          positionSec: Number(row.position_sec),
          durationSec: Number(row.duration_sec),
          completed: row.completed,
          updatedAt: row.updated_at,
        };
      }
      // Positions not written yet are newer than the server's copy.
      const local = get().progress;
      pendingProgress.forEach((_, episodeId) => {
        if (local[episodeId]) progress![episodeId] = local[episodeId];
      });
    }

    // A failed read keeps the previous list rather than blanking it.
    set({
      ...(favoritesRes.error ? null : { favoriteSeriesIds: (favoritesRes.data ?? []).map((r) => r.series_id) }),
      ...(unlocksRes.error ? null : { unlockedEpisodeIds: (unlocksRes.data ?? []).map((r) => r.episode_id) }),
      ...(historyRes.error
        ? null
        : {
            history: (historyRes.data ?? []).map((r) => ({
              episodeId: r.episode_id,
              seriesId: r.series_id,
              watchedAt: r.watched_at,
            })),
          }),
      ...(progress ? { progress } : null),
      hydrateError: error ? String(error.message ?? error) : null,
      ...(error ? null : { lastHydratedAt: Date.now() }),
      isHydrated: true,
    });
  },

  refreshIfStale: async (maxAgeMs) => {
    const last = get().lastHydratedAt;
    if (last !== null && Date.now() - last < maxAgeMs) return;
    await get().hydrateFromServer();
  },

  resetLocal: () => {
    dropPendingProgress();
    set({ ...EMPTY_STATE, isHydrated: false });
  },
}));
