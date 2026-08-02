import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
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

const MIN_SPLASH_MS = 1400;

export default function SplashScreen() {
  const hasHydrated = useUserStore((s) => s.hasHydrated);
  const hasOnboarded = useUserStore((s) => s.hasOnboarded);
  const user = useUserStore((s) => s.user);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

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

  if (hasHydrated && minTimeElapsed) {
    if (!hasOnboarded) return <Redirect href="/onboarding" />;
    if (!user) return <Redirect href="/auth" />;
    return <Redirect href="/(tabs)" />;
  }

  return (
    <LinearGradient colors={gradients.splash} style={styles.container}>
      <Animated.View style={[styles.logoMark, logoStyle]}>
        <Text style={styles.logoGlyph}>D</Text>
      </Animated.View>
      <Animated.Text style={[styles.brandName, logoStyle]}>{BRAND.name}</Animated.Text>
      <Animated.Text style={[styles.tagline, taglineStyle]}>{BRAND.tagline}</Animated.Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoMark: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoGlyph: { fontSize: 40, fontWeight: '800', color: colors.white },
  brandName: { ...typography.display, color: colors.textPrimary, marginBottom: 8 },
  tagline: { ...typography.body, color: colors.textTertiary },
});
