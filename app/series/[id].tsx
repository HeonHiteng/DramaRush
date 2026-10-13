import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { StackHeader } from '@/components/ui/StackHeader';
import { AppButton } from '@/components/ui/AppButton';
import { EpisodeRow, PosterArt, PosterCard } from '@/components/media';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePosterGridCardWidth } from '@/hooks/usePosterGridCardWidth';
import { getNextEpisode } from '@/utils/nextEpisode';
import { getSimilarSeries } from '@/data';
import { useSeries, useSeriesById, useEpisodesForSeries } from '@/services/content';
import { useLibraryStore } from '@/store';
import { useTranslation } from '@/i18n/useTranslation';

type DetailTab = 'episodes' | 'similar';

export default function SeriesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: series, isLoading: seriesLoading } = useSeriesById(id);
  const { data: episodes, isLoading: episodesLoading } = useEpisodesForSeries(id);
  const { data: allSeries } = useSeries();
  const isFavorite = useLibraryStore((s) => (series ? s.isFavorite(series.id) : false));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const favoriteSeriesIds = useLibraryStore((s) => s.favoriteSeriesIds);
  const unlockedEpisodeIds = useLibraryStore((s) => s.unlockedEpisodeIds);
  const progress = useLibraryStore((s) => s.progress);
  const { t } = useTranslation();
  const [tab, setTab] = useState<DetailTab>('episodes');
  const gridCardWidth = usePosterGridCardWidth();

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
        <EmptyState fill icon="alert-circle-outline" title={t('series.notFound')} />
      </View>
    );
  }

  const similar = getSimilarSeries(allSeries ?? [], series.id);

  const nextEpisode = getNextEpisode(episodes, series.id, progress);

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
            {/* Fades the art all the way into the page background so the
                title (which overlaps the banner's bottom edge) sits on a
                seamless surface instead of a visible horizontal seam. */}
            <LinearGradient colors={['transparent', colors.bg]} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
          </LinearGradient>
          <View style={styles.headerOverlay}>
            <StackHeader title="" overlay />
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

          <AppButton
            label={hasStarted ? t('series.continueWatching') : t('series.startWatching')}
            onPress={() => nextEpisode && router.push(`/player/${nextEpisode.id}`)}
            variant="primary"
            size="lg"
            fullWidth
            icon={<Ionicons name="play" size={18} color={colors.textInverse} />}
            style={styles.playButton}
          />

          <Text style={styles.synopsis}>{series.synopsis}</Text>

          {series.cast.length > 0 && (
            <Text style={styles.castText} numberOfLines={2}>
              <Text style={styles.castLabel}>{t('series.cast')}: </Text>
              {series.cast.map((c) => c.name).join(', ')}
            </Text>
          )}

          <View style={styles.labeledActionsRow}>
            <LabeledAction
              icon={isFavorite ? 'checkmark' : 'add'}
              label={t('series.myList')}
              accessibilityLabel={isFavorite ? t('series.removeFromFavourites') : t('series.addToFavourites')}
              onPress={() => toggleFavorite(series.id)}
            />
            <LabeledAction
              icon="share-social-outline"
              label={t('series.share')}
              accessibilityLabel={t('series.shareSeries')}
              onPress={handleShare}
            />
          </View>

          <View style={styles.tabBar}>
            <DetailTabButton label={t('series.episodes')} active={tab === 'episodes'} onPress={() => setTab('episodes')} />
            {similar.length > 0 && (
              <DetailTabButton label={t('series.moreLikeThis')} active={tab === 'similar'} onPress={() => setTab('similar')} />
            )}
          </View>

          {tab === 'episodes' ? (
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
          ) : (
            <View style={styles.grid}>
              {similar.map((s) => (
                <PosterCard
                  key={s.id}
                  series={s}
                  width={gridCardWidth}
                  height={Math.round(gridCardWidth * 1.5)}
                  showRating={false}
                  isFavorite={favoriteSeriesIds.includes(s.id)}
                  onToggleFavorite={() => toggleFavorite(s.id)}
                  onPress={() => router.push(`/series/${s.id}`)}
                />
              ))}
            </View>
          )}
        </View>
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

interface LabeledActionProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

/** Netflix-style icon-over-label action ("My List", "Share"). */
function LabeledAction({ icon, label, accessibilityLabel, onPress }: LabeledActionProps) {
  return (
    <Pressable onPress={onPress} style={styles.labeledAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <Ionicons name={icon} size={24} color={colors.textPrimary} />
      <Text style={styles.labeledActionText}>{label}</Text>
    </Pressable>
  );
}

function DetailTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: spacing.xl },
  bannerWrap: { height: 320 },
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
  playButton: { marginBottom: spacing.md },
  synopsis: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 21 },
  castText: { ...typography.caption, color: colors.textTertiary, marginBottom: spacing.lg },
  castLabel: { color: colors.textSecondary },
  labeledActionsRow: { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.lg, paddingHorizontal: spacing.xs },
  labeledAction: { alignItems: 'center', gap: 4, minWidth: 56 },
  labeledActionText: { ...typography.micro, color: colors.textTertiary },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginBottom: spacing.md,
  },
  tab: { paddingBottom: spacing.xs },
  tabIndicator: { height: 3, marginBottom: spacing.sm, backgroundColor: 'transparent' },
  tabIndicatorActive: { backgroundColor: colors.accent },
  tabLabel: { ...typography.bodyMedium, color: colors.textTertiary },
  tabLabelActive: { color: colors.textPrimary },
  episodeList: { marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: spacing.md },
});
