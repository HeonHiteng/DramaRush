import { spacing } from '@/theme';
import { useAppWidth } from '@/components/ui/WebFrame';

/** Card width for a Netflix-style poster grid that spans the screen with the
 * standard `spacing.lg` side insets and `spacing.sm` gaps between columns. */
export function usePosterGridCardWidth(columns = 3) {
  const appWidth = useAppWidth();
  return Math.floor((appWidth - spacing.lg * 2 - spacing.sm * (columns - 1)) / columns);
}
