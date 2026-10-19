import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { colors, gradients, radius, spacing, typography } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { StackHeader } from '@/components/ui/StackHeader';
import { AppButton } from '@/components/ui/AppButton';
import { AppModal } from '@/components/ui/AppModal';
import { CoinBadge } from '@/components/ui/CoinBadge';
import { DailyMissionCard } from '@/components/ui/DailyMissionCard';
import { TransactionRow } from '@/components/ui/TransactionRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { AccountGateSheet } from '@/components/ui/AccountGateSheet';
import { useCoinPackages, usePublicConfig } from '@/services/content';
import { useWalletStore } from '@/store';
import { BRAND } from '@/config';
import type { CoinPackage } from '@/types';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccountGate } from '@/hooks/useAccountGate';
import { useRefreshOnForeground } from '@/hooks/useRefreshOnForeground';
import { useTranslation } from '@/i18n/useTranslation';

type ModalState = 'confirm' | 'processing' | 'success' | 'failed';

export default function WalletScreen() {
  const balance = useWalletStore((s) => s.balance);
  const transactions = useWalletStore((s) => s.transactions);
  const purchasePackage = useWalletStore((s) => s.purchasePackage);
  const { data: packages, isLoading: packagesLoading, isError: packagesFailed } = useCoinPackages();
  const { data: config } = usePublicConfig();
  // Until the config arrives the server is the judge (it refuses purchases
  // when simulated payments are off); hide the buttons only once it says so.
  const paymentsEnabled = config?.simulatedPayments ?? true;
  const { requireAccount } = useAccountGate();

  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [modalState, setModalState] = useState<ModalState>('confirm');
  /** Blocks a second confirm tap while the first purchase is in flight. */
  const purchasingRef = useRef(false);
  const [purchasing, setPurchasing] = useState(false);
  const { success: successHaptic } = useHaptics();
  const { t } = useTranslation();

  useRefreshOnForeground(useCallback((maxAgeMs: number) => void useWalletStore.getState().refreshIfStale(maxAgeMs), []));

  const checkScale = useSharedValue(0);

  useEffect(() => {
    if (modalState === 'success') {
      checkScale.value = withSequence(withTiming(1.15, { duration: 220 }), withTiming(1, { duration: 120 }));
    } else {
      checkScale.value = 0;
    }
  }, [modalState, checkScale]);

  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));

  const openConfirm = (pkg: CoinPackage) => {
    // Coins belong to an account: a guest is asked to link one first.
    if (!requireAccount('coins')) return;
    setSelectedPackage(pkg);
    setModalState('confirm');
  };

  const confirmPurchase = async () => {
    if (!selectedPackage || purchasingRef.current) return;
    purchasingRef.current = true;
    setPurchasing(true);
    setModalState('processing');
    const ok = await purchasePackage(selectedPackage);
    purchasingRef.current = false;
    setPurchasing(false);
    if (ok) {
      setModalState('success');
      successHaptic();
    } else {
      setModalState('failed');
    }
  };

  const closeModal = () => {
    if (purchasingRef.current) return;
    setSelectedPackage(null);
  };

  const handleRestore = () => {
    const message = t('wallet.restorePurchasesMessage');
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert(t('wallet.restorePurchases'), message);
    }
  };

  return (
    <Screen>
      <StackHeader title={t('wallet.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={gradients.premiumBanner} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('wallet.yourBalance')}</Text>
          <CoinBadge amount={balance} size="lg" />
        </LinearGradient>

        <DailyMissionCard />

        <Text style={styles.sectionTitle}>{t('wallet.coinPackages')}</Text>
        {/* Full-width rows rather than a 2-up grid: every package reads the
            same way at any screen width, with the price as the action. */}
        {!paymentsEnabled ? (
          <Text style={styles.notice}>{t('wallet.comingSoon')}</Text>
        ) : packagesLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.packagesLoading} />
        ) : packagesFailed || !packages ? (
          <Text style={styles.notice}>{t('wallet.packagesUnavailable')}</Text>
        ) : (
        <View style={styles.packageList}>
          {packages.map((pkg) => (
            <Pressable
              key={pkg.id}
              onPress={() => openConfirm(pkg)}
              style={[styles.packageRow, pkg.badge && styles.packageRowFeatured]}
              accessibilityRole="button"
              accessibilityLabel={`Buy ${pkg.coins} coins for ${pkg.priceLabel}`}
            >
              <Text style={styles.packageIcon}>{BRAND.currency.coinSymbol}</Text>
              <View style={styles.packageInfo}>
                <View style={styles.packageTitleRow}>
                  <Text style={styles.packageCoins}>{pkg.coins.toLocaleString()}</Text>
                  {pkg.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{pkg.badge}</Text>
                    </View>
                  )}
                </View>
                {pkg.bonusCoins > 0 && (
                  <Text style={styles.packageBonus}>{t('wallet.bonusSuffix', { bonus: pkg.bonusCoins })}</Text>
                )}
              </View>
              <View style={styles.pricePill}>
                <Text style={styles.pricePillText}>{pkg.priceLabel}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        )}

        <View style={styles.linkRow}>
          <AppButton label={t('wallet.restorePurchases')} onPress={handleRestore} variant="ghost" style={styles.linkButton} />
          <AppButton label={t('wallet.help')} onPress={() => router.push('/settings/help')} variant="ghost" style={styles.linkButton} />
        </View>

        <Text style={styles.sectionTitle}>{t('wallet.transactionHistory')}</Text>
        {transactions.length === 0 ? (
          <EmptyState icon="receipt-outline" title={t('wallet.emptyTransactionsTitle')} subtitle={t('wallet.emptyTransactionsSubtitle')} />
        ) : (
          <View style={styles.historyList}>
            {transactions.map((txn) => (
              <TransactionRow key={txn.id} transaction={txn} />
            ))}
          </View>
        )}
      </ScrollView>

      <AppModal visible={!!selectedPackage} onClose={closeModal}>
        {selectedPackage && modalState === 'confirm' && (
          <>
            <Text style={styles.modalTitle}>{t('wallet.confirmPurchaseTitle')}</Text>
            <Text style={styles.modalBody}>
              {t('wallet.buyCoinsFor', {
                coins: selectedPackage.coins.toLocaleString(),
                unit: BRAND.currency.coinNamePlural.toLowerCase(),
                bonus: selectedPackage.bonusCoins > 0 ? ` ${t('wallet.bonusSuffix', { bonus: selectedPackage.bonusCoins })}` : '',
                price: selectedPackage.priceLabel,
              })}
            </Text>
            <AppButton
              label={t('wallet.confirmPrice', { price: selectedPackage.priceLabel })}
              onPress={confirmPurchase}
              loading={purchasing}
              fullWidth
              style={styles.modalAction}
            />
            <AppButton label={t('common.cancel')} onPress={closeModal} variant="ghost" fullWidth />
          </>
        )}
        {selectedPackage && modalState === 'processing' && (
          <View style={styles.processingWrap}>
            <Text style={styles.modalTitle}>{t('wallet.processing')}</Text>
            <Text style={styles.modalBody}>{t('wallet.processingBody')}</Text>
          </View>
        )}
        {selectedPackage && modalState === 'success' && (
          <View style={styles.processingWrap}>
            <Animated.View style={[styles.successCircle, checkStyle]}>
              <Ionicons name="checkmark" size={32} color={colors.textInverse} />
            </Animated.View>
            <Text style={styles.modalTitle}>
              {t('wallet.coinsAdded', { amount: selectedPackage.coins + selectedPackage.bonusCoins })}
            </Text>
            <AppButton label={t('wallet.done')} onPress={closeModal} fullWidth style={styles.modalAction} />
          </View>
        )}
        {selectedPackage && modalState === 'failed' && (
          <View style={styles.processingWrap}>
            <Ionicons name="alert-circle" size={44} color={colors.danger} style={styles.failedIcon} />
            <Text style={styles.modalBody}>{t('wallet.purchaseFailed')}</Text>
            <AppButton label={t('common.close')} onPress={closeModal} variant="secondary" fullWidth />
          </View>
        )}
      </AppModal>

      <AccountGateSheet />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  balanceCard: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
  balanceLabel: { ...typography.body, color: 'rgba(255,255,255,0.75)', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  packageList: { gap: spacing.sm, marginBottom: spacing.md },
  packagesLoading: { marginVertical: spacing.lg },
  notice: { ...typography.body, color: colors.textTertiary, textAlign: 'center', marginVertical: spacing.lg },
  failedIcon: { marginBottom: spacing.sm },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  packageRowFeatured: { borderColor: colors.accent },
  packageIcon: { fontSize: 26 },
  packageInfo: { flex: 1 },
  packageTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  packageCoins: { ...typography.h3, color: colors.textPrimary },
  badge: { backgroundColor: colors.accent, paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { ...typography.micro, color: colors.white },
  packageBonus: { ...typography.caption, color: colors.gold, marginTop: 2 },
  pricePill: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pricePillText: { ...typography.bodyMedium, color: colors.textInverse, fontWeight: '700' },
  linkRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  linkButton: { flex: 1 },
  historyList: { gap: 0 },
  modalTitle: { ...typography.h2, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  modalBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  modalAction: { marginBottom: spacing.sm, marginTop: spacing.sm },
  processingWrap: { alignItems: 'center', paddingVertical: spacing.md },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
});
