import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { useUserStore } from '@/store';
import { BRAND } from '@/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = Math.min(SCREEN_WIDTH, 430);

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  colors: readonly [string, string];
}

const SLIDES: Slide[] = [
  { icon: 'film', title: 'Stories made for every moment.', colors: ['#2A1B2E', '#4A2430'] },
  { icon: 'flash', title: 'Watch addictive dramas in minutes.', colors: ['#1B2033', '#2E3A66'] },
  { icon: 'diamond', title: 'Unlock more with coins or membership.', colors: ['#241017', '#5E1E2E'] },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      const nextIndex = index + 1;
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setIndex(nextIndex);
    } else {
      finish();
    }
  };

  const finish = () => {
    completeOnboarding();
    router.replace('/auth');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setIndex(newIndex);
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      <Pressable onPress={finish} style={styles.skip} accessibilityRole="button" accessibilityLabel="Skip onboarding">
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.title}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: SLIDE_WIDTH, offset: SLIDE_WIDTH * i, index: i })}
        renderItem={({ item }) => (
          <View style={{ width: SLIDE_WIDTH }}>
            <LinearGradient colors={item.colors} style={styles.slideGradient}>
              <View style={styles.iconCircle}>
                <Ionicons name={item.icon} size={48} color={colors.white} />
              </View>
            </LinearGradient>
            <View style={styles.textBlock}>
              <Text style={styles.brand}>{BRAND.name}</Text>
              <Text style={styles.title}>{item.title}</Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <AppButton
          label={isLast ? 'Get Started' : 'Next'}
          onPress={goNext}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  skip: { position: 'absolute', top: spacing.xl, right: spacing.lg, zIndex: 10, padding: spacing.xs },
  skipText: { ...typography.bodyMedium, color: colors.textTertiary },
  slideGradient: {
    height: 340,
    marginTop: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { paddingHorizontal: spacing.xl, marginTop: spacing.xl, alignItems: 'center' },
  brand: { ...typography.caption, color: colors.accent, marginBottom: spacing.sm, letterSpacing: 2 },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  footer: { padding: spacing.xl, gap: spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.surfaceRaised },
  dotActive: { width: 22, backgroundColor: colors.accent },
});
