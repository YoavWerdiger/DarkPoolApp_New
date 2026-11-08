import i18n from '../../lib/i18n';
// ============================================
// Media Gallery Viewer — MediaViewer chrome + horizontal paging
// ============================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Modal,
  Image,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from '../../lib/expoAvSafe';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { shareMediaFile } from '../../lib/shareMediaFile';
import { logger } from '../../utils/logger';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';
import { chatPalette as COLORS } from './chatDesignTokens';
import { useDesignTokens } from '../ui/DesignTokens';
import { useMediaZoomGestures } from './useMediaZoomGestures';
import { MediaBlurBackdrop, MediaViewerChrome } from './MediaViewerChrome';

export interface MediaGalleryItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  caption?: string;
  /** תמונה שכבר נטענה (הגריד בצ'אט) — מוצגת מיד עד שהמלאה נטענת */
  previewUrl?: string;
}

interface MediaGalleryViewerProps {
  visible: boolean;
  onClose: () => void;
  mediaItems: MediaGalleryItem[];
  initialIndex?: number;
  senderName?: string;
  timeLabel?: string;
  /** «השב» — לפריט המוצג כרגע (כמו בצופה הבודד) */
  onReply?: (item: MediaGalleryItem) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function isDisplayableMediaUri(u: string | null | undefined): u is string {
  return !!u && (u.startsWith('http') || u.startsWith('file:') || u.startsWith('content:'));
}

/** תמונה בעמוד הנוכחי — המחוות (זום / החלקה / משיכה לסגירה) אצל הצופה, על כל עמוד */
function GalleryImagePage({ url, previewUrl }: { url: string; previewUrl?: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // כתובת חדשה (נתיב → URL חתום) — מתחילים טעינה נקייה; שגיאה מכתובת קודמת לא נשארת
  const displayable = isDisplayableMediaUri(url);
  useEffect(() => {
    setLoadError(false);
    setIsLoading(true);
  }, [url]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {(isLoading || !displayable) && !loadError && previewUrl && isDisplayableMediaUri(previewUrl) ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={{ uri: previewUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        </View>
      ) : null}
      {(isLoading || !displayable) && !loadError && !previewUrl && (
        <View style={styles.loadingContainer} pointerEvents="none">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
      {loadError ? (
        <View style={styles.mediaErrorContainer}>
          <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.mediaErrorText}>{i18n.t('auto.components__chat__MediaGalleryViewer.s1')}</Text>
          <TouchableOpacity
            style={styles.mediaErrorRetry}
            onPress={() => {
              setLoadError(false);
              setIsLoading(true);
            }}
          >
            <Text style={styles.mediaErrorRetryText}>{i18n.t('auto.components__chat__MediaGalleryViewer.s2')}</Text>
          </TouchableOpacity>
        </View>
      ) : !displayable ? null : (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setLoadError(true);
          }}
        />
      )}
    </View>
  );
}

export default function MediaGalleryViewer({
  visible,
  onClose,
  mediaItems,
  initialIndex = 0,
  senderName,
  timeLabel,
  onReply,
}: MediaGalleryViewerProps) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromeOpacity = useSharedValue(1);
  const videoRef = useRef<Video>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const isMountedRef = useRef(true);
  const isDraggingRef = useRef(false);
  const lastSeekTargetRef = useRef<number | null>(null);
  const positionRef = useRef(0);

  const durationVal = useSharedValue(0);
  const timelineWidthVal = useSharedValue(0);
  const startPositionVal = useSharedValue(0);
  const positionShared = useSharedValue(0);

  const mediaSignature = mediaItems.map((m) => `${m.id}:${m.url}`).join('|');
  const currentItem = mediaItems[currentIndex];
  const displayPosition = isDragging ? dragPosition : position;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // רק בפתיחה / שינוי הפריט שנלחץ — לא כשנטען עמוד נוסף ברקע (אחרת קופץ חזרה לפריט שנלחץ)
  const itemCountRef = useRef(mediaItems.length);
  itemCountRef.current = mediaItems.length;
  useEffect(() => {
    if (!visible) return;
    const safeIndex = Math.max(0, Math.min(initialIndex, Math.max(itemCountRef.current - 1, 0)));
    setCurrentIndex(safeIndex);
    setPosition(0);
    setDuration(0);
  }, [visible, initialIndex]);

  useEffect(() => {
    if (!visible || mediaItems.length === 0) return;
    let cancelled = false;

    const signIds = async (ids: string[]) => {
      const next: Record<string, string> = {};
      await Promise.all(
        ids.map(async (id) => {
          const item = mediaItems.find((m) => m.id === id);
          if (!item) return;
          const u = await getChatMediaDisplayUri(item.url);
          next[id] = u || item.url;
        })
      );
      if (!cancelled && Object.keys(next).length) {
        setSignedUrls((prev) => ({ ...prev, ...next }));
      }
    };

    const center = Math.max(0, Math.min(initialIndex, mediaItems.length - 1));
    const priority = mediaItems
      .slice(Math.max(0, center - 2), Math.min(mediaItems.length, center + 3))
      .map((m) => m.id);
    const rest = mediaItems.map((m) => m.id).filter((id) => !priority.includes(id));

    void (async () => {
      await signIds(priority);
      if (!cancelled && rest.length) await signIds(rest);
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, mediaSignature, initialIndex]);

  // מעבר עמוד / סגירה: איפוס הנגן; סרטון מתחיל לבד (כמו בוואטסאפ)
  const autoplayAtRef = useRef(0);
  useEffect(() => {
    const autoplay = visible && mediaItems[currentIndex]?.type === 'video';
    if (autoplay) autoplayAtRef.current = Date.now();
    setIsPlaying(autoplay);
    setPosition(0);
    setDuration(0);
    setVideoError(false);
    positionShared.value = 0;
    if (videoRef.current) {
      videoRef.current.pauseAsync().catch(() => {});
    }
  }, [currentIndex, visible]);

  useEffect(() => {
    if (!visible && videoRef.current) {
      videoRef.current.stopAsync().catch(() => {});
      videoRef.current.unloadAsync().catch(() => {});
      setIsPlaying(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!isDragging) {
      positionShared.value = withTiming(position, { duration: 120 });
    }
  }, [position, isDragging]);

  useEffect(() => {
    durationVal.value = duration;
    timelineWidthVal.value = timelineWidth;
  }, [duration, timelineWidth]);

  positionRef.current = position;
  isDraggingRef.current = isDragging;

  const resolveUri = useCallback(
    (item: MediaGalleryItem) => signedUrls[item.id] || item.url,
    [signedUrls]
  );

  const formatTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  const handleSeek = useCallback((positionSeconds: number) => {
    lastSeekTargetRef.current = positionSeconds;
    const ms = Math.max(0, positionSeconds) * 1000;
    (videoRef.current as any)?.setPositionAsync(ms).then(() => {
      setPosition(positionSeconds);
      lastSeekTargetRef.current = null;
    }).catch(() => {
      lastSeekTargetRef.current = null;
    });
  }, []);

  const recordDragStart = useCallback(() => {
    startPositionVal.value = position;
    positionShared.value = position;
    setDragPosition(position);
    setIsDragging(true);
    isDraggingRef.current = true;
  }, [position]);

  const commitSeek = useCallback(
    (finalPositionSeconds: number) => {
      positionShared.value = finalPositionSeconds;
      setPosition(finalPositionSeconds);
      setIsDragging(false);
      isDraggingRef.current = false;
      handleSeek(finalPositionSeconds);
    },
    [handleSeek]
  );

  const handleTimelineTap = useCallback(
    (x: number) => {
      if (timelineWidth <= 0 || duration <= 0) return;
      const ratio = Math.max(0, Math.min(1, x / timelineWidth));
      const sec = ratio * duration;
      positionShared.value = sec;
      setPosition(sec);
      handleSeek(sec);
    },
    [timelineWidth, duration, handleSeek]
  );

  const timelinePanGesture = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      'worklet';
      runOnJS(recordDragStart)();
    })
    .onUpdate((e) => {
      'worklet';
      const w = timelineWidthVal.value;
      const d = durationVal.value;
      if (w <= 0 || d <= 0) return;
      const newSec = startPositionVal.value + (e.translationX / w) * d;
      const clamped = Math.max(0, Math.min(d, newSec));
      positionShared.value = clamped;
      runOnJS(setDragPosition)(clamped);
    })
    .onEnd((e) => {
      'worklet';
      const w = timelineWidthVal.value;
      const d = durationVal.value;
      if (w <= 0 || d <= 0) {
        runOnJS(commitSeek)(startPositionVal.value);
        return;
      }
      const newSec = startPositionVal.value + (e.translationX / w) * d;
      const clamped = Math.max(0, Math.min(d, newSec));
      runOnJS(commitSeek)(clamped);
    });

  const timelineTapGesture = Gesture.Tap().onEnd((e) => {
    'worklet';
    runOnJS(handleTimelineTap)(e.x);
  });

  const timelineGesture = Gesture.Exclusive(timelinePanGesture, timelineTapGesture);

  const animatedFillStyle = useAnimatedStyle(() => {
    const d = durationVal.value;
    const p = positionShared.value;
    if (d <= 0) return { width: 0 };
    const w = timelineWidthVal.value;
    return { width: w * (p / d) };
  }, []);

  const animatedThumbStyle = useAnimatedStyle(() => {
    const d = durationVal.value;
    const p = positionShared.value;
    if (d <= 0) return { left: -7 };
    const w = timelineWidthVal.value;
    return { left: w * (p / d) - 7 };
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    const next = !isPlaying;
    setIsPlaying(next);
    if (next) (videoRef.current as any).playAsync?.();
    else (videoRef.current as any).pauseAsync?.();
  }, [isPlaying]);

  // פייג'ר במחוות (לא ScrollView אופקי): ב-Android עם forceRTL ה-offset של ScrollView מתהפך —
  // העמוד שעל המסך ≠ currentIndex (מסך שחור בסרטון, פריט אחר נפתח, סאונד «מתוך תמונה»).
  // כמו MediaPreviewModal: עמוד אחד חי + שכנים צמודים שנעים עם האצבע.
  const goToNeighbor = useCallback(
    (direction: 1 | -1) => {
      setCurrentIndex((i) => Math.max(0, Math.min(mediaItems.length - 1, i + direction)));
    },
    [mediaItems.length],
  );

  const toggleChrome = useCallback(() => setChromeVisible((open) => !open), []);

  const { zoomGesture, animatedStyle, backdropStyle, prevPagerStyle, nextPagerStyle } = useMediaZoomGestures({
    resetKey: visible ? `${currentIndex}:${currentItem?.id ?? ''}` : false,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    onSingleTap: toggleChrome,
    onSwipeDismiss: onClose,
    // RTL: הבא משמאל — אצבע זזה ימינה = הבא
    onSwipeHorizontal: mediaItems.length > 1 ? goToNeighbor : undefined,
    canSwipeNext: currentIndex < mediaItems.length - 1,
    canSwipePrev: currentIndex > 0,
  });

  useEffect(() => {
    if (visible) setChromeVisible(true);
  }, [visible]);

  useEffect(() => {
    chromeOpacity.value = withTiming(chromeVisible ? 1 : 0, { duration: 180 });
  }, [chromeVisible, chromeOpacity]);

  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeOpacity.value }));

  const handleShare = async () => {
    if (!currentItem) return;
    try {
      // קובץ אמיתי (לא קישור ל-bucket)
      await shareMediaFile(currentItem.url || resolveUri(currentItem), { kind: currentItem.type });
    } catch (error) {
      logger.error('MediaGalleryViewer', 'Share failed', error);
    }
  };

  const renderCurrent = (item: MediaGalleryItem) => {
    const uri = resolveUri(item);

    if (item.type === 'video') {
      return (
        <View style={[StyleSheet.absoluteFill, styles.videoPage]}>
          {!isDisplayableMediaUri(uri) && !videoError && (
            <View style={styles.loadingContainer} pointerEvents="none">
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}
          {videoError ? (
            <View style={styles.mediaErrorContainer}>
              <Ionicons name="videocam-outline" size={64} color="rgba(255,255,255,0.3)" />
              <Text style={styles.mediaErrorText}>{i18n.t('auto.components__chat__MediaGalleryViewer.s3')}</Text>
            </View>
          ) : isDisplayableMediaUri(uri) ? (
            <Video
              ref={videoRef}
              source={{ uri }}
              style={styles.fullMedia}
              useNativeControls={false}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={isPlaying}
              pointerEvents="none"
              onPlaybackStatusUpdate={(status) => {
                if (!isMountedRef.current || !status?.isLoaded) return;
                if (status.durationMillis != null) setDuration(status.durationMillis / 1000);
                if (!isDraggingRef.current) {
                  const reported = (status.positionMillis ?? 0) / 1000;
                  const target = lastSeekTargetRef.current;
                  if (target == null) {
                    setPosition(reported);
                  } else if (Math.abs(reported - target) < 0.5) {
                    lastSeekTargetRef.current = null;
                    setPosition(reported);
                  }
                }
                if (status.isPlaying !== undefined) {
                  // ניגון אוטומטי: הדיווח הראשון (readyToPlay) עוד אומר playing=false — לא מבטלים את ההפעלה
                  if (!status.isPlaying && !status.didJustFinish && Date.now() - autoplayAtRef.current < 1500) return;
                  setIsPlaying(status.isPlaying);
                }
              }}
              onLoad={() => {
                (videoRef.current as any)?.setStatusAsync?.({ progressUpdateIntervalMillis: 100 });
              }}
              onError={() => {
                setVideoError(true);
              }}
            />
          ) : null}
        </View>
      );
    }

    return <GalleryImagePage key={item.id} url={uri} previewUrl={item.previewUrl} />;
  };

  /** שכן (קודם/הבא) צמוד לצד המסך — נע יחד עם הגרירה; סרטון: רקע שחור + סמל ניגון */
  const renderNeighbor = (item: MediaGalleryItem | undefined, pagerStyle: typeof prevPagerStyle) => {
    if (!item) return null;
    const uri = item.type === 'image' ? resolveUri(item) : null;
    const preview = item.previewUrl && isDisplayableMediaUri(item.previewUrl) ? item.previewUrl : null;
    const src = isDisplayableMediaUri(uri) ? uri : preview;
    return (
      <Animated.View pointerEvents="none" style={[styles.neighbor, pagerStyle]}>
        {item.type === 'video' ? (
          <View style={[StyleSheet.absoluteFill, styles.videoPage, styles.neighborVideo]}>
            <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.7)" />
          </View>
        ) : src ? (
          <Image source={{ uri: src }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        ) : null}
      </Animated.View>
    );
  };

  if (!visible || !mediaItems || mediaItems.length === 0) return null;

  const caption = currentItem?.caption?.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.stage}>
          <MediaBlurBackdrop
            uri={currentItem?.type === 'image' && isDisplayableMediaUri(resolveUri(currentItem)) ? resolveUri(currentItem) : undefined}
            style={backdropStyle}
          />
          {renderNeighbor(mediaItems[currentIndex - 1], prevPagerStyle)}
          {renderNeighbor(mediaItems[currentIndex + 1], nextPagerStyle)}
          {currentItem ? (
            <GestureDetector gesture={zoomGesture}>
              <Animated.View style={styles.fullMedia} collapsable={false}>
                <Animated.View key={currentItem.id} style={[StyleSheet.absoluteFill, animatedStyle]}>
                  {renderCurrent(currentItem)}
                </Animated.View>
              </Animated.View>
            </GestureDetector>
          ) : null}
        </View>

        <MediaViewerChrome
          chromeStyle={chromeStyle}
          pointerEvents={chromeVisible ? 'box-none' : 'none'}
          paddingTop={insets.top + 12}
          paddingBottom={insets.bottom + 12}
          caption={caption}
          counter={mediaItems.length > 1 ? `${currentIndex + 1} / ${mediaItems.length}` : undefined}
          onClose={onClose}
          title={senderName}
          timeLabel={timeLabel}
          onReply={onReply && currentItem ? () => onReply(currentItem) : undefined}
          onShare={() => { void handleShare(); }}
          videoSlot={currentItem?.type === 'video' ? (
            <View style={styles.videoControlsRow}>
              <TouchableOpacity
                style={[styles.videoPlayBtn, { backgroundColor: tokens.colors.background.cardSolid }]}
                onPress={togglePlayPause}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={tokens.colors.text.primary} />
              </TouchableOpacity>
              <Text style={styles.videoTimeText}>{formatTime(displayPosition)}</Text>
              <GestureDetector gesture={timelineGesture}>
                <View
                  style={styles.timelineTrack}
                  onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}
                >
                  <View style={styles.timelineTrackBg} />
                  <Animated.View style={[styles.timelineFill, animatedFillStyle]} />
                  <Animated.View style={[styles.timelineThumb, animatedThumbStyle]} />
                </View>
              </GestureDetector>
              <Text style={styles.videoTimeText}>{formatTime(duration)}</Text>
            </View>
          ) : null}
        />
      </GestureHandlerRootView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    overflow: 'hidden',
  },
  neighbor: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  neighborVideo: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPage: {
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fullMedia: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  mediaErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  mediaErrorText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    textAlign: 'center',
  },
  mediaErrorRetry: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  mediaErrorRetryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBlur: {
    width: '100%',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  topContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  topSpacer: {
    flex: 1,
  },
  counter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomBlur: {
    width: '100%',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  videoControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  videoPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTimeText: {
    color: COLORS.text,
    fontSize: 12,
    minWidth: 36,
    textAlign: 'center',
  },
  timelineTrack: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  timelineFill: {
    position: 'absolute',
    left: 0,
    top: 7,
    height: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  timelineThumb: {
    position: 'absolute',
    top: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.text,
    marginLeft: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  timelineTrackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 7,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  captionContainer: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  captionText: {
    color: COLORS.text,
    fontSize: 15,
    textAlign: 'right',
    lineHeight: 22,
    opacity: 0.9,
  },
});
