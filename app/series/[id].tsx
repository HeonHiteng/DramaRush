import React from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { StackHeader } from '@/components/ui/StackHeader';
import { AppButton } from '@/components/ui/AppButton';
import { EpisodeRow, PosterArt, SeriesRail } from '@/components/media';
import { EmptyState } from '@/components/ui/EmptyState';
import { getSimilarSeries } from '@/data';
import { useSeries, useSeriesById, useEpisodesForSeries } from '@/services/content';
import { useLibraryStore } from '@/store';
import { useTranslation } from '@/i18n/useTranslation';

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: series, isLoading: seriesLoading } = useSeriesById(id);
  const { data: episodes, isLoading: episodesLoading } = useEpisodesForSeries(id);
  const { data: allSeries } = useSeries();
  const isFavorite = useLibraryStore((s) => (series ? s.isFavorite(series.id) : false));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const unlockedEpisodeIds = useLibraryStore((s) => s.unlockedEpisodeIds);
  const progress = useLibraryStore((s) => s.progress);
  const { t } = useTranslation();

  if (seriesLoading || episodesLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!series) {
    return (
      <View style={styles.root}>
        <StackHeader title={t('series.headerTitle')} />
        <EmptyState icon="alert-circle-outline" title={t('series.notFound')} />
      </View>
    );
  }

  const similar = getSimilarSeries(allSeries ?? [], series.id);

  const nextEpisode =
    episodes.find((ep) => {
      const p = progress[ep.id];
      return !p || !p.completed;
    }) ?? episodes[0];

  const hasStarted = episodes.some((ep) => progress[ep.id]);

  const handleShare = () => {
    const message = t('series.shareMessage', { title: series.title });
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert(t('series.share'), message);
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
            {series.posterImageUri ? (
              <Image source={{ uri: series.posterImageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <PosterArt series={series} size="hero" />
            )}
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
            <Text style={styles.metaText}>{series.status === 'completed' ? t('series.completed') : t('series.ongoing')}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{t('series.episodesCount', { count: episodes.length })}</Text>
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
            <Text style={styles.castLabel}>{t('series.cast')}</Text>
            <Text style={styles.castText}>{series.cast.map((c) => `${c.name} as ${c.role}`).join('  ·  ')}</Text>
          </View>

          <View style={styles.actionsRow}>
            <AppButton
              label={hasStarted ? t('series.continueWatching') : t('series.startWatching')}
              onPress={() => nextEpisode && router.push(`/player/${nextEpisode.id}`)}
              variant="primary"
              style={styles.mainAction}
            />
            <Pressable
              onPress={() => toggleFavorite(series.id)}
              style={styles.iconAction}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? t('series.removeFromFavourites') : t('series.addToFavourites')}
            >
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? colors.accent : colors.textPrimary} />
            </Pressable>
            <Pressable onPress={handleShare} style={styles.iconAction} accessibilityRole="button" accessibilityLabel={t('series.shareSeries')}>
              <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>{t('series.episodes')}</Text>
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

        <SeriesRail title={t('series.similarSeries')} series={similar} />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
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
