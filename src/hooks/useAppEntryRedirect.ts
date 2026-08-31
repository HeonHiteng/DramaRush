import { useEffect, useRef } from 'react';
import { useUserStore } from '@/store';
import { autoGuestSignIn } from '@/utils/autoGuestSignIn';

export type AppEntryRedirect = '/onboarding' | '/(tabs)' | null;

/**
 * Decides where the splash screen should send the user once app state has
 * hydrated — separated from SplashScreen's animation/rendering so the
 * decision itself (a plain function of hasOnboarded/user) can be reasoned
 * about and tested without mounting reanimated shared values.
 *
 * Returns null while there's nothing to redirect to yet: either app state
 * hasn't hydrated, or an onboarded-but-signed-out user's automatic guest
 * sign-in (see autoGuestSignIn) is still in flight. That sign-in isn't
 * needed for a first-ever launch — onboarding's own "Get Started"/"Skip"
 * triggers it directly so it can navigate the moment sign-in resolves,
 * without waiting for this hook's own effect to catch up on the next render.
 */
export function useAppEntryRedirect(ready: boolean): AppEntryRedirect {
  const hasOnboarded = useUserStore((s) => s.hasOnboarded);
  const user = useUserStore((s) => s.user);
  const guestAttempted = useRef(false);

  useEffect(() => {
    if (ready && hasOnboarded && !user && !guestAttempted.current) {
      guestAttempted.current = true;
      autoGuestSignIn();
    }
  }, [ready, hasOnboarded, user]);

  if (!ready) return null;
  if (!hasOnboarded) return '/onboarding';
  if (user) return '/(tabs)';
  // No user yet: the effect above is attempting guest sign-in (or has
  // already redirected to /auth via autoGuestSignIn's own fallback).
  return null;
}
