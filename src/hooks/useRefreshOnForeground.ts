import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Coming back to the app re-reads server data at most this often. */
export const FOREGROUND_REFRESH_MS = 60_000;
/** Opening (or returning to) a screen re-reads its data at most this often. */
export const FOCUS_REFRESH_MS = 15_000;

/**
 * Keeps a screen's server-backed stores current without a request storm:
 * `refresh(maxAgeMs)` (a store's refreshIfStale) runs when the screen gains
 * focus and when the app returns to the foreground — e.g. coins bought or a
 * membership expired on another device while this one sat in the background.
 */
export function useRefreshOnForeground(refresh: (maxAgeMs: number) => void) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && previous !== 'active') refreshRef.current(FOREGROUND_REFRESH_MS);
      previous = next;
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshRef.current(FOCUS_REFRESH_MS);
    }, [])
  );
}
