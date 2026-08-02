import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { colors } from '@/theme';
import { WebFrame } from '@/components/ui/WebFrame';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { StartupErrorScreen } from '@/components/ui/StartupErrorScreen';
import { queryClient } from '@/lib/queryClient';
import { supabaseConfigError } from '@/lib/supabase';
import { AuthListener } from '@/store/AuthListener';

export default function RootLayout() {
  if (supabaseConfigError) {
    // Render directly, without AuthListener/QueryClientProvider/Stack — none
    // of them should touch the (unusable) Supabase client in this state.
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <WebFrame>
            <StatusBar style="light" />
            <StartupErrorScreen message={supabaseConfigError} />
          </WebFrame>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <WebFrame>
              <StatusBar style="light" />
              <AuthListener />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="index" options={{ animation: 'fade' }} />
                <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
                <Stack.Screen name="auth" options={{ animation: 'fade' }} />
                <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
                <Stack.Screen
                  name="player/[episodeId]"
                  options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                />
              </Stack>
            </WebFrame>
          </SafeAreaProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
