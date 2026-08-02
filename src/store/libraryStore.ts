import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

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

interface LibraryState {
  favoriteSeriesIds: string[];
  unlockedEpisodeIds: string[];
  history: HistoryEntry[];
  progress: Record<string, EpisodeProgress>;
  isHydrated: boolean;

  toggleFavorite: (seriesId: string) => Promise<void>;
  isFavorite: (seriesId: string) => boolean;
  removeFavorite: (seriesId: string) => Promise<void>;

  isUnlocked: (episodeId: string) => boolean;
  /** Calls the unlock_episode_with_coins() RPC: atomic, idempotent, deducts from the real wallet. */
  unlockEpisodeWithCoins: (episodeId: string) => Promise<boolean>;
  /** Calls the redeem_ad_reward() RPC after the rewarded-ad simulation completes. */
  redeemAdReward: (episodeId: string) => Promise<boolean>;
  /** Demo Controls only — bulk-locks by deleting unlock rows, no coin refund. */
  lockAllPremium: (premiumEpisodeIds: string[]) => Promise<void>;
  /** Demo Controls only — bulk-unlocks for free, bypassing coins entirely. */
  unlockAll: (allEpisodeIds: string[]) => Promise<void>;

  setProgress: (episodeId: string, positionSec: number, durationSec: number) => void;
  getProgress: (episodeId: string) => EpisodeProgress | undefined;

  recordHistory: (episodeId: string, seriesId: string) => void;
  removeHistoryEntry: (episodeId: string) => Promise<void>;
  clearHistory: () => Promise<void>;

  hydrateFromServer: () => Promise<void>;
  resetLocal: () => void;
  resetServerData: () => Promise<void>;
}

const EMPTY_STATE = {
  favoriteSeriesIds: [] as string[],
  unlockedEpisodeIds: [] as string[],
  history: [] as HistoryEntry[],
  progress: {} as Record<string, EpisodeProgress>,
};

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  ...EMPTY_STATE,
  isHydrated: false,

  toggleFavorite: async (seriesId) => {
    const userId = await currentUserId();
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
    if (error) {
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
    const userId = await currentUserId();
    set((state) => ({
      favoriteSeriesIds: state.favoriteSeriesIds.filter((id) => id !== seriesId),
    }));
    if (userId) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('series_id', seriesId);
    }
  },

  isUnlocked: (episodeId) => get().unlockedEpisodeIds.includes(episodeId),

  unlockEpisodeWithCoins: async (episodeId) => {
    const { data, error } = await supabase.rpc('unlock_episode_with_coins', { p_episode_id: episodeId });
    if (error) {
      console.warn('unlockEpisodeWithCoins failed', error);
      return false;
    }
    if (data) {
      set((state) =>
        state.unlockedEpisodeIds.includes(episodeId)
          ? state
          : { unlockedEpisodeIds: [...state.unlockedEpisodeIds, episodeId] }
      );
    }
    return Boolean(data);
  },

  redeemAdReward: async (episodeId) => {
    const { data, error } = await supabase.rpc('redeem_ad_reward', { p_episode_id: episodeId });
    if (error) {
      console.warn('redeemAdReward failed', error);
      return false;
    }
    if (data) {
      set((state) =>
        state.unlockedEpisodeIds.includes(episodeId)
          ? state
          : { unlockedEpisodeIds: [...state.unlockedEpisodeIds, episodeId] }
      );
    }
    return Boolean(data);
  },

  lockAllPremium: async (premiumEpisodeIds) => {
    const userId = await currentUserId();
    set((state) => ({
      unlockedEpisodeIds: state.unlockedEpisodeIds.filter((id) => !premiumEpisodeIds.includes(id)),
    }));
    if (userId) {
      await supabase.from('unlocks').delete().eq('user_id', userId).in('episode_id', premiumEpisodeIds);
    }
  },
  unlockAll: async (allEpisodeIds) => {
    const userId = await currentUserId();
    set({ unlockedEpisodeIds: [...allEpisodeIds] });
    if (userId) {
      await supabase
        .from('unlocks')
        .upsert(
          allEpisodeIds.map((episodeId) => ({ user_id: userId, episode_id: episodeId })),
          { onConflict: 'user_id,episode_id', ignoreDuplicates: true }
        );
    }
  },

  setProgress: (episodeId, positionSec, durationSec) => {
    const completed = durationSec > 0 && positionSec / durationSec >= 0.9;
    const updatedAt = new Date().toISOString();
    set((state) => ({
      progress: {
        ...state.progress,
        [episodeId]: { positionSec, durationSec, completed, updatedAt },
      },
    }));
    currentUserId().then((userId) => {
      if (!userId) return;
      supabase
        .from('progress')
        .upsert(
          { user_id: userId, episode_id: episodeId, position_sec: positionSec, duration_sec: durationSec, completed, updated_at: updatedAt },
          { onConflict: 'user_id,episode_id' }
        )
        .then(({ error }) => error && console.warn('setProgress sync failed', error));
    });
  },
  getProgress: (episodeId) => get().progress[episodeId],

  recordHistory: (episodeId, seriesId) => {
    const watchedAt = new Date().toISOString();
    set((state) => ({
      history: [{ episodeId, seriesId, watchedAt }, ...state.history.filter((h) => h.episodeId !== episodeId)].slice(0, 100),
    }));
    currentUserId().then((userId) => {
      if (!userId) return;
      supabase
        .from('watch_history')
        .upsert(
          { user_id: userId, episode_id: episodeId, series_id: seriesId, watched_at: watchedAt },
          { onConflict: 'user_id,episode_id' }
        )
        .then(({ error }) => error && console.warn('recordHistory sync failed', error));
    });
  },
  removeHistoryEntry: async (episodeId) => {
    const userId = await currentUserId();
    set((state) => ({ history: state.history.filter((h) => h.episodeId !== episodeId) }));
    if (userId) {
      await supabase.from('watch_history').delete().eq('user_id', userId).eq('episode_id', episodeId);
    }
  },
  clearHistory: async () => {
    const userId = await currentUserId();
    set({ history: [] });
    if (userId) {
      await supabase.from('watch_history').delete().eq('user_id', userId);
    }
  },

  hydrateFromServer: async () => {
    const userId = await currentUserId();
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

    const progress: Record<string, EpisodeProgress> = {};
    for (const row of progressRes.data ?? []) {
      progress[row.episode_id] = {
        positionSec: Number(row.position_sec),
        durationSec: Number(row.duration_sec),
        completed: row.completed,
        updatedAt: row.updated_at,
      };
    }

    set({
      favoriteSeriesIds: (favoritesRes.data ?? []).map((r) => r.series_id),
      unlockedEpisodeIds: (unlocksRes.data ?? []).map((r) => r.episode_id),
      history: (historyRes.data ?? []).map((r) => ({
        episodeId: r.episode_id,
        seriesId: r.series_id,
        watchedAt: r.watched_at,
      })),
      progress,
      isHydrated: true,
    });
  },

  resetLocal: () => set({ ...EMPTY_STATE, isHydrated: false }),

  resetServerData: async () => {
    const userId = await currentUserId();
    set({ ...EMPTY_STATE });
    if (!userId) return;
    await Promise.all([
      supabase.from('favorites').delete().eq('user_id', userId),
      supabase.from('unlocks').delete().eq('user_id', userId),
      supabase.from('watch_history').delete().eq('user_id', userId),
      supabase.from('progress').delete().eq('user_id', userId),
    ]);
  },
}));
