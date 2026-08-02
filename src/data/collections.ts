import type { Series } from '@/types';
import { SERIES } from './seriesData';

export interface Collection {
  id: string;
  title: string;
  series: Series[];
}

function byPopularityDesc(list: Series[]): Series[] {
  return [...list].sort((a, b) => b.popularity - a.popularity);
}

export function getTrendingNow(): Series[] {
  return byPopularityDesc(SERIES).slice(0, 6);
}

export function getNewReleases(): Series[] {
  return SERIES.filter((s) => s.isNew);
}

export function getRecommendedForYou(): Series[] {
  return [...SERIES].reverse().slice(0, 6);
}

export function getFreeToWatch(): Series[] {
  return SERIES.filter((s) =>
    s.episodeIds.some((_id, idx) => idx < 2)
  );
}

export function getCompletedSeries(): Series[] {
  return SERIES.filter((s) => s.status === 'completed');
}

export function getHeroSeries(): Series[] {
  return byPopularityDesc(SERIES).slice(0, 5);
}

export function getSimilarSeries(seriesId: string, limit = 6): Series[] {
  const current = SERIES.find((s) => s.id === seriesId);
  if (!current) return [];
  return SERIES.filter((s) => s.id !== seriesId)
    .map((s) => ({
      series: s,
      overlap: s.genres.filter((g) => current.genres.includes(g)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap || b.series.popularity - a.series.popularity)
    .slice(0, limit)
    .map((x) => x.series);
}

export function getSeriesByGenre(genre: string): Series[] {
  return SERIES.filter((s) => s.genres.includes(genre as Series['genres'][number]));
}
