import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { useUserStore } from '@/store';
import { BRAND } from '@/config';
import { useTranslation } from '@/i18n/useTranslation';
import { OptionPickerModal } from '@/components/ui/OptionPickerModal';
import { composePhone, DEFAULT_PHONE_COUNTRY, formatPhone, looksComplete, PHONE_COUNTRIES, type PhoneCountry } from '@/utils/phone';

type PendingAction = 'guest' | 'google' | 'whatsapp' | null;
type ScreenMode = 'default' | 'link' | 'switch';

/** WhatsApp only lets a code be re-requested so often; matching that here
 * keeps people from tapping into the rate limit. */
const RESEND_COOLDOWN_S = 60;

/** The screen renders three different pitches depending on why it was
 * opened (see `mode` below) — collecting what differs into one object keeps
 * that split in one place instead of scattered through the JSX. */
function getScreenCopy(mode: ScreenMode, t: ReturnType<typeof useTranslation>['t']) {
  return {
    title:
      mode === 'link' ? t('auth.upgradeTitle') : mode === 'switch' ? t('auth.signInTitle') : t('auth.welcome', { brand: BRAND.name }),
    subtitle: mode === 'link' ? t('auth.upgradeSubtitle') : mode === 'switch' ? t('auth.signInSubtitle') : t('auth.subtitle'),
    // Someone who is already a guest gains nothing from "Continue as Guest"
    // except a second, empty guest account.
    showGuestButton: mode === 'default',
    showHaveAccountLink: mode === 'link',
    showLegalDisclosure: mode !== 'link',
  };
}

export default function AuthScreen() {
  // Reached two ways: (1) as a fallback if the automatic guest sign-in on
  // onboarding/relaunch failed, or after a member's session expired, showing
  // every option; (2) from Profile as `?mode=upgrade`, when a signed-in guest
  // wants to link Google/WhatsApp to their existing account. From (2) the
  // guest can switch to signing into an account they already have (after a
  // warning that the guest's data stays behind) — mode 'switch'.
  // `failed` names the method a web OAuth round trip just failed with, so its
  // error shows next to that button (see /auth/callback).
  const { mode: modeParam, failed } = useLocalSearchParams<{ mode?: string; failed?: string }>();
  const [switched, setSwitched] = useState(false);
  const mode: ScreenMode = modeParam === 'upgrade' ? (switched ? 'switch' : 'link') : 'default';
  const isLinking = mode === 'link';
  const { t } = useTranslation();
  const copy = getScreenCopy(mode, t);

  const signInAsGuest = useUserStore((s) => s.signInAsGuest);
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
  const [lastAttempt, setLastAttempt] = useState<PendingAction>(failed === 'google' ? 'google' : null);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp'>('phone');
  // Whether the code on its way was requested to link (verify as
  // 'phone_change') or to sign in ('sms') — fixed when it's sent, because
  // the screen's mode can change while the user is reading WhatsApp.
  const [phoneFlow, setPhoneFlow] = useState<'link' | 'signin'>('signin');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resendLeft, setResendLeft] = useState(0);
  // The "your guest data won't come along" warning, and what to do once the
  // user accepts it.
  const [switchWarning, setSwitchWarning] = useState<{ then: () => void } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // The phone form sits at the bottom of the page: once the keyboard is up,
  // scroll so the field (and its button) stay visible above it.
  const revealForm = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  const fullPhone = composePhone(phoneCountry, phoneNumber);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const timer = setTimeout(() => setResendLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendLeft]);

  const errorFor = (action: PendingAction) =>
    pending === null && lastAttempt === action && authError ? t(authError, { brand: BRAND.name }) : null;
  // Guest sign-in errors, plus any error already set when this screen opened
  // (e.g. the automatic guest sign-in failed, or the session expired).
  const topError = errorFor('guest') ?? errorFor(null);
  // Linking failed because that Google account / number already has its own
  // account: offer to sign into it instead (same warning as the link below).
  const offerSwitchFor = (action: PendingAction) =>
    isLinking && pending === null && lastAttempt === action && authError === 'auth.alreadyLinked';

  const afterSuccess = (linked: boolean) => router.replace(linked ? '/(tabs)/profile' : '/(tabs)');

  const runSignIn = async (action: Exclude<PendingAction, null>, task: () => Promise<boolean>, linked = false) => {
    clearAuthError();
    setLastAttempt(action);
    setPending(action);
    const succeeded = await task();
    setPending(null);
    if (succeeded) afterSuccess(linked);
  };

  const sendCode = async (flow: 'link' | 'signin') => {
    clearAuthError();
    setLastAttempt('whatsapp');
    setPending('whatsapp');
    // Linking attaches the number to the guest's current account; otherwise
    // it's an ordinary sign-in (which replaces the current session).
    const send = flow === 'link' ? linkPhoneOtp : signInWithPhoneOtp;
    const ok = await send(fullPhone);
    setPending(null);
    if (ok) {
      setPhoneFlow(flow);
      setPhoneStep('otp');
      setResendLeft(RESEND_COOLDOWN_S);
    }
  };

  const handleSendCode = () => sendCode(isLinking ? 'link' : 'signin');
  const handleResendCode = () => sendCode(phoneFlow);

  const handleVerifyCode = () => {
    const linking = phoneFlow === 'link';
    const verify = linking ? verifyLinkedPhoneOtp : verifyPhoneOtp;
    runSignIn('whatsapp', () => verify(fullPhone, otpCode.trim()), linking);
  };

  const handleGoogle = () =>
    runSignIn('google', () => (isLinking ? linkOAuthIdentity('google') : signInWithOAuth('google')), isLinking);

  const handleChangeNumber = () => {
    clearAuthError();
    setPhoneStep('phone');
    setOtpCode('');
  };

  const warnThen = (then: () => void) => setSwitchWarning({ then });

  const switchToSignIn = () =>
    warnThen(() => {
      clearAuthError();
      setLastAttempt(null);
      setSwitched(true);
      setPhoneStep('phone');
      setOtpCode('');
    });

  /** "Sign in with that account" after an alreadyLinked error: switch modes
   * and retry the same method as a sign-in. */
  const signInWithThatAccount = (action: 'google' | 'whatsapp') =>
    warnThen(() => {
      setSwitched(true);
      if (action === 'google') runSignIn('google', () => signInWithOAuth('google'));
      else sendCode('signin');
    });

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
            {offerSwitchFor('google') && (
              <AppButton label={t('auth.useThatAccount')} onPress={() => signInWithThatAccount('google')} variant="ghost" fullWidth />
            )}

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
                onResendCode={handleResendCode}
                resendLeft={resendLeft}
                onVerifyCode={handleVerifyCode}
                onChangeNumber={handleChangeNumber}
                submitting={pending === 'whatsapp'}
                error={errorFor('whatsapp')}
                onUseThatAccount={offerSwitchFor('whatsapp') ? () => signInWithThatAccount('whatsapp') : undefined}
              />
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

            {copy.showHaveAccountLink && (
              <AppButton label={t('auth.haveAccount')} onPress={switchToSignIn} variant="ghost" fullWidth disabled={isAuthenticating} />
            )}
          </View>

          {copy.showLegalDisclosure && <Text style={styles.legal}>{t('auth.legalNotice')}</Text>}
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
        <AppModal visible={switchWarning !== null} onClose={() => setSwitchWarning(null)}>
          <View style={styles.warningIconWrap}>
            <Ionicons name="warning" size={26} color={colors.danger} />
          </View>
          <Text style={styles.warningTitle}>{t('auth.switchWarningTitle')}</Text>
          <Text style={styles.warningBody}>{t('auth.switchWarningBody')}</Text>
          <AppButton
            label={t('auth.switchConfirm')}
            onPress={() => {
              const then = switchWarning?.then;
              setSwitchWarning(null);
              then?.();
            }}
            variant="danger"
            fullWidth
            style={styles.warningAction}
          />
          <AppButton label={t('common.cancel')} onPress={() => setSwitchWarning(null)} variant="ghost" fullWidth />
        </AppModal>
      </LinearGradient>
    </KeyboardAvoidingView>
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
  onResendCode: () => void;
  /** Seconds until another code may be requested; 0 = now. */
  resendLeft: number;
  onVerifyCode: () => void;
  onChangeNumber: () => void;
  submitting: boolean;
  error: string | null;
  /** Shown when linking failed because the number already has an account. */
  onUseThatAccount?: () => void;
}

