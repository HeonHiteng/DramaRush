import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import type { Series } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH, 480) - spacing.lg * 2;
const CARD_HEIGHT = 400;

interface HeroCarouselProps {
  series: Series[];
}

export function HeroCarousel({ series }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<Series>>(null);

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
                <AppButton
                  label="Watch Now"
                  onPress={() => router.push(`/series/${item.id}`)}
                  style={styles.cta}
                />
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
  cta: { marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
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
