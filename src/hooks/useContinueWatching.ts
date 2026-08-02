import { useMemo } from 'react';
import { useLibraryStore } from '@/store';
import { getEpisodeById, getSeriesById } from '@/data';
import type { Episode, Series } from '@/types';

export interface ContinueWatchingItem {
  series: Series;
  episode: Episode;
  progress: number;
}

export function useContinueWatching(): ContinueWatchingItem[] {
  const progress = useLibraryStore((s) => s.progress);

  return useMemo(() => {
    const items: ContinueWatchingItem[] = [];
    const seenSeries = new Set<string>();

    const sortedEntries = Object.entries(progress).sort(
      (a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime()
    );

    for (const [episodeId, p] of sortedEntries) {
      if (p.completed || p.positionSec <= 0) continue;
      const episode = getEpisodeById(episodeId);
      if (!episode) continue;
      if (seenSeries.has(episode.seriesId)) continue;
      const series = getSeriesById(episode.seriesId);
      if (!series) continue;
      seenSeries.add(episode.seriesId);
      items.push({ series, episode, progress: p.durationSec > 0 ? p.positionSec / p.durationSec : 0 });
    }

    return items;
  }, [progress]);
}
