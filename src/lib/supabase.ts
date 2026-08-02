import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Set when EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are
 * missing. Checked explicitly at the root of the app (see app/_layout.tsx)
 * so a misconfigured build shows a clear message instead of a blank screen —
 * deliberately NOT a thrown error, since a throw during module evaluation
 * happens before React ever renders and isn't catchable by an error boundary.
 */
export const supabaseConfigError: string | null =
  !supabaseUrl || !supabaseAnonKey
    ? 'Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in a .env file at the project root ' +
      "(see .env.example) — get these values from your Supabase project's " +
      'Settings → API page. See the DramaRush-Backend repo README for full setup steps.'
    : null;

export const supabase: SupabaseClient = supabaseConfigError
  ? (null as unknown as SupabaseClient)
  : createClient(supabaseUrl!, supabaseAnonKey!, {
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

if (!supabaseConfigError) {
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
}
