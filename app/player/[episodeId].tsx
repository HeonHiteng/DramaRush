import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PaywallSheet } from '@/components/ui/PaywallSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlayerPage } from '@/features/player/PlayerPage';
import { RewardedAdOverlay } from '@/features/player/RewardedAdOverlay';
import { EpisodeListSheet } from '@/features/player/EpisodeListSheet';
import { useEpisodeById, useEpisodesForSeries, useSeriesById } from '@/services/content';
import { useLibraryStore, useSubscriptionStore, useWalletStore } from '@/store';
import { goBack } from '@/utils/navigation';
import type { Episode } from '@/types';

export default function PlayerScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  return <PlayerScreenInner episodeId={episodeId} />;
}

function PlayerScreenInner({ episodeId }: { episodeId: string }) {
  const { data: initialEpisode, isLoading: episodeLoading } = useEpisodeById(episodeId);
  const { data: series, isLoading: seriesLoading } = useSeriesById(initialEpisode?.seriesId);
  const { data: episodes = [], isLoading: episodesLoading } = useEpisodesForSeries(initialEpisode?.seriesId);
  const initialIndex = Math.max(0, episodes.findIndex((e) => e.id === episodeId));

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [episodeListVisible, setEpisodeListVisible] = useState(false);
  const [paywallEpisode, setPaywallEpisode] = useState<Episode | null>(null);
  const [adEpisode, setAdEpisode] = useState<Episode | null>(null);
  const listRef = useRef<FlatList<Episode>>(null);

  const isFavorite = useLibraryStore((s) => (series ? s.isFavorite(series.id) : false));
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const unlockedEpisodeIds = useLibraryStore((s) => s.unlockedEpisodeIds);
  const unlockEpisodeWithCoins = useLibraryStore((s) => s.unlockEpisodeWithCoins);
  const redeemAdReward = useLibraryStore((s) => s.redeemAdReward);
  const balance = useWalletStore((s) => s.balance);
  const isSubscriber = useSubscriptionStore((s) => s.isActive);

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
        <EmptyState icon="alert-circle-outline" title="Episode not found" actionLabel="Go Back" onAction={() => goBack()} />
      </View>
    );
  }

  const goToIndex = (index: number) => {
    if (index < 0 || index >= episodes.length || containerSize.height === 0) return;
    listRef.current?.scrollToOffset({ offset: index * containerSize.height, animated: true });
    setActiveIndex(index);
  };

  const handleShare = () => {
    const message = `Check out "${series.title}" on DramaRush (simulated share).`;
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert('Share', message);
    }
  };

  const handleRestorePurchases = () => {
    const message = 'No previous purchases found for this device (simulated).';
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert('Restore Purchases', message);
    }
  };

  return (
    <View
      style={styles.root}
      onLayout={(e) => setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {containerSize.height > 0 && (
        <FlatList
          ref={listRef}
          data={episodes}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          initialScrollIndex={initialIndex}
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
                onLocked={() => setPaywallEpisode(item)}
                onAutoAdvance={() => goToIndex(index + 1)}
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
        coinBalance={balance}
        isSubscriber={isSubscriber}
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
        onRewardEarned={() => {
          if (adEpisode) redeemAdReward(adEpisode.id);
        }}
        onClose={() => setAdEpisode(null)}
      />

      <BottomSheet visible={episodeListVisible} onClose={() => setEpisodeListVisible(false)}>
        <EpisodeListSheet
          seriesTitle={series.title}
          episodes={episodes}
          activeEpisodeId={episodes[activeIndex]?.id ?? episodes[0].id}
          onSelect={(index) => {
            goToIndex(index);
            setEpisodeListVisible(false);
          }}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  notFoundRoot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
