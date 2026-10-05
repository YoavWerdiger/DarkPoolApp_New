// ============================================
// Media Gallery Viewer — MediaViewer chrome + horizontal paging
// ============================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Modal,
  FlatList,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Share as RNShare,
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
import { logger } from '../../utils/logger';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';
import { chatPalette as COLORS } from './chatDesignTokens';
import { useMediaZoomGestures } from './useMediaZoomGestures';
import { MediaBlurBackdrop, MediaViewerChrome } from './MediaViewerChrome';

export interface MediaGalleryItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  caption?: string;
}

interface MediaGalleryViewerProps {
  visible: boolean;
  onClose: () => void;
  mediaItems: MediaGalleryItem[];
  initialIndex?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function isDisplayableMediaUri(u: string | null | undefined): u is string {
  return !!u && (u.startsWith('http') || u.startsWith('file:') || u.startsWith('content:'));
}

function GalleryImageItem({
  url,
  isActive,
  onZoomChange,
  onSingleTap,
  onSwipeDismiss,
}: {
  url: string;
  isActive: boolean;
  onZoomChange?: (zoomed: boolean) => void;
  onSingleTap?: () => void;
  onSwipeDismiss?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const { zoomGesture, animatedStyle, backdropStyle, resetZoomImmediate } = useMediaZoomGestures({
    resetKey: isActive ? url : false,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    onZoomChange: isActive ? onZoomChange : undefined,
    onSingleTap: isActive ? onSingleTap : undefined,
    onSwipeDismiss: isActive ? onSwipeDismiss : undefined,
  });

  useEffect(() => {
    if (!isActive) {
      resetZoomImmediate();
    }
  }, [isActive, resetZoomImmediate]);

  useEffect(() => {
    if (isDisplayableMediaUri(url)) setIsLoading(false);
  }, [url]);

  return (
    <View style={[styles.page, styles.imagePage]}>
      <MediaBlurBackdrop uri={url} style={backdropStyle} />
      {isLoading && !loadError && (
        <View style={styles.loadingContainer} pointerEvents="none">
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
      {loadError ? (
        <View style={styles.mediaErrorContainer}>
          <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.mediaErrorText}>לא ניתן לטעון את התמונה</Text>
          <TouchableOpacity
            style={styles.mediaErrorRetry}
            onPress={() => {
              setLoadError(false);
              setIsLoading(true);
            }}
          >
            <Text style={styles.mediaErrorRetryText}>נסה שוב</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <GestureDetector gesture={zoomGesture}>
          <Animated.View style={styles.fullMedia} collapsable={false}>
            <Animated.Image
              source={{ uri: url }}
              style={[StyleSheet.absoluteFill, animatedStyle]}
              resizeMode="contain"
              onLoadEnd={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setLoadError(true);
              }}
            />
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

export default function MediaGalleryViewer({
  visible,
  onClose,
  mediaItems,
  initialIndex = 0,
}: MediaGalleryViewerProps) {
  const insets = useSafeAreaInsets();
  const [chromeVisible, setChromeVisible] = useState(true);
  const chromeOpacity = useSharedValue(1);
  const flatListRef = useRef<FlatList>(null);
  const videoRef = useRef<Video>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [isZoomed, setIsZoomed] = useState(false);
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

  useEffect(() => {
    if (!visible) return;
    const safeIndex = Math.max(0, Math.min(initialIndex, Math.max(mediaItems.length - 1, 0)));
    setCurrentIndex(safeIndex);
    setIsZoomed(false);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
  }, [visible, initialIndex, mediaItems.length]);

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

  // Reset video when page changes or modal closes
  useEffect(() => {
    setIsPlaying(false);
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

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (typeof newIndex === 'number' && newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        setIsZoomed(false);
      }
    }
  }, [currentIndex]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

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
      await RNShare.share({ url: resolveUri(currentItem) });
    } catch (error) {
      logger.error('MediaGalleryViewer', 'Share failed', error);
    }
  };

  const handleZoomChange = useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed);
  }, []);

  const renderItem = ({ item, index }: { item: MediaGalleryItem; index: number }) => {
    const uri = resolveUri(item);
    const isActive = index === currentIndex;

    if (item.type === 'video') {
      // Only mount Video for the active page to match single MediaViewer lifecycle
      if (!isActive) {
        return <View style={styles.page} />;
      }

      return (
        <View style={styles.page}>
          {!isDisplayableMediaUri(uri) && !videoError && (
            <View style={styles.loadingContainer} pointerEvents="none">
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}
          {videoError ? (
            <View style={styles.mediaErrorContainer}>
              <Ionicons name="videocam-outline" size={64} color="rgba(255,255,255,0.3)" />
              <Text style={styles.mediaErrorText}>לא ניתן לטעון את הסרטון</Text>
            </View>
          ) : isDisplayableMediaUri(uri) ? (
            <Video
              ref={videoRef}
              source={{ uri }}
              style={styles.fullMedia}
              useNativeControls={false}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={isPlaying}
              onPlaybackStatusUpdate={(status) => {
                if (!isMountedRef.current || !status.isLoaded) return;
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

    return (
      <GalleryImageItem
        url={uri}
        isActive={isActive}
        onZoomChange={isActive ? handleZoomChange : undefined}
        onSingleTap={() => setChromeVisible((open) => !open)}
        onSwipeDismiss={onClose}
      />
    );
  };

  if (!visible || !mediaItems || mediaItems.length === 0) return null;

  const safeInitialIndex = Math.max(0, Math.min(initialIndex, mediaItems.length - 1));
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
        <FlatList
          ref={flatListRef}
          data={mediaItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          // LTR קבוע: בתוך Modal ה-RTL של האפליקציה הופך את הגלילה האופקית, ו-initialScrollIndex
          // לעמוד האחרון נחת מחוץ לתוכן (מסך שקוף)
          style={styles.pager}
          horizontal
          pagingEnabled
          scrollEnabled={!isZoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={safeInitialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={Math.min(mediaItems.length, 10)}
          windowSize={5}
          maxToRenderPerBatch={3}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => flatListRef.current?.scrollToOffset({ offset: index * SCREEN_WIDTH, animated: false }), 50);
          }}
        />

        <MediaViewerChrome
          chromeStyle={chromeStyle}
          pointerEvents={chromeVisible ? 'box-none' : 'none'}
          paddingTop={insets.top + 12}
          paddingBottom={insets.bottom + 12}
          caption={caption}
          counter={mediaItems.length > 1 ? `${currentIndex + 1} / ${mediaItems.length}` : undefined}
          onClose={onClose}
          onShare={() => { void handleShare(); }}
          videoSlot={currentItem?.type === 'video' ? (
            <View style={styles.videoControlsRow}>
              <TouchableOpacity style={styles.videoPlayBtn} onPress={togglePlayPause}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color={COLORS.text} />
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
  pager: {
    flex: 1,
    direction: 'ltr',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  imagePage: {
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
    backgroundColor: COLORS.glass,
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
