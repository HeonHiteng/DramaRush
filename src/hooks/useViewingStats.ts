import { useMemo } from 'react';
import { useLibraryStore } from '@/store';
import { useSeries, useEpisodes } from '@/services/content';
import { computeViewingStats, type ViewingStats } from '@/utils/viewingStats';
import type { useTranslation } from '@/i18n/useTranslation';

type Translate = ReturnType<typeof useTranslation>['t'];

/** "2 hr 15 min", "35 min" or "< 1 min", in the interface language. */
export function formatWatchTime(totalSec: number, t: Translate): string {
  const totalMin = Math.floor(totalSec / 60);
  if (totalSec <= 0) return t('viewing.minutes', { m: 0 });
  if (totalMin < 1) return t('viewing.lessThanMinute');
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? t('viewing.hoursMinutes', { h, m }) : t('viewing.minutes', { m });
}

export function useViewingStats(): ViewingStats {
  const progress = useLibraryStore((s) => s.progress);
  const { data: series } = useSeries();
  const { data: episodes } = useEpisodes();
  return useMemo(() => computeViewingStats(progress, series ?? [], episodes ?? []), [progress, series, episodes]);
}
