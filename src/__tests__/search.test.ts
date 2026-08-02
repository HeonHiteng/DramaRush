import { matchesQuery, searchSeries } from '@/utils/search';
import { SERIES } from '@/data';

describe('search filtering', () => {
  it('matches by title (case-insensitive)', () => {
    const results = searchSeries(SERIES, 'crimson');
    expect(results.map((s) => s.id)).toContain('crimson-contract');
  });

  it('matches by genre', () => {
    const results = searchSeries(SERIES, 'fantasy');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((s) => {
      expect(s.genres.some((g) => g.toLowerCase().includes('fantasy'))).toBe(true);
    });
  });

  it('matches by cast member name', () => {
    const results = searchSeries(SERIES, 'Elena Marsh');
    expect(results.map((s) => s.id)).toContain('crimson-contract');
  });

  it('returns no results for a query that matches nothing', () => {
    const results = searchSeries(SERIES, 'zzzznotarealquery');
    expect(results).toHaveLength(0);
  });

  it('returns false for an empty/whitespace query', () => {
    expect(matchesQuery(SERIES[0], '')).toBe(false);
    expect(matchesQuery(SERIES[0], '   ')).toBe(false);
  });
});
