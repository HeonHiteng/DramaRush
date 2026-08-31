import { router } from 'expo-router';
import { useUserStore } from '@/store';

/**
 * Signs the device in as a guest (an anonymous Supabase user, indistinguishable
 * from a real account for content/wallet/progress purposes) and navigates into
 * the app — instead of making every new user face a sign-in decision before
 * they've seen a single episode. Falls back to the auth screen only if guest
 * sign-in itself fails (e.g. anonymous auth disabled, no network), so nobody
 * gets stuck. Email/Google/staying-a-guest remain available afterward — this
 * just defers that choice past the point where it costs activation.
 */
export async function autoGuestSignIn() {
  await useUserStore.getState().signInAsGuest();
  if (useUserStore.getState().authError) {
    router.replace('/auth');
  } else {
    router.replace('/(tabs)');
  }
}
