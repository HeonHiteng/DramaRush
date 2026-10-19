jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __reset, __setInvokeHandler } from '../testUtils/supabaseMock';
import { deleteAccount, resetPrototype } from '@/store/resetPrototype';
import { useUserStore } from '@/store/userStore';
import { useWalletStore } from '@/store/walletStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSearchStore } from '@/store/searchStore';

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

    // reset_my_data() sets the balance to 0 (the welcome bonus is never paid twice).
    expect(useWalletStore.getState().balance).toBe(0);

    expect(useSubscriptionStore.getState().isActive).toBe(false);
    expect(useSubscriptionStore.getState().planId).toBeNull();

    expect(useLibraryStore.getState().favoriteSeriesIds).toHaveLength(0);
    expect(useLibraryStore.getState().unlockedEpisodeIds).toHaveLength(0);
    expect(useLibraryStore.getState().history).toHaveLength(0);
    expect(Object.keys(useLibraryStore.getState().progress)).toHaveLength(0);

    expect(useSearchStore.getState().recentSearches).toHaveLength(0);
  });
});

describe('account deletion', () => {
  beforeEach(async () => {
    __reset();
    useUserStore.setState({
      user: { id: 'test-user-1', displayName: 'Test User', provider: 'google', avatarSeed: 'x', createdAt: new Date().toISOString(), isAdmin: false },
      hasOnboarded: true,
      signOutRequested: false,
      pendingWelcome: true,
    });
    await useLibraryStore.getState().toggleFavorite('series-1');
  });

  it('calls delete-account, then forgets the account on this device', async () => {
    const calls: string[] = [];
    __setInvokeHandler(async (name) => {
      calls.push(name);
      return { data: { deleted: true }, error: null };
    });

    expect(await deleteAccount()).toBe(true);

    expect(calls).toEqual(['delete-account']);
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().hasOnboarded).toBe(false);
    expect(useUserStore.getState().pendingWelcome).toBe(false);
    expect(useLibraryStore.getState().favoriteSeriesIds).toHaveLength(0);
  });

  it('keeps everything when the server did not confirm', async () => {
    __setInvokeHandler(async () => ({ data: null, error: new Error('offline') }));

    expect(await deleteAccount()).toBe(false);

    expect(useUserStore.getState().user?.id).toBe('test-user-1');
    expect(useUserStore.getState().hasOnboarded).toBe(true);
    expect(useLibraryStore.getState().favoriteSeriesIds).toEqual(['series-1']);
  });
});
