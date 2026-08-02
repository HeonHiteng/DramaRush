import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useUserStore } from './userStore';
import { useLibraryStore } from './libraryStore';
import { useWalletStore } from './walletStore';
import { useSubscriptionStore } from './subscriptionStore';
import { useSearchStore } from './searchStore';
import type { AuthProvider, MockUser } from '@/types';

function detectProvider(session: Session): AuthProvider {
  if (session.user.is_anonymous) return 'guest';
  const metaProvider = session.user.user_metadata?.provider as AuthProvider | undefined;
  if (metaProvider === 'google' || metaProvider === 'apple') return metaProvider;
  return 'email';
}

async function loadMockUser(session: Session): Promise<MockUser> {
  const provider = detectProvider(session);
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_seed')
    .eq('user_id', session.user.id)
    .maybeSingle();

  const fallbackName = provider === 'guest' ? 'Guest Viewer' : 'DramaRush Member';

  return {
    id: session.user.id,
    displayName: profile?.display_name ?? fallbackName,
    email: session.user.email ?? undefined,
    avatarSeed: profile?.avatar_seed ?? profile?.display_name ?? fallbackName,
    provider,
    createdAt: session.user.created_at,
  };
}

/**
 * Mounted once at the app root. Keeps `useUserStore`'s `user` in sync with
 * the real Supabase session, and hydrates/clears the other per-user stores
 * (library, wallet, subscription, search) whenever the session changes.
 */
export function AuthListener() {
  useEffect(() => {
    let isMounted = true;

    async function handleSession(session: Session | null) {
      if (session) {
        const user = await loadMockUser(session);
        if (!isMounted) return;
        useUserStore.getState().setSessionUser(user);
        await Promise.all([
          useLibraryStore.getState().hydrateFromServer(),
          useWalletStore.getState().hydrateFromServer(),
          useSubscriptionStore.getState().hydrateFromServer(),
          useSearchStore.getState().hydrateFromServer(),
        ]);
      } else {
        useUserStore.getState().setSessionUser(null);
        useLibraryStore.getState().resetLocal();
        useWalletStore.getState().resetLocal();
        useSubscriptionStore.getState().resetLocal();
        useSearchStore.getState().resetLocal();
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) handleSession(session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return null;
}
