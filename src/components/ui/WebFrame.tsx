import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors } from '@/theme';

// Exported so screens that size content relative to "the phone frame" (e.g.
// onboarding's slide width) share this instead of guessing their own copy of
// the same number — it's the one place that actually decides the frame size.
export const FRAME_WIDTH = 430;
const FRAME_HEIGHT = 932;
const FRAME_BORDER = 10;
const BREAKPOINT = 640;

/** The width screens actually get to lay out in: the phone frame's inner
 * width on wide web viewports, the window width everywhere else. Use this
 * instead of the raw window width when sizing content to fit the screen. */
export function useAppWidth() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= BREAKPOINT ? FRAME_WIDTH - FRAME_BORDER * 2 : width;
}

/**
 * On wide web viewports, centers the app inside a phone-sized frame instead
 * of stretching the mobile layout across the whole browser window. No-op on
 * native and on narrow web viewports (mobile browsers).
 */
export function WebFrame({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== 'web' || width < BREAKPOINT) {
    return <>{children}</>;
  }

  const frameHeight = Math.min(FRAME_HEIGHT, height - 48);

  return (
    <View style={styles.backdrop}>
      <View style={[styles.frame, { width: FRAME_WIDTH, height: frameHeight }]}>
        <View style={styles.notch} />
        <View style={styles.inner}>{children}</View>
      </View>
      <View style={styles.watermark}>
        <View style={styles.watermarkDot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: '#050406',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  frame: {
    backgroundColor: colors.bg,
    borderRadius: 44,
    borderWidth: FRAME_BORDER,
    borderColor: '#1C1A1F',
    overflow: 'hidden',
    boxShadow: '0 40px 120px rgba(0,0,0,0.65)',
  },
  notch: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -60,
    width: 120,
    height: 24,
    backgroundColor: '#1C1A1F',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    zIndex: 10,
  },
  inner: { flex: 1 },
  watermark: { position: 'absolute', bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.35 },
  watermarkDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textTertiary },
});
