import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { PosterCard } from '@/components/media';
import { EmptyState } from '@/components/ui/EmptyState';
import { GridSkeleton } from '@/components/ui/LoadingSkeleton';
import { OptionPickerModal } from '@/components/ui/OptionPickerModal';
import { GENRES } from '@/data';
import { useSeries, useEpisodes } from '@/services/content';
import { useLibraryStore } from '@/store';
import { usePosterGridCardWidth } from '@/hooks/usePosterGridCardWidth';
import { useHaptics } from '@/hooks/useHaptics';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import type { Episode, Series } from '@/types';

type AccessFilter = 'all' | 'free' | 'premium';
type StatusFilter = 'all' | 'ongoing' | 'completed';
type SortMode = 'popularity' | 'rating' | 'newest';
type PickerKind = 'genre' | 'access' | 'status' | 'language' | 'sort';

const SORT_LABEL_KEYS: Record<SortMode, TranslationKey> = {
  popularity: 'discover.sortPopularity',
  rating: 'discover.sortTopRated',
  newest: 'discover.sortNewest',
};
const ACCESS_LABEL_KEYS: Record<AccessFilter, TranslationKey> = {
  all: 'discover.anyAccess',
  free: 'discover.free',
  premium: 'discover.premium',
};
const STATUS_LABEL_KEYS: Record<StatusFilter, TranslationKey> = {
  all: 'discover.anyStatus',
  ongoing: 'discover.ongoing',
  completed: 'discover.completed',
};

const GRID_COLUMNS = 3;
const EMPTY_SERIES: Series[] = [];
const EMPTY_EPISODES: Episode[] = [];

export default function DiscoverScreen() {
  const { data: series, isLoading: seriesLoading } = useSeries();
  const { data: episodes, isLoading: episodesLoading } = useEpisodes();
  const favoriteSeriesIds = useLibraryStore((s) => s.favoriteSeriesIds);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const [genre, setGenre] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [language, setLanguage] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('popularity');
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const cardWidth = usePosterGridCardWidth(GRID_COLUMNS);
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

  const hasActiveFilter = genre !== null || access !== 'all' || status !== 'all' || language !== null;
  const clearFilters = () => {
    setGenre(null);
    setAccess('all');
    setStatus('all');
    setLanguage(null);
  };
  const closePicker = () => setPicker(null);

  return (
    <Screen>
      <Text style={styles.header}>{t('discover.title')}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow} contentContainerStyle={styles.pillRowContent}>
        {hasActiveFilter && (
          <Pressable onPress={clearFilters} style={styles.clearPill} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('discover.clearFilters')}>
            <Ionicons name="close" size={16} color={colors.textPrimary} />
          </Pressable>
        )}
        <FilterPill label={genre ?? t('discover.allGenres')} active={genre !== null} onPress={() => setPicker('genre')} />
        <FilterPill label={t(ACCESS_LABEL_KEYS[access])} active={access !== 'all'} onPress={() => setPicker('access')} />
        <FilterPill label={t(STATUS_LABEL_KEYS[status])} active={status !== 'all'} onPress={() => setPicker('status')} />
        {languages.length > 1 && (
          <FilterPill label={language ?? t('discover.anyLanguage')} active={language !== null} onPress={() => setPicker('language')} />
        )}
      </ScrollView>

      <View style={styles.sortRow}>
        <Text style={styles.resultCount}>{loading ? '…' : t('discover.seriesCount', { count: results.length })}</Text>
        <Pressable onPress={() => setPicker('sort')} style={styles.sortButton} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Sort by ${t(SORT_LABEL_KEYS[sort])}`}>
          <Ionicons name="swap-vertical" size={14} color={colors.textSecondary} />
          <Text style={styles.sortText}>{t(SORT_LABEL_KEYS[sort])}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
        </Pressable>
      </View>

      {loading ? (
        <GridSkeleton count={6} itemWidth={cardWidth} />
      ) : results.length === 0 ? (
        <EmptyState fill icon="film-outline" title={t('discover.emptyTitle')} subtitle={t('discover.emptySubtitle')} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <PosterCard
              series={item}
              width={cardWidth}
              height={Math.round(cardWidth * 1.5)}
              showRating={false}
              isFavorite={favoriteSeriesIds.includes(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
              onPress={() => router.push(`/series/${item.id}`)}
            />
          )}
        />
      )}

      <OptionPickerModal
        visible={picker === 'genre'}
        options={[{ value: null, label: t('discover.allGenres') }, ...GENRES.map((g) => ({ value: g as string | null, label: g }))]}
        selected={genre}
        onSelect={setGenre}
        onClose={closePicker}
        closeLabel={t('common.close')}
      />
      <OptionPickerModal
        visible={picker === 'access'}
        options={(['all', 'free', 'premium'] as AccessFilter[]).map((v) => ({ value: v, label: t(ACCESS_LABEL_KEYS[v]) }))}
        selected={access}
        onSelect={setAccess}
        onClose={closePicker}
        closeLabel={t('common.close')}
      />
      <OptionPickerModal
        visible={picker === 'status'}
        options={(['all', 'ongoing', 'completed'] as StatusFilter[]).map((v) => ({ value: v, label: t(STATUS_LABEL_KEYS[v]) }))}
        selected={status}
        onSelect={setStatus}
        onClose={closePicker}
        closeLabel={t('common.close')}
      />
      <OptionPickerModal
        visible={picker === 'language'}
        options={[{ value: null, label: t('discover.anyLanguage') }, ...languages.map((l) => ({ value: l as string | null, label: l }))]}
        selected={language}
        onSelect={setLanguage}
        onClose={closePicker}
        closeLabel={t('common.close')}
      />
      <OptionPickerModal
        visible={picker === 'sort'}
        options={(['popularity', 'rating', 'newest'] as SortMode[]).map((v) => ({ value: v, label: t(SORT_LABEL_KEYS[v]) }))}
        selected={sort}
        onSelect={setSort}
        onClose={closePicker}
        closeLabel={t('common.close')}
      />
    </Screen>
  );
}

/** Netflix's "Categories ▾"-style pill: shows the current choice and opens
 * a full-screen picker. Filled when a non-default value is selected. */
function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { selection } = useHaptics();
  return (
    <Pressable
      onPress={() => {
        selection();
        onPress();
      }}
      style={[styles.pill, active && styles.pillActive]}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={active ? colors.textInverse : colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { ...typography.h1, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  pillRow: { flexGrow: 0, marginBottom: spacing.sm },
  pillRowContent: { paddingHorizontal: spacing.lg, alignItems: 'center', gap: spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pillActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  pillText: { ...typography.bodyMedium, color: colors.textPrimary },
  pillTextActive: { color: colors.textInverse },
  clearPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
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
  gridContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  gridRow: { columnGap: spacing.sm, marginBottom: spacing.md },
});
