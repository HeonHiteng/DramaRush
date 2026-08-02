import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/theme';
import { PosterCard } from './PosterCard';
import type { Series } from '@/types';

interface SeriesRailProps {
  title: string;
  series: Series[];
  onSeeAll?: () => void;
}

export function SeriesRail({ title, series, onSeeAll }: SeriesRailProps) {
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
        renderItem={({ item }) => <PosterCard series={item} onPress={() => router.push(`/series/${item.id}`)} />}
        ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
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
});
