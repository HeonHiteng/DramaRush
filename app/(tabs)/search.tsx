import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { GenreChip } from '@/components/ui/GenreChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { GENRES } from '@/data';
import { useSearchStore } from '@/store';
import { useSeries } from '@/services/content';
import type { Series } from '@/types';
import { matchesQuery } from '@/utils/search';

const TRENDING_SEARCHES = ['Crimson Contract', 'Revenge', 'Fantasy romance', 'Ever After Glitch', 'Workplace drama'];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const recentSearches = useSearchStore((s) => s.recentSearches);
  const addRecent = useSearchStore((s) => s.addRecent);
  const clearRecent = useSearchStore((s) => s.clearRecent);
  const { data: series } = useSeries();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 280);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => {
    if (!debouncedQuery.trim() || !series) return [];
    return series.filter((s) => matchesQuery(s, debouncedQuery));
  }, [debouncedQuery, series]);

  const commitSearch = (text: string) => {
    setQuery(text);
    if (text.trim()) addRecent(text.trim());
  };

  const showEmptyResults = debouncedQuery.trim().length > 0 && results.length === 0;
  const showDiscoveryContent = !debouncedQuery.trim();

  return (
    <Screen>
      <Text style={styles.header}>Search</Text>

      <View style={styles.inputWrap}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => commitSearch(query)}
          placeholder="Search titles, genres, or cast"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          returnKeyType="search"
          accessibilityLabel="Search DramaRush"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {showDiscoveryContent ? (
        <FlatList
          data={[1]}
          keyExtractor={() => 'discovery'}
          contentContainerStyle={styles.scrollContent}
          renderItem={() => (
            <View>
              {recentSearches.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Recent Searches</Text>
                    <Pressable onPress={clearRecent} accessibilityRole="button" accessibilityLabel="Clear recent searches">
                      <Text style={styles.clearText}>Clear</Text>
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
                <Text style={styles.sectionTitle}>Trending Searches</Text>
                <View style={styles.chipWrap}>
                  {TRENDING_SEARCHES.map((q) => (
                    <GenreChip key={q} label={q} onPress={() => commitSearch(q)} />
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Browse by Genre</Text>
                <View style={styles.chipWrap}>
                  {GENRES.map((g) => (
                    <GenreChip key={g} label={g} onPress={() => commitSearch(g)} />
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Suggested Titles</Text>
                {(series ?? []).slice(0, 4).map((s) => (
                  <SuggestedRow key={s.id} series={s} onPress={() => router.push(`/series/${s.id}`)} />
                ))}
              </View>
            </View>
          )}
        />
      ) : showEmptyResults ? (
        <EmptyState
          icon="search-outline"
          title={`No results for "${debouncedQuery}"`}
          subtitle="Try a different title, genre, or cast member."
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContent}
          renderItem={({ item }) => (
            <SuggestedRow
              series={item}
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

function SuggestedRow({ series, onPress }: { series: Series; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`Open ${series.title}`}>
      <LinearGradient colors={[series.posterColorFrom, series.posterColorTo]} style={styles.rowThumb} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {series.title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {series.genres.join(' · ')} · ★ {series.rating.toFixed(1)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </Pressable>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  rowThumb: { width: 48, height: 68, borderRadius: radius.sm },
  rowText: { flex: 1 },
  rowTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  rowSubtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
});
