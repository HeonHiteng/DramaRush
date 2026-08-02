import { useLibraryStore } from '@/store/libraryStore';

describe('library: favourites', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      favoriteSeriesIds: [],
      unlockedEpisodeIds: [],
      history: [],
      progress: {},
    });
  });

  it('toggles a series in and out of favourites', () => {
    useLibraryStore.getState().toggleFavorite('crimson-contract');
    expect(useLibraryStore.getState().isFavorite('crimson-contract')).toBe(true);

    useLibraryStore.getState().toggleFavorite('crimson-contract');
    expect(useLibraryStore.getState().isFavorite('crimson-contract')).toBe(false);
  });

  it('removeFavorite removes a specific series without affecting others', () => {
    useLibraryStore.getState().toggleFavorite('crimson-contract');
    useLibraryStore.getState().toggleFavorite('heir-to-nowhere');

    useLibraryStore.getState().removeFavorite('crimson-contract');

    expect(useLibraryStore.getState().isFavorite('crimson-contract')).toBe(false);
    expect(useLibraryStore.getState().isFavorite('heir-to-nowhere')).toBe(true);
  });
});

describe('library: viewing progress persistence', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      favoriteSeriesIds: [],
      unlockedEpisodeIds: [],
      history: [],
      progress: {},
    });
  });

  it('stores position and duration for an episode', () => {
    useLibraryStore.getState().setProgress('crimson-contract-ep1', 42, 600);
    const progress = useLibraryStore.getState().getProgress('crimson-contract-ep1');
    expect(progress?.positionSec).toBe(42);
    expect(progress?.durationSec).toBe(600);
  });

  it('marks an episode completed once watched past ~90%', () => {
    useLibraryStore.getState().setProgress('crimson-contract-ep1', 300, 600);
    expect(useLibraryStore.getState().getProgress('crimson-contract-ep1')?.completed).toBe(false);

    useLibraryStore.getState().setProgress('crimson-contract-ep1', 550, 600);
    expect(useLibraryStore.getState().getProgress('crimson-contract-ep1')?.completed).toBe(true);
  });

  it('resuming updates the stored position for the same episode', () => {
    useLibraryStore.getState().setProgress('crimson-contract-ep1', 100, 600);
    useLibraryStore.getState().setProgress('crimson-contract-ep1', 250, 600);
    expect(useLibraryStore.getState().getProgress('crimson-contract-ep1')?.positionSec).toBe(250);
  });
});

describe('library: watch history', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      favoriteSeriesIds: [],
      unlockedEpisodeIds: [],
      history: [],
      progress: {},
    });
  });

  it('records a history entry and de-duplicates repeats of the same episode', () => {
    useLibraryStore.getState().recordHistory('crimson-contract-ep1', 'crimson-contract');
    useLibraryStore.getState().recordHistory('crimson-contract-ep1', 'crimson-contract');
    expect(useLibraryStore.getState().history).toHaveLength(1);
  });

  it('removeHistoryEntry removes only the targeted episode', () => {
    useLibraryStore.getState().recordHistory('crimson-contract-ep1', 'crimson-contract');
    useLibraryStore.getState().recordHistory('crimson-contract-ep2', 'crimson-contract');

    useLibraryStore.getState().removeHistoryEntry('crimson-contract-ep1');

    const ids = useLibraryStore.getState().history.map((h) => h.episodeId);
    expect(ids).toEqual(['crimson-contract-ep2']);
  });

  it('clearHistory empties the list', () => {
    useLibraryStore.getState().recordHistory('crimson-contract-ep1', 'crimson-contract');
    useLibraryStore.getState().clearHistory();
    expect(useLibraryStore.getState().history).toHaveLength(0);
  });
});
