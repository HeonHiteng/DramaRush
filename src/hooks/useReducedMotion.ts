import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSettingsStore } from '@/store';

export function useReducedMotion(): boolean {
  const preferReduced = useSettingsStore((s) => s.reducedMotion);
  const [systemReduced, setSystemReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setSystemReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setSystemReduced);
    return () => sub?.remove?.();
  }, []);

  return preferReduced || systemReduced;
}
