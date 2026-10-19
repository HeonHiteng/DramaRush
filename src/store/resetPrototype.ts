import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { clearPlaybackCache } from '@/services/playback';
import { clearAllPrototypeStorage } from './storage';
import { useUserStore } from './userStore';
import { useLibraryStore } from './libraryStore';
import { useWalletStore } from './walletStore';
import { useSubscriptionStore } from './subscriptionStore';
import { useSearchStore } from './searchStore';
import { useSettingsStore } from './settingsStore';

function clearLocalUserData() {
  useLibraryStore.getState().resetLocal();
  useWalletStore.getState().resetLocal();
  useSubscriptionStore.getState().resetLocal();
  useSearchStore.getState().resetLocal();
  queryClient.clear();
  clearPlaybackCache();
}

/**
 * Developer tool (Profile shows it only in __DEV__ builds, to admins): clears
 * the signed-in user's server-side data (favorites, unlocks, history,
 * progress, coin balance, transactions, subscription, recent searches) via
 * the reset_my_data() RPC, signs them out of Supabase, and clears
 * device-local state (onboarding flag, playback/notification settings).
 */
export async function resetPrototype(): Promise<void> {
  // Must run while still authenticated. The server refuses once simulated
  // payments are switched off (launch builds) — then only local state resets.
  const { error } = await supabase.rpc('reset_my_data');
  if (error) console.warn('reset_my_data failed', error);

  clearLocalUserData();

  await useUserStore.getState().signOut();
  useUserStore.setState({ hasOnboarded: false });
  useSettingsStore.getState().resetSettings();

  await clearAllPrototypeStorage();
}

/**
 * Permanently deletes the signed-in account (members and guests alike) via
 * the delete-account Edge Function, then forgets it on this device. Resolves
 * to false — with nothing changed locally — if the server didn't confirm, so
 * the user can retry instead of being signed out of an account that still
 * exists. Device preferences (language, playback) are kept: they belong to
 * the device, not the account.
 */
export async function deleteAccount(): Promise<boolean> {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) {
    console.warn('delete-account failed', error);
    return false;
  }

  // The user no longer exists server-side, so signOut's revoke call is
  // refused — supabase-js still drops the local session for 401/403/404.
  // signOut() also marks the SIGNED_OUT as requested, so AuthListener
  // doesn't "recover" by creating a guest or sending them to sign in.
  await useUserStore.getState().signOut();
  clearLocalUserData();
  useUserStore.setState({ user: null, hasOnboarded: false, pendingWelcome: false, authError: null });
  return true;
}