/** Two-step WhatsApp sign-in: collect a phone number, send a 6-digit code to
 * it over WhatsApp, then collect that code to finish signing in. */
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
  onResendCode,
  resendLeft,
  onVerifyCode,
  onChangeNumber,
  submitting,
  error,
  onUseThatAccount,
}: PhoneAuthFormProps) {
  const { t } = useTranslation();
  const switchButton = onUseThatAccount && (
    <AppButton label={t('auth.useThatAccount')} onPress={onUseThatAccount} variant="ghost" fullWidth />
  );

  if (step === 'phone') {
    return (
      <View style={styles.formCard}>
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
            accessibilityLabel={t('auth.phoneNumberLabel')}
            autoCapitalize="none"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
          />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {switchButton}
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
    <View style={styles.formCard}>
      <Text style={styles.otpSubtitle}>{t('auth.otpSubtitle', { phone: formatPhone(fullPhone) })}</Text>
      <View style={styles.fieldWrap}>
        <TextInput
          style={styles.input}
          placeholder={t('auth.otpPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={otpCode}
          onChangeText={onOtpCodeChange}
          accessibilityLabel={t('auth.otpLabel')}
          keyboardType="number-pad"
          onFocus={onInputFocus}
          textContentType="oneTimeCode"
          maxLength={6}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {switchButton}
      <AppButton label={t('auth.verifyCode')} onPress={onVerifyCode} variant="primary" fullWidth loading={submitting} disabled={otpCode.trim().length < 6} />
      <AppButton
        label={resendLeft > 0 ? t('auth.resendIn', { seconds: resendLeft }) : t('auth.resendCode')}
        onPress={onResendCode}
        variant="ghost"
        fullWidth
        disabled={submitting || resendLeft > 0}
      />
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
  formCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  otpSubtitle: { ...typography.caption, color: colors.textTertiary },
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
  // Same look as Profile's destructive confirmations.
  warningIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(232,71,76,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  warningTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  warningBody: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  warningAction: { marginBottom: spacing.sm },
});
