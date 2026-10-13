import type { Episode } from '@/types';
import type { EpisodeProgress } from '@/store';

/**
 * The episode a "Play" / "Watch Now" button should start: the first episode
 * of the series the viewer hasn't finished, or episode 1 if they've finished
 * them all. `episodes` may be the whole catalog — it's filtered here.
 */
export function getNextEpisode(
  episodes: Episode[],
  seriesId: string,
  progress: Record<string, EpisodeProgress>
): Episode | undefined {
  const seriesEpisodes = episodes.filter((e) => e.seriesId === seriesId).sort((a, b) => a.number - b.number);
  return seriesEpisodes.find((ep) => !progress[ep.id]?.completed) ?? seriesEpisodes[0];
}
