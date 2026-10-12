import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

const KEY = 'player';

/**
 * While the player is on screen: block screenshots and screen recordings
 * (Android FLAG_SECURE; iOS 11+ recordings and 13+ screenshots come out
 * black), and blur the iOS app-switcher preview. Released when the player
 * closes, so the rest of the app can still be screenshotted.
 * Web has no equivalent — see usePlaybackProtection.web.ts.
 */
export function usePlaybackProtection(): void {
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync(KEY).catch((error) => {
      console.warn('preventScreenCapture failed', error);
    });
    if (Platform.OS === 'ios') {
      ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
    }
    return () => {
      ScreenCapture.allowScreenCaptureAsync(KEY).catch(() => {});
      if (Platform.OS === 'ios') {
        ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
      }
    };
  }, []);
}
