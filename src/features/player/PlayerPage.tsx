import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent, useEventListener } from 'expo';
import { colors, typography } from '@/theme';
import { VideoControls } from '@/components/media/VideoControls';
import type { Episode } from '@/types';
import { useLibraryStore, useSettingsStore } from '@/store';
import { useTranslation } from '@/i18n/useTranslation';
import type { TranslationKey } from '@/i18n/translations';
import { fetchPlayback, isGrantFresh, type PlaybackErrorCode, type PlaybackGrant } from '@/services/playback';
import { WatermarkOverlay } from './WatermarkOverlay';
import { attachHls, needsHlsJs, renderedVideoSize, type HlsAttachment } from './hlsBridge';

const SPEED_STEPS = [1, 1.25, 1.5, 2, 0.75];
const AUTOPLAY_COUNTDOWN_SEC = 5;
/** Automatic re-fetches of a fresh signed URL after a playback error, before giving up. */
const MAX_SOURCE_RETRIES = 2;
/** First automatic retry waits this long; each further one doubles it. */
const RETRY_BASE_DELAY_MS = 1500;
/** Seconds of real playback after which a source counts as working again. */
const HEALTHY_PLAYBACK_SEC = 3;
/** Wider than tall by more than this counts as landscape (letterboxed, rotate offered). */
const LANDSCAPE_MIN_RATIO = 1.05;

