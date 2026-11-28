import { computeViewingStats } from '@/utils/viewingStats';
import type { EpisodeProgress } from '@/store';
import type { Episode, Series } from '@/types';

function makeSeries(id: string): Series {
  return {
    id,
    title: id,
    synopsis: '',
    genres: ['Romance'],
    rating: 4,
    status: 'ongoing',
    language: 'English',
    posterColorFrom: '#000',
    posterColorTo: '#000',
    bannerColorFrom: '#000',
    bannerColorTo: '#000',
    cast: [],
    popularity: 1,
    isNew: false,
  };
}

function ep(seriesId: string, number: number, durationSec = 120): Episode {
  return { id: `${seriesId}-${number}`, seriesId, number, title: `EP ${number}`, durationSec, access: 'free', published: true };
}

function watched(positionSec: number, durationSec: number, updatedAt: string): EpisodeProgress {
  return { positionSec, durationSec, completed: positionSec / durationSec >= 0.9, updatedAt };
}

const NOW = new Date(2026, 10, 28, 12);
const THIS_MONTH = new Date(2026, 10, 20).toISOString();
const LAST_MONTH = new Date(2026, 9, 5).toISOString();

const series = [makeSeries('a'), makeSeries('b'), makeSeries('c')];
const episodes = [ep('a', 1), ep('a', 2), ep('b', 1), ep('b', 2), ep('c', 1)];

describe('computeViewingStats', () => {
  it('splits series into watching and finished, most recent first', () => {
    const stats = computeViewingStats(
      {
        'a-1': watched(120, 120, LAST_MONTH),
        'a-2': watched(120, 120, LAST_MONTH),
        'b-1': watched(30, 120, THIS_MONTH),
      },
      series,
      episodes,
      NOW
    );
    expect(stats.all.map((v) => v.series.id)).toEqual(['b', 'a']);
    expect(stats.finished.map((v) => v.series.id)).toEqual(['a']);
    expect(stats.watching.map((v) => v.series.id)).toEqual(['b']);
    expect(stats.watching[0]).toMatchObject({ totalEpisodes: 2, startedEpisodes: 1, completedEpisodes: 0 });
    expect(stats.watching[0].nextEpisode?.id).toBe('b-1');
  });

  it('counts how far into each episode the viewer got, and this month separately', () => {
    const stats = computeViewingStats(
      { 'a-1': watched(120, 120, LAST_MONTH), 'b-1': watched(30, 120, THIS_MONTH) },
      series,
      episodes,
      NOW
    );
    expect(stats.totalSec).toBe(150);
    expect(stats.monthSec).toBe(30);
  });

  it('ignores episodes that were opened but never played, and unknown episodes', () => {
    const stats = computeViewingStats(
      { 'c-1': watched(0, 120, THIS_MONTH), 'gone-1': watched(60, 120, THIS_MONTH) },
      series,
      episodes,
      NOW
    );
    expect(stats.all).toEqual([]);
    expect(stats.totalSec).toBe(0);
  });

  it('moves a finished series back to watching when a new episode is published', () => {
    const progress = { 'c-1': watched(120, 120, THIS_MONTH) };
    expect(computeViewingStats(progress, series, episodes, NOW).finished).toHaveLength(1);
    const withNewEpisode = computeViewingStats(progress, series, [...episodes, ep('c', 2)], NOW);
    expect(withNewEpisode.finished).toHaveLength(0);
    expect(withNewEpisode.watching[0].nextEpisode?.id).toBe('c-2');
  });
});
