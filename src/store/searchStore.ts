import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { asyncStorageAdapter, STORAGE_KEYS } from './storage';

interface SearchState {
  recentSearches: string[];
  addRecent: (query: string) => void;
  clearRecent: () => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      recentSearches: [],
      addRecent: (query) =>
        set((state) => {
          const trimmed = query.trim();
          if (!trimmed) return state;
          const deduped = [trimmed, ...state.recentSearches.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())];
          return { recentSearches: deduped.slice(0, 10) };
        }),
      clearRecent: () => set({ recentSearches: [] }),
    }),
    {
      name: STORAGE_KEYS.search,
      storage: asyncStorageAdapter,
    }
  )
);
