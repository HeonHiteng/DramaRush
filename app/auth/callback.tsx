import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

/**
 * Where Google/Apple send people back after signing in (`redirectTo` in
 * userStore.signInWithOAuth). On web the browser lands here with `?code=…`
 * and we finish the PKCE exchange; on native openAuthSessionAsync already
 * exchanged the code, so a deep link that ends up here just moves on.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const providerError = params.error_description ?? params.error;
      if (providerError) {
        useUserStore.setState({ authError: String(providerError) });
        if (!cancelled) router.replace('/auth');
        return;
      }
      if (Platform.OS === 'web' && params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(String(params.code));
        if (error) {
          useUserStore.setState({ authError: error.message });
          if (!cancelled) router.replace('/auth');
          return;
        }
      }
      if (!cancelled) router.replace('/(tabs)');
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
