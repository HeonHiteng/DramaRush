import type { Episode, Series } from '@/types';
import type { EpisodeProgress } from '@/store';

export interface SeriesViewing {
  series: Series;
  /** Published episodes the series has right now. */
  totalEpisodes: number;
  /** Episodes the viewer has started (including finished ones). */
  startedEpisodes: number;
  completedEpisodes: number;
  watchedSec: number;
  lastWatchedAt: string;
  /** Every published episode watched to the end. A series that later gets new
   * episodes moves back to "watching". */
  finished: boolean;
  /** The episode a play button should start: the first one not yet finished. */
  nextEpisode: Episode | undefined;
}

export interface ViewingStats {
  totalSec: number;
  monthSec: number;
  /** Every series the viewer has played, most recent first. */
  all: SeriesViewing[];
  watching: SeriesViewing[];
  finished: SeriesViewing[];
}

/**
 * Viewing totals from the per-episode progress the app already syncs.
 * Time watched is how far into each episode the viewer got (the whole episode
 * once finished), so rewatching an episode doesn't count twice. "This month"
 * is that time for episodes last watched this calendar month.
 */
export function computeViewingStats(
  progress: Record<string, EpisodeProgress>,
  series: Series[],
  episodes: Episode[],
  now: Date = new Date()
): ViewingStats {
  const episodeById = new Map(episodes.map((e) => [e.id, e]));
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let totalSec = 0;
  let monthSec = 0;
  const bySeries = new Map<string, { started: number; completed: number; watchedSec: number; lastWatchedAt: string }>();

  for (const [episodeId, p] of Object.entries(progress)) {
    const episode = episodeById.get(episodeId);
    if (!episode || (!p.completed && p.positionSec <= 0)) continue;
    const sec = Math.max(0, p.completed ? p.durationSec || episode.durationSec : Math.min(p.positionSec, p.durationSec || p.positionSec));
    totalSec += sec;
    if (new Date(p.updatedAt).getTime() >= monthStart) monthSec += sec;

    const entry = bySeries.get(episode.seriesId) ?? { started: 0, completed: 0, watchedSec: 0, lastWatchedAt: p.updatedAt };
    entry.started += 1;
    if (p.completed) entry.completed += 1;
    entry.watchedSec += sec;
    if (p.updatedAt > entry.lastWatchedAt) entry.lastWatchedAt = p.updatedAt;
    bySeries.set(episode.seriesId, entry);
  }

  const all: SeriesViewing[] = [];
  for (const [seriesId, entry] of bySeries) {
    const s = seriesById.get(seriesId);
    if (!s) continue;
    const seriesEpisodes = episodes.filter((e) => e.seriesId === seriesId && e.published).sort((a, b) => a.number - b.number);
    const completedEpisodes = seriesEpisodes.filter((e) => progress[e.id]?.completed).length;
    all.push({
      series: s,
      totalEpisodes: seriesEpisodes.length,
      startedEpisodes: entry.started,
      completedEpisodes,
      watchedSec: entry.watchedSec,
      lastWatchedAt: entry.lastWatchedAt,
      finished: seriesEpisodes.length > 0 && completedEpisodes === seriesEpisodes.length,
      nextEpisode: seriesEpisodes.find((e) => !progress[e.id]?.completed) ?? seriesEpisodes[0],
    });
  }
  all.sort((a, b) => (a.lastWatchedAt < b.lastWatchedAt ? 1 : -1));

  return {
    totalSec,
    monthSec,
    all,
    watching: all.filter((v) => !v.finished),
    finished: all.filter((v) => v.finished),
  };
}
