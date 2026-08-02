import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { useHaptics } from '@/hooks/useHaptics';

export type AppButtonVariant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';
export type AppButtonSize = 'md' | 'lg';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
  accessibilityHint,
  testID,
}: AppButtonProps) {
  const scale = useSharedValue(1);
  const { impact } = useHaptics();
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.96, { duration: 90 });
  };
  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 140 });
  };
  const handlePress = () => {
    if (isDisabled) return;
    impact();
    onPress();
  };

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.textPrimary : colors.textInverse} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.label,
              size === 'lg' && styles.labelLg,
              variant === 'secondary' && styles.labelSecondary,
              variant === 'ghost' && styles.labelGhost,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={8}
      style={[
        animatedStyle,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {variant === 'primary' || variant === 'gold' ? (
        <LinearGradient
          colors={variant === 'gold' ? gradients.goldGlow : gradients.coralGlow}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, size === 'lg' && styles.baseLg]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.base,
            size === 'lg' && styles.baseLg,
            variant === 'secondary' && styles.secondary,
            variant === 'ghost' && styles.ghost,
            variant === 'danger' && styles.dangerBase,
          ]}
        >
          {content}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  base: {
    minHeight: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  baseLg: { minHeight: 54, paddingHorizontal: spacing.xl },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerBase: {
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.button,
    color: colors.textInverse,
  },
  labelLg: { fontSize: 16 },
  labelSecondary: { color: colors.textPrimary },
  labelGhost: { color: colors.textSecondary },
});
