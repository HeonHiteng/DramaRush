jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __getTable, __reset, __setQueryError, __setUserId } from '../testUtils/supabaseMock';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useWalletStore } from '@/store/walletStore';
import { useUserStore } from '@/store/userStore';
import type { AuthProvider } from '@/types';

function signInAs(id: string, provider: AuthProvider = 'google') {
  __setUserId(id, { anonymous: provider === 'guest' });
  useUserStore.setState({ user: { id, displayName: 'Tester', provider, avatarSeed: 'Tester', createdAt: '', isAdmin: false } });
}

function daysBetween(from: string, to: string) {
  return (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
}

describe('subscription entitlement', () => {
  beforeEach(() => {
    __reset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    signInAs('test-user-1');
    useSubscriptionStore.getState().resetLocal();
    useWalletStore.getState().resetLocal();
  });

  afterEach(() => jest.restoreAllMocks());

  it('activates a monthly plan and sets a renewal roughly one month out', async () => {
    expect(await useSubscriptionStore.getState().activate('monthly')).toBe(true);
    const state = useSubscriptionStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.planId).toBe('monthly');
    expect(state.cancelledAt).toBeNull();
    const days = daysBetween(state.startedAt!, state.renewsAt!);
    expect(days).toBeGreaterThan(25);
    expect(days).toBeLessThan(32);
  });

  it('activates an annual plan and sets a renewal roughly one year out', async () => {
    await useSubscriptionStore.getState().activate('annual');
    const state = useSubscriptionStore.getState();
    const days = daysBetween(state.startedAt!, state.renewsAt!);
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(367);
  });

  it('cancel() keeps access until the renewal date and records the cancellation', async () => {
    await useSubscriptionStore.getState().activate('monthly');
    const renewsAt = useSubscriptionStore.getState().renewsAt;
    expect(await useSubscriptionStore.getState().cancel()).toBe(true);
    const state = useSubscriptionStore.getState();
    expect(state.isActive).toBe(true);
    expect(state.planId).toBe('monthly');
    expect(state.renewsAt).toBe(renewsAt);
    expect(state.cancelledAt).not.toBeNull();

    // The server agrees after a fresh read.
    await useSubscriptionStore.getState().hydrateFromServer();
    expect(useSubscriptionStore.getState()).toMatchObject({ isActive: true, cancelledAt: state.cancelledAt });
  });

  it('pays the plan bonus once per billing period (subscribe -> cancel -> subscribe pays nothing more)', async () => {
    await useSubscriptionStore.getState().activate('monthly');
    expect(useWalletStore.getState().balance).toBe(100);
    await useSubscriptionStore.getState().cancel();
    await useSubscriptionStore.getState().activate('monthly');
    expect(useSubscriptionStore.getState().cancelledAt).toBeNull();
    expect(useWalletStore.getState().balance).toBe(100);
    expect(__getTable('transactions').filter((t) => t.type === 'bonus')).toHaveLength(1);
  });

  it('treats a membership past its renewal date as over', async () => {
    Object.assign(__getTable('subscriptions')[0], {
      is_active: true,
      plan_id: 'monthly',
      started_at: '2026-08-01T00:00:00.000Z',
      renews_at: '2026-09-01T00:00:00.000Z',
      cancelled_at: '2026-08-15T00:00:00.000Z',
    });
    await useSubscriptionStore.getState().hydrateFromServer();
    expect(useSubscriptionStore.getState().isActive).toBe(false);
  });

  it('reports a failed cancel and keeps the membership', async () => {
    await useSubscriptionStore.getState().activate('annual');
    // The server no longer sees a session: the call is refused.
    __setUserId(null);
    expect(await useSubscriptionStore.getState().cancel()).toBe(false);
    expect(useSubscriptionStore.getState().isActive).toBe(true);
  });

  it('guests cannot subscribe (account_required)', async () => {
    signInAs('guest-1', 'guest');
    expect(await useSubscriptionStore.getState().activate('monthly')).toBe(false);
    expect(useSubscriptionStore.getState().isActive).toBe(false);
  });

  it('keeps the membership it knows when a read fails', async () => {
    await useSubscriptionStore.getState().activate('annual');
    __setQueryError('subscriptions', { message: 'timeout' });
    await useSubscriptionStore.getState().hydrateFromServer();
    expect(useSubscriptionStore.getState()).toMatchObject({ isActive: true, planId: 'annual', hydrateError: 'timeout' });
  });

  it("discards a read that finishes after another account signed in", async () => {
    await useSubscriptionStore.getState().activate('annual');
    useSubscriptionStore.getState().resetLocal();
    const inFlight = useSubscriptionStore.getState().hydrateFromServer();
    signInAs('user-b');
    await inFlight;
    expect(useSubscriptionStore.getState().isActive).toBe(false);
  });
});