const NOTICE_KEYS: Partial<Record<PlaybackErrorCode, TranslationKey>> = {
  unavailable: 'player.videoUnavailable',
  rate_limited: 'player.tryAgainLater',
  blocked: 'player.tryAgainLater',
  budget: 'player.tryAgainLater',
};

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
  /** The active page entered/left the rotated landscape view (the pager stops swiping meanwhile). */
  onLandscapeChange?: (landscape: boolean) => void;
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
  onLandscapeChange,
}: PlayerPageProps) {
  const setProgress = useLibraryStore((s) => s.setProgress);
  const recordHistory = useLibraryStore((s) => s.recordHistory);
  const autoplayNextEpisode = useSettingsStore((s) => s.autoplayNextEpisode);
  const defaultSubtitlesEnabled = useSettingsStore((s) => s.subtitlesEnabled);
  const { t } = useTranslation();

  const [controlsVisible, setControlsVisible] = useState(true);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(defaultSubtitlesEnabled);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  /** Picture size reported by the player once decoding; trusted over the stored size. */
  const [renderedSize, setRenderedSize] = useState<{ width: number; height: number } | null>(null);
  /** Landscape videos can be watched rotated 90 degrees to fill the screen (in-app, so the watermark stays). */
  const [landscapeMode, setLandscapeMode] = useState(false);
  const hasResumedRef = useRef(false);
  const hasRecordedHistoryRef = useRef(false);
  const lockedNotifiedRef = useRef(false);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Signed playback URL from the backend (playback-token). Only requested when
  // this page is the active one — neighbouring pages don't preload, since
  // every buffered second is billed and counts toward the rate limit.
  const [grant, setGrant] = useState<PlaybackGrant | null>(null);
  const [playbackError, setPlaybackError] = useState<PlaybackErrorCode | null>(null);
  const loadingSourceRef = useRef(false);
  /** Set when a new source is loading: seek target (or null), cleared (undefined) once ready. */
  const pendingSeekRef = useRef<number | null | undefined>(undefined);
  const sourceRetriesRef = useRef(0);
  /** Position when the current source became ready; cleared once it has played a few seconds. */
  const healthAnchorRef = useRef<number | null>(null);
  const lastPositionRef = useRef(0);
  /** hls.js instance on web browsers without native HLS (see hlsBridge.web.ts). */
  const hlsRef = useRef<HlsAttachment | null>(null);
  const retryAfterErrorRef = useRef<() => void>(() => {});
  const isActiveRef = useRef(isActive);
  const onLockedRef = useRef(onLocked);
  const onLandscapeChangeRef = useRef(onLandscapeChange);
  useEffect(() => {
    isActiveRef.current = isActive;
    onLockedRef.current = onLocked;
    onLandscapeChangeRef.current = onLandscapeChange;
  });

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.4;
  });

  /** Fetches a (fresh) signed URL and loads it, resuming at `resumeAt` seconds. */
  const loadSource = useCallback(
    async (resumeAt: number | null, force: boolean) => {
      if (loadingSourceRef.current) return;
      loadingSourceRef.current = true;
      const result = await fetchPlayback(episode.id, { force });
      loadingSourceRef.current = false;
      if (!result.ok) {
        setPlaybackError(result.code);
        // The server is the authority: if it says locked, show the paywall.
        if (result.code === 'not_entitled') onLockedRef.current();
        return;
      }
      setPlaybackError(null);
      setGrant(result.grant);
      pendingSeekRef.current = resumeAt;

      if (needsHlsJs()) {
        // Browser can't play HLS itself: hls.js feeds the mounted <video>.
        hlsRef.current?.destroy();
        hlsRef.current = null;
        try {
          hlsRef.current = await attachHls(player, result.grant.hlsUrl, () => retryAfterErrorRef.current());
        } catch (err) {
          console.warn('hls.js attach failed', err);
          setPlaybackError('server_error');
          return;
        }
        if (isActiveRef.current) player.play();
        return;
      }

      player.replace({ uri: result.grant.hlsUrl, contentType: 'hls' }, true);
      // On web, replace() already starts playback; a second play() would race
      // the load. Native keeps the previous paused state, so start it here.
      if (Platform.OS !== 'web' && isActiveRef.current) player.play();
    },
    [episode.id, player]
  );

  /**
   * Most often an expired token (paused > 15 min): get a new URL and continue
   * where we were. Backs off between attempts, and the attempt count only
   * resets after real playback (see the progress effect) — a source that loads
   * but can't play must not turn into a request loop (it would also trip the
   * server's rate limit and block the account).
   */
  const retryAfterError = useCallback(() => {
    if (!isUnlocked) return;
    if (sourceRetriesRef.current < MAX_SOURCE_RETRIES) {
      sourceRetriesRef.current += 1;
      const delayMs = RETRY_BASE_DELAY_MS * 2 ** (sourceRetriesRef.current - 1);
      setTimeout(() => {
        if (isActiveRef.current) loadSource(lastPositionRef.current || null, true);
      }, delayMs);
    } else {
      setPlaybackError('network_error');
    }
  }, [isUnlocked, loadSource]);

  useEffect(() => {
    retryAfterErrorRef.current = retryAfterError;
  });

  useEffect(() => () => hlsRef.current?.destroy(), []);

  useEventListener(player, 'statusChange', ({ status: next }) => {
    if (next === 'readyToPlay') {
      const justLoaded = pendingSeekRef.current !== undefined;
      if (justLoaded) healthAnchorRef.current = pendingSeekRef.current ?? 0;
      if (pendingSeekRef.current !== null && pendingSeekRef.current !== undefined) {
        player.currentTime = pendingSeekRef.current;
      }
      pendingSeekRef.current = undefined;
      // Start (again) once the new source can play. On web, React re-applies
      // the <video src> after replace(), which reloads the element and drops
      // the play() that replace() issued — while player.playing still says
      // true. play() is idempotent, so just call it.
      if (justLoaded && isActiveRef.current) player.play();
    } else if (next === 'error') {
      retryAfterError();
    }
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
  const buffering = isUnlocked && !playbackError && (status === 'loading' || (isActive && !grant));

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
      if (!isGrantFresh(grant)) {
        let resumeAt: number | null = lastPositionRef.current || null;
        if (!hasResumedRef.current) {
          hasResumedRef.current = true;
          const saved = useLibraryStore.getState().getProgress(episode.id);
          if (saved && saved.positionSec > 0 && !saved.completed) {
            resumeAt = saved.positionSec;
          }
        }
        loadSource(resumeAt, grant !== null);
      } else {
        player.play();
      }
      if (!hasRecordedHistoryRef.current) {
        hasRecordedHistoryRef.current = true;
        recordHistory(episode.id, seriesId);
      }
    } else {
      player.pause();
      setNextCountdown(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isUnlocked]);

  useEffect(() => {
    if (!isActive || !isUnlocked) return;
    if (currentTime > 0) lastPositionRef.current = currentTime;
    const anchor = healthAnchorRef.current;
    if (anchor !== null && currentTime >= anchor + HEALTHY_PLAYBACK_SEC) {
      sourceRetriesRef.current = 0;
      healthAnchorRef.current = null;
    }
    if (!renderedSize && currentTime > 0) {
      const size = renderedVideoSize(player);
      if (size) setRenderedSize(size);
    }
    if (currentTime > 0 && duration > 0) {
      setProgress(episode.id, currentTime, duration);
    }
  }, [currentTime, duration, isActive, isUnlocked, episode.id, setProgress, renderedSize, player]);

  // Leaving the page, or losing access, ends the rotated view.
  useEffect(() => {
    if (!isActive || !isUnlocked) setLandscapeMode(false);
  }, [isActive, isUnlocked]);

  useEffect(() => {
    if (isActive) onLandscapeChangeRef.current?.(landscapeMode);
  }, [landscapeMode, isActive]);

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
    if (player.playing) {
      player.pause();
      return;
    }
    // Resuming after an error or after the signed URL expired: fetch a new one.
    if (playbackError || !isGrantFresh(grant)) {
      sourceRetriesRef.current = 0;
      setPlaybackError(null);
      loadSource(lastPositionRef.current || null, true);
      return;
    }
    player.play();
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

  const pictureSize =
    renderedSize ?? (episode.videoWidth && episode.videoHeight ? { width: episode.videoWidth, height: episode.videoHeight } : null);
  const isLandscape = !!pictureSize && pictureSize.width > pictureSize.height * LANDSCAPE_MIN_RATIO;
  // Rotated 90 degrees: a box as wide as the page is tall, centred, so it fills the screen sideways.
  const frameStyle = landscapeMode
    ? {
        position: 'absolute' as const,
        width: height,
        height: width,
        left: (width - height) / 2,
        top: (height - width) / 2,
        transform: [{ rotate: '90deg' }],
      }
    : StyleSheet.absoluteFill;
  // Just under the letterboxed picture.
  const pictureHeight = pictureSize ? Math.min(height, (width * pictureSize.height) / pictureSize.width) : 0;
  const landscapeButtonTop = Math.min(height - 120, height / 2 + pictureHeight / 2 + 14);

  return (
    <View style={{ width, height, backgroundColor: colors.black }}>
      {isUnlocked ? (
        <View style={frameStyle}>
          <VideoView
            style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
            player={player}
            contentFit={isLandscape ? 'contain' : 'cover'}
            nativeControls={false}
            allowsPictureInPicture={false}
          />
          {grant && <WatermarkOverlay code={grant.watermarkCode} />}
          {landscapeMode && (
            <>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={togglePlay}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? t('player.pauseVideo') : t('player.playVideo')}
              />
              {!isPlaying && (
                <View style={[StyleSheet.absoluteFill, styles.centered, { pointerEvents: 'none' }]}>
                  <Ionicons name="play" size={44} color="rgba(255,255,255,0.85)" />
                </View>
              )}
              <Pressable
                style={styles.exitLandscape}
                onPress={() => setLandscapeMode(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('player.exitLandscape')}
              >
                <Ionicons name="contract-outline" size={20} color={colors.white} />
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <LockedPoster episodeNumber={episode.number} episodeTitle={episode.title} lockedTitle={t('player.lockedTitle', { number: episode.number })} />
      )}

      {isUnlocked && playbackError && playbackError !== 'not_entitled' && (
        <View style={[StyleSheet.absoluteFill, styles.noticeWrap, { pointerEvents: 'none' }]}>
          <Ionicons name="time-outline" size={28} color={colors.textTertiary} />
          <Text style={styles.noticeText}>{t(NOTICE_KEYS[playbackError] ?? 'player.loadFailed')}</Text>
        </View>
      )}

      {!landscapeMode && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setControlsVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t('player.pauseVideo') : t('player.playVideo')}
        />
      )}

      {isUnlocked && !landscapeMode && subtitlesEnabled && (
        <View style={[styles.subtitleWrap, { bottom: height * 0.18, pointerEvents: 'none' }]}>
          <Text style={styles.subtitleText}>{t('player.subtitlePlaceholder')}</Text>
        </View>
      )}

      {isUnlocked && !landscapeMode && (
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

      {isUnlocked && isLandscape && !landscapeMode && grant && !playbackError && (
        <Pressable
          style={[styles.landscapeButton, { top: landscapeButtonTop }]}
          onPress={() => setLandscapeMode(true)}
          accessibilityRole="button"
          accessibilityLabel={t('player.watchLandscape')}
        >
          <Ionicons name="phone-landscape-outline" size={16} color={colors.white} />
          <Text style={styles.landscapeButtonText}>{t('player.watchLandscape')}</Text>
        </Pressable>
      )}
    </View>
  );
}

function LockedPoster({ lockedTitle, episodeTitle }: { episodeNumber: number; episodeTitle: string; lockedTitle: string }) {
  return (
    <LinearGradient colors={['#241A2C', '#120E17']} style={styles.lockedRoot}>
      <View style={styles.lockedIconCircle}>
        <Ionicons name="lock-closed" size={28} color={colors.gold} />
      </View>
      <Text style={styles.lockedTitle}>{lockedTitle}</Text>
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
  noticeWrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  landscapeButton: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  landscapeButtonText: { ...typography.caption, color: colors.white, fontWeight: '600' },
  exitLandscape: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  noticeText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
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
