import React, { useMemo } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { PosterRailSkeleton, SkeletonBlock } from '@/components/ui/LoadingSkeleton';
import { LinkAccountBanner } from '@/components/ui/LinkAccountBanner';
import { HeroCarousel, PosterCard, SeriesRail } from '@/components/media';
import { BRAND } from '@/config';
import { buildHomeRails, homeDateKey } from '@/data';
import { useSeries, useEpisodes } from '@/services/content';
import { useContinueWatching } from '@/hooks/useContinueWatching';
import { useTranslation } from '@/i18n/useTranslation';
import type { Genre } from '@/types';

function openCategory(genre: Genre) {
  router.navigate({ pathname: '/discover', params: { genre, at: String(Date.now()) } });
}

export default function HomeScreen() {
  const seriesQuery = useSeries();
  const episodesQuery = useEpisodes();
  const continueWatching = useContinueWatching();
  const { t } = useTranslation();

  const loading = seriesQuery.isLoading || episodesQuery.isLoading;
  const episodes = episodesQuery.data ?? [];
  // Each series shows in at most one rail; "Recommended" reshuffles once a day.
  const today = homeDateKey();
  const rails = useMemo(
    () => buildHomeRails(seriesQuery.data ?? [], episodesQuery.data ?? [], { date: today }),
    [seriesQuery.data, episodesQuery.data, today],
  );

  const onRefresh = () => {
    seriesQuery.refetch();
    episodesQuery.refetch();
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <BrandMark />
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
          <BrandMark />
          <Pressable
            onPress={() => router.push('/wallet')}
            style={styles.walletShortcut}
            accessibilityRole="button"
            accessibilityLabel="Open wallet"
          >
            <Ionicons name="wallet-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Guests only; renders nothing otherwise. */}
        <LinkAccountBanner />

        <HeroCarousel series={rails.hero} episodes={episodes} />

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

        <SeriesRail title={rails.lead.genre} series={rails.lead.series} onSeeAll={() => openCategory(rails.lead.genre)} />

        <SeriesRail title={t('home.trendingNow')} series={rails.trending} ranked />
        <SeriesRail title={t('home.newReleases')} series={rails.newReleases} />
        <SeriesRail title={t('home.recommendedForYou')} series={rails.recommended} />
        <SeriesRail title={t('home.freeToWatch')} series={rails.free} />
        <SeriesRail
          title={rails.featured.genre}
          series={rails.featured.series}
          onSeeAll={() => openCategory(rails.featured.genre)}
        />

        {rails.genres.map(({ genre, series: list }) => (
          <SeriesRail key={genre} title={genre} series={list} onSeeAll={() => openCategory(genre)} />
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </Screen>
  );
}

function BrandMark() {
  return (
    <View style={styles.brandRow} accessibilityRole="header" accessibilityLabel={BRAND.name}>
      <Image source={require('../../assets/images/logo-mark.png')} style={styles.brandLogo} resizeMode="contain" />
      <Text style={styles.brand}>{BRAND.name}</Text>
    </View>
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
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brandLogo: { width: 28, height: 28 },
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
  heroSkeleton: { marginHorizontal: spacing.lg, marginBottom: spacing.xl },
});
