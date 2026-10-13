import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/theme';
import { PosterCard } from './PosterCard';
import { useLibraryStore } from '@/store';
import type { Series } from '@/types';

interface SeriesRailProps {
  title: string;
  series: Series[];
  onSeeAll?: () => void;
  /** Netflix's "Top 10"-style treatment: a large rank number behind each
   * poster, in list order. Meant for rails that are actually ranked (e.g.
   * Trending Now) — not every rail. */
  ranked?: boolean;
}

export function SeriesRail({ title, series, onSeeAll, ranked = false }: SeriesRailProps) {
  const favoriteSeriesIds = useLibraryStore((s) => s.favoriteSeriesIds);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  if (series.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        data={series}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const card = (
            <PosterCard
              series={item}
              onPress={() => router.push(`/series/${item.id}`)}
              isFavorite={favoriteSeriesIds.includes(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
            />
          );
          if (!ranked) return card;
          return (
            <View style={styles.rankedItem}>
              <Text style={styles.rankNumber}>{index + 1}</Text>
              <View style={styles.rankedPoster}>{card}</View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ width: ranked ? 0 : spacing.sm }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h3, color: colors.textPrimary },
  seeAll: { ...typography.bodyMedium, color: colors.accent },
  listContent: { paddingHorizontal: spacing.lg },
  rankedItem: { flexDirection: 'row', alignItems: 'flex-end', marginRight: spacing.sm },
  rankNumber: {
    fontSize: 88,
    lineHeight: 88,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.35)',
    marginRight: -16,
  },
  rankedPoster: { zIndex: 1 },
});
