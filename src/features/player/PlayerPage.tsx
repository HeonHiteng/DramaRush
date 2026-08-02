import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent, useEventListener } from 'expo';
import { colors, typography } from '@/theme';
import { VideoControls } from '@/components/media/VideoControls';
import type { Episode } from '@/types';
import { useLibraryStore, useSettingsStore } from '@/store';

const SPEED_STEPS = [1, 1.25, 1.5, 2, 0.75];
const AUTOPLAY_COUNTDOWN_SEC = 5;

interface PlayerPageProps {
  episode: Episode;
  seriesId: string;
  seriesTitle: string;
  totalEpisodes: number;
  width: number;
  height: number;
  isActive: boolean;
  isUnlocked: boolean;
  isFavorite: boolean;
  hasNext: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
  onOpenEpisodeList: () => void;
  onClose: () => void;
  onLocked: () => void;
  onAutoAdvance: () => void;
}

export function PlayerPage({
  episode,
  seriesId,
  seriesTitle,
  totalEpisodes,
  width,
  height,
  isActive,
  isUnlocked,
  isFavorite,
  hasNext,
  onToggleFavorite,
  onShare,
  onOpenEpisodeList,
  onClose,
  onLocked,
  onAutoAdvance,
}: PlayerPageProps) {
  const setProgress = useLibraryStore((s) => s.setProgress);
  const recordHistory = useLibraryStore((s) => s.recordHistory);
  const autoplayNextEpisode = useSettingsStore((s) => s.autoplayNextEpisode);
  const defaultSubtitlesEnabled = useSettingsStore((s) => s.subtitlesEnabled);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(defaultSubtitlesEnabled);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const hasResumedRef = useRef(false);
  const hasRecordedHistoryRef = useRef(false);
  const lockedNotifiedRef = useRef(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const player = useVideoPlayer(isUnlocked ? episode.videoUri : null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.4;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  const duration = player.duration || episode.durationSec;
  const buffering = isUnlocked && status === 'loading';

  useEventListener(player, 'playToEnd', () => {
    if (!hasNext) return;
    if (!autoplayNextEpisode) return;
    setNextCountdown(AUTOPLAY_COUNTDOWN_SEC);
  });

  useEffect(() => {
    if (!isUnlocked) {
      if (isActive && !lockedNotifiedRef.current) {
        lockedNotifiedRef.current = true;
        onLocked();
      }
      return;
    }
    lockedNotifiedRef.current = false;

    if (isActive) {
      if (!hasResumedRef.current) {
        hasResumedRef.current = true;
        const saved = useLibraryStore.getState().getProgress(episode.id);
        if (saved && saved.positionSec > 0 && !saved.completed) {
          player.currentTime = saved.positionSec;
        }
      }
      if (!hasRecordedHistoryRef.current) {
        hasRecordedHistoryRef.current = true;
        recordHistory(episode.id, seriesId);
      }
      player.play();
    } else {
      player.pause();
      setNextCountdown(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isUnlocked]);

  useEffect(() => {
    if (!isActive || !isUnlocked) return;
    if (currentTime > 0 && duration > 0) {
      setProgress(episode.id, currentTime, duration);
    }
  }, [currentTime, duration, isActive, isUnlocked, episode.id, setProgress]);

  useEffect(() => {
    if (nextCountdown === null) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }
    if (nextCountdown <= 0) {
      onAutoAdvance();
      setNextCountdown(null);
      return;
    }
    countdownTimerRef.current = setInterval(() => {
      setNextCountdown((c) => (c === null ? null : c - 1));
    }, 1000);
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [nextCountdown, onAutoAdvance]);

  const togglePlay = () => {
    if (!isUnlocked) return;
    if (player.playing) player.pause();
    else player.play();
  };

  const cycleSpeed = () => {
    const next = (speedIndex + 1) % SPEED_STEPS.length;
    setSpeedIndex(next);
    player.playbackRate = SPEED_STEPS[next];
  };

  const toggleMute = () => {
    setIsMuted((m) => {
      player.muted = !m;
      return !m;
    });
  };

  const handleSeek = (ratio: number) => {
    if (duration > 0) player.currentTime = ratio * duration;
  };

  return (
    <View style={{ width, height, backgroundColor: colors.black }}>
      {isUnlocked ? (
        <VideoView
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
          player={player}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      ) : (
        <LockedPoster episodeNumber={episode.number} episodeTitle={episode.title} />
      )}

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setControlsVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
      />

      {isUnlocked && subtitlesEnabled && (
        <View style={[styles.subtitleWrap, { bottom: height * 0.18, pointerEvents: 'none' }]}>
          <Text style={styles.subtitleText}>[ Prototype subtitles placeholder ]</Text>
        </View>
      )}

      {isUnlocked && (
        <VideoControls
          visible={controlsVisible}
          seriesTitle={seriesTitle}
          episodeTitle={episode.title}
          episodeNumber={episode.number}
          totalEpisodes={totalEpisodes}
          isPlaying={isPlaying}
          positionSec={currentTime}
          durationSec={duration}
          buffering={buffering}
          isFavorite={isFavorite}
          subtitlesEnabled={subtitlesEnabled}
          playbackSpeed={SPEED_STEPS[speedIndex]}
          isMuted={isMuted}
          nextCountdown={nextCountdown}
          onTogglePlay={togglePlay}
          onClose={onClose}
          onToggleFavorite={onToggleFavorite}
          onShare={onShare}
          onOpenEpisodeList={onOpenEpisodeList}
          onToggleSubtitles={() => setSubtitlesEnabled((v) => !v)}
          onCycleSpeed={cycleSpeed}
          onToggleMute={toggleMute}
          onSeek={handleSeek}
          onCancelCountdown={() => setNextCountdown(null)}
        />
      )}
    </View>
  );
}

function LockedPoster({ episodeNumber, episodeTitle }: { episodeNumber: number; episodeTitle: string }) {
  return (
    <LinearGradient colors={['#241A2C', '#120E17']} style={styles.lockedRoot}>
      <View style={styles.lockedIconCircle}>
        <Ionicons name="lock-closed" size={28} color={colors.gold} />
      </View>
      <Text style={styles.lockedTitle}>Episode {episodeNumber} is locked</Text>
      <Text style={styles.lockedSubtitle} numberOfLines={2}>
        {episodeTitle}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  lockedRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  lockedIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(244,185,66,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lockedTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 6 },
  lockedSubtitle: { ...typography.body, color: colors.textTertiary, textAlign: 'center' },
  subtitleWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  subtitleText: {
    ...typography.bodyMedium,
    color: colors.white,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    textAlign: 'center',
  },
});
