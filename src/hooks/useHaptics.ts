import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function useHaptics() {
  const impact = useCallback((style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(style).catch(() => {});
  }, []);

  const success = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const selection = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {});
  }, []);

  return { impact, success, selection };
}
