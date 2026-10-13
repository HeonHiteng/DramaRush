import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '@/config';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { GenreChip } from '@/components/ui/GenreChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { PosterArt, PosterCard } from '@/components/media';
import { GENRES } from '@/data';
import { useLibraryStore, useSearchStore } from '@/store';
import { useEpisodes, useSeries } from '@/services/content';
import { usePosterGridCardWidth } from '@/hooks/usePosterGridCardWidth';
import { useTranslation } from '@/i18n/useTranslation';
import { getNextEpisode } from '@/utils/nextEpisode';
import { matchesQuery } from '@/utils/search';
import type { Series } from '@/types';

const GRID_COLUMNS = 3;
const TOP_SEARCHES_COUNT = 8;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const recentSearches = useSearchStore((s) => s.recentSearches);
  const addRecent = useSearchStore((s) => s.addRecent);
  const clearRecent = useSearchStore((s) => s.clearRecent);
  const favoriteSeriesIds = useLibraryStore((s) => s.favoriteSeriesIds);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const progress = useLibraryStore((s) => s.progress);
  const { data: series } = useSeries();
  const { data: episodes } = useEpisodes();
  const cardWidth = usePosterGridCardWidth(GRID_COLUMNS);
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 280);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => {
    if (!debouncedQuery.trim() || !series) return [];
    return series.filter((s) => matchesQuery(s, debouncedQuery));
  }, [debouncedQuery, series]);

  const topSearches = useMemo(
    () => [...(series ?? [])].sort((a, b) => b.popularity - a.popularity).slice(0, TOP_SEARCHES_COUNT),
    [series]
  );

  const commitSearch = (text: string) => {
    setQuery(text);
    if (text.trim()) addRecent(text.trim());
  };

  const playSeries = (s: Series) => {
    const nextEpisode = getNextEpisode(episodes ?? [], s.id, progress);
    router.push(nextEpisode ? `/player/${nextEpisode.id}` : `/series/${s.id}`);
  };

  const showEmptyResults = debouncedQuery.trim().length > 0 && results.length === 0;
  const showDiscoveryContent = !debouncedQuery.trim();

  return (
    <Screen>
      <Text style={styles.header}>{t('search.title')}</Text>

      <View style={styles.inputWrap}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => commitSearch(query)}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          returnKeyType="search"
          accessibilityLabel={`Search ${BRAND.name}`}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {showDiscoveryContent ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{t('search.recentSearches')}</Text>
                <Pressable onPress={clearRecent} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear recent searches">
                  <Text style={styles.clearText}>{t('search.clear')}</Text>
                </Pressable>
              </View>
              <View style={styles.chipWrap}>
                {recentSearches.map((q) => (
                  <GenreChip key={q} label={q} onPress={() => commitSearch(q)} />
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('search.topSearches')}</Text>
            {topSearches.map((s) => (
              <TopSearchRow
                key={s.id}
                series={s}
                playLabel={t('search.playSeries', { title: s.title })}
                onOpen={() => router.push(`/series/${s.id}`)}
                onPlay={() => playSeries(s)}
              />
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('search.browseByGenre')}</Text>
            <View style={styles.chipWrap}>
              {GENRES.map((g) => (
                <GenreChip key={g} label={g} onPress={() => commitSearch(g)} />
              ))}
            </View>
          </View>
        </ScrollView>
      ) : showEmptyResults ? (
        <EmptyState fill icon="search-outline" title={t('search.emptyTitle', { query: debouncedQuery })} subtitle={t('search.emptySubtitle')} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={styles.sectionTitle}>{t('search.topResults')}</Text>}
          renderItem={({ item }) => (
            <PosterCard
              series={item}
              width={cardWidth}
              height={Math.round(cardWidth * 1.5)}
              showRating={false}
              isFavorite={favoriteSeriesIds.includes(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
              onPress={() => {
                addRecent(debouncedQuery);
                router.push(`/series/${item.id}`);
              }}
            />
          )}
        />
      )}
    </Screen>
  );
}

interface TopSearchRowProps {
  series: Series;
  playLabel: string;
  onOpen: () => void;
  onPlay: () => void;
}

/** Netflix's Top Searches row: wide thumbnail and title (opens the series),
 * plus a play button that starts watching straight away. The two targets
 * are siblings, not nested — a pressable inside a pressable renders as an
 * invalid <button> inside a <button> on web. */
function TopSearchRow({ series, playLabel, onOpen, onPlay }: TopSearchRowProps) {
  return (
    <View style={styles.topRow}>
      <Pressable onPress={onOpen} style={styles.topRowMain} accessibilityRole="button" accessibilityLabel={`Open ${series.title}`}>
        <LinearGradient colors={[series.bannerColorFrom, series.bannerColorTo]} style={styles.topThumb}>
          {series.posterImageUri ? (
            <Image source={{ uri: series.posterImageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <PosterArt series={series} />
          )}
        </LinearGradient>
        <View style={styles.topRowText}>
          <Text style={styles.topRowTitle} numberOfLines={2}>
            {series.title}
          </Text>
          <Text style={styles.topRowSubtitle} numberOfLines={1}>
            {series.genres.join(' · ')} · ★ {series.rating.toFixed(1)}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onPlay} hitSlop={8} style={styles.playButton} accessibilityRole="button" accessibilityLabel={playLabel}>
        <Ionicons name="play-circle-outline" size={34} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { ...typography.h1, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  input: { flex: 1, ...typography.body, color: colors.textPrimary },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  clearText: { ...typography.bodyMedium, color: colors.accent },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  topRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topThumb: { width: 128, height: 72, borderRadius: radius.sm, overflow: 'hidden' },
  topRowText: { flex: 1 },
  topRowTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  topRowSubtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  playButton: { padding: 2 },
  gridRow: { columnGap: spacing.sm, marginBottom: spacing.md },
});
