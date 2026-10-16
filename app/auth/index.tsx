import React, { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { OptionPickerModal } from '@/components/ui/OptionPickerModal';
import { composePhone, DEFAULT_PHONE_COUNTRY, formatPhone, looksComplete, PHONE_COUNTRIES, type PhoneCountry } from '@/utils/phone';

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
  const linkOAuthIdentity = useUserStore((s) => s.linkOAuthIdentity);
  const linkPhoneOtp = useUserStore((s) => s.linkPhoneOtp);
  const verifyLinkedPhoneOtp = useUserStore((s) => s.verifyLinkedPhoneOtp);
  const isAuthenticating = useUserStore((s) => s.isAuthenticating);
  const authError = useUserStore((s) => s.authError);
  const clearAuthError = useUserStore((s) => s.clearAuthError);

  const [pending, setPending] = useState<PendingAction>(null);
  // Which action the current authError belongs to, so it's shown beside
  // that action only — not repeated in every form on the screen.
  const [lastAttempt, setLastAttempt] = useState<PendingAction>(null);
  const [showEmailForm, setShowEmailForm] = useState(isUpgrade);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  // The phone form sits at the bottom of the page: once the keyboard is up,
  // scroll so the field (and its button) stay visible above it.
  const revealForm = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  const fullPhone = composePhone(phoneCountry, phoneNumber);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const errorFor = (action: PendingAction) => (pending === null && lastAttempt === action ? authError : null);
  // Guest sign-in errors, plus any error already set when this screen opened
  // (e.g. the automatic guest sign-in failed and sent the user here).
  const topError = errorFor('guest') ?? errorFor(null);

  const runSignIn = async (action: Exclude<PendingAction, null>, task: () => Promise<boolean>) => {
    clearAuthError();
    setLastAttempt(action);
    setPending(action);
    const succeeded = await task();
    setPending(null);
    if (succeeded) router.replace('/(tabs)');
  };

  const handleSendCode = async () => {
    clearAuthError();
    setLastAttempt('whatsapp');
    setPending('whatsapp');
    // Upgrading a guest attaches the number to their current account;
    // otherwise it's an ordinary sign-in.
    const sendCode = isUpgrade ? linkPhoneOtp : signInWithPhoneOtp;
    const ok = await sendCode(fullPhone);
    setPending(null);
    if (ok) setPhoneStep('otp');
  };

  const handleVerifyCode = () => {
    const verify = isUpgrade ? verifyLinkedPhoneOtp : verifyPhoneOtp;
    runSignIn('whatsapp', () => verify(fullPhone, otpCode.trim()));
  };

  const handleGoogle = () =>
    runSignIn('google', () => (isUpgrade ? linkOAuthIdentity('google') : signInWithOAuth('google')));

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
      // Android draws edge-to-edge, so the window no longer resizes for the
      // keyboard by itself: pad on both platforms.
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
    >
      <LinearGradient colors={gradients.splash} style={styles.flex}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Image
            source={require('../../assets/images/logo-mark.png')}
            style={styles.logoMark}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel={BRAND.name}
          />
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>

          <View style={styles.actions}>
            {topError && <Text style={styles.errorText}>{topError}</Text>}
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
                error={errorFor('email')}
              />
            )}

            <AppButton
              label={t('auth.continueWithGoogle')}
              onPress={handleGoogle}
              variant="secondary"
              fullWidth
              loading={pending === 'google'}
              disabled={isAuthenticating && pending !== 'google'}
              icon={<Ionicons name="logo-google" size={18} color={colors.textPrimary} />}
            />
            {errorFor('google') && <Text style={styles.errorText}>{errorFor('google')}</Text>}

            {!showPhoneForm ? (
              <AppButton
                label={t('auth.continueWithWhatsApp')}
                onPress={() => {
                  setShowPhoneForm(true);
                  revealForm();
                }}
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
                country={phoneCountry}
                onPickCountry={() => setCountryPickerVisible(true)}
                fullPhone={fullPhone}
                onInputFocus={revealForm}
                otpCode={otpCode}
                onOtpCodeChange={setOtpCode}
                onSendCode={handleSendCode}
                onVerifyCode={handleVerifyCode}
                onChangeNumber={handleChangeNumber}
                submitting={pending === 'whatsapp'}
                error={errorFor('whatsapp')}
              />
            )}
          </View>

          {copy.showLegalDisclosure && (
            <Text style={styles.legal}>{t('auth.legalNotice')}</Text>
          )}
        </ScrollView>
        <OptionPickerModal
          visible={countryPickerVisible}
          options={PHONE_COUNTRIES.map((c) => ({ value: c.code, label: `${c.flag}  ${c.name}  +${c.dial}` }))}
          selected={phoneCountry.code}
          onSelect={(code) => {
            setPhoneCountry(PHONE_COUNTRIES.find((c) => c.code === code) ?? DEFAULT_PHONE_COUNTRY);
            setCountryPickerVisible(false);
          }}
          onClose={() => setCountryPickerVisible(false)}
          closeLabel={t('common.close')}
        />
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
  country: PhoneCountry;
  onPickCountry: () => void;
  /** The international number that will be used, e.g. +60122339276. */
  fullPhone: string;
  onInputFocus: () => void;
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
  country,
  onPickCountry,
  fullPhone,
  onInputFocus,
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
        <View style={styles.phoneRow}>
          <Pressable
            style={styles.countryButton}
            onPress={onPickCountry}
            accessibilityRole="button"
            accessibilityLabel={`${country.name} +${country.dial}`}
          >
            <Text style={styles.countryText}>
              {country.flag} +{country.dial}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
          </Pressable>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder={country.example}
            placeholderTextColor={colors.textTertiary}
            value={phoneNumber}
            onChangeText={onPhoneNumberChange}
            onFocus={onInputFocus}
            accessibilityLabel="Phone number"
            autoCapitalize="none"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
          />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <AppButton
          label={t('auth.sendCodeViaWhatsApp')}
          onPress={onSendCode}
          variant="primary"
          fullWidth
          loading={submitting}
          disabled={!looksComplete(country, phoneNumber)}
        />
      </View>
    );
  }

  return (
    <View style={styles.emailForm}>
      <Text style={styles.otpSubtitle}>{t('auth.otpSubtitle', { phone: formatPhone(fullPhone) })}</Text>
      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder={t('auth.otpPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={otpCode}
          onChangeText={onOtpCodeChange}
          accessibilityLabel="Verification code"
          keyboardType="number-pad"
          onFocus={onInputFocus}
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
  logoMark: { width: 72, height: 72, marginBottom: spacing.lg },
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
  phoneRow: { flexDirection: 'row', gap: spacing.xs },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  countryText: { ...typography.body, color: colors.textPrimary },
  phoneInput: { flex: 1 },
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
