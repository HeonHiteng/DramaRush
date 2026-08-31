import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightRatio?: number;
}

// Shared by the close animation and the unmount timer below — they're
// describing the same motion, so they must stay in sync. Two separate
// literal `220`s would silently drift the moment either one changed.
const CLOSE_ANIM_MS = 220;

export function BottomSheet({ visible, onClose, children, maxHeightRatio = 0.86 }: BottomSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(screenHeight);
  const backdropOpacity = useSharedValue(0);
  // Don't rely on <Modal visible={visible}> alone to hide this sheet: paired
  // with the GestureDetector below, closing it (visible -> false) on web
  // sometimes leaves the Modal's portal mounted and showing on top of
  // whatever opens next (e.g. selecting an episode from this sheet, then
  // hitting a paywall, left both stacked on screen). Track mount state
  // ourselves and skip rendering the Modal entirely once actually closed.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withTiming(0, { duration: 300 });
      backdropOpacity.value = withTiming(1, { duration: 240 });
      return;
    }
    translateY.value = withTiming(screenHeight, { duration: CLOSE_ANIM_MS });
    backdropOpacity.value = withTiming(0, { duration: 200 });
    // Plain JS timer rather than withTiming's own completion callback: that
    // callback crosses the reanimated UI-thread/JS-thread bridge and, at
    // least in this web setup, doesn't reliably fire — which left this sheet
    // mounted (just painted over by whatever opened next) indefinitely.
    const timer = setTimeout(() => setMounted(false), CLOSE_ANIM_MS);
    return () => clearTimeout(timer);
    // Deliberately keyed on `visible` alone: `screenHeight` (from
    // useWindowDimensions) can genuinely change mid-transition (layout
    // reflow as sibling sheets open/close), and including it here re-ran
    // this effect before the timeout fired, clearing it via the cleanup
    // above on every fluctuation — so `mounted` could go long stretches
    // without ever settling to false. translateY/backdropOpacity are stable
    // useSharedValue refs and never change, so omitting them is safe too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Hooks must run unconditionally on every render, so the "should this even
  // render" check sits after all of them and only gates the JSX/return value.
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!mounted) return null;

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) {
        translateY.value = withTiming(screenHeight, { duration: 200 });
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              { maxHeight: screenHeight * maxHeightRatio, paddingBottom: insets.bottom + spacing.lg },
              sheetStyle,
            ]}
          >
            <View style={styles.handle} />
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
});
