import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useSeries, useEpisodesForSeries } from '@/services/content';
import { colors, spacing, typography } from '@/theme';
import type { Series } from '@/types';

export default function AdminSeriesListScreen() {
  const { data: series, isLoading } = useSeries();

  return (
    <Screen>
      <StackHeader title="Content Admin" onBack={() => router.replace('/(tabs)/profile')} />
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : (
        <FlatList
          data={series ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState icon="film-outline" title="No series yet" subtitle="Create your first series to get started." />
          }
          ListHeaderComponent={
            <AppButton
              label="New Series"
              onPress={() => router.push('/admin/series/new')}
              icon={<Ionicons name="add" size={18} color={colors.textInverse} />}
              style={styles.newButton}
            />
          }
          renderItem={({ item }) => <SeriesRow series={item} />}
        />
      )}
    </Screen>
  );
}

function SeriesRow({ series }: { series: Series }) {
  const { data: episodes } = useEpisodesForSeries(series.id);
  return (
    <Pressable
      onPress={() => router.push(`/admin/series/${series.id}`)}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${series.title}`}
    >
      <LinearGradient colors={[series.posterColorFrom, series.posterColorTo]} style={styles.thumb} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {series.title}
        </Text>
        <Text style={styles.rowSubtitle}>
          {episodes?.length ?? 0} episode{episodes?.length === 1 ? '' : 's'} · {series.genres.join(', ')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  list: { padding: spacing.md, gap: spacing.sm },
  newButton: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  thumb: { width: 48, height: 64, borderRadius: 8 },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  rowSubtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
});
