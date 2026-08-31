import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';
import { AppButton } from './AppButton';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Fill and vertically center within the remaining screen space, instead of
   * just centering its own (fixed-height) content. Use when this is the sole
   * content of a screen — otherwise it sits pinned near the top with a dead
   * gap below it, since `justifyContent: 'center'` on an auto-height
   * container has nothing to center against. */
  fill?: boolean;
}

export function EmptyState({ icon = 'file-tray-outline', title, subtitle, actionLabel, onAction, fill = false }: EmptyStateProps) {
  return (
    <View style={[styles.container, fill && styles.fill]} accessible accessibilityRole="text">
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={30} color={colors.textTertiary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  fill: { flex: 1, paddingVertical: 0 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  action: { marginTop: spacing.lg },
});
