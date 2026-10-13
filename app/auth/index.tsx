import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller, type Control, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { useUserStore } from '@/store';
import { BRAND, DEFAULT_MEMBER_NAME } from '@/config';
import { useTranslation } from '@/i18n/useTranslation';

const emailSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'At least 6 characters'),
});
type EmailFormValues = z.infer<typeof emailSchema>;

type PendingAction = 'guest' | 'email' | 'google' | 'whatsapp' | null;

/** The screen renders two fairly different pitches depending on why it was
 * opened (see the comment on `isUpgrade` below) — collecting what differs
 * into one object keeps that split in one place instead of scattered across
 * five separate `{!isUpgrade && ...}` checks through the JSX. */
function getScreenCopy(isUpgrade: boolean, t: ReturnType<typeof useTranslation>['t']) {
  return {
    title: isUpgrade ? t('auth.upgradeTitle') : t('auth.welcome', { brand: BRAND.name }),
    subtitle: isUpgrade ? t('auth.upgradeSubtitle') : t('auth.subtitle'),
    showGuestButton: !isUpgrade,
    // Linking Google to an existing guest session needs
    // supabase.auth.linkIdentity, not signInWithOAuth (which would sign
    // into/create a *separate* account, silently orphaning the guest's
    // wallet/unlocks/history). Not built yet, so hide it in upgrade mode
    // rather than offer something that would lose the user's data.
    showGoogleButton: !isUpgrade,
    // Same reasoning as showGoogleButton: linking a phone number to an
    // existing guest session isn't built yet, so don't offer it where it
    // would silently start a second account instead.
    showWhatsAppButton: !isUpgrade,
    showLegalDisclosure: !isUpgrade,
  };
}

