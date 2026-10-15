import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, gradients, typography } from '@/theme';
import { BRAND } from '@/config';
import { useUserStore } from '@/store';
import { useAppEntryRedirect } from '@/hooks/useAppEntryRedirect';

const MIN_SPLASH_MS = 1400;
// The full logo already includes the "KBbox" wordmark.
const LOGO_FULL = require('../assets/images/logo-full.png');

export default function SplashScreen() {
  const hasHydrated = useUserStore((s) => s.hasHydrated);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const redirectTo = useAppEntryRedirect(hasHydrated && minTimeElapsed);

  const logoScale = useSharedValue(0.7);
  const logoOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.exp) });
    logoOpacity.value = withTiming(1, { duration: 480 });
    taglineOpacity.value = withDelay(320, withTiming(1, { duration: 480 }));

    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, [logoScale, logoOpacity, taglineOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  if (redirectTo) return <Redirect href={redirectTo} />;

  return (
    <LinearGradient colors={gradients.splash} style={styles.container}>
      <Animated.Image
        source={LOGO_FULL}
        style={[styles.logo, logoStyle]}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel={BRAND.name}
      />
      <Animated.Text style={[styles.tagline, taglineStyle]}>{BRAND.tagline}</Animated.Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // 480x616 source image.
  logo: { width: 150, height: 192, marginBottom: 20 },
  tagline: { ...typography.body, color: colors.textTertiary },
});
