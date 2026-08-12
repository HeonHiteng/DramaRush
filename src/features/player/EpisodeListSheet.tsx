import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { EpisodeRow } from '@/components/media/EpisodeRow';
import type { Episode } from '@/types';
import { useLibraryStore } from '@/store';
import { useTranslation } from '@/i18n/useTranslation';

interface EpisodeListSheetProps {
  seriesTitle: string;
  episodes: Episode[];
  activeEpisodeId: string;
  onSelect: (index: number) => void;
}

export function EpisodeListSheet({ seriesTitle, episodes, activeEpisodeId, onSelect }: EpisodeListSheetProps) {
  const unlockedEpisodeIds = useLibraryStore((s) => s.unlockedEpisodeIds);
  const progress = useLibraryStore((s) => s.progress);
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{seriesTitle}</Text>
      <Text style={styles.subtitle}>{t('series.episodesCount', { count: episodes.length })}</Text>
      <FlatList
        data={episodes}
        keyExtractor={(item) => item.id}
        style={styles.list}
        renderItem={({ item, index }) => {
          const p = progress[item.id];
          return (
            <View style={[styles.rowWrap, item.id === activeEpisodeId && styles.rowWrapActive]}>
              <EpisodeRow
                episode={item}
                isUnlocked={unlockedEpisodeIds.includes(item.id)}
                progress={p ? p.positionSec / Math.max(1, p.durationSec) : undefined}
                onPress={() => onSelect(index)}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { maxHeight: 480 },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.sm },
  list: { marginTop: spacing.xs },
  rowWrap: { borderRadius: 12 },
  rowWrapActive: { backgroundColor: colors.surfaceRaised },
});
