import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config/backend';

/** The Keybox backend (src/config/backend.ts) — the only database there is. */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE avoids needing to parse tokens out of a URL fragment on
    // native, where in-app browser redirects only give us a `?code=`
    // query param.
    flowType: 'pkce',
  },
});

// Supabase's token auto-refresh timer only runs while this is called;
// pause it when the app is backgrounded so it isn't wastefully refreshing
// tokens for a session nobody's using (recommended by Supabase's RN/Expo
// guide).
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
