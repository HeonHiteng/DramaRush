import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PaywallSheet } from '@/components/ui/PaywallSheet';
import { AccountGateSheet } from '@/components/ui/AccountGateSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlayerPage, type LockReason } from '@/features/player/PlayerPage';
import { RewardedAdOverlay } from '@/features/player/RewardedAdOverlay';
import { EpisodeListSheet } from '@/features/player/EpisodeListSheet';
import { useEpisodeById, useEpisodesForSeries, useSeriesById } from '@/services/content';
import { useLibraryStore, useSubscriptionStore, useWalletStore } from '@/store';
import { goBack } from '@/utils/navigation';
import { usePlaybackProtection } from '@/hooks/usePlaybackProtection';
import { useAccountGate } from '@/hooks/useAccountGate';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import { BRAND } from '@/config';
import type { Episode } from '@/types';

export default function PlayerScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  return <PlayerScreenInner episodeId={episodeId} />;
}

function PlayerScreenInner({ episodeId }: { episodeId: string }) {
  // No screenshots / screen recordings while the player is open (native only).
  usePlaybackProtection();
  const { data: initialEpisode, isLoading: episodeLoading } = useEpisodeById(episodeId);
  const { data: series, isLoading: seriesLoading } = useSeriesById(initialEpisode?.seriesId);
  const { data: episodes = [], isLoading: episodesLoading } = useEpisodesForSeries(initialEpisode?.seriesId);

  /**
   * The requested episode's page, derived from the list as soon as it has
   * arrived (null before). It used to be seeded once from the first render,
   * when the list was still empty — so a cold start or deep link always
   * activated episode 1 while the list scrolled to the requested one. Once
   * the viewer swipes or jumps, their choice takes over. The list isn't
   * mounted before this is known, so its initialScrollIndex and the active
   * page always agree.
   */
  const requestedIndex = useMemo(
    () => (episodes.length > 0 ? Math.max(0, episodes.findIndex((e) => e.id === episodeId)) : null),
    [episodes, episodeId]
  );
  const [chosenIndex, setActiveIndex] = useState<number | null>(null);
  const activeIndex = chosenIndex ?? requestedIndex;
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [episodeListVisible, setEpisodeListVisible] = useState(false);
  const [paywallEpisode, setPaywallEpisode] = useState<Episode | null>(null);
  const [adEpisode, setAdEpisode] = useState<Episode | null>(null);
  /** The active page is showing a landscape video rotated full-screen: no swiping between episodes. */
  const [landscape, setLandscape] = useState(false);
  const listRef = useRef<FlatList<Episode>>(null);

  const isFavorite = useLibraryStore((s) => (series ? s.isFavorite(series.id) : false));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const unlockedEpisodeIds = useLibraryStore((s) => s.unlockedEpisodeIds);
  const unlockEpisodeWithCoins = useLibraryStore((s) => s.unlockEpisodeWithCoins);
  const redeemAdReward = useLibraryStore((s) => s.redeemAdReward);
  const balance = useWalletStore((s) => s.balance);
  const isSubscriber = useSubscriptionStore((s) => s.isActive);
  const { isGuest, requireAccount, openGate } = useAccountGate();
  const { t } = useTranslation();

  if (episodeLoading || seriesLoading || episodesLoading) {
    return (
      <View style={[styles.notFoundRoot, styles.root]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!initialEpisode || !series || episodes.length === 0) {
    return (
      <View style={styles.notFoundRoot}>
        <EmptyState icon="alert-circle-outline" title={t('player.episodeNotFound')} actionLabel={t('player.goBack')} onAction={() => goBack()} />
      </View>
    );
  }

  /**
   * A locked page: members get the paywall. Guests get it too on an ad
   * episode (with only the ad offered — that unlock is theirs to use); on a
   * coin or member episode, the link-account gate.
   */
  const handleLocked = (item: Episode, reason: LockReason) => {
    if (reason === 'account_required') {
      // The server said so, whatever we thought.
      openGate('paywall');
      return;
    }
    if (item.access !== 'ad_unlock' && !requireAccount('paywall')) return;
    setPaywallEpisode(item);
  };

  /** Claims the ad reward; resolves to the message the ad overlay shows instead of "Reward earned!", or null. */
  const claimAdReward = async (): Promise<TranslationKey | null> => {
    if (!adEpisode) return null;
    const result = await redeemAdReward(adEpisode.id);
    if (result === 'unlocked') {
      // The reward is recorded as a transaction; keep the wallet's history current.
      void useWalletStore.getState().hydrateFromServer();
      return null;
    }
    if (result === 'cap_reached') return 'player.adCapReached';
    if (result === 'account_required') {
      openGate('ad');
      return 'gate.reason.ad';
    }
    return 'player.adFailed';
  };

  const goToIndex = (index: number) => {
    if (index < 0 || index >= episodes.length || containerSize.height === 0) return;
    listRef.current?.scrollToOffset({ offset: index * containerSize.height, animated: true });
    setActiveIndex(index);
  };

  const handleShare = () => {
    const message = t('player.shareMessage', { title: series.title, brand: BRAND.name });
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert(t('player.share'), message);
    }
  };

  const handleRestorePurchases = () => {
    const message = t('wallet.restorePurchasesMessage');
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert(t('wallet.restorePurchases'), message);
    }
  };

  return (
    // `key` makes this a fresh mount rather than an update of the loading
    // View above (same type, same position): react-native-web only starts
    // observing layout if onLayout is already set when a View mounts, so a
    // cold load (loading view first) never got a size and stayed black.
    <View
      key="player-root"
      style={styles.root}
      onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {containerSize.height > 0 && activeIndex !== null && (
        <FlatList
          ref={listRef}
          data={episodes}
          keyExtractor={(item) => item.id}
          pagingEnabled
          scrollEnabled={!landscape}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={activeIndex}
          getItemLayout={(_, i) => ({ length: containerSize.height, offset: containerSize.height * i, index: i })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.y / containerSize.height);
            setActiveIndex(idx);
          }}
          renderItem={({ item, index }) => {
            const isUnlocked =
              item.access === 'free' || unlockedEpisodeIds.includes(item.id) || (item.access === 'subscriber' && isSubscriber);
            return (
              <PlayerPage
                episode={item}
                seriesId={series.id}
                seriesTitle={series.title}
                totalEpisodes={episodes.length}
                width={containerSize.width}
                height={containerSize.height}
                isActive={index === activeIndex}
                isUnlocked={isUnlocked}
                isFavorite={isFavorite}
                hasNext={index < episodes.length - 1}
                onToggleFavorite={() => toggleFavorite(series.id)}
                onShare={handleShare}
                onOpenEpisodeList={() => setEpisodeListVisible(true)}
                onClose={() => goBack(`/series/${series.id}`)}
                onLocked={(reason) => handleLocked(item, reason)}
                onAutoAdvance={() => goToIndex(index + 1)}
                onLandscapeChange={setLandscape}
              />
            );
          }}
        />
      )}

      <PaywallSheet
        visible={!!paywallEpisode}
        onClose={() => setPaywallEpisode(null)}
        episode={paywallEpisode ?? episodes[0]}
        seriesTitle={series.title}
        seriesRating={series.rating}
        totalEpisodes={episodes.length}
        coinBalance={balance}
        isSubscriber={isSubscriber}
        adOnly={isGuest}
        onUnlockWithCoins={async () => {
          if (!paywallEpisode) return false;
          return unlockEpisodeWithCoins(paywallEpisode.id);
        }}
        onWatchAd={() => {
          setAdEpisode(paywallEpisode);
          setPaywallEpisode(null);
        }}
        onUnlocked={() => setPaywallEpisode(null)}
        onViewCoinPackages={() => router.push('/wallet')}
        onViewMembership={() => router.push('/subscription')}
        onRestorePurchases={handleRestorePurchases}
      />

      <RewardedAdOverlay
        visible={!!adEpisode}
        onRewardEarned={claimAdReward}
        onClose={() => setAdEpisode(null)}
      />

      <BottomSheet visible={episodeListVisible} onClose={() => setEpisodeListVisible(false)}>
        <EpisodeListSheet
          seriesTitle={series.title}
          episodes={episodes}
          activeEpisodeId={episodes[activeIndex ?? 0]?.id ?? episodes[0].id}
          onSelect={(index) => {
            goToIndex(index);
            setEpisodeListVisible(false);
          }}
        />
      </BottomSheet>

      <AccountGateSheet />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  notFoundRoot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
