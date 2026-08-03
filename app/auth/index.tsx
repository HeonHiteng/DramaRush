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

const emailSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'At least 6 characters'),
});
type EmailFormValues = z.infer<typeof emailSchema>;

type PendingAction = 'guest' | 'email' | 'google' | 'apple' | null;

export default function AuthScreen() {
  const signInAsGuest = useUserStore((s) => s.signInAsGuest);
  const signUpWithEmail = useUserStore((s) => s.signUpWithEmail);
  const signInWithEmail = useUserStore((s) => s.signInWithEmail);
  const signInWithOAuth = useUserStore((s) => s.signInWithOAuth);
  const isAuthenticating = useUserStore((s) => s.isAuthenticating);
  const authError = useUserStore((s) => s.authError);
  const clearAuthError = useUserStore((s) => s.clearAuthError);

  const [pending, setPending] = useState<PendingAction>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const runSignIn = async (action: Exclude<PendingAction, null>, task: () => Promise<void>) => {
    clearAuthError();
    setPending(action);
    await task();
    setPending(null);
    if (!useUserStore.getState().authError) {
      router.replace('/(tabs)');
    }
  };

  const onSubmitEmail = (values: EmailFormValues) => {
    if (mode === 'signup') {
      runSignIn('email', () => signUpWithEmail(values.name?.trim() || 'DramaRush Member', values.email, values.password));
    } else {
      runSignIn('email', () => signInWithEmail(values.email, values.password));
    }
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
            {authError && pending === null && !showEmailForm && (
              <Text style={styles.errorText}>{authError}</Text>
            )}
            <AppButton
              label="Continue as Guest"
              onPress={() => runSignIn('guest', signInAsGuest)}
              variant="secondary"
              fullWidth
              loading={pending === 'guest'}
              disabled={isAuthenticating && pending !== 'guest'}
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
                <View style={styles.modeToggleRow}>
                  <AppButton
                    label="Sign Up"
                    onPress={() => setMode('signup')}
                    variant={mode === 'signup' ? 'primary' : 'ghost'}
                    style={styles.modeToggleButton}
                  />
                  <AppButton
                    label="Sign In"
                    onPress={() => setMode('signin')}
                    variant={mode === 'signin' ? 'primary' : 'ghost'}
                    style={styles.modeToggleButton}
                  />
                </View>

                {mode === 'signup' && (
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
                      </View>
                    )}
                  />
                )}
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
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={styles.fieldWrap}>
                      <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor={colors.textTertiary}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        accessibilityLabel="Password"
                        secureTextEntry
                      />
                      {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
                    </View>
                  )}
                />
                {authError && pending === null && <Text style={styles.errorText}>{authError}</Text>}
                <AppButton
                  label={mode === 'signup' ? 'Create Account' : 'Sign In'}
                  onPress={handleSubmit(onSubmitEmail)}
                  variant="primary"
                  fullWidth
                  loading={pending === 'email'}
                />
              </View>
            )}

            <AppButton
              label="Continue with Google"
              onPress={() => runSignIn('google', () => signInWithOAuth('google'))}
              variant="secondary"
              fullWidth
              loading={pending === 'google'}
              disabled={isAuthenticating && pending !== 'google'}
              icon={<Ionicons name="logo-google" size={18} color={colors.textPrimary} />}
            />
            <AppButton
              label="Continue with Apple"
              onPress={() => runSignIn('apple', () => signInWithOAuth('apple'))}
              variant="secondary"
              fullWidth
              loading={pending === 'apple'}
              disabled={isAuthenticating && pending !== 'apple'}
              icon={<Ionicons name="logo-apple" size={18} color={colors.textPrimary} />}
            />
          </View>

          <Text style={styles.legal}>
            Google and Apple sign-in require one-time provider setup in the backend — see the
            DramaRush-Backend README. Everything else here is a real account.
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
  modeToggleRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  modeToggleButton: { flex: 1 },
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
