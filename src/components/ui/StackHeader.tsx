import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { goBack } from '@/utils/navigation';

interface StackHeaderProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Gives the back button a scrim backing so it stays legible floating over
   * busy imagery (e.g. a banner photo) instead of a plain transparent hit
   * area, which only reads well against a flat background. */
  overlay?: boolean;
}

export function StackHeader({ title, onBack, right, overlay = false }: StackHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? (() => goBack())}
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
  },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconButtonOverlay: { backgroundColor: 'rgba(11,9,13,0.55)', borderRadius: 18 },
  title: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  right: { minWidth: 36, alignItems: 'flex-end' },
});
