import React, { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
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
type FormMode = 'signup' | 'signin';

/** Title/subtitle for the three versions of this screen: sign in, sign up,
 * and a guest saving their progress (sign up from Profile, `?mode=upgrade`). */
function getScreenCopy(isUpgrade: boolean, mode: FormMode, t: ReturnType<typeof useTranslation>['t']) {
  if (mode === 'signin') return { title: t('auth.signIn'), subtitle: t('auth.subtitle') };
  if (isUpgrade) return { title: t('auth.upgradeTitle'), subtitle: t('auth.upgradeSubtitle') };
  return { title: t('auth.createAccount'), subtitle: t('auth.signUpSubtitle') };
}

export default function AuthScreen() {
  // Reached two ways: (1) after signing out, or as a fallback if the
  // automatic guest sign-in on onboarding/relaunch failed; (2) from Profile as
  // `?mode=upgrade`, when an already-signed-in guest wants to attach real
  // credentials to their existing account instead of starting a new one.
  const { mode: screenModeParam } = useLocalSearchParams<{ mode?: string }>();
  const isUpgrade = screenModeParam === 'upgrade';
  const { t } = useTranslation();

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
  // Someone landing here after signing out most likely wants to sign back in;
  // a guest saving their progress is creating an account.
  const [mode, setMode] = useState<FormMode>(isUpgrade ? 'signup' : 'signin');
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(DEFAULT_PHONE_COUNTRY);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  // The phone form sits near the bottom of the page: once the keyboard is up,
  // scroll so the field (and its button) stay visible above it.
  const revealForm = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  const fullPhone = composePhone(phoneCountry, phoneNumber);
  const copy = getScreenCopy(isUpgrade, mode, t);

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

  const switchMode = () => {
    clearAuthError();
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
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
          <View style={styles.container}>
            <Image
              source={require('../../assets/images/logo-mark.png')}
              style={styles.logoMark}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel={BRAND.name}
            />
            <Text style={styles.title} accessibilityRole="header">
              {copy.title}
            </Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>

            {topError && <Text style={[styles.errorText, styles.topError]}>{topError}</Text>}

            <EmailAuthForm
              control={control}
              errors={errors}
              mode={mode}
              onSubmit={handleSubmit(onSubmitEmail)}
              submitting={pending === 'email'}
              disabled={isAuthenticating && pending !== 'email'}
              error={errorFor('email')}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{mode === 'signin' ? t('auth.newHere', { brand: BRAND.name }) : t('auth.haveAccount')}</Text>
              <Pressable
                onPress={switchMode}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={mode === 'signin' ? t('auth.signUpNow') : t('auth.signIn')}
              >
                <Text style={styles.switchLink}>{mode === 'signin' ? t('auth.signUpNow') : t('auth.signIn')}</Text>
              </Pressable>
            </View>

            <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.altActions}>
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

              {!isUpgrade && (
                <AppButton
                  label={t('auth.continueAsGuest')}
                  onPress={() => runSignIn('guest', signInAsGuest)}
                  variant="ghost"
                  fullWidth
                  loading={pending === 'guest'}
                  disabled={isAuthenticating && pending !== 'guest'}
                  icon={<Ionicons name="person-outline" size={18} color={colors.textSecondary} />}
                />
              )}
            </View>

            {!isUpgrade && <Text style={styles.legal}>{t('auth.legalNotice')}</Text>}
          </View>
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

interface AuthFieldProps extends Omit<TextInputProps, 'style' | 'placeholder' | 'placeholderTextColor'> {
  label: string;
  error?: string | null;
  /** E.g. the password show/hide toggle, drawn inside the field on the right. */
  accessory?: React.ReactNode;
}

/** Netflix-style input: a dark box whose label sits where the placeholder
 * would be, then shrinks to the top edge once the field is focused or filled
 * — so the label stays visible while typing, unlike a placeholder. */
function AuthField({ label, error, accessory, value, onFocus, onBlur, ...inputProps }: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const floated = focused || !!value;

  return (
    <View style={styles.fieldWrap}>
      <View style={[styles.field, focused && styles.fieldFocused, !!error && styles.fieldError]}>
        <Text style={[styles.fieldLabel, floated && styles.fieldLabelFloated]} numberOfLines={1}>
          {label}
        </Text>
        <TextInput
          {...inputProps}
          value={value}
          style={styles.fieldInput}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {accessory}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

interface EmailAuthFormProps {
  control: Control<EmailFormValues>;
  errors: FieldErrors<EmailFormValues>;
  mode: FormMode;
  onSubmit: () => void;
  submitting: boolean;
  disabled: boolean;
  error: string | null;
}

/** The name (sign-up only), email and password fields plus the submit button. */
function EmailAuthForm({ control, errors, mode, onSubmit, submitting, disabled, error }: EmailAuthFormProps) {
  const { t } = useTranslation();
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <View style={styles.form}>
      {mode === 'signup' && (
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthField
              label={t('auth.nameLabel')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          )}
        />
      )}
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthField
            label={t('auth.emailLabel')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.email?.message}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <AuthField
            label={t('auth.passwordPlaceholder')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.password?.message}
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            onSubmitEditing={onSubmit}
            returnKeyType="go"
            accessory={
              <Pressable
                onPress={() => setPasswordVisible((v) => !v)}
                hitSlop={10}
                style={styles.fieldAccessory}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
              </Pressable>
            }
          />
        )}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <AppButton
        label={mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')}
        onPress={onSubmit}
        variant="primary"
        size="lg"
        fullWidth
        loading={submitting}
        disabled={disabled}
        style={styles.submit}
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
 * it over WhatsApp, then collect that code to finish signing in. Uses the same
 * AuthField inputs as the email form so the two read as one design. */
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
      <View style={styles.form}>
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
          <View style={styles.phoneField}>
            <AuthField
              label={t('auth.phoneLabel')}
              value={phoneNumber}
              onChangeText={onPhoneNumberChange}
              onFocus={onInputFocus}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
            />
          </View>
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <AppButton
          label={t('auth.sendCodeViaWhatsApp')}
          onPress={onSendCode}
          variant="primary"
          fullWidth
          loading={submitting}
          disabled={!looksComplete(country, phoneNumber)}
          icon={<Ionicons name="logo-whatsapp" size={18} color={colors.textInverse} />}
        />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <Text style={styles.otpSubtitle}>{t('auth.otpSubtitle', { phone: formatPhone(fullPhone) })}</Text>
      <AuthField
        label={t('auth.otpPlaceholder')}
        value={otpCode}
        onChangeText={onOtpCodeChange}
        onFocus={onInputFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <AppButton label={t('auth.verifyCode')} onPress={onVerifyCode} variant="primary" fullWidth loading={submitting} disabled={otpCode.trim().length < 6} />
      <AppButton label={t('auth.changeNumber')} onPress={onChangeNumber} variant="ghost" fullWidth disabled={submitting} />
    </View>
  );
}

const FIELD_HEIGHT = 58;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  container: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  logoMark: { width: 56, height: 56, alignSelf: 'center', marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    alignSelf: 'center',
    maxWidth: 340,
  },
  topError: { textAlign: 'center', marginBottom: spacing.md },
  form: { gap: spacing.sm },
  fieldWrap: { gap: 4 },
  field: {
    height: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  fieldFocused: { borderColor: colors.textSecondary },
  fieldError: { borderColor: colors.danger },
  fieldLabel: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: (FIELD_HEIGHT - 22) / 2 - 1.5,
    ...typography.body,
    color: colors.textTertiary,
    pointerEvents: 'none',
  },
  fieldLabelFloated: { top: 7, ...typography.micro, color: colors.textTertiary },
  fieldInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.md,
    paddingTop: 20,
    paddingBottom: 4,
    ...typography.body,
    color: colors.textPrimary,
    // The whole field's border brightens on focus (fieldFocused); the
    // browser's own outline would draw a second, square box inside it.
    outlineWidth: 0,
  },
  fieldAccessory: { paddingHorizontal: spacing.md, height: '100%', justifyContent: 'center' },
  submit: { marginTop: spacing.xs },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: spacing.md },
  switchText: { ...typography.body, color: colors.textTertiary },
  switchLink: { ...typography.bodyMedium, color: colors.textPrimary, textDecorationLine: 'underline' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  dividerText: { ...typography.caption, color: colors.textTertiary, textTransform: 'uppercase' },
  altActions: { gap: spacing.sm },
  otpSubtitle: { ...typography.caption, color: colors.textTertiary },
  phoneRow: { flexDirection: 'row', gap: spacing.xs },
  phoneField: { flex: 1 },
  countryButton: {
    height: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  countryText: { ...typography.body, color: colors.textPrimary },
  errorText: { ...typography.caption, color: colors.danger },
  legal: {
    ...typography.caption,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xl,
    alignSelf: 'center',
    maxWidth: 320,
  },
});
