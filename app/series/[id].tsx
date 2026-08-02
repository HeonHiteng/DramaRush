import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { StackHeader } from '@/components/ui/StackHeader';
import { AppButton } from '@/components/ui/AppButton';
import { EpisodeRow, SeriesRail } from '@/components/media';
import { EmptyState } from '@/components/ui/EmptyState';
import { getEpisodesForSeries, getSeriesById, getSimilarSeries } from '@/data';
import { useLibraryStore } from '@/store';

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const series = getSeriesById(id);
  const isFavorite = useLibraryStore((s) => (series ? s.isFavorite(series.id) : false));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const unlockedEpisodeIds = useLibraryStore((s) => s.unlockedEpisodeIds);
  const progress = useLibraryStore((s) => s.progress);

  if (!series) {
    return (
      <View style={styles.root}>
        <StackHeader title="Series" />
        <EmptyState icon="alert-circle-outline" title="Series not found" />
      </View>
    );
  }

  const episodes = getEpisodesForSeries(series.id);
  const similar = getSimilarSeries(series.id);

  const nextEpisode =
    episodes.find((ep) => {
      const p = progress[ep.id];
      return !p || !p.completed;
    }) ?? episodes[0];

  const hasStarted = episodes.some((ep) => progress[ep.id]);

  const handleShare = () => {
    if (Platform.OS === 'web') {
      alert(`Share link copied for "${series.title}" (simulated).`);
    } else {
      Alert.alert('Share', `Share link copied for "${series.title}" (simulated).`);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.bannerWrap}>
          <LinearGradient
            colors={[series.bannerColorFrom, series.bannerColorTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.banner}
          >
            <LinearGradient colors={gradients.posterFade} style={StyleSheet.absoluteFill} />
          </LinearGradient>
          <View style={styles.headerOverlay}>
            <StackHeader title="" />
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{series.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.ratingChip}>
              <Ionicons name="star" size={12} color={colors.gold} />
              <Text style={styles.ratingText}>{series.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.metaText}>{series.status === 'completed' ? 'Completed' : 'Ongoing'}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{episodes.length} episodes</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{series.language}</Text>
          </View>

          <View style={styles.genreRow}>
            {series.genres.map((g) => (
              <View key={g} style={styles.genrePill}>
                <Text style={styles.genrePillText}>{g}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.synopsis}>{series.synopsis}</Text>

          <View style={styles.castRow}>
            <Text style={styles.castLabel}>Cast</Text>
            <Text style={styles.castText}>{series.cast.map((c) => `${c.name} as ${c.role}`).join('  ·  ')}</Text>
          </View>

          <View style={styles.actionsRow}>
            <AppButton
              label={hasStarted ? 'Continue Watching' : 'Start Watching'}
              onPress={() => router.push(`/player/${nextEpisode.id}`)}
              variant="primary"
              style={styles.mainAction}
            />
            <Pressable
              onPress={() => toggleFavorite(series.id)}
              style={styles.iconAction}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            >
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? colors.accent : colors.textPrimary} />
            </Pressable>
            <Pressable onPress={handleShare} style={styles.iconAction} accessibilityRole="button" accessibilityLabel="Share series">
              <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Episodes</Text>
          <View style={styles.episodeList}>
            {episodes.map((ep) => {
              const epProgress = progress[ep.id];
              return (
                <EpisodeRow
                  key={ep.id}
                  episode={ep}
                  isUnlocked={unlockedEpisodeIds.includes(ep.id)}
                  progress={epProgress ? epProgress.positionSec / Math.max(1, epProgress.durationSec) : undefined}
                  onPress={() => router.push(`/player/${ep.id}`)}
                />
              );
            })}
          </View>
        </View>

        <SeriesRail title="Similar Series" series={similar} />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: spacing.xl },
  bannerWrap: { height: 280 },
  banner: { flex: 1 },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { paddingHorizontal: spacing.lg, marginTop: -spacing.xl },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.goldMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  ratingText: { ...typography.caption, color: colors.gold },
  metaText: { ...typography.caption, color: colors.textTertiary },
  metaDot: { ...typography.caption, color: colors.textTertiary },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs, marginBottom: spacing.md },
  genrePill: { backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radius.sm },
  genrePillText: { ...typography.micro, color: colors.textSecondary },
  synopsis: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 21 },
  castRow: { marginBottom: spacing.lg },
  castLabel: { ...typography.caption, color: colors.textTertiary, marginBottom: 4 },
  castText: { ...typography.body, color: colors.textSecondary },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  mainAction: { flex: 1 },
  iconAction: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  episodeList: { marginBottom: spacing.md },
});
