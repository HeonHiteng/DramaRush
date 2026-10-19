import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useUserStore, authErrorKey, redirectError } from '@/store';
import { STORAGE_KEYS } from '@/store/storage';

/** Reads and clears the note runOAuthFlow leaves before a web Google-link
 * redirect — the store that started the flow didn't survive the page load. */
async function consumeLinkFlag(): Promise<boolean> {
  const flag = await AsyncStorage.getItem(STORAGE_KEYS.oauthLink);
  if (flag !== null) await AsyncStorage.removeItem(STORAGE_KEYS.oauthLink);
  return flag === '1';
}

/**
 * Where Google sends people back (`redirectTo` in userStore's OAuth flow).
 * On web the browser lands here with `?code=…` and we finish the PKCE
 * exchange; on native openAuthSessionAsync already exchanged the code (and
 * the auth screen navigates when it's done), so a deep link that ends up
 * here just steps back out of the way.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_code?: string; error_description?: string }>();

  useEffect(() => {
    let cancelled = false;
    const go = (href: Parameters<typeof router.replace>[0]) => {
      if (!cancelled) router.replace(href);
    };

    (async () => {
      if (Platform.OS !== 'web') {
        if (router.canGoBack()) router.back();
        else go('/(tabs)');
        return;
      }

      const wasLinking = await consumeLinkFlag();
      // A guest who failed to link (or to switch accounts) must land back on
      // the bind screen — plain /auth offers "Continue as Guest", which would
      // abandon their current guest for yet another one. getSession() rather
      // than the store: on this fresh page load the profile may not be in yet.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const stillGuest = wasLinking || !!session?.user.is_anonymous;
      const failRoute = stillGuest ? '/auth?mode=upgrade&failed=google' : '/auth';

      const providerError = params.error_description || params.error
        ? { code: params.error_code, message: String(params.error_description ?? params.error) }
        : redirectError(window.location.href);
      if (providerError) {
        useUserStore.setState({ authError: authErrorKey(providerError) });
        go(failRoute);
        return;
      }

      if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(String(params.code));
        if (error) {
          useUserStore.setState({ authError: authErrorKey(error) });
          go(failRoute);
          return;
        }
      }

      if (wasLinking) {
        useUserStore.setState({ pendingWelcome: true });
        go('/(tabs)/profile');
      } else {
        go('/(tabs)');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
