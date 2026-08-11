jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __reset } from '../testUtils/supabaseMock';
import { useWalletStore } from '@/store/walletStore';
import { useLibraryStore } from '@/store/libraryStore';
import { STARTING_COIN_BALANCE, COIN_PACKAGES } from '@/data/wallet';

describe('wallet: coin deduction', () => {
  beforeEach(() => {
    __reset();
    useWalletStore.setState({ balance: STARTING_COIN_BALANCE, transactions: [] });
    useLibraryStore.setState({ favoriteSeriesIds: [], unlockedEpisodeIds: [], history: [], progress: {} });
  });

  it('deducts coins and records a transaction when unlocking a coin episode', async () => {
    const ok = await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin');
    expect(ok).toBe(true);

    await useWalletStore.getState().hydrateFromServer();
    expect(useWalletStore.getState().balance).toBe(STARTING_COIN_BALANCE - 20);
    expect(useWalletStore.getState().transactions[0]).toMatchObject({ amount: -20, type: 'unlock' });
  });

  it('rejects unlocking when the balance is too low (insufficient coins)', async () => {
    // ep-coin costs 20; drop the mock wallet's balance below that first.
    await useWalletStore.getState().setBalance(5);
    const ok = await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin');
    expect(ok).toBe(false);
    expect(useLibraryStore.getState().isUnlocked('ep-coin')).toBe(false);
  });

  it('adds coins plus bonus coins when purchasing a package', async () => {
    const pkg = COIN_PACKAGES.find((p) => p.bonusCoins > 0)!;
    await useWalletStore.getState().purchasePackage(pkg);
    expect(useWalletStore.getState().balance).toBe(STARTING_COIN_BALANCE + pkg.coins + pkg.bonusCoins);
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

  it('awards coins for the daily mission and marks it claimed', async () => {
    const awarded = await useWalletStore.getState().claimDailyMission();
    expect(awarded).toBe(20);
    expect(useWalletStore.getState().balance).toBe(STARTING_COIN_BALANCE + 20);
    expect(useWalletStore.getState().dailyMissionClaimedToday).toBe(true);
    expect(useWalletStore.getState().transactions[0]).toMatchObject({ amount: 20, type: 'reward' });
  });

  it('does not award the daily mission twice on the same day', async () => {
    await useWalletStore.getState().claimDailyMission();
    const balanceAfterFirst = useWalletStore.getState().balance;

    const secondAward = await useWalletStore.getState().claimDailyMission();
    expect(secondAward).toBe(0);
    expect(useWalletStore.getState().balance).toBe(balanceAfterFirst);
  });
});
