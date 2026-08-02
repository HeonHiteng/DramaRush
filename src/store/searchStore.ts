import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface SearchState {
  recentSearches: string[];
  isHydrated: boolean;
  addRecent: (query: string) => void;
  clearRecent: () => Promise<void>;
  hydrateFromServer: () => Promise<void>;
  resetLocal: () => void;
}

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export const useSearchStore = create<SearchState>()((set, get) => ({
  recentSearches: [],
  isHydrated: false,

  addRecent: (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const deduped = [trimmed, ...get().recentSearches.filter((q) => q.toLowerCase() !== trimmed.toLowerCase())].slice(0, 10);
    set({ recentSearches: deduped });
    currentUserId().then((userId) => {
      if (!userId) return;
      supabase
        .from('recent_searches')
        .insert({ user_id: userId, query: trimmed })
        .then(({ error }) => error && console.warn('addRecent sync failed', error));
    });
  },

  clearRecent: async () => {
    const userId = await currentUserId();
    set({ recentSearches: [] });
    if (userId) {
      await supabase.from('recent_searches').delete().eq('user_id', userId);
    }
  },

  hydrateFromServer: async () => {
    const userId = await currentUserId();
    if (!userId) {
      set({ recentSearches: [], isHydrated: true });
      return;
    }
    const { data } = await supabase
      .from('recent_searches')
      .select('query')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    set({ recentSearches: (data ?? []).map((r) => r.query), isHydrated: true });
  },

  resetLocal: () => set({ recentSearches: [], isHydrated: false }),
}));
