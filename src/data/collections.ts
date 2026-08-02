import type { Episode, Series } from '@/types';

function byPopularityDesc(list: Series[]): Series[] {
  return [...list].sort((a, b) => b.popularity - a.popularity);
}

export function getTrendingNow(series: Series[]): Series[] {
  return byPopularityDesc(series).slice(0, 6);
}

export function getNewReleases(series: Series[]): Series[] {
  return series.filter((s) => s.isNew);
}

export function getRecommendedForYou(series: Series[]): Series[] {
  return [...series].reverse().slice(0, 6);
}

export function getFreeToWatch(series: Series[], episodes: Episode[]): Series[] {
  const freeSeriesIds = new Set(episodes.filter((e) => e.access === 'free').map((e) => e.seriesId));
  return series.filter((s) => freeSeriesIds.has(s.id));
}

export function getCompletedSeries(series: Series[]): Series[] {
  return series.filter((s) => s.status === 'completed');
}

export function getHeroSeries(series: Series[]): Series[] {
  return byPopularityDesc(series).slice(0, 5);
}

export function getSimilarSeries(series: Series[], seriesId: string, limit = 6): Series[] {
  const current = series.find((s) => s.id === seriesId);
  if (!current) return [];
  return series
    .filter((s) => s.id !== seriesId)
    .map((s) => ({
      series: s,
      overlap: s.genres.filter((g) => current.genres.includes(g)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap || b.series.popularity - a.series.popularity)
    .slice(0, limit)
    .map((x) => x.series);
}

export function getSeriesByGenre(series: Series[], genre: string): Series[] {
  return series.filter((s) => s.genres.includes(genre as Series['genres'][number]));
}
