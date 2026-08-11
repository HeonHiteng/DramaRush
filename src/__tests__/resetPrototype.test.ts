jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __reset } from '../testUtils/supabaseMock';
import { resetPrototype } from '@/store/resetPrototype';
import { useUserStore } from '@/store/userStore';
import { useWalletStore } from '@/store/walletStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSearchStore } from '@/store/searchStore';
import { STARTING_COIN_BALANCE } from '@/data/wallet';

describe('prototype reset behavior', () => {
  beforeEach(async () => {
    __reset();
    useUserStore.setState({
      user: { id: 'u1', displayName: 'Test User', provider: 'guest', avatarSeed: 'x', createdAt: new Date().toISOString(), isAdmin: false },
      hasOnboarded: true,
    });

    await useLibraryStore.getState().toggleFavorite('series-1');
    await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin');
    useLibraryStore.getState().recordHistory('ep-free', 'series-1');
    useLibraryStore.getState().setProgress('ep-free', 100, 600);

    await useSubscriptionStore.getState().activate('annual');
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
