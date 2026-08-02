jest.mock('@/lib/supabase', () => require('../testUtils/supabaseMock'));

import { __reset } from '../testUtils/supabaseMock';
import { useLibraryStore } from '@/store/libraryStore';

function resetLibrary() {
  useLibraryStore.setState({ favoriteSeriesIds: [], unlockedEpisodeIds: [], history: [], progress: {} });
}

describe('library: favourites', () => {
  beforeEach(() => {
    __reset();
    resetLibrary();
  });

  it('toggles a series in and out of favourites', async () => {
    await useLibraryStore.getState().toggleFavorite('series-1');
    expect(useLibraryStore.getState().isFavorite('series-1')).toBe(true);

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
});

describe('library: viewing progress persistence', () => {
  beforeEach(() => {
    __reset();
    resetLibrary();
  });

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

describe('library: watch history', () => {
  beforeEach(() => {
    __reset();
    resetLibrary();
  });

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
