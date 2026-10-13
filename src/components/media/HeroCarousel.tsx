import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { PosterArt } from './PosterArt';
import { useTranslation } from '@/i18n/useTranslation';
import { useLibraryStore } from '@/store';
import { getNextEpisode } from '@/utils/nextEpisode';
import type { Episode, Series } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH, 480) - spacing.lg * 2;
const CARD_HEIGHT = 400;

interface HeroCarouselProps {
  series: Series[];
  /** Used to resolve each series' next episode to play — the same
   * "first incomplete episode, else episode 1" rule as the series detail
   * page — so "Watch Now" here starts playback immediately instead of
   * just opening the series page (that's what "More Info" is for). */
  episodes: Episode[];
}

export function HeroCarousel({ series, episodes }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<Series>>(null);
  const progress = useLibraryStore((s) => s.progress);
  const { t } = useTranslation();

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + spacing.md));
    setActiveIndex(index);
  }, []);

  if (series.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={series}
        horizontal
        pagingEnabled={false}
        snapToInterval={CARD_WIDTH + spacing.md}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item: Series) => item.id}
        contentContainerStyle={styles.listContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }: { item: Series }) => (
          <View style={styles.card}>
            <LinearGradient
              colors={[item.bannerColorFrom, item.bannerColorTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            >
              {item.posterImageUri ? (
                <Image source={{ uri: item.posterImageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <PosterArt series={item} size="hero" />
              )}
              <LinearGradient colors={gradients.scrimBottom} style={StyleSheet.absoluteFill} />
              <View style={styles.badgeRow}>
                {item.genres.slice(0, 2).map((g) => (
                  <View key={g} style={styles.genrePill}>
                    <Text style={styles.genreText}>{g}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.synopsis} numberOfLines={2}>
                  {item.synopsis}
                </Text>
                <View style={styles.ctaRow}>
                  <AppButton
                    label={t('common.watchNow')}
                    onPress={() => {
                      const nextEpisode = getNextEpisode(episodes, item.id, progress);
                      router.push(nextEpisode ? `/player/${nextEpisode.id}` : `/series/${item.id}`);
                    }}
                    icon={<Ionicons name="play" size={16} color={colors.textInverse} />}
                    style={styles.cta}
                  />
                  <AppButton
                    label={t('common.moreInfo')}
                    onPress={() => router.push(`/series/${item.id}`)}
                    variant="secondary"
                    icon={<Ionicons name="information-circle-outline" size={18} color={colors.textPrimary} />}
                    style={styles.cta}
                  />
                </View>
              </View>
            </LinearGradient>
          </View>
        )}
      />
      <View style={styles.dots}>
        {series.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.xl },
  listContent: { paddingHorizontal: spacing.lg },
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, marginRight: spacing.md },
  gradient: {
    flex: 1,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  badgeRow: { flexDirection: 'row', gap: spacing.xxs },
  genrePill: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  genreText: { ...typography.micro, color: colors.textPrimary },
  textBlock: { gap: spacing.xs },
  title: { ...typography.display, color: colors.textPrimary },
  synopsis: { ...typography.body, color: colors.textSecondary },
  // flexWrap so "More Info" drops to its own line on narrow screens instead
  // of being squeezed to zero width (its label vanished entirely at 320px
  // before this — RN doesn't ellipsize a Pressable's content, it just clips).
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  cta: { paddingHorizontal: spacing.lg },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.accent,
  },
});
