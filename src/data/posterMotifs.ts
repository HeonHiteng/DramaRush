import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

/** One symbolic icon per series, standing in for real poster artwork —
 * genre-appropriate, giving each series a distinct silhouette instead of a
 * flat gradient. Keyed by series id so it survives title edits. */
export const POSTER_MOTIFS: Record<string, IconName> = {
  'crimson-contract': 'flame',
  'heir-to-nowhere': 'business',
  'midnight-ledger': 'book',
  'paper-moon-diner': 'moon',
  'ever-after-glitch': 'sparkles',
  'varsity-hearts': 'musical-notes',
  'understudys-revenge': 'megaphone',
  'static-bloom': 'flower',
};

export const DEFAULT_POSTER_MOTIF: IconName = 'film';

export function motifForSeries(seriesId: string): IconName {
  return POSTER_MOTIFS[seriesId] ?? DEFAULT_POSTER_MOTIF;
}
