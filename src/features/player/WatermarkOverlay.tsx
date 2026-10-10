import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * The viewer's short code, drawn faintly over the video and hopping between
 * corners. If a screen recording leaks, the code identifies the account. Kept
 * small and translucent so it doesn't compete with the content.
 */
const POSITIONS = [
  { top: '16%', left: 16 },
  { top: '44%', left: '28%' },
  { bottom: '22%', left: 16 },
  { top: '62%', left: '36%' },
] as const;
const HOP_MS = 20_000;

export function WatermarkOverlay({ code }: { code: string | null }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % POSITIONS.length), HOP_MS);
    return () => clearInterval(timer);
  }, [code]);

  if (!code) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Text style={[styles.code, POSITIONS[index]]} accessible={false}>
        {code}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  code: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.28)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
});
