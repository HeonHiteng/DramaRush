import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { colors, spacing, typography } from '@/theme';
import { goBack } from '@/utils/navigation';

interface StackHeaderProps {
  title: string;
  onBack?: () => void;
  /** Where back goes when there's no history to return to (the page was
   * opened from a link, a refresh, or a fresh tab) — the page's logical
   * parent. Defaults to Home. */
  fallback?: Href;
  right?: React.ReactNode;
  /** Gives the back button a scrim backing so it stays legible floating over
   * busy imagery (e.g. a banner photo) instead of a plain transparent hit
   * area, which only reads well against a flat background. */
  overlay?: boolean;
}

export function StackHeader({ title, onBack, fallback, right, overlay = false }: StackHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? (() => goBack(fallback))}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        style={[styles.iconButton, overlay && styles.iconButtonOverlay]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    // Only the buttons take touches, so a header floated over content (e.g.
    // the series banner) doesn't block taps/scrolls on the empty strip.
    pointerEvents: 'box-none',
  },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconButtonOverlay: { backgroundColor: 'rgba(11,9,13,0.55)', borderRadius: 18 },
  title: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  right: { minWidth: 36, alignItems: 'flex-end' },
});
