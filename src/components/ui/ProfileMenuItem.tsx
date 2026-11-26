import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';

interface ProfileMenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  destructive?: boolean;
  iconColor?: string;
}

export function ProfileMenuItem({
  icon,
  label,
  value,
  onPress,
  toggle,
  destructive = false,
  iconColor,
}: ProfileMenuItemProps) {
  return (
    <Pressable
      onPress={toggle ? undefined : onPress}
      disabled={!onPress && !toggle}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}
      accessibilityRole={toggle ? undefined : 'button'}
      accessibilityLabel={label}
    >
      <View style={[styles.iconWrap, destructive && styles.iconWrapDanger]}>
        <Ionicons name={icon} size={18} color={iconColor ?? (destructive ? colors.danger : colors.textSecondary)} />
      </View>
      <Text style={[styles.label, destructive && styles.labelDanger]} numberOfLines={1}>
        {label}
      </Text>
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
          thumbColor={colors.white}
        />
      ) : (
        <View style={styles.trailing}>
          {value ? (
            <Text style={styles.value} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** A rounded card of menu rows with a hairline between each, inset to line
 * up with the row labels (iOS Settings style). Falsy children are skipped,
 * so rows can be shown conditionally without stray dividers. */
export function MenuGroup({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children);
  return (
    <View style={styles.group}>
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={styles.divider} />}
          {row}
        </React.Fragment>
      ))}
    </View>
  );
}

const ICON_SIZE = 32;

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xxs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
    marginLeft: spacing.md + ICON_SIZE + spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: { backgroundColor: 'rgba(232,71,76,0.12)' },
  label: { ...typography.body, color: colors.textPrimary, flex: 1 },
  labelDanger: { color: colors.danger },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  value: { ...typography.body, color: colors.textTertiary, maxWidth: 160 },
});
