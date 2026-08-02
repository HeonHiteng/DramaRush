import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { ProgressBar } from '@/components/ui/ProgressBar';
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
          <LinearGradient colors={gradients.posterFade} style={styles.posterOverlay} />

          {series.isNew && (
            <View style={styles.newRibbon}>
              <Text style={styles.newRibbonText}>NEW</Text>
            </View>
          )}

          {showRating && (
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={10} color={colors.gold} />
              <Text style={styles.ratingText}>{series.rating.toFixed(1)}</Text>
            </View>
          )}

          <View style={styles.titleWrap}>
            <Text style={styles.posterTitle} numberOfLines={2}>
              {series.title}
            </Text>
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
  ratingPill: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(11,9,13,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  ratingText: { ...typography.micro, color: colors.textPrimary },
  titleWrap: { padding: spacing.xs },
  posterTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  progressWrap: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  captionTitle: { ...typography.bodyMedium, color: colors.textPrimary, marginTop: spacing.xs },
  captionSubtitle: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },
});
