import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asyncStorageAdapter, STORAGE_KEYS } from './storage';

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

  toggleFavorite: (seriesId: string) => void;
  isFavorite: (seriesId: string) => boolean;
  removeFavorite: (seriesId: string) => void;

  isUnlocked: (episodeId: string) => boolean;
  unlockEpisode: (episodeId: string) => void;
  lockAllPremium: (premiumEpisodeIds: string[]) => void;
  unlockAll: (allEpisodeIds: string[]) => void;

  setProgress: (episodeId: string, positionSec: number, durationSec: number) => void;
  getProgress: (episodeId: string) => EpisodeProgress | undefined;

  recordHistory: (episodeId: string, seriesId: string) => void;
  removeHistoryEntry: (episodeId: string) => void;
  clearHistory: () => void;

  resetLibrary: () => void;
}

const EMPTY_STATE = {
  favoriteSeriesIds: [] as string[],
  unlockedEpisodeIds: [] as string[],
  history: [] as HistoryEntry[],
  progress: {} as Record<string, EpisodeProgress>,
};

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      ...EMPTY_STATE,

      toggleFavorite: (seriesId) =>
        set((state) => {
          const has = state.favoriteSeriesIds.includes(seriesId);
          return {
            favoriteSeriesIds: has
              ? state.favoriteSeriesIds.filter((id) => id !== seriesId)
              : [seriesId, ...state.favoriteSeriesIds],
          };
        }),
      isFavorite: (seriesId) => get().favoriteSeriesIds.includes(seriesId),
      removeFavorite: (seriesId) =>
        set((state) => ({
          favoriteSeriesIds: state.favoriteSeriesIds.filter((id) => id !== seriesId),
        })),

      isUnlocked: (episodeId) => get().unlockedEpisodeIds.includes(episodeId),
      unlockEpisode: (episodeId) =>
        set((state) =>
          state.unlockedEpisodeIds.includes(episodeId)
            ? state
            : { unlockedEpisodeIds: [...state.unlockedEpisodeIds, episodeId] }
        ),
      lockAllPremium: (premiumEpisodeIds) =>
        set((state) => ({
          unlockedEpisodeIds: state.unlockedEpisodeIds.filter(
            (id) => !premiumEpisodeIds.includes(id)
          ),
        })),
      unlockAll: (allEpisodeIds) => set({ unlockedEpisodeIds: [...allEpisodeIds] }),

      setProgress: (episodeId, positionSec, durationSec) =>
        set((state) => {
          const completed = durationSec > 0 && positionSec / durationSec >= 0.9;
          return {
            progress: {
              ...state.progress,
              [episodeId]: {
                positionSec,
                durationSec,
                completed,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),
      getProgress: (episodeId) => get().progress[episodeId],

      recordHistory: (episodeId, seriesId) =>
        set((state) => ({
          history: [
            { episodeId, seriesId, watchedAt: new Date().toISOString() },
            ...state.history.filter((h) => h.episodeId !== episodeId),
          ].slice(0, 100),
        })),
      removeHistoryEntry: (episodeId) =>
        set((state) => ({
          history: state.history.filter((h) => h.episodeId !== episodeId),
        })),
      clearHistory: () => set({ history: [] }),

      resetLibrary: () => set({ ...EMPTY_STATE }),
    }),
    {
      name: STORAGE_KEYS.library,
      storage: asyncStorageAdapter,
    }
  )
);