export default function AuthScreen() {
  // Reached two ways: (1) as a fallback if the automatic guest sign-in on
  // onboarding/relaunch failed, showing every option; (2) from Profile as
  // `?mode=upgrade`, when an already-signed-in guest wants to attach real
  // credentials to their existing account instead of starting a new one.
  const { mode: screenModeParam } = useLocalSearchParams<{ mode?: string }>();
  const isUpgrade = screenModeParam === 'upgrade';
  const { t } = useTranslation();
  const copy = getScreenCopy(isUpgrade, t);

  const signInAsGuest = useUserStore((s) => s.signInAsGuest);
  const signUpWithEmail = useUserStore((s) => s.signUpWithEmail);
  const signInWithEmail = useUserStore((s) => s.signInWithEmail);
  const upgradeGuestAccount = useUserStore((s) => s.upgradeGuestAccount);
  const signInWithOAuth = useUserStore((s) => s.signInWithOAuth);
  const signInWithPhoneOtp = useUserStore((s) => s.signInWithPhoneOtp);
  const verifyPhoneOtp = useUserStore((s) => s.verifyPhoneOtp);
  const isAuthenticating = useUserStore((s) => s.isAuthenticating);
  const authError = useUserStore((s) => s.authError);
  const clearAuthError = useUserStore((s) => s.clearAuthError);

  const [pending, setPending] = useState<PendingAction>(null);
  const [showEmailForm, setShowEmailForm] = useState(isUpgrade);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const runSignIn = async (action: Exclude<PendingAction, null>, task: () => Promise<boolean>) => {
    clearAuthError();
    setPending(action);
    const succeeded = await task();
    setPending(null);
    if (succeeded) router.replace('/(tabs)');
  };

  const handleSendCode = async () => {
    clearAuthError();
    setPending('whatsapp');
    const ok = await signInWithPhoneOtp(phoneNumber.trim());
    setPending(null);
    if (ok) setPhoneStep('otp');
  };

  const handleVerifyCode = () => runSignIn('whatsapp', () => verifyPhoneOtp(phoneNumber.trim(), otpCode.trim()));

  const handleChangeNumber = () => {
    clearAuthError();
    setPhoneStep('phone');
    setOtpCode('');
  };

  const onSubmitEmail = (values: EmailFormValues) => {
    if (mode === 'signup') {
      const name = values.name?.trim() || DEFAULT_MEMBER_NAME;
      const task = isUpgrade
        ? () => upgradeGuestAccount(name, values.email, values.password)
        : () => signUpWithEmail(name, values.email, values.password);
      runSignIn('email', task);
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
            <Text style={styles.logoGlyph}>{BRAND.name.charAt(0)}</Text>
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>

          <View style={styles.actions}>
            {authError && pending === null && !showEmailForm && (
              <Text style={styles.errorText}>{authError}</Text>
            )}
            {copy.showGuestButton && (
              <AppButton
                label={t('auth.continueAsGuest')}
                onPress={() => runSignIn('guest', signInAsGuest)}
                variant="primary"
                fullWidth
                loading={pending === 'guest'}
                disabled={isAuthenticating && pending !== 'guest'}
                icon={<Ionicons name="person-outline" size={18} color={colors.textInverse} />}
              />
            )}

            {!showEmailForm ? (
              <AppButton
                label={t('auth.signInWithEmail')}
                onPress={() => setShowEmailForm(true)}
                variant="secondary"
                fullWidth
                disabled={isAuthenticating}
                icon={<Ionicons name="mail-outline" size={18} color={colors.textPrimary} />}
              />
            ) : (
              <EmailAuthForm
                control={control}
                errors={errors}
                mode={mode}
                onModeChange={setMode}
                onSubmit={handleSubmit(onSubmitEmail)}
                submitting={pending === 'email'}
                error={pending === null ? authError : null}
              />
            )}

            {copy.showGoogleButton && (
              <AppButton
                label={t('auth.continueWithGoogle')}
                onPress={() => runSignIn('google', () => signInWithOAuth('google'))}
                variant="secondary"
                fullWidth
                loading={pending === 'google'}
                disabled={isAuthenticating && pending !== 'google'}
                icon={<Ionicons name="logo-google" size={18} color={colors.textPrimary} />}
              />
            )}

            {copy.showWhatsAppButton &&
              (!showPhoneForm ? (
                <AppButton
                  label={t('auth.continueWithWhatsApp')}
                  onPress={() => setShowPhoneForm(true)}
                  variant="secondary"
                  fullWidth
                  disabled={isAuthenticating}
                  icon={<Ionicons name="logo-whatsapp" size={18} color={colors.textPrimary} />}
                />
              ) : (
                <PhoneAuthForm
                  step={phoneStep}
                  phoneNumber={phoneNumber}
                  onPhoneNumberChange={setPhoneNumber}
                  otpCode={otpCode}
                  onOtpCodeChange={setOtpCode}
                  onSendCode={handleSendCode}
                  onVerifyCode={handleVerifyCode}
                  onChangeNumber={handleChangeNumber}
                  submitting={pending === 'whatsapp'}
                  error={pending === null ? authError : null}
                />
              ))}
          </View>

          {copy.showLegalDisclosure && (
            <Text style={styles.legal}>
              Google sign-in requires one-time provider setup in the backend — see the
              backend README. Everything else here is a real account.
            </Text>
          )}
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

interface EmailAuthFormProps {
  control: Control<EmailFormValues>;
  errors: FieldErrors<EmailFormValues>;
  mode: 'signup' | 'signin';
  onModeChange: (mode: 'signup' | 'signin') => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}

/** The name/email/password fields plus the sign-up/sign-in toggle, pulled
 * out of AuthScreen so that screen's JSX reads as "which pieces are shown
 * for this mode" rather than being buried under ~90 lines of form markup. */
function EmailAuthForm({ control, errors, mode, onModeChange, onSubmit, submitting, error }: EmailAuthFormProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.emailForm}>
      <View style={styles.modeToggleRow}>
        <AppButton
          label={t('auth.signUp')}
          onPress={() => onModeChange('signup')}
          variant={mode === 'signup' ? 'primary' : 'ghost'}
          style={styles.modeToggleButton}
        />
        <AppButton
          label={t('auth.signIn')}
          onPress={() => onModeChange('signin')}
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
                placeholder={t('auth.namePlaceholder')}
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
              placeholder={t('auth.emailPlaceholder')}
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
              placeholder={t('auth.passwordPlaceholder')}
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
      {error && <Text style={styles.errorText}>{error}</Text>}
      <AppButton
        label={mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')}
        onPress={onSubmit}
        variant="primary"
        fullWidth
        loading={submitting}
      />
    </View>
  );
}

interface PhoneAuthFormProps {
  step: 'phone' | 'otp';
  phoneNumber: string;
  onPhoneNumberChange: (value: string) => void;
  otpCode: string;
  onOtpCodeChange: (value: string) => void;
  onSendCode: () => void;
  onVerifyCode: () => void;
  onChangeNumber: () => void;
  submitting: boolean;
  error: string | null;
}

/** Two-step WhatsApp sign-in: collect a phone number, send a 6-digit code to
 * it over WhatsApp, then collect that code to finish signing in. Mirrors
 * EmailAuthForm's shape (same styles, same submitting/error props) so the
 * two forms read as siblings rather than two different patterns. */
function PhoneAuthForm({
  step,
  phoneNumber,
  onPhoneNumberChange,
  otpCode,
  onOtpCodeChange,
  onSendCode,
  onVerifyCode,
  onChangeNumber,
  submitting,
  error,
}: PhoneAuthFormProps) {
  const { t } = useTranslation();

  if (step === 'phone') {
    return (
      <View style={styles.emailForm}>
        <View style={styles.fieldWrap}>
          <TextInput
            style={styles.input}
            placeholder={t('auth.phonePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={phoneNumber}
            onChangeText={onPhoneNumberChange}
            accessibilityLabel="Phone number"
            autoCapitalize="none"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <AppButton
          label={t('auth.sendCodeViaWhatsApp')}
          onPress={onSendCode}
          variant="primary"
          fullWidth
          loading={submitting}
          disabled={phoneNumber.trim().length < 8}
        />
      </View>
    );
  }

  return (
    <View style={styles.emailForm}>
      <Text style={styles.otpSubtitle}>{t('auth.otpSubtitle', { phone: phoneNumber.trim() })}</Text>
      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder={t('auth.otpPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={otpCode}
          onChangeText={onOtpCodeChange}
          accessibilityLabel="Verification code"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={6}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <AppButton label={t('auth.verifyCode')} onPress={onVerifyCode} variant="primary" fullWidth loading={submitting} disabled={otpCode.trim().length < 6} />
      <AppButton label={t('auth.changeNumber')} onPress={onChangeNumber} variant="ghost" fullWidth disabled={submitting} />
    </View>
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
  otpSubtitle: { ...typography.caption, color: colors.textTertiary },
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
