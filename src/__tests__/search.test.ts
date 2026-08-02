import { matchesQuery, searchSeries } from '@/utils/search';
import type { Series } from '@/types';

const FIXTURE_SERIES: Series[] = [
  {
    id: 'crimson-contract',
    title: 'Crimson Contract',
    synopsis: 'A woman fakes her death to take down the family that ruined hers.',
    genres: ['Revenge', 'Suspense'],
    rating: 4.8,
    status: 'ongoing',
    language: 'English',
    posterColorFrom: '#3A1420',
    posterColorTo: '#7A1F2B',
    bannerColorFrom: '#4A0F1A',
    bannerColorTo: '#8C2233',
    cast: [{ name: 'Elena Marsh', role: 'Wren Hale' }],
    popularity: 98,
    isNew: false,
  },
  {
    id: 'ever-after-glitch',
    title: 'Ever After Glitch',
    synopsis: 'A woman is pulled into a malfunctioning fairy-tale simulation.',
    genres: ['Fantasy', 'Romance'],
    rating: 4.9,
    status: 'ongoing',
    language: 'English',
    posterColorFrom: '#1E1330',
    posterColorTo: '#5A2E8C',
    bannerColorFrom: '#160D26',
    bannerColorTo: '#7B3FB8',
    cast: [{ name: 'Iris Okonkwo', role: 'Iris Vance' }],
    popularity: 95,
    isNew: true,
  },
];

describe('search filtering', () => {
  it('matches by title (case-insensitive)', () => {
    const results = searchSeries(FIXTURE_SERIES, 'crimson');
    expect(results.map((s) => s.id)).toContain('crimson-contract');
  });

  it('matches by genre', () => {
    const results = searchSeries(FIXTURE_SERIES, 'fantasy');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((s) => {
      expect(s.genres.some((g) => g.toLowerCase().includes('fantasy'))).toBe(true);
    });
  });

  it('matches by cast member name', () => {
    const results = searchSeries(FIXTURE_SERIES, 'Elena Marsh');
    expect(results.map((s) => s.id)).toContain('crimson-contract');
  });

  it('returns no results for a query that matches nothing', () => {
    const results = searchSeries(FIXTURE_SERIES, 'zzzznotarealquery');
    expect(results).toHaveLength(0);
  });

  it('returns false for an empty/whitespace query', () => {
    expect(matchesQuery(FIXTURE_SERIES[0], '')).toBe(false);
    expect(matchesQuery(FIXTURE_SERIES[0], '   ')).toBe(false);
  });
});
