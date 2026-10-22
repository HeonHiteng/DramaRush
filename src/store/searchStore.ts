import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useUserStore } from './userStore';

const MAX_RECENT = 10;

interface SearchState {
  recentSearches: string[];
  isHydrated: boolean;
  /** Message of the last failed hydrate (the previous list is kept), or null. */
  hydrateError: string | null;
  addRecent: (query: string) => void;
  clearRecent: () => Promise<void>;
  hydrateFromServer: () => Promise<void>;
  resetLocal: () => void;
}

/** The signed-in user as AuthListener last saw it — no auth network call. */
function currentUserId(): string | null {
  return useUserStore.getState().user?.id ?? null;
}

/** Newest first, one entry per query regardless of case ("Crimson" and "crimson" are the same search). */
export function dedupeSearches(queries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const query of queries) {
    const key = query.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(query.trim());
  }
  return result.slice(0, MAX_RECENT);
}

export const useSearchStore = create<SearchState>()((set, get) => ({
  recentSearches: [],
  isHydrated: false,
  hydrateError: null,

  addRecent: (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    set({ recentSearches: dedupeSearches([trimmed, ...get().recentSearches]) });
    const userId = currentUserId();
    if (!userId) return;
    supabase
      .from('recent_searches')
      .insert({ user_id: userId, query: trimmed })
      .then(({ error }) => error && console.warn('addRecent sync failed', error));
  },

  clearRecent: async () => {
    const userId = currentUserId();
    set({ recentSearches: [] });
    if (userId) {
      await supabase.from('recent_searches').delete().eq('user_id', userId);
    }
  },

  hydrateFromServer: async () => {
    const userId = currentUserId();
    if (!userId) {
      set({ recentSearches: [], hydrateError: null, isHydrated: true });
      return;
    }
    // Every search is a new row, so repeats are common: read extra rows so
    // ten distinct queries survive de-duplication.
    const { data, error } = await supabase
      .from('recent_searches')
      .select('query')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_RECENT * 5);
    if (currentUserId() !== userId) return;
    if (error) {
      console.warn('search hydrate failed', error);
      set({ hydrateError: String(error.message ?? error), isHydrated: true });
      return;
    }
    set({ recentSearches: dedupeSearches((data ?? []).map((r) => r.query)), hydrateError: null, isHydrated: true });
  },

  resetLocal: () => set({ recentSearches: [], hydrateError: null, isHydrated: false }),
}));
