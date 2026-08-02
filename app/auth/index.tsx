import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { useUserStore } from '@/store';
import { BRAND } from '@/config';
import type { AuthProvider } from '@/types';

const emailSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters'),
  email: z.string().trim().email('Enter a valid email address'),
});
type EmailFormValues = z.infer<typeof emailSchema>;

export default function AuthScreen() {
  const signIn = useUserStore((s) => s.signIn);
  const isAuthenticating = useUserStore((s) => s.isAuthenticating);
  const [pendingProvider, setPendingProvider] = useState<AuthProvider | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { name: '', email: '' },
  });

  const runSignIn = async (provider: AuthProvider, name?: string, email?: string) => {
    setPendingProvider(provider);
    await signIn(provider, name, email);
    setPendingProvider(null);
    router.replace('/(tabs)');
  };

  const onSubmitEmail = (values: EmailFormValues) => {
    runSignIn('email', values.name, values.email);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={gradients.splash} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.logoMark}>
            <Text style={styles.logoGlyph}>D</Text>
          </View>
          <Text style={styles.title}>Welcome to {BRAND.name}</Text>
          <Text style={styles.subtitle}>Sign in to sync your favourites, coins, and progress across devices.</Text>

          <View style={styles.actions}>
            <AppButton
              label="Continue as Guest"
              onPress={() => runSignIn('guest')}
              variant="secondary"
              fullWidth
              loading={pendingProvider === 'guest'}
              disabled={isAuthenticating && pendingProvider !== 'guest'}
              icon={<Ionicons name="person-outline" size={18} color={colors.textPrimary} />}
            />

            {!showEmailForm ? (
              <AppButton
                label="Sign in with Email"
                onPress={() => setShowEmailForm(true)}
                variant="primary"
                fullWidth
                disabled={isAuthenticating}
                icon={<Ionicons name="mail-outline" size={18} color={colors.textInverse} />}
              />
            ) : (
              <View style={styles.emailForm}>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={styles.fieldWrap}>
                      <TextInput
                        style={styles.input}
                        placeholder="Your name"
                        placeholderTextColor={colors.textTertiary}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        accessibilityLabel="Your name"
                        autoCapitalize="words"
                      />
                      {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={styles.fieldWrap}>
                      <TextInput
                        style={styles.input}
                        placeholder="you@example.com"
                        placeholderTextColor={colors.textTertiary}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        accessibilityLabel="Email address"
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                      {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
                    </View>
                  )}
                />
                <AppButton
                  label="Continue"
                  onPress={handleSubmit(onSubmitEmail)}
                  variant="primary"
                  fullWidth
                  loading={pendingProvider === 'email'}
                />
              </View>
            )}

            <AppButton
              label="Continue with Google"
              onPress={() => runSignIn('google')}
              variant="secondary"
              fullWidth
              loading={pendingProvider === 'google'}
              disabled={isAuthenticating && pendingProvider !== 'google'}
              icon={<Ionicons name="logo-google" size={18} color={colors.textPrimary} />}
            />
            <AppButton
              label="Continue with Apple"
              onPress={() => runSignIn('apple')}
              variant="secondary"
              fullWidth
              loading={pendingProvider === 'apple'}
              disabled={isAuthenticating && pendingProvider !== 'apple'}
              icon={<Ionicons name="logo-apple" size={18} color={colors.textPrimary} />}
            />
          </View>

          <Text style={styles.legal}>
            This is a prototype. No real accounts are created and no passwords are collected.
          </Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoGlyph: { fontSize: 30, fontWeight: '800', color: colors.white },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    maxWidth: 320,
  },
  actions: { width: '100%', maxWidth: 360, gap: spacing.sm },
  emailForm: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  fieldWrap: { gap: 4 },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: { ...typography.caption, color: colors.danger },
  legal: {
    ...typography.caption,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xl,
    maxWidth: 320,
  },
});
