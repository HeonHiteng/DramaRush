import type { Series } from '@/types';

export function matchesQuery(series: Series, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (
    series.title.toLowerCase().includes(q) ||
    series.genres.some((g) => g.toLowerCase().includes(q)) ||
    series.cast.some((c) => c.name.toLowerCase().includes(q)) ||
    series.synopsis.toLowerCase().includes(q)
  );
}

export function searchSeries(series: Series[], query: string): Series[] {
  return series.filter((s) => matchesQuery(s, query));
}
