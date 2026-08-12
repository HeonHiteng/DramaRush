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
import { colors, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { useUserStore } from '@/store';
import { BRAND } from '@/config';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = Math.min(SCREEN_WIDTH, 430);

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  colors: readonly [string, string, string];
  glow: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'film',
    titleKey: 'onboarding.slide1.title',
    subtitleKey: 'onboarding.slide1.subtitle',
    colors: ['#3A2030', '#1E1420', colors.bg],
    glow: 'rgba(255,90,95,0.35)',
  },
  {
    icon: 'flash',
    titleKey: 'onboarding.slide2.title',
    subtitleKey: 'onboarding.slide2.subtitle',
    colors: ['#1C2440', '#161B30', colors.bg],
    glow: 'rgba(78,140,255,0.35)',
  },
  {
    icon: 'diamond',
    titleKey: 'onboarding.slide3.title',
    subtitleKey: 'onboarding.slide3.subtitle',
    colors: ['#402715', '#241708', colors.bg],
    glow: 'rgba(244,185,66,0.35)',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const { t } = useTranslation();

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
        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.titleKey}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: SLIDE_WIDTH, offset: SLIDE_WIDTH * i, index: i })}
        renderItem={({ item }) => (
          <LinearGradient colors={item.colors} style={{ width: SLIDE_WIDTH }}>
            <View style={styles.illustration}>
              <View style={[styles.glow, { backgroundColor: item.glow }]} />

              <View style={[styles.stackCard, styles.stackCardBack, { transform: [{ rotate: '-14deg' }] }]} />
              <View style={[styles.stackCard, styles.stackCardMid, { transform: [{ rotate: '10deg' }] }]} />
              <View style={styles.stackCard}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)']}
                  style={styles.stackCardFill}
                >
                  <Ionicons name={item.icon} size={40} color={colors.white} />
                </LinearGradient>
              </View>
            </View>

            <View style={styles.textBlock}>
              <Text style={styles.brand}>{BRAND.name}</Text>
              <Text style={styles.title}>{t(item.titleKey)}</Text>
              <Text style={styles.subtitle}>{t(item.subtitleKey)}</Text>
            </View>
          </LinearGradient>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <AppButton
          label={isLast ? t('onboarding.getStarted') : t('onboarding.next')}
          onPress={goNext}
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

const CARD_SIZE = 128;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  skip: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    zIndex: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skipText: { ...typography.bodyMedium, color: colors.textSecondary },
  illustration: {
    height: 340,
    marginTop: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.9,
  },
  stackCard: {
    position: 'absolute',
    width: CARD_SIZE,
    height: CARD_SIZE * 1.35,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackCardBack: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stackCardMid: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  stackCardFill: {
    flex: 1,
    width: '100%',
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  textBlock: { paddingHorizontal: spacing.xl, marginTop: spacing.xl, alignItems: 'center' },
  brand: { ...typography.caption, color: colors.accent, marginBottom: spacing.sm, letterSpacing: 2 },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  footer: { padding: spacing.xl, gap: spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.surfaceRaised },
  dotActive: { width: 22, backgroundColor: colors.accent },
});
