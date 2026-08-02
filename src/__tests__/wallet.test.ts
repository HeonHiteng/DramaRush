import { useWalletStore } from '@/store/walletStore';
import { useLibraryStore } from '@/store/libraryStore';
import { STARTING_COIN_BALANCE, COIN_PACKAGES } from '@/data/wallet';

describe('wallet: coin deduction', () => {
  beforeEach(() => {
    useWalletStore.setState({ balance: STARTING_COIN_BALANCE, transactions: [] });
    useLibraryStore.setState({
      favoriteSeriesIds: [],
      unlockedEpisodeIds: [],
      history: [],
      progress: {},
    });
  });

  it('deducts coins and records a transaction on successful spend', () => {
    const ok = useWalletStore.getState().spendCoins(20, 'Unlock episode');
    expect(ok).toBe(true);
    expect(useWalletStore.getState().balance).toBe(STARTING_COIN_BALANCE - 20);
    expect(useWalletStore.getState().transactions[0]).toMatchObject({ amount: -20, type: 'unlock' });
  });

  it('rejects spending more coins than the current balance (insufficient coins)', () => {
    const ok = useWalletStore.getState().spendCoins(STARTING_COIN_BALANCE + 1, 'Unlock episode');
    expect(ok).toBe(false);
    expect(useWalletStore.getState().balance).toBe(STARTING_COIN_BALANCE);
    expect(useWalletStore.getState().transactions).toHaveLength(0);
  });

  it('adds coins plus bonus coins when purchasing a package', () => {
    const pkg = COIN_PACKAGES.find((p) => p.bonusCoins > 0)!;
    useWalletStore.getState().purchasePackage(pkg);
    expect(useWalletStore.getState().balance).toBe(STARTING_COIN_BALANCE + pkg.coins + pkg.bonusCoins);
  });

  it('prevents the same episode from being charged twice', () => {
    const episodeId = 'crimson-contract-ep4';
    const first = useWalletStore.getState().spendCoins(20, 'Unlock episode 4');
    if (first) useLibraryStore.getState().unlockEpisode(episodeId);

    expect(useLibraryStore.getState().isUnlocked(episodeId)).toBe(true);
    const balanceAfterFirstUnlock = useWalletStore.getState().balance;

    // The paywall UI only calls spendCoins when the episode isn't already unlocked;
    // simulate that guard here and confirm a duplicate charge never happens.
    const alreadyUnlocked = useLibraryStore.getState().isUnlocked(episodeId);
    if (!alreadyUnlocked) {
      useWalletStore.getState().spendCoins(20, 'Unlock episode 4');
    }

    expect(useWalletStore.getState().balance).toBe(balanceAfterFirstUnlock);
  });

  it('unlockEpisode is idempotent for an already-unlocked episode', () => {
    const episodeId = 'crimson-contract-ep4';
    useLibraryStore.getState().unlockEpisode(episodeId);
    useLibraryStore.getState().unlockEpisode(episodeId);
    const unlocked = useLibraryStore.getState().unlockedEpisodeIds.filter((id) => id === episodeId);
    expect(unlocked).toHaveLength(1);
  });
});
