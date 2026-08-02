import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

interface ProgressBarProps {
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  progress,
  height = 4,
  trackColor = 'rgba(255,255,255,0.16)',
  fillColor = colors.accent,
  style,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={[styles.track, { height, backgroundColor: trackColor }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: fillColor, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.pill,
  },
});
