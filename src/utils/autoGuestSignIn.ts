import { router } from 'expo-router';
import { useUserStore } from '@/store';

/**
 * Signs the device in as a guest (an anonymous Supabase user) and navigates
 * into the app — instead of making every new user face a sign-in decision
 * before they've seen a single episode. Falls back to the auth screen only if
 * guest sign-in itself fails (e.g. anonymous auth disabled, no network), so
 * nobody gets stuck. Linking Google/WhatsApp stays available afterward from
 * Profile — this just defers that choice past the point where it costs
 * activation.
 */
export async function autoGuestSignIn() {
  await useUserStore.getState().signInAsGuest();
  if (useUserStore.getState().authError) {
    router.replace('/auth');
  } else {
    router.replace('/(tabs)');
  }
}

/**
 * The guest's session died underneath them (see AuthListener): start a new
 * guest where they are rather than bouncing them through the splash — the old
 * guest account can't be signed back into anyway. Only a failed sign-in
 * leaves the current screen.
 */
export async function recoverGuestSession() {
  const ok = await useUserStore.getState().signInAsGuest();
  if (!ok) router.replace('/auth');
}
