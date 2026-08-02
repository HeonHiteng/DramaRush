import { resetPrototype } from '@/store/resetPrototype';
import { useUserStore } from '@/store/userStore';
import { useWalletStore } from '@/store/walletStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSearchStore } from '@/store/searchStore';
import { STARTING_COIN_BALANCE } from '@/data/wallet';

describe('prototype reset behavior', () => {
  beforeEach(() => {
    useUserStore.setState({
      user: { id: 'u1', displayName: 'Test User', provider: 'guest', avatarSeed: 'x', createdAt: new Date().toISOString() },
      hasOnboarded: true,
    });
    useWalletStore.setState({ balance: 9999, transactions: [{ id: 't1', type: 'bonus', label: 'x', amount: 500, timestamp: new Date().toISOString() }] });
    useSubscriptionStore.setState({ isActive: true, planId: 'annual', startedAt: new Date().toISOString(), renewsAt: new Date().toISOString() });
    useLibraryStore.setState({
      favoriteSeriesIds: ['crimson-contract'],
      unlockedEpisodeIds: ['crimson-contract-ep4'],
      history: [{ episodeId: 'crimson-contract-ep1', seriesId: 'crimson-contract', watchedAt: new Date().toISOString() }],
      progress: { 'crimson-contract-ep1': { positionSec: 100, durationSec: 600, completed: false, updatedAt: new Date().toISOString() } },
    });
    useSearchStore.setState({ recentSearches: ['crimson'] });
  });

  it('clears onboarding, sign-in, coins, membership, unlocks, favourites, history, and search state', async () => {
    await resetPrototype();

    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().hasOnboarded).toBe(false);

    expect(useWalletStore.getState().balance).toBe(STARTING_COIN_BALANCE);

    expect(useSubscriptionStore.getState().isActive).toBe(false);
    expect(useSubscriptionStore.getState().planId).toBeNull();

    expect(useLibraryStore.getState().favoriteSeriesIds).toHaveLength(0);
    expect(useLibraryStore.getState().unlockedEpisodeIds).toHaveLength(0);
    expect(useLibraryStore.getState().history).toHaveLength(0);
    expect(Object.keys(useLibraryStore.getState().progress)).toHaveLength(0);

    expect(useSearchStore.getState().recentSearches).toHaveLength(0);
  });
});
