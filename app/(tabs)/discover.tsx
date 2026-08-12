import React, { useMemo, useState } from 'react';
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { GenreChip } from '@/components/ui/GenreChip';
import { PosterCard } from '@/components/media';
import { EmptyState } from '@/components/ui/EmptyState';
import { GridSkeleton } from '@/components/ui/LoadingSkeleton';
import { GENRES } from '@/data';
import { useSeries, useEpisodes } from '@/services/content';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import type { Episode, Series } from '@/types';

type AccessFilter = 'all' | 'free' | 'premium';
type StatusFilter = 'all' | 'ongoing' | 'completed';
type SortMode = 'popularity' | 'rating' | 'newest';

const SORT_LABEL_KEYS: Record<SortMode, TranslationKey> = {
  popularity: 'discover.sortPopularity',
  rating: 'discover.sortTopRated',
  newest: 'discover.sortNewest',
};
const SORT_ORDER: SortMode[] = ['popularity', 'rating', 'newest'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_WIDTH = Math.min(SCREEN_WIDTH, 430);
const GRID_CARD_WIDTH = (CONTAINER_WIDTH - spacing.lg * 2 - spacing.md) / 2;
const GRID_CARD_HEIGHT = GRID_CARD_WIDTH * 1.5;

const EMPTY_SERIES: Series[] = [];
const EMPTY_EPISODES: Episode[] = [];

export default function DiscoverScreen() {
  const { data: series, isLoading: seriesLoading } = useSeries();
  const { data: episodes, isLoading: episodesLoading } = useEpisodes();
  const [genre, setGenre] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [language, setLanguage] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('popularity');
  const { t } = useTranslation();

  const loading = seriesLoading || episodesLoading;
  const allSeries = series ?? EMPTY_SERIES;
  const allEpisodes = episodes ?? EMPTY_EPISODES;

  const languages = useMemo(() => Array.from(new Set(allSeries.map((s) => s.language))), [allSeries]);
  const premiumSeriesIds = useMemo(
    () => new Set(allEpisodes.filter((e) => e.access === 'subscriber').map((e) => e.seriesId)),
    [allEpisodes]
  );

  const results = useMemo(() => {
    let list = [...allSeries];

    if (genre) list = list.filter((s) => s.genres.includes(genre as Series['genres'][number]));
    if (status !== 'all') list = list.filter((s) => s.status === status);
    if (language) list = list.filter((s) => s.language === language);
    if (access !== 'all') {
      list = list.filter((s) => (access === 'premium' ? premiumSeriesIds.has(s.id) : !premiumSeriesIds.has(s.id)));
    }

    switch (sort) {
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        list.sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.popularity - a.popularity);
        break;
      default:
        list.sort((a, b) => b.popularity - a.popularity);
    }

    return list;
  }, [allSeries, genre, access, status, language, sort, premiumSeriesIds]);

  const cycleSort = () => {
    const idx = SORT_ORDER.indexOf(sort);
    setSort(SORT_ORDER[(idx + 1) % SORT_ORDER.length]);
  };

  return (
    <Screen>
      <Text style={styles.header}>{t('discover.title')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        <GenreChip label={t('discover.allGenres')} selected={genre === null} onPress={() => setGenre(null)} />
        {GENRES.map((g) => (
          <GenreChip key={g} label={g} selected={genre === g} onPress={() => setGenre(genre === g ? null : g)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        <GenreChip label={t('discover.anyAccess')} selected={access === 'all'} onPress={() => setAccess('all')} />
        <GenreChip label={t('discover.free')} selected={access === 'free'} onPress={() => setAccess('free')} />
        <GenreChip label={t('discover.premium')} selected={access === 'premium'} onPress={() => setAccess('premium')} />
        <View style={styles.chipDivider} />
        <GenreChip label={t('discover.anyStatus')} selected={status === 'all'} onPress={() => setStatus('all')} />
        <GenreChip label={t('discover.ongoing')} selected={status === 'ongoing'} onPress={() => setStatus('ongoing')} />
        <GenreChip label={t('discover.completed')} selected={status === 'completed'} onPress={() => setStatus('completed')} />
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        <GenreChip label={t('discover.anyLanguage')} selected={language === null} onPress={() => setLanguage(null)} />
        {languages.map((l) => (
          <GenreChip key={l} label={l} selected={language === l} onPress={() => setLanguage(language === l ? null : l)} />
        ))}
      </ScrollView>

      <View style={styles.sortRow}>
        <Text style={styles.resultCount}>{loading ? '…' : t('discover.seriesCount', { count: results.length })}</Text>
        <Pressable onPress={cycleSort} style={styles.sortButton} accessibilityRole="button" accessibilityLabel={`Sort by ${t(SORT_LABEL_KEYS[sort])}`}>
          <Ionicons name="swap-vertical" size={14} color={colors.textSecondary} />
          <Text style={styles.sortText}>{t(SORT_LABEL_KEYS[sort])}</Text>
        </Pressable>
      </View>

      {loading ? (
        <GridSkeleton count={6} />
      ) : results.length === 0 ? (
        <EmptyState
          icon="film-outline"
          title={t('discover.emptyTitle')}
          subtitle={t('discover.emptySubtitle')}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <PosterCard
              series={item}
              width={GRID_CARD_WIDTH}
              height={GRID_CARD_HEIGHT}
              onPress={() => router.push(`/series/${item.id}`)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { ...typography.h1, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  chipRow: { flexGrow: 0, marginBottom: spacing.sm },
  chipRowContent: { paddingHorizontal: spacing.lg, alignItems: 'center' },
  chipDivider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: spacing.xs },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  resultCount: { ...typography.caption, color: colors.textTertiary },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  sortText: { ...typography.caption, color: colors.textSecondary },
  gridContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  gridRow: { justifyContent: 'space-between', marginBottom: spacing.md },
});
