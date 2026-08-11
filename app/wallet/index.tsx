import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { COIN_PACKAGES } from '@/data';
import { useWalletStore } from '@/store';
import { BRAND } from '@/config';
import type { CoinPackage } from '@/types';
import { useHaptics } from '@/hooks/useHaptics';

type ModalState = 'confirm' | 'processing' | 'success';

export default function WalletScreen() {
  const balance = useWalletStore((s) => s.balance);
  const transactions = useWalletStore((s) => s.transactions);
  const purchasePackage = useWalletStore((s) => s.purchasePackage);

  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [modalState, setModalState] = useState<ModalState>('confirm');
  const { success: successHaptic } = useHaptics();

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
    setSelectedPackage(pkg);
    setModalState('confirm');
  };

  const confirmPurchase = () => {
    if (!selectedPackage) return;
    setModalState('processing');
    setTimeout(() => {
      purchasePackage(selectedPackage);
      setModalState('success');
      successHaptic();
    }, 1100);
  };

  const closeModal = () => setSelectedPackage(null);

  const handleRestore = () => {
    const message = 'No previous purchases found for this device (simulated).';
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert('Restore Purchases', message);
    }
  };

  return (
    <Screen>
      <StackHeader title="Wallet" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={gradients.premiumBanner} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your Balance</Text>
          <CoinBadge amount={balance} size="lg" />
        </LinearGradient>

        <DailyMissionCard />

        <Text style={styles.sectionTitle}>Coin Packages</Text>
        <View style={styles.packagesGrid}>
          {COIN_PACKAGES.map((pkg) => (
            <Pressable
              key={pkg.id}
              onPress={() => openConfirm(pkg)}
              style={styles.packageCard}
              accessibilityRole="button"
              accessibilityLabel={`Buy ${pkg.coins} coins for ${pkg.priceLabel}`}
            >
              {pkg.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pkg.badge}</Text>
                </View>
              )}
              <Text style={styles.packageIcon}>{BRAND.currency.coinSymbol}</Text>
              <Text style={styles.packageCoins}>{pkg.coins.toLocaleString()}</Text>
              {pkg.bonusCoins > 0 && <Text style={styles.packageBonus}>+{pkg.bonusCoins} bonus</Text>}
              <Text style={styles.packagePrice}>{pkg.priceLabel}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.linkRow}>
          <AppButton label="Restore Purchases" onPress={handleRestore} variant="ghost" style={styles.linkButton} />
          <AppButton label="Help" onPress={() => router.push('/settings/help')} variant="ghost" style={styles.linkButton} />
        </View>

        <Text style={styles.sectionTitle}>Transaction History</Text>
        {transactions.length === 0 ? (
          <EmptyState icon="receipt-outline" title="No transactions yet" subtitle="Purchases and unlocks will appear here." />
        ) : (
          <View style={styles.historyList}>
            {transactions.map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
          </View>
        )}
      </ScrollView>

      <AppModal visible={!!selectedPackage} onClose={closeModal}>
        {selectedPackage && modalState === 'confirm' && (
          <>
            <Text style={styles.modalTitle}>Confirm purchase</Text>
            <Text style={styles.modalBody}>
              Buy {selectedPackage.coins.toLocaleString()} {BRAND.currency.coinNamePlural.toLowerCase()}
              {selectedPackage.bonusCoins > 0 ? ` + ${selectedPackage.bonusCoins} bonus` : ''} for{' '}
              {selectedPackage.priceLabel}?
            </Text>
            <AppButton label={`Confirm · ${selectedPackage.priceLabel}`} onPress={confirmPurchase} fullWidth style={styles.modalAction} />
            <AppButton label="Cancel" onPress={closeModal} variant="ghost" fullWidth />
          </>
        )}
        {selectedPackage && modalState === 'processing' && (
          <View style={styles.processingWrap}>
            <Text style={styles.modalTitle}>Processing…</Text>
            <Text style={styles.modalBody}>Simulating payment (prototype only, no real charge).</Text>
          </View>
        )}
        {selectedPackage && modalState === 'success' && (
          <View style={styles.processingWrap}>
            <Animated.View style={[styles.successCircle, checkStyle]}>
              <Ionicons name="checkmark" size={32} color={colors.textInverse} />
            </Animated.View>
            <Text style={styles.modalTitle}>
              +{selectedPackage.coins + selectedPackage.bonusCoins} coins added
            </Text>
            <AppButton label="Done" onPress={closeModal} fullWidth style={styles.modalAction} />
          </View>
        )}
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  balanceCard: { borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
  balanceLabel: { ...typography.body, color: 'rgba(255,255,255,0.75)', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  packagesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  packageCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: { ...typography.micro, color: colors.white },
  packageIcon: { fontSize: 26, marginBottom: spacing.xs, marginTop: spacing.xs },
  packageCoins: { ...typography.h2, color: colors.textPrimary },
  packageBonus: { ...typography.caption, color: colors.gold, marginTop: 2 },
  packagePrice: { ...typography.bodyMedium, color: colors.textSecondary, marginTop: spacing.sm },
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
