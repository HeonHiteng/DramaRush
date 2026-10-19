jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) } }));

import { router } from 'expo-router';
import { __emitAuthEvent, __getTable, __makeSession, __reset, __setUserId, supabase } from '../testUtils/supabaseMock';
import { startAuthListener } from '@/store/AuthListener';
import { useUserStore } from '@/store/userStore';
import { useWalletStore } from '@/store/walletStore';
import { useLibraryStore } from '@/store/libraryStore';
import { queryClient } from '@/lib/queryClient';
import * as playback from '@/services/playback';

/** Lets every pending mock query and the handlers awaiting them run. */
async function settle() {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
}

/** Holds the next query on `table` until the returned release() is called. */
function gateNextQuery(table: string) {
  const gate = deferred();
  const realFrom = supabase.from;
  let used = false;
  const spy = jest.spyOn(supabase, 'from').mockImplementation((name: string) => {
    const builder = realFrom(name);
    if (name !== table || used) return builder;
    used = true;
    const realThen = builder.then.bind(builder);
    builder.then = ((onFulfilled, onRejected) =>
      gate.promise.then(() => realThen(onFulfilled, onRejected))) as typeof builder.then;
    return builder;
  });
  return { release: gate.release, spy };
}

async function addAccount(userId: string, opts: { name: string; provider: string; balance: number }) {
  __getTable('wallets').push({ user_id: userId, balance: opts.balance, updated_at: new Date().toISOString() });
  __getTable('subscriptions').push({ user_id: userId, is_active: false, plan_id: null, started_at: null, renews_at: null });
  await supabase.from('profiles').insert({
    user_id: userId,
    display_name: opts.name,
    avatar_seed: opts.name,
    is_admin: false,
    public_code: `CODE-${userId}`,
    provider: opts.provider,
  });
}

function signIn(event: 'INITIAL_SESSION' | 'SIGNED_IN' | 'TOKEN_REFRESHED' | 'USER_UPDATED', userId: string, isAnonymous = false) {
  __setUserId(userId);
  __emitAuthEvent(event, __makeSession(userId, { isAnonymous }));
}

