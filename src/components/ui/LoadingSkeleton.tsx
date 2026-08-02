import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, radius } from '@/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function SkeletonBlock({ width = '100%', height = 16, borderRadius: br = radius.sm, style }: SkeletonBlockProps) {
  const opacity = useSharedValue(0.35);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.45;
      return;
    }
    opacity.value = withRepeat(withTiming(0.7, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reducedMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: br, backgroundColor: colors.surfaceRaised },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function PosterRailSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.rail}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.posterItem}>
          <SkeletonBlock width={124} height={186} borderRadius={radius.lg} />
          <SkeletonBlock width={100} height={12} style={styles.marginTop} />
        </View>
      ))}
    </View>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.gridItem}>
          <SkeletonBlock height={180} borderRadius={radius.lg} />
          <SkeletonBlock width="70%" height={12} style={styles.marginTop} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  posterItem: { width: 124 },
  marginTop: { marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  gridItem: { width: '47%' },
});
