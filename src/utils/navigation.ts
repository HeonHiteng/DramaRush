import { router, type Href } from 'expo-router';

/**
 * Navigates back if there's in-app history to go back to, otherwise
 * replaces with `fallback`. router.back() silently does nothing when a
 * screen was entered directly (deep link, browser refresh, a fresh tab) —
 * without this, the back button just appears broken in that case.
 */
export function goBack(fallback: Href = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
