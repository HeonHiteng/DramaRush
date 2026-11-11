import { buildHomeRails, getSimilarSeries, seededShuffle, type HomeRails } from '@/data';
import type { Episode, Genre, Series } from '@/types';

function makeSeries(id: string, popularity: number, extra: Partial<Series> = {}): Series {
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
    popularity,
    isNew: false,
    ...extra,
  };
}

function freeEpisode(seriesId: string): Episode {
  return { id: `${seriesId}-1`, seriesId, number: 1, title: 'EP 1', durationSec: 60, access: 'free', published: true };
}

function allRails(r: HomeRails): Series[][] {
  return [r.hero, r.trending, r.newReleases, r.recommended, r.free, r.completed, ...r.genres.map((g) => g.series)];
}

const GENRE_CYCLE: Genre[] = ['Romance', 'Suspense', 'Revenge', 'Comedy', 'Fantasy', 'Youth', 'Mystery', 'Workplace'];

/** Shaped like the live catalogue: 7 films + 50 series, almost all `isNew`, plus one older title. */
function liveLikeCatalogue() {
  const series: Series[] = [];
  for (let i = 0; i < 57; i++) {
    series.push(
      makeSeries(`s${i}`, 120 - i, {
        isNew: true,
        status: i % 3 === 0 ? 'completed' : 'ongoing',
        genres: [GENRE_CYCLE[i % GENRE_CYCLE.length]],
      }),
    );
  }
  series.push(makeSeries('000-01', 10, { status: 'completed', genres: ['Mystery'] }));
  const episodes = series.map((s) => freeEpisode(s.id));
  return { series, episodes };
}

describe('buildHomeRails', () => {
  it('never puts the same series in two rails', () => {
    const { series, episodes } = liveLikeCatalogue();
    const rails = buildHomeRails(series, episodes, { date: '2026-11-11' });
    const ids = allRails(rails).flat().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    // and with this many titles every rail is filled
    expect(rails.trending.length).toBeGreaterThanOrEqual(6);
    expect(rails.newReleases).toHaveLength(10);
    expect(rails.recommended).toHaveLength(10);
    expect(rails.free).toHaveLength(10);
  });

  it('puts the 5 most popular distinct series in the hero, in order', () => {
    const { series, episodes } = liveLikeCatalogue();
    const duplicated = [...series, series[0], series[1]];
    const rails = buildHomeRails(duplicated, episodes, { date: '2026-11-11' });
    expect(rails.hero.map((s) => s.id)).toEqual(['s0', 's1', 's2', 's3', 's4']);
  });

  it('only puts matching series in the filtered rails', () => {
    const { series, episodes } = liveLikeCatalogue();
    const rails = buildHomeRails(series, episodes.slice(0, 40), { date: '2026-11-11' });
    const freeIds = new Set(episodes.slice(0, 40).map((e) => e.seriesId));
    expect(rails.newReleases.every((s) => s.isNew)).toBe(true);
    expect(rails.free.every((s) => freeIds.has(s.id))).toBe(true);
    expect(rails.completed.every((s) => s.status === 'completed')).toBe(true);
    for (const { genre, series: list } of rails.genres) {
      expect(list.every((s) => s.genres.includes(genre))).toBe(true);
    }
  });

  it('keeps Recommended stable within a day and changes it on another day', () => {
    const { series, episodes } = liveLikeCatalogue();
    const ids = (date: string, input = series) =>
      buildHomeRails(input, episodes, { date }).recommended.map((s) => s.id);
    const today = ids('2026-11-11');
    expect(ids('2026-11-11')).toEqual(today);
    expect(ids('2026-11-11', [...series].reverse())).toEqual(today); // input order does not matter
    expect(ids('2026-11-12')).not.toEqual(today);
  });

  it('leaves out rails with fewer than 3 series', () => {
    // 9 series: hero 5, trending 3, one left over for New Releases with nothing to top it up.
    const series = Array.from({ length: 9 }, (_, i) =>
      makeSeries(`s${i}`, 100 - i, { isNew: i === 8, genres: i === 8 ? ['Fantasy'] : ['Romance'] }),
    );
    const rails = buildHomeRails(series, [], { date: '2026-11-11', trendingSize: 3 });
    expect(rails.hero).toHaveLength(5);
    expect(rails.trending).toHaveLength(3);
    expect(rails.newReleases).toEqual([]); // only s8 is new: 1 < 3
    expect(rails.free).toEqual([]); // nothing is free
    expect(rails.completed).toEqual([]);
    // s8 went to Recommended (topped up with reused titles); no genre rail has anything new.
    expect(rails.recommended.map((s) => s.id)[0]).toBe('s8');
    expect(rails.genres).toEqual([]);
  });

  it('fills a short rail from unshown series first, then reuses earlier ones', () => {
    // Hero s0-s4, Trending s5-s7, Recommended takes 3 of s8-s11, so one free title is left unshown.
    const series = Array.from({ length: 12 }, (_, i) => makeSeries(`s${i}`, 100 - i, { genres: ['Comedy'] }));
    const episodes = ['s0', 's1', 's8', 's9', 's10', 's11'].map(freeEpisode);
    const rails = buildHomeRails(series, episodes, { date: '2026-11-11', trendingSize: 3, railSize: 3 });
    const [own, ...reused] = rails.free.map((s) => s.id);
    expect(rails.recommended.map((s) => s.id)).not.toContain(own);
    // ...so the rail reuses free hero titles rather than disappearing.
    expect(reused).toEqual(['s0', 's1']);

    // Genre rails. trendingSize/railSize 0 switch the other rails off so only genres are left.
    const off = { date: '2026-11-11', trendingSize: 0, railSize: 0 };
    const top = Array.from({ length: 5 }, (_, i) => makeSeries(`top${i}`, 200 - i, { genres: ['Comedy'] }));
    const m1 = makeSeries('m1', 50, { genres: ['Mystery'] });
    const r1 = makeSeries('r1', 40, { genres: ['Romance', 'Mystery'] });
    const r2 = makeSeries('r2', 30, { genres: ['Romance', 'Mystery'] });

    // Romance (r1, r2) is short and has nothing to reuse, so it is dropped and Mystery takes
    // the unshown r1, r2 as its top-up.
    const a = buildHomeRails([...top, m1, r1, r2], [], off);
    expect(a.genres.map((g) => [g.genre, g.series.map((s) => s.id)])).toEqual([['Mystery', ['m1', 'r1', 'r2']]]);

    // Genre rails never reuse: with a third Romance title, Romance keeps r1-r3 and Mystery (m1
    // alone, nothing unshown to borrow) is dropped instead of repeating them.
    const r3 = makeSeries('r3', 20, { genres: ['Romance', 'Mystery'] });
    const b = buildHomeRails([...top, m1, r1, r2, r3], [], off);
    expect(b.genres.map((g) => [g.genre, g.series.map((s) => s.id)])).toEqual([['Romance', ['r1', 'r2', 'r3']]]);
  });
});

describe('existing helpers', () => {
  it('seededShuffle is a permutation', () => {
    const list = [1, 2, 3, 4, 5, 6];
    expect([...seededShuffle(list, 'x')].sort()).toEqual(list);
  });

  it('getSimilarSeries still works', () => {
    const series = [makeSeries('a', 1), makeSeries('b', 2), makeSeries('c', 3, { genres: ['Comedy'] })];
    expect(getSimilarSeries(series, 'a').map((s) => s.id)).toEqual(['b', 'c']);
  });
});