describe('AuthListener', () => {
  let stop: () => void;

  beforeEach(async () => {
    __reset();
    jest.restoreAllMocks();
    (router.replace as jest.Mock).mockClear();
    queryClient.clear();
    useUserStore.setState({ user: null, sessionChecked: false, signOutRequested: false, authError: null, pendingWelcome: false });
    useWalletStore.getState().resetLocal();
    useLibraryStore.getState().resetLocal();
    await addAccount('user-a', { name: 'Alice', provider: 'google', balance: 500 });
    await addAccount('user-b', { name: 'Bob', provider: 'phone', balance: 70 });
    stop = startAuthListener();
  });

  afterEach(() => stop());

  it('marks the session checked once the first event is handled', async () => {
    __setUserId(null);
    __emitAuthEvent('INITIAL_SESSION', null);
    await settle();
    expect(useUserStore.getState().sessionChecked).toBe(true);
    expect(useUserStore.getState().user).toBeNull();
  });

  it('reads the provider and name from profiles', async () => {
    signIn('INITIAL_SESSION', 'user-a');
    await settle();
    expect(useUserStore.getState().user).toMatchObject({ id: 'user-a', displayName: 'Alice', provider: 'google' });
    expect(useUserStore.getState().sessionChecked).toBe(true);
    expect(useWalletStore.getState().balance).toBe(500);
  });

  it('drops a slow profile load for account A that finishes after B signed in', async () => {
    const gate = gateNextQuery('profiles');
    signIn('INITIAL_SESSION', 'user-a');
    signIn('SIGNED_IN', 'user-b');
    await settle();
    expect(useUserStore.getState().user).toMatchObject({ id: 'user-b', displayName: 'Bob' });

    gate.release();
    await settle();
    expect(useUserStore.getState().user).toMatchObject({ id: 'user-b', displayName: 'Bob' });
    expect(useWalletStore.getState().balance).toBe(70);
  });

  it("re-hydrates when a stale hydrate for A lands after B's", async () => {
    signIn('INITIAL_SESSION', 'user-a');
    await settle();
    // A's next wallet read is in flight when B signs in, and returns last.
    const gate = gateNextQuery('wallets');
    signIn('SIGNED_IN', 'user-a');
    await new Promise((resolve) => setTimeout(resolve, 0));
    signIn('SIGNED_IN', 'user-b');
    await settle();
    gate.release();
    await settle();
    expect(useUserStore.getState().user?.id).toBe('user-b');
    expect(useWalletStore.getState().balance).toBe(70);
  });

  it('clears per-user stores, the query cache and playback grants when the account changes', async () => {
    signIn('INITIAL_SESSION', 'user-a');
    await settle();
    useLibraryStore.setState({ favoriteSeriesIds: ['series-1'] });
    queryClient.setQueryData(['admin', 'drafts'], ['draft-episode']);
    const clearPlayback = jest.spyOn(playback, 'clearPlaybackCache');

    signIn('SIGNED_IN', 'user-b');
    // Synchronously, before anything for B has loaded.
    expect(useLibraryStore.getState().favoriteSeriesIds).toEqual([]);
    expect(useWalletStore.getState().isHydrated).toBe(false);
    expect(queryClient.getQueryData(['admin', 'drafts'])).toBeUndefined();
    expect(clearPlayback).toHaveBeenCalled();
    expect(useUserStore.getState().user?.id).toBe('user-b');

    await settle();
    expect(useWalletStore.getState().balance).toBe(70);
  });

  it('does not re-read anything on TOKEN_REFRESHED for the same user', async () => {
    signIn('INITIAL_SESSION', 'user-a');
    await settle();
    const from = jest.spyOn(supabase, 'from');
    signIn('TOKEN_REFRESHED', 'user-a');
    await settle();
    expect(from).not.toHaveBeenCalled();
    expect(useUserStore.getState().user?.id).toBe('user-a');
  });

  it('reloads the profile in place when the same user signs in again (e.g. after linking)', async () => {
    signIn('INITIAL_SESSION', 'guest-x', true);
    __getTable('wallets').push({ user_id: 'guest-x', balance: 0 });
    __getTable('profiles').push({ user_id: 'guest-x', display_name: 'Guest Viewer', provider: 'guest', is_admin: false });
    await settle();
    useLibraryStore.setState({ favoriteSeriesIds: ['series-1'] });

    const profile = __getTable('profiles').find((p) => p.user_id === 'guest-x')!;
    profile.provider = 'google';
    profile.display_name = 'Gina';
    __getTable('wallets').find((w) => w.user_id === 'guest-x')!.balance = 150;
    signIn('SIGNED_IN', 'guest-x');
    // Same account: nothing is cleared.
    expect(useLibraryStore.getState().favoriteSeriesIds).toEqual(['series-1']);
    await settle();
    expect(useUserStore.getState().user).toMatchObject({ id: 'guest-x', provider: 'google', displayName: 'Gina' });
    expect(useWalletStore.getState().balance).toBe(150);
  });

  it('replaces a guest whose session ended on its own with a new guest', async () => {
    signIn('INITIAL_SESSION', 'guest-old', true);
    await settle();

    __setUserId(null);
    __emitAuthEvent('SIGNED_OUT', null);
    await settle();

    expect(useUserStore.getState().user).toMatchObject({ id: 'guest-1', provider: 'guest' });
    expect(useWalletStore.getState().balance).toBe(0);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends a member whose session expired to sign in, with a message", async () => {
    signIn('INITIAL_SESSION', 'user-a');
    await settle();

    __setUserId(null);
    __emitAuthEvent('SIGNED_OUT', null);
    await settle();

    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().authError).toBe('auth.sessionExpired');
    expect(router.replace).toHaveBeenCalledWith('/auth');
    expect(useWalletStore.getState().isHydrated).toBe(false);
  });

  it('does nothing extra when the user signed out themselves', async () => {
    signIn('INITIAL_SESSION', 'user-a');
    await settle();

    await useUserStore.getState().signOut();
    await settle();

    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().authError).toBeNull();
    expect(useUserStore.getState().signOutRequested).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
