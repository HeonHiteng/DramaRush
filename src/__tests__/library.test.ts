jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __getTable, __reset, __setConfig, __setQueryError, __setUserId, supabase } from '../testUtils/supabaseMock';
import { PROGRESS_WRITE_INTERVAL_MS, useLibraryStore } from '@/store/libraryStore';
import { useUserStore } from '@/store/userStore';
import type { AuthProvider } from '@/types';

function signInAs(id: string, provider: AuthProvider = 'google') {
  __setUserId(id, { anonymous: provider === 'guest' });
  useUserStore.setState({ user: { id, displayName: 'Tester', provider, avatarSeed: 'Tester', createdAt: '', isAdmin: false } });
}

function resetLibrary() {
  useLibraryStore.getState().resetLocal();
}

function progressRow(episodeId: string) {
  return __getTable('progress').find((r) => r.episode_id === episodeId);
}

beforeEach(() => {
  __reset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  signInAs('test-user-1');
  resetLibrary();
});

afterEach(() => {
  resetLibrary();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('library: favourites', () => {
  it('toggles a series in and out of favourites', async () => {
    await useLibraryStore.getState().toggleFavorite('series-1');
    expect(useLibraryStore.getState().isFavorite('series-1')).toBe(true);
    expect(__getTable('favorites')).toEqual([{ user_id: 'test-user-1', series_id: 'series-1' }]);

    await useLibraryStore.getState().toggleFavorite('series-1');
    expect(useLibraryStore.getState().isFavorite('series-1')).toBe(false);
  });

  it('removeFavorite removes a specific series without affecting others', async () => {
    await useLibraryStore.getState().toggleFavorite('series-1');
    await useLibraryStore.getState().toggleFavorite('series-2');

    await useLibraryStore.getState().removeFavorite('series-1');

    expect(useLibraryStore.getState().isFavorite('series-1')).toBe(false);
    expect(useLibraryStore.getState().isFavorite('series-2')).toBe(true);
  });

  it('takes the user from the signed-in session, without an auth network call', async () => {
    const getUser = jest.spyOn(supabase.auth, 'getUser');
    await useLibraryStore.getState().toggleFavorite('series-1');
    useLibraryStore.getState().recordHistory('ep-free', 'series-1');
    await useLibraryStore.getState().hydrateFromServer();
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('library: viewing progress persistence', () => {
  it('stores position and duration for an episode', () => {
    useLibraryStore.getState().setProgress('ep-free', 42, 600);
    const progress = useLibraryStore.getState().getProgress('ep-free');
    expect(progress?.positionSec).toBe(42);
    expect(progress?.durationSec).toBe(600);
  });

  it('marks an episode completed once watched past ~90%', () => {
    useLibraryStore.getState().setProgress('ep-free', 300, 600);
    expect(useLibraryStore.getState().getProgress('ep-free')?.completed).toBe(false);

    useLibraryStore.getState().setProgress('ep-free', 550, 600);
    expect(useLibraryStore.getState().getProgress('ep-free')?.completed).toBe(true);
  });

  it('resuming updates the stored position for the same episode', () => {
    useLibraryStore.getState().setProgress('ep-free', 100, 600);
    useLibraryStore.getState().setProgress('ep-free', 250, 600);
    expect(useLibraryStore.getState().getProgress('ep-free')?.positionSec).toBe(250);
  });
});

describe('library: progress write throttle', () => {
  beforeEach(() => jest.useFakeTimers());

  function progressWrites(from: jest.SpyInstance) {
    return from.mock.calls.filter(([table]) => table === 'progress').length;
  }

  it('writes at most once per interval per episode, then the latest position', () => {
    const from = jest.spyOn(supabase, 'from');
    // The player reports time every 0.4 s.
    for (let t = 1; t <= 10; t++) {
      useLibraryStore.getState().setProgress('ep-free', t * 0.4, 600);
      jest.advanceTimersByTime(400);
    }
    // First report written at once; the rest wait for the interval.
    expect(progressWrites(from)).toBe(1);
    expect(progressRow('ep-free')?.position_sec).toBeCloseTo(0.4);

    jest.advanceTimersByTime(PROGRESS_WRITE_INTERVAL_MS);
    expect(progressWrites(from)).toBe(2);
    expect(progressRow('ep-free')?.position_sec).toBeCloseTo(4);
    // Local state is never throttled.
    expect(useLibraryStore.getState().getProgress('ep-free')?.positionSec).toBeCloseTo(4);
  });

  it('throttles each episode on its own', () => {
    const from = jest.spyOn(supabase, 'from');
    useLibraryStore.getState().setProgress('ep-free', 10, 600);
    useLibraryStore.getState().setProgress('ep-coin', 20, 600);
    expect(progressWrites(from)).toBe(2);
  });

  it('flushProgress writes the pending position immediately (pause, page change, background)', () => {
    const from = jest.spyOn(supabase, 'from');
    useLibraryStore.getState().setProgress('ep-free', 10, 600);
    useLibraryStore.getState().setProgress('ep-free', 11.2, 600);
    expect(progressWrites(from)).toBe(1);

    useLibraryStore.getState().flushProgress('ep-free');
    expect(progressWrites(from)).toBe(2);
    expect(progressRow('ep-free')?.position_sec).toBe(11.2);

    // Nothing left: the trailing timer and a second flush write nothing.
    useLibraryStore.getState().flushProgress('ep-free');
    jest.advanceTimersByTime(PROGRESS_WRITE_INTERVAL_MS);
    expect(progressWrites(from)).toBe(2);
  });

  it("never writes one account's pending position under another's", () => {
    useLibraryStore.getState().setProgress('ep-free', 10, 600);
    useLibraryStore.getState().setProgress('ep-free', 30, 600);
    signInAs('user-b');
    useLibraryStore.getState().flushProgress();
    expect(__getTable('progress')).toEqual([expect.objectContaining({ user_id: 'test-user-1', position_sec: 10 })]);
  });

  it('a hydrate keeps positions that have not been written yet', async () => {
    useLibraryStore.getState().setProgress('ep-free', 10, 600);
    useLibraryStore.getState().setProgress('ep-free', 42, 600);
    await useLibraryStore.getState().hydrateFromServer();
    expect(useLibraryStore.getState().getProgress('ep-free')?.positionSec).toBe(42);
  });
});

describe('library: watch history', () => {
  it('records a history entry and de-duplicates repeats of the same episode', () => {
    useLibraryStore.getState().recordHistory('ep-free', 'series-1');
    useLibraryStore.getState().recordHistory('ep-free', 'series-1');
    expect(useLibraryStore.getState().history).toHaveLength(1);
  });

  it('removeHistoryEntry removes only the targeted episode', async () => {
    useLibraryStore.getState().recordHistory('ep-free', 'series-1');
    useLibraryStore.getState().recordHistory('ep-ad', 'series-1');

    await useLibraryStore.getState().removeHistoryEntry('ep-free');

    const ids = useLibraryStore.getState().history.map((h) => h.episodeId);
    expect(ids).toEqual(['ep-ad']);
  });

  it('clearHistory empties the list', async () => {
    useLibraryStore.getState().recordHistory('ep-free', 'series-1');
    await useLibraryStore.getState().clearHistory();
    expect(useLibraryStore.getState().history).toHaveLength(0);
  });
});

describe('library: hydration', () => {
  it('keeps the lists it has when a read fails', async () => {
    await useLibraryStore.getState().toggleFavorite('series-1');
    useLibraryStore.getState().recordHistory('ep-free', 'series-1');
    await useLibraryStore.getState().hydrateFromServer();

    __setQueryError('favorites', { message: 'offline' });
    __getTable('watch_history').length = 0;
    await useLibraryStore.getState().hydrateFromServer();
    const state = useLibraryStore.getState();
    expect(state.favoriteSeriesIds).toEqual(['series-1']);
    expect(state.hydrateError).toBe('offline');
    // The reads that worked still apply.
    expect(state.history).toEqual([]);
  });

  it("discards a hydrate that finishes after another account signed in", async () => {
    await useLibraryStore.getState().toggleFavorite('series-1');
    resetLibrary();
    const inFlight = useLibraryStore.getState().hydrateFromServer();
    signInAs('user-b');
    await inFlight;
    expect(useLibraryStore.getState().favoriteSeriesIds).toEqual([]);
  });
});

describe('library: rewarded-ad unlocks', () => {
  it('unlocks the episode', async () => {
    expect(await useLibraryStore.getState().redeemAdReward('ep-ad')).toBe('unlocked');
    expect(useLibraryStore.getState().isUnlocked('ep-ad')).toBe(true);
  });

  it("says when today's ad-unlock cap is reached", async () => {
    __setConfig('ad_unlocks_per_day', 0);
    expect(await useLibraryStore.getState().redeemAdReward('ep-ad')).toBe('cap_reached');
    expect(useLibraryStore.getState().isUnlocked('ep-ad')).toBe(false);
  });

  it('tells guests to link an account, and other errors apart', async () => {
    expect(await useLibraryStore.getState().redeemAdReward('ep-coin')).toBe('failed');
    signInAs('guest-1', 'guest');
    expect(await useLibraryStore.getState().redeemAdReward('ep-ad')).toBe('account_required');
    expect(await useLibraryStore.getState().unlockEpisodeWithCoins('ep-coin')).toBe(false);
    expect(__getTable('unlocks')).toHaveLength(0);
  });
});
