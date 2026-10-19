jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __getTable, __reset, __setBalance, __setConfig, __setQueryError, __setUserId } from '../testUtils/supabaseMock';
import { useWalletStore } from '@/store/walletStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useUserStore } from '@/store/userStore';
import { fetchCoinPackages } from '@/services/content';
import type { AuthProvider } from '@/types';

function signInAs(id: string, provider: AuthProvider = 'google') {
  __setUserId(id, { anonymous: provider === 'guest' });
  useUserStore.setState({ user: { id, displayName: 'Tester', provider, avatarSeed: 'Tester', createdAt: '', isAdmin: false } });
}

describe('wallet: coin deduction', () => {
  beforeEach(async () => {
    __reset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    signInAs('test-user-1');
    useWalletStore.getState().resetLocal();
    useLibraryStore.getState().resetLocal();
    __setBalance('test-user-1', 150);
    await useWalletStore.getState().hydrateFromServer();
  });

  afterEach(() => jest.restoreAllMocks());

  it('deducts coins and records a transaction when unlocking a coin episode', async () => {
    const ok = await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin');
    expect(ok).toBe(true);

    await useWalletStore.getState().hydrateFromServer();
    expect(useWalletStore.getState().balance).toBe(130);
    expect(useWalletStore.getState().transactions[0]).toMatchObject({ amount: -20, type: 'unlock' });
  });

  it('rejects unlocking when the balance is too low (insufficient coins)', async () => {
    // ep-coin costs 20; drop the mock wallet's balance below that first.
    await useWalletStore.getState().setBalance(5);
    const ok = await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin');
    expect(ok).toBe(false);
    expect(useLibraryStore.getState().isUnlocked('ep-coin')).toBe(false);
  });

  it('adds coins plus bonus coins when purchasing a package from the server catalog', async () => {
    const pkg = (await fetchCoinPackages()).find((p) => p.bonusCoins > 0)!;
    expect(await useWalletStore.getState().purchasePackage(pkg)).toBe(true);
    expect(useWalletStore.getState().balance).toBe(150 + pkg.coins + pkg.bonusCoins);
  });

  it('never charges the same episode twice', async () => {
    const first = await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin');
    expect(first).toBe(true);
    await useWalletStore.getState().hydrateFromServer();
    const balanceAfterFirstUnlock = useWalletStore.getState().balance;

    const second = await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin');
    expect(second).toBe(true); // idempotent success, not a new charge

    await useWalletStore.getState().hydrateFromServer();
    expect(useWalletStore.getState().balance).toBe(balanceAfterFirstUnlock);
  });

  it('unlocking is reflected immediately in isUnlocked()', async () => {
    await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin');
    expect(useLibraryStore.getState().isUnlocked('ep-coin')).toBe(true);
  });

  it('awards the server-configured daily mission reward and marks it claimed', async () => {
    __setConfig('daily_mission_reward', 35);
    const awarded = await useWalletStore.getState().claimDailyMission();
    expect(awarded).toBe(35);
    expect(useWalletStore.getState().balance).toBe(185);
    expect(useWalletStore.getState().dailyMissionClaimedToday).toBe(true);
    expect(useWalletStore.getState().transactions[0]).toMatchObject({ amount: 35, type: 'reward' });
  });

  it('does not award the daily mission twice on the same day', async () => {
    await useWalletStore.getState().claimDailyMission();
    const balanceAfterFirst = useWalletStore.getState().balance;

    const secondAward = await useWalletStore.getState().claimDailyMission();
    expect(secondAward).toBe(0);
    expect(useWalletStore.getState().balance).toBe(balanceAfterFirst);
  });

  it('marks the mission done when another device already claimed today', async () => {
    __getTable('daily_mission_claims').push({
      user_id: 'test-user-1',
      claim_date: new Date().toISOString().slice(0, 10),
      coins_awarded: 20,
    });
    useWalletStore.setState({ dailyMissionClaimedToday: false });
    expect(await useWalletStore.getState().claimDailyMission()).toBe(0);
    expect(useWalletStore.getState().dailyMissionClaimedToday).toBe(true);
  });

  it('a failed claim pays nothing and leaves the mission open', async () => {
    signInAs('guest-1', 'guest');
    useWalletStore.setState({ dailyMissionClaimedToday: false });
    expect(await useWalletStore.getState().claimDailyMission()).toBe(0);
    expect(useWalletStore.getState().dailyMissionClaimedToday).toBe(false);
  });
});

describe('wallet: account rules and hydration', () => {
  beforeEach(() => {
    __reset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    signInAs('test-user-1');
    useWalletStore.getState().resetLocal();
  });

  afterEach(() => jest.restoreAllMocks());

  it('starts every account at 0 coins — nothing assumes a starting balance', async () => {
    expect(useWalletStore.getState().balance).toBe(0);
    await useWalletStore.getState().hydrateFromServer();
    expect(useWalletStore.getState().balance).toBe(0);
  });

  it('shows 0, not the previous balance, when the account has no wallet row', async () => {
    useWalletStore.setState({ balance: 999 });
    signInAs('no-wallet-user');
    await useWalletStore.getState().hydrateFromServer();
    expect(useWalletStore.getState().balance).toBe(0);
  });

  it('keeps the previous data and reports the error when a read fails', async () => {
    __setBalance('test-user-1', 70);
    await useWalletStore.getState().hydrateFromServer();
    await useWalletStore.getState().claimDailyMission();
    const before = useWalletStore.getState();
    expect(before.balance).toBe(90);

    __setQueryError('wallets', { message: 'network down' });
    __setQueryError('transactions', { message: 'network down' });
    __setBalance('test-user-1', 5);
    await useWalletStore.getState().hydrateFromServer();
    expect(useWalletStore.getState().balance).toBe(90);
    expect(useWalletStore.getState().transactions).toEqual(before.transactions);
    expect(useWalletStore.getState().hydrateError).toBe('network down');

    __setQueryError('wallets', null);
    __setQueryError('transactions', null);
    await useWalletStore.getState().hydrateFromServer();
    expect(useWalletStore.getState().balance).toBe(5);
    expect(useWalletStore.getState().hydrateError).toBeNull();
  });

  it("discards a hydrate that finishes after another account signed in", async () => {
    __setBalance('test-user-1', 500);
    const inFlight = useWalletStore.getState().hydrateFromServer();
    signInAs('user-b');
    await inFlight;
    expect(useWalletStore.getState().balance).toBe(0);
    expect(useWalletStore.getState().isHydrated).toBe(false);
  });

  it('refreshIfStale only re-reads once the data is older than asked', async () => {
    await useWalletStore.getState().hydrateFromServer();
    __setBalance('test-user-1', 40);
    await useWalletStore.getState().refreshIfStale(60_000);
    expect(useWalletStore.getState().balance).toBe(0);
    useWalletStore.setState({ lastHydratedAt: Date.now() - 61_000 });
    await useWalletStore.getState().refreshIfStale(60_000);
    expect(useWalletStore.getState().balance).toBe(40);
  });

  it('guests can neither buy coins nor claim rewards (account_required)', async () => {
    signInAs('guest-1', 'guest');
    const [pkg] = await fetchCoinPackages();
    expect(await useWalletStore.getState().purchasePackage(pkg)).toBe(false);
    expect(await useWalletStore.getState().claimDailyMission()).toBe(0);
    await useWalletStore.getState().hydrateFromServer();
    expect(useWalletStore.getState().balance).toBe(0);
    expect(__getTable('transactions')).toHaveLength(0);
  });
});
