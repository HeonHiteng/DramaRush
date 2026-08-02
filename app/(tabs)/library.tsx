import React, { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { PosterCard } from '@/components/media';
import { useSeries, useEpisodes } from '@/services/content';
import { useLibraryStore } from '@/store';
import { useContinueWatching } from '@/hooks/useContinueWatching';
import { formatRelativeDate } from '@/utils/format';

export default function LibraryScreen() {
  const continueWatching = useContinueWatching();
  const { data: allSeries = [] } = useSeries();
  const { data: allEpisodes = [] } = useEpisodes();
  const favoriteSeriesIds = useLibraryStore((s) => s.favoriteSeriesIds);
  const unlockedEpisodeIds = useLibraryStore((s) => s.unlockedEpisodeIds);
  const history = useLibraryStore((s) => s.history);
  const removeFavorite = useLibraryStore((s) => s.removeFavorite);
  const removeHistoryEntry = useLibraryStore((s) => s.removeHistoryEntry);
  const clearHistory = useLibraryStore((s) => s.clearHistory);

  const seriesById = useMemo(() => new Map(allSeries.map((s) => [s.id, s])), [allSeries]);
  const episodeById = useMemo(() => new Map(allEpisodes.map((e) => [e.id, e])), [allEpisodes]);

  const favoriteSeries = useMemo(
    () => favoriteSeriesIds.map((id) => seriesById.get(id)).filter((s): s is NonNullable<typeof s> => !!s),
    [favoriteSeriesIds, seriesById]
  );

  const unlockedSeries = useMemo(() => {
    const seriesIds = new Set(
      unlockedEpisodeIds.map((epId) => episodeById.get(epId)?.seriesId).filter((id): id is string => !!id)
    );
    return Array.from(seriesIds)
      .map((id) => seriesById.get(id))
      .filter((s): s is NonNullable<typeof s> => !!s);
  }, [unlockedEpisodeIds, seriesById, episodeById]);

  const hasAnything =
    continueWatching.length > 0 || favoriteSeries.length > 0 || unlockedSeries.length > 0 || history.length > 0;

  if (!hasAnything) {
    return (
      <Screen>
        <Text style={styles.header}>Library</Text>
        <EmptyState
          icon="bookmark-outline"
          title="Your library is empty"
          subtitle="Favourite a series or start an episode to see it here."
          actionLabel="Discover Series"
          onAction={() => router.push('/discover')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>Library</Text>

        {continueWatching.length > 0 && (
          <Section title="Continue Watching">
            <FlatList
              data={continueWatching}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.episode.id}
              contentContainerStyle={styles.railContent}
              ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
              renderItem={({ item }) => (
                <PosterCard
                  series={item.series}
                  progress={item.progress}
                  subtitle={`EP ${item.episode.number} · resume`}
                  onPress={() => router.push(`/player/${item.episode.id}`)}
                />
              )}
            />
          </Section>
        )}

        {favoriteSeries.length > 0 && (
          <Section title="Favourites">
            {favoriteSeries.map((series) => (
              <RowItem
                key={series.id}
                colorsFrom={series.posterColorFrom}
                colorsTo={series.posterColorTo}
                title={series.title}
                subtitle={`${series.genres.join(' · ')}`}
                onPress={() => router.push(`/series/${series.id}`)}
                onRemove={() => removeFavorite(series.id)}
                removeLabel="Remove favourite"
              />
            ))}
          </Section>
        )}

        {unlockedSeries.length > 0 && (
          <Section title="Unlocked Series">
            <FlatList
              data={unlockedSeries}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.railContent}
              ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
              renderItem={({ item }) => <PosterCard series={item} onPress={() => router.push(`/series/${item.id}`)} />}
            />
          </Section>
        )}

        {history.length > 0 && (
          <Section
            title="Watch History"
            action={{ label: 'Clear all', onPress: clearHistory }}
          >
            {history.slice(0, 30).map((entry) => {
              const episode = episodeById.get(entry.episodeId);
              const series = seriesById.get(entry.seriesId);
              if (!episode || !series) return null;
              return (
                <RowItem
                  key={entry.episodeId}
                  colorsFrom={series.posterColorFrom}
                  colorsTo={series.posterColorTo}
                  title={series.title}
                  subtitle={`EP ${episode.number} · ${formatRelativeDate(entry.watchedAt)}`}
                  onPress={() => router.push(`/player/${episode.id}`)}
                  onRemove={() => removeHistoryEntry(entry.episodeId)}
                  removeLabel="Remove from history"
                />
              );
            })}
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && (
          <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label}>
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function RowItem({
  colorsFrom,
  colorsTo,
  title,
  subtitle,
  onPress,
  onRemove,
  removeLabel,
}: {
  colorsFrom: string;
  colorsTo: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPress} style={styles.rowPressable} accessibilityRole="button" accessibilityLabel={title}>
        <LinearGradient colors={[colorsFrom, colorsTo]} style={styles.rowThumb} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={removeLabel} style={styles.removeButton}>
        <Ionicons name="close" size={16} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.md },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  actionText: { ...typography.bodyMedium, color: colors.accent },
  railContent: { paddingRight: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowPressable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  rowThumb: { width: 48, height: 68, borderRadius: radius.sm },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  rowSubtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
