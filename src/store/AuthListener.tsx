import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearPlaybackCache } from '@/services/playback';
import { DEFAULT_GUEST_NAME, DEFAULT_MEMBER_NAME } from '@/config';
import { useUserStore } from './userStore';
import { useLibraryStore } from './libraryStore';
import { useWalletStore } from './walletStore';
import { useSubscriptionStore } from './subscriptionStore';
import { useSearchStore } from './searchStore';
import type { AuthProvider, MockUser } from '@/types';

function detectProvider(session: Session): AuthProvider {
  if (session.user.is_anonymous) return 'guest';
  // Supabase records how the account signs in (email / phone / google / apple).
  const provider = (session.user.app_metadata?.provider ?? session.user.user_metadata?.provider) as string | undefined;
  if (provider === 'phone' || provider === 'google' || provider === 'apple') return provider;
  return 'email';
}

async function loadMockUser(session: Session): Promise<MockUser> {
  const provider = detectProvider(session);
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_seed, is_admin, public_code')
    .eq('user_id', session.user.id)
    .maybeSingle();

  const fallbackName = provider === 'guest' ? DEFAULT_GUEST_NAME : DEFAULT_MEMBER_NAME;

  return {
    id: session.user.id,
    displayName: profile?.display_name ?? fallbackName,
    email: session.user.email || undefined,
    phone: session.user.phone || undefined,
    publicCode: profile?.public_code ?? undefined,
    avatarSeed: profile?.avatar_seed ?? profile?.display_name ?? fallbackName,
    provider,
    createdAt: session.user.created_at,
    isAdmin: profile?.is_admin ?? false,
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
      // Signed playback URLs were issued for the previous user's entitlements.
      clearPlaybackCache();
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
