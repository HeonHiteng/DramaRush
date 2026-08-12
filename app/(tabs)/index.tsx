import React from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { PosterRailSkeleton, SkeletonBlock } from '@/components/ui/LoadingSkeleton';
import { HeroCarousel, PosterCard, SeriesRail } from '@/components/media';
import { BRAND } from '@/config';
import {
  getCompletedSeries,
  getFreeToWatch,
  getHeroSeries,
  getNewReleases,
  getRecommendedForYou,
  getSeriesByGenre,
  getTrendingNow,
  GENRES,
} from '@/data';
import { useSeries, useEpisodes } from '@/services/content';
import { useContinueWatching } from '@/hooks/useContinueWatching';
import { useTranslation } from '@/i18n/useTranslation';

export default function HomeScreen() {
  const seriesQuery = useSeries();
  const episodesQuery = useEpisodes();
  const continueWatching = useContinueWatching();
  const { t } = useTranslation();

  const loading = seriesQuery.isLoading || episodesQuery.isLoading;
  const series = seriesQuery.data ?? [];
  const episodes = episodesQuery.data ?? [];

  const onRefresh = () => {
    seriesQuery.refetch();
    episodesQuery.refetch();
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>{BRAND.name}</Text>
        </View>
        <SkeletonBlock height={340} borderRadius={radius.xxl} style={styles.heroSkeleton} />
        <PosterRailSkeleton />
        <View style={{ height: spacing.lg }} />
        <PosterRailSkeleton />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl tintColor={colors.accent} refreshing={seriesQuery.isRefetching} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerRow}>
          <Text style={styles.brand}>{BRAND.name}</Text>
          <Pressable
            onPress={() => router.push('/wallet')}
            style={styles.walletShortcut}
            accessibilityRole="button"
            accessibilityLabel="Open wallet"
          >
            <Ionicons name="wallet-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <HeroCarousel series={getHeroSeries(series)} />

        {continueWatching.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('home.continueWatching')}</Text>
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
          </View>
        )}

        <MembershipBanner />

        <SeriesRail title={t('home.trendingNow')} series={getTrendingNow(series)} />
        <SeriesRail title={t('home.newReleases')} series={getNewReleases(series)} />
        <SeriesRail title={t('home.recommendedForYou')} series={getRecommendedForYou(series)} />
        <SeriesRail title={t('home.freeToWatch')} series={getFreeToWatch(series, episodes)} />
        <SeriesRail title={t('home.completedSeries')} series={getCompletedSeries(series)} />

        {GENRES.map((genre) => {
          const list = getSeriesByGenre(series, genre);
          if (list.length === 0) return null;
          return <SeriesRail key={genre} title={`${genre} Picks`} series={list} />;
        })}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}

function MembershipBanner() {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => router.push('/subscription')}
      accessibilityRole="button"
      accessibilityLabel="View DramaRush membership plans"
      style={styles.bannerWrap}
    >
      <LinearGradient
        colors={['#3A2A12', '#5E4318', '#7A5A1E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.bannerTextWrap}>
          <Text style={styles.bannerEyebrow}>{t('home.membershipBannerEyebrow', { brand: BRAND.name.toUpperCase() })}</Text>
          <Text style={styles.bannerTitle}>{t('home.membershipBannerTitle')}</Text>
          <Text style={styles.bannerSubtitle}>{t('home.membershipBannerSubtitle')}</Text>
        </View>
        <Ionicons name="diamond" size={40} color="rgba(255,255,255,0.85)" />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  brand: { ...typography.h2, color: colors.textPrimary },
  walletShortcut: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  railContent: { paddingHorizontal: spacing.lg },
  bannerWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  banner: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTextWrap: { flex: 1, paddingRight: spacing.md },
  bannerEyebrow: { ...typography.micro, color: colors.gold, marginBottom: 4 },
  bannerTitle: { ...typography.h3, color: colors.white },
  bannerSubtitle: { ...typography.caption, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  heroSkeleton: { marginHorizontal: spacing.lg, marginBottom: spacing.xl },
});
