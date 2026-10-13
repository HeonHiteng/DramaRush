import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PosterArt } from './PosterArt';
import type { Series } from '@/types';
import { useHaptics } from '@/hooks/useHaptics';

interface PosterCardProps {
  series: Series;
  onPress: () => void;
  width?: number;
  height?: number;
  progress?: number;
  showRating?: boolean;
  subtitle?: string;
  /** When provided, shows a quick add/remove-from-list button on the
   * poster itself — Netflix's "+" row-level shortcut — so favoriting
   * doesn't require opening the series page first. */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PosterCard({
  series,
  onPress,
  width = 124,
  height = 186,
  progress,
  showRating = true,
  subtitle,
  isFavorite = false,
  onToggleFavorite,
}: PosterCardProps) {
  const scale = useSharedValue(1);
  const { impact } = useHaptics();

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={{ width }}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={`${series.title}, ${series.genres.join(', ')}, rated ${series.rating} out of 5`}
        onPress={() => {
          impact();
          onPress();
        }}
        onPressIn={() => {
          scale.value = withTiming(0.95, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 140 });
        }}
        style={[{ width, height }, animatedStyle]}
      >
        <LinearGradient
          colors={[series.posterColorFrom, series.posterColorTo]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.poster}
        >
          {series.posterImageUri ? (
            <Image source={{ uri: series.posterImageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <PosterArt series={series} />
          )}
          <LinearGradient colors={gradients.posterFade} style={styles.posterOverlay} />

          {series.isNew && (
            <View style={styles.newRibbon}>
              <Text style={styles.newRibbonText}>NEW</Text>
            </View>
          )}

          <View style={styles.topRightStack}>
            {showRating && (
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={10} color={colors.gold} />
                <Text style={styles.ratingText}>{series.rating.toFixed(1)}</Text>
              </View>
            )}
            {onToggleFavorite && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  impact();
                  onToggleFavorite();
                }}
                hitSlop={8}
                style={styles.quickAddButton}
                // No accessibilityRole="button" here: the whole card above
                // this is already a <button> on web, and nesting a <button>
                // inside a <button> is invalid HTML (React logs a hydration
                // error and the browser mangles the DOM to fix it, which
                // broke tapping this icon entirely).
                accessibilityLabel={isFavorite ? `Remove ${series.title} from My List` : `Add ${series.title} to My List`}
              >
                <Ionicons name={isFavorite ? 'checkmark' : 'add'} size={14} color={colors.textPrimary} />
              </Pressable>
            )}
          </View>

          {typeof progress === 'number' && (
            <View style={styles.progressWrap}>
              <ProgressBar progress={progress} height={3} />
            </View>
          )}
        </LinearGradient>
      </AnimatedPressable>
      <Text style={styles.captionTitle} numberOfLines={1}>
        {series.title}
      </Text>
      <Text style={styles.captionSubtitle} numberOfLines={1}>
        {subtitle ?? series.genres.slice(0, 2).join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  posterOverlay: {
    ...StyleSheet.absoluteFill,
  },
  newRibbon: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  newRibbonText: { ...typography.micro, color: colors.white },
  topRightStack: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    alignItems: 'flex-end',
    gap: 4,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(11,9,13,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  ratingText: { ...typography.micro, color: colors.textPrimary },
  quickAddButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,9,13,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  progressWrap: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  captionTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginTop: spacing.xs },
  captionSubtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },
});
