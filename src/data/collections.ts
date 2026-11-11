import type { Episode, Genre, Series } from '@/types';
import { GENRES } from './genres';

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

// ---------------------------------------------------------------------------
// Home page rails without repeats
// ---------------------------------------------------------------------------

export interface HomeRails {
  hero: Series[];
  trending: Series[];
  newReleases: Series[];
  recommended: Series[];
  free: Series[];
  completed: Series[];
  /** Only genres with at least `minRailSize` series, in GENRES order. */
  genres: { genre: Genre; series: Series[] }[];
}

export interface HomeRailsOptions {
  /** Day the "Recommended" shuffle is seeded with (YYYY-MM-DD or a Date). Defaults to today. */
  date?: string | Date;
  heroSize?: number;
  trendingSize?: number;
  railSize?: number;
  /** A rail with fewer items than this is not shown (the hero only needs one). */
  minRailSize?: number;
}

/** Local calendar day as YYYY-MM-DD. */
export function homeDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Deterministic Fisher-Yates shuffle driven by a string seed (FNV-1a hash + mulberry32). */
export function seededShuffle<T>(list: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Splits the catalogue over the Home rails so no series shows up in two rails.
 *
 * Allocation order: hero (most popular) -> Trending Now (next by popularity) -> New Releases
 * (`isNew`, by popularity) -> Recommended (daily seeded shuffle of what is left) -> Free To Watch
 * -> Completed -> one rail per genre (grouped by each series' first genre). Every rail only takes
 * series that match it. A rail that would get fewer than `minRailSize` items first takes other
 * unshown matching series, then (except genre rails) reuses matching series from earlier rails; if it is still short,
 * or has no unshown series of its own at all, it is returned empty (genre rails are left out) so
 * the screen does not render it. Genre rails are not capped, so every series lands somewhere.
 */
export function buildHomeRails(series: Series[], episodes: Episode[], opts: HomeRailsOptions = {}): HomeRails {
  const heroSize = opts.heroSize ?? 5;
  const trendingSize = opts.trendingSize ?? 8;
  const railSize = opts.railSize ?? 10;
  const minRail = opts.minRailSize ?? 3;
  const dateKey = typeof opts.date === 'string' ? opts.date : homeDateKey(opts.date);

  // Distinct ids, most popular first; id breaks ties so the order never depends on input order.
  const seen = new Set<string>();
  const sorted = [...series]
    .sort((a, b) => b.popularity - a.popularity || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));

  const used = new Set<string>();

  /** Takes up to `size` unused series from `candidates` (in order), topping up short rails. */
  const fill = (candidates: Series[], size: number, fallback: Series[] = candidates, allowReuse = true): Series[] => {
    const picked = candidates.filter((s) => !used.has(s.id)).slice(0, size);
    // A rail with nothing new of its own would only repeat earlier rails, so it is dropped.
    if (picked.length === 0) return [];
    if (picked.length < minRail) {
      const ids = new Set(picked.map((s) => s.id));
      // 1) other series nobody has seen yet, 2) reuse ones already shown in an earlier rail.
      for (const pass of allowReuse ? [false, true] : [false]) {
        for (const s of fallback) {
          if (picked.length >= minRail) break;
          if (ids.has(s.id) || used.has(s.id) !== pass) continue;
          picked.push(s);
          ids.add(s.id);
        }
      }
    }
    if (picked.length < minRail) return [];
    picked.forEach((s) => used.add(s.id));
    return picked;
  };

  const hero = sorted.slice(0, heroSize);
  hero.forEach((s) => used.add(s.id));

  const trending = fill(sorted, trendingSize);
  const newReleases = fill(
    sorted.filter((s) => s.isNew),
    railSize,
  );
  const recommended = fill(seededShuffle(sorted, dateKey), railSize);

  const freeIds = new Set(episodes.filter((e) => e.access === 'free').map((e) => e.seriesId));
  const free = fill(
    sorted.filter((s) => freeIds.has(s.id)),
    railSize,
  );
  const completed = fill(
    sorted.filter((s) => s.status === 'completed'),
    railSize,
  );

  const genres: HomeRails['genres'] = [];
  for (const genre of GENRES) {
    const firstGenre = sorted.filter((s) => s.genres.find((g) => GENRES.includes(g)) === genre);
    const anyGenre = sorted.filter((s) => s.genres.includes(genre));
    // Genre rails only top up with unshown series: with a big catalogue most titles are already
    // placed by now, and reusing them would bring back the repeats this function exists to avoid.
    const list = fill(firstGenre, Number.POSITIVE_INFINITY, anyGenre, false);
    if (list.length > 0) genres.push({ genre, series: list });
  }

  return { hero, trending, newReleases, recommended, free, completed, genres };
}
