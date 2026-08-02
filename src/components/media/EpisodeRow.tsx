import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { LockBadge } from '@/components/ui/LockBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Episode } from '@/types';
import { formatEpisodeDuration } from '@/utils/format';

interface EpisodeRowProps {
  episode: Episode;
  isUnlocked: boolean;
  progress?: number;
  onPress: () => void;
}

export function EpisodeRow({ episode, isUnlocked, progress, onPress }: EpisodeRowProps) {
  const isLocked = episode.access !== 'free' && !isUnlocked;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Episode ${episode.number}, ${episode.title}, ${
        isLocked ? 'locked' : 'unlocked'
      }, ${formatEpisodeDuration(episode.durationSec)}`}
    >
      <View style={styles.numberWrap}>
        <Text style={styles.number}>{episode.number}</Text>
      </View>

      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {episode.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.duration}>{formatEpisodeDuration(episode.durationSec)}</Text>
          <LockBadge access={episode.access} coinPrice={episode.coinPrice} />
        </View>
        {typeof progress === 'number' && progress > 0 && (
          <ProgressBar progress={progress} style={styles.progress} />
        )}
      </View>

      <View style={styles.trailing}>
        {isLocked ? (
          <Ionicons name="lock-closed" size={18} color={colors.textTertiary} />
        ) : (
          <Ionicons name="play-circle" size={26} color={colors.accent} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  numberWrap: { width: 28, alignItems: 'center' },
  number: { ...typography.bodyMedium, color: colors.textTertiary },
  middle: { flex: 1, gap: 4 },
  title: { ...typography.bodyMedium, color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  duration: { ...typography.caption, color: colors.textTertiary },
  progress: { marginTop: 2 },
  trailing: { paddingLeft: spacing.xs },
});
