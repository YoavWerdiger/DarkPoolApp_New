import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator, Animated as RNAnimated,
  Keyboard, ScrollView, TouchableOpacity, TextInput, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { initialWindowMetrics, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { X, Play, Pause } from 'lucide-react-native';
import { Audio, Video, ResizeMode } from '../../lib/expoAvSafe';
import { MediaFile } from '../../services/mediaService';
import { logger } from '../../utils/logger';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';
import { useTheme } from '../../context/ThemeContext';

interface MediaPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (mediaFiles: MediaFile[], captions: Record<string, string>) => void;
  mediaFiles: MediaFile[];
  /** בתוך מודל שכבר פתוח — בלי מודל שני ובלי אנימציית כניסה. */
  embedded?: boolean;
}

import { useDesignTokens } from '../ui/DesignTokens';
import { CHAT_LAYOUT, CHAT_TYPE, chatPhysicalRightText } from './chatLayout';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useMediaZoomGestures } from './useMediaZoomGestures';
import { MediaBlurBackdrop, MediaKeyboardDim } from './MediaViewerChrome';

function MediaPreviewBody({
  visible,
  onClose,
  onSend,
  mediaFiles,
  embedded = false,
}: MediaPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, initialWindowMetrics?.insets.bottom ?? 0);
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { isDarkMode } = useTheme();
  const tokens = useDesignTokens();
  const iconColor = isDarkMode ? tokens.colors.text.primary : tokens.colors.text.inverse;
  const [videoPosterUri, setVideoPosterUri] = useState<string | null>(null);
  const captionRef = useRef<TextInput>(null);
  
  const [localFiles, setLocalFiles] = useState(mediaFiles);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false); // ⚡ expo-image handles loading - no need to show spinner
  const audioRefs = useRef<Record<string, Audio.Sound>>({});
  const videoRef = useRef<any>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoPosition, setVideoPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [videoDragging, setVideoDragging] = useState(false);
  const [videoDragPosition, setVideoDragPosition] = useState(0);
  const videoDurationVal = useSharedValue(0);
  const videoTimelineWidthVal = useSharedValue(0);
  const videoStartPositionVal = useSharedValue(0);
  const videoDraggingRef = useRef(false);
  const videoLastSeekTargetRef = useRef<number | null>(null);
  const videoPositionShared = useSharedValue(0);
  const videoDisplayPosition = videoDragging ? videoDragPosition : videoPosition;
  videoDraggingRef.current = videoDragging;

  // Animation refs for modal open/close (using React Native Animated for modal)
  const modalScaleAnim = useRef(new RNAnimated.Value(embedded ? 1 : 0.9)).current;
  const modalOpacityAnim = useRef(new RNAnimated.Value(embedded ? 1 : 0)).current;
  // Controls are always visible - no animation needed
  
  const keyboard = useAnimatedKeyboard();
  const captionLift = useAnimatedStyle(() => {
    const open = keyboard.height.value > 8;
    return {
      paddingBottom: open ? 8 : safeBottom + 12,
      transform: [{ translateY: -keyboard.height.value }],
    };
  });

  // כמו וואטסאפ: רק שורת הכיתוב עולה עם המקלדת — נגן הווידאו והממוזערות נשארים במקומם
  // (המקלדת מכסה אותם): מבטלים בדיוק את ההרמה נטו של הדוק (מקלדת פחות שינוי ה-padding)
  const stayBehindKeyboard = useAnimatedStyle(() => {
    const kb = keyboard.height.value;
    const open = kb > 8;
    return {
      transform: [{ translateY: open ? Math.max(0, kb - (safeBottom + 12 - 8)) : 0 }],
    };
  });

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleSwipe = useCallback(
    (direction: 1 | -1) => {
      setCurrentIndex((i) => {
        const next = Math.min(localFiles.length - 1, Math.max(0, i + direction));
        if (next !== i) {
          setIsLoading(true);
          void HapticFeedback.selection();
        }
        return next;
      });
    },
    [localFiles.length],
  );

  const currentMedia = localFiles[currentIndex];

  const { zoomGesture, animatedStyle: animatedImageStyle, resetZoomImmediate, prevPagerStyle, nextPagerStyle } =
    useMediaZoomGestures({
      resetKey: visible ? `${currentIndex}:${currentMedia?.id ?? ''}` : false,
      onSingleTap: dismissKeyboard,
      // RTL: הבא משמאל — החלקה ימינה (אצבע זזה ימינה) = הבא
      onSwipeHorizontal: localFiles.length > 1 ? handleSwipe : undefined,
      canSwipeNext: currentIndex < localFiles.length - 1,
      canSwipePrev: currentIndex > 0,
    });

  useEffect(() => {
    if (currentMedia?.type !== 'video') return;
    if (!videoDragging) {
      videoPositionShared.value = withTiming(videoPosition, { duration: 120 });
    }
  }, [videoPosition, videoDragging, currentMedia?.type]);

  useEffect(() => {
    if (visible) {
      // ⚡ לא מחכים ל-decode — מודאל נפתח מייד; thumb/full נטענים בשכבות
      setIsLoading(false);
      resetZoomImmediate();
      if (embedded) {
        modalScaleAnim.setValue(1);
        modalOpacityAnim.setValue(1);
        return;
      }
      RNAnimated.parallel([
        RNAnimated.timing(modalScaleAnim, {
          toValue: 1,
          duration: 50,
          useNativeDriver: true,
        }),
        RNAnimated.timing(modalOpacityAnim, {
          toValue: 1,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start(() => {});
    } else {
      modalScaleAnim.setValue(0.9);
      modalOpacityAnim.setValue(0);
      resetZoomImmediate();
    }
  }, [visible, embedded, resetZoomImmediate, modalOpacityAnim, modalScaleAnim]);

  useEffect(() => {
    setLocalFiles(mediaFiles);
  }, [mediaFiles]);

  // פריים ראשון לפריוויו וידאו (מקומי — אמין ב-iOS)
  useEffect(() => {
    if (!visible || currentMedia?.type !== 'video' || !currentMedia.uri) {
      setVideoPosterUri(null);
      return;
    }
    let cancelled = false;
    (async () => {
      for (const time of [1000, 0, 100]) {
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(currentMedia.uri, {
            time,
            quality: 0.7,
          });
          if (!cancelled && uri) {
            setVideoPosterUri(uri);
            setLocalFiles((prev) =>
              prev.map((f, i) =>
                i === currentIndex && f.type === 'video' && !f.thumbnail_url
                  ? { ...f, thumbnail_url: uri }
                  : f,
              ),
            );
            return;
          }
        } catch {
          /* ניסיון הבא */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, currentIndex, currentMedia?.type, currentMedia?.uri]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAudio = async (fileId: string) => {
    try {
      if (isPlaying[fileId]) {
        if (audioRefs.current[fileId]) {
          await audioRefs.current[fileId].stopAsync();
          await audioRefs.current[fileId].unloadAsync();
        }
        setIsPlaying(prev => ({ ...prev, [fileId]: false }));
      } else {
        const mediaFile = localFiles.find(f => f.id === fileId);
        if (mediaFile && mediaFile.type === 'audio') {
          const { sound } = await Audio.Sound.createAsync({ uri: mediaFile.uri });
          audioRefs.current[fileId] = sound;
          await sound.playAsync();
          setIsPlaying(prev => ({ ...prev, [fileId]: true }));

          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(prev => ({ ...prev, [fileId]: false }));
            }
          });
        }
      }
    } catch (error) {
      logger.error('MediaPreviewModal', 'Audio toggle error', error);
    }
  };

  const removeMedia = (fileId: string) => {
    if (localFiles.length === 1) {
      onClose();
      return;
    }

    const newCaptions = { ...captions };
    delete newCaptions[fileId];

    if (currentIndex >= localFiles.length - 1) {
      setCurrentIndex(Math.max(0, localFiles.length - 2));
    }

    setLocalFiles(prev => prev.filter(f => f.id !== fileId));
    setCaptions(newCaptions);
  };

  const handleSend = () => {
    if (localFiles.length === 0) return;
    const validMediaFiles = localFiles.filter(f => f.uri);
    if (validMediaFiles.length === 0) {
      legacyAlert('שגיאה', 'אין קבצים לשליחה');
      return;
    }
    // Send with copies of data, then close
    onSend([...validMediaFiles], { ...captions });
    onClose();
  };

  const handleVideoSeek = useCallback((positionSeconds: number) => {
    videoLastSeekTargetRef.current = positionSeconds;
    const ms = Math.max(0, positionSeconds) * 1000;
    videoRef.current?.setPositionAsync(ms).then(() => {
      setVideoPosition(positionSeconds);
      videoLastSeekTargetRef.current = null;
    }).catch(() => {
      videoLastSeekTargetRef.current = null;
    });
  }, []);

  const handleVideoTimelinePress = useCallback((evt: { nativeEvent: { locationX: number } }) => {
    if (timelineWidth <= 0 || videoDuration <= 0) return;
    const ratio = Math.max(0, Math.min(1, evt.nativeEvent.locationX / timelineWidth));
    handleVideoSeek(ratio * videoDuration);
  }, [timelineWidth, videoDuration, handleVideoSeek]);

  const toggleVideoPlayPause = useCallback(() => {
    if (!videoRef.current) return;
    const next = !videoPlaying;
    setVideoPlaying(next);
    if (next) videoRef.current.playAsync?.();
    else videoRef.current.pauseAsync?.();
  }, [videoPlaying]);

  useEffect(() => {
    if (currentMedia?.type === 'video') {
      videoDurationVal.value = videoDuration;
      videoTimelineWidthVal.value = timelineWidth;
    }
  }, [videoDuration, timelineWidth, currentMedia?.type]);

  useEffect(() => {
    if (currentMedia?.type !== 'video') {
      setVideoPlaying(false);
      setVideoPosition(0);
      setVideoDuration(0);
      setVideoDragging(false);
    }
  }, [currentIndex, currentMedia?.type]);

  const recordVideoDragStart = useCallback(() => {
    videoStartPositionVal.value = videoPosition;
    videoPositionShared.value = videoPosition;
    setVideoDragPosition(videoPosition);
    setVideoDragging(true);
    videoDraggingRef.current = true;
  }, [videoPosition]);

  const commitVideoSeek = useCallback((finalPositionSeconds: number) => {
    videoPositionShared.value = finalPositionSeconds;
    setVideoPosition(finalPositionSeconds);
    setVideoDragging(false);
    videoDraggingRef.current = false;
    handleVideoSeek(finalPositionSeconds);
  }, [handleVideoSeek]);

  const handleVideoTimelineTap = useCallback((x: number) => {
    if (timelineWidth <= 0 || videoDuration <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / timelineWidth));
    const sec = ratio * videoDuration;
    videoPositionShared.value = sec;
    setVideoPosition(sec);
    handleVideoSeek(sec);
  }, [timelineWidth, videoDuration, handleVideoSeek]);

  const videoTimelinePanGesture = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      'worklet';
      runOnJS(recordVideoDragStart)();
    })
    .onUpdate((e) => {
      'worklet';
      const w = videoTimelineWidthVal.value;
      const d = videoDurationVal.value;
      if (w <= 0 || d <= 0) return;
      const newSec = videoStartPositionVal.value + (e.translationX / w) * d;
      const clamped = Math.max(0, Math.min(d, newSec));
      videoPositionShared.value = clamped;
      runOnJS(setVideoDragPosition)(clamped);
    })
    .onEnd((e) => {
      'worklet';
      const w = videoTimelineWidthVal.value;
      const d = videoDurationVal.value;
      if (w <= 0 || d <= 0) {
        runOnJS(commitVideoSeek)(videoStartPositionVal.value);
        return;
      }
      const newSec = videoStartPositionVal.value + (e.translationX / w) * d;
      const clamped = Math.max(0, Math.min(d, newSec));
      runOnJS(commitVideoSeek)(clamped);
    });

  const videoTimelineTapGesture = Gesture.Tap()
    .onEnd((e) => {
      'worklet';
      runOnJS(handleVideoTimelineTap)(e.x);
    });

  const videoTimelineGesture = Gesture.Exclusive(videoTimelinePanGesture, videoTimelineTapGesture);

  const videoAnimatedFillStyle = useAnimatedStyle(() => {
    const d = videoDurationVal.value;
    const p = videoPositionShared.value;
    if (d <= 0) return { width: 0 };
    const w = videoTimelineWidthVal.value;
    return { width: w * (p / d) };
  }, []);

  const videoAnimatedThumbStyle = useAnimatedStyle(() => {
    const d = videoDurationVal.value;
    const p = videoPositionShared.value;
    if (d <= 0) return { left: -7 };
    const w = videoTimelineWidthVal.value;
    return { left: w * (p / d) - 7 };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach(sound => {
        sound?.unloadAsync();
      });
    };
  }, []);

  // Video playback status: set up via ref for explicit cleanup on unmount
  useEffect(() => {
    if (currentMedia?.type !== 'video' || !visible) return;
    const video = videoRef.current;
    if (!video) return;

    const callback = (status: { isLoaded?: boolean; durationMillis?: number; positionMillis?: number }) => {
      if (status.isLoaded) {
        if (status.durationMillis != null) {
          const sec = status.durationMillis / 1000;
          setVideoDuration(sec);
          setLocalFiles((prev) =>
            prev.map((f, i) =>
              i === currentIndex && f.type === 'video' ? { ...f, duration: sec } : f,
            ),
          );
        }
        if (!videoDraggingRef.current) {
          const reported = (status.positionMillis ?? 0) / 1000;
          const target = videoLastSeekTargetRef.current;
          if (target == null) {
            setVideoPosition(reported);
          } else if (Math.abs(reported - target) < 0.5) {
            videoLastSeekTargetRef.current = null;
            setVideoPosition(reported);
          }
        }
      }
    };

    video.setOnPlaybackStatusUpdate(callback);

    return () => {
      videoRef.current?.setOnPlaybackStatusUpdate(null);
    };
  }, [currentMedia?.type, currentIndex, visible]);

  if (!visible || !currentMedia) {
    return null;
  }

  /** שכן (קודם/הבא) צמוד לצד — נע יחד עם הגרירה, כמו מעבר בין סטוריז */
  const renderNeighbor = (media: MediaFile | undefined, pagerStyle: typeof prevPagerStyle) => {
    if (!media) return null;
    const uri = media.type === 'image' ? media.uri : media.type === 'video' ? media.thumbnail_url : null;
    const srcW = media.width && media.width > 0 ? media.width : screenW;
    const srcH = media.height && media.height > 0 ? media.height : screenH;
    const frameH = Math.min(screenW * (srcH / srcW), screenH);
    return (
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0, left: 0, width: screenW, height: screenH }, pagerStyle]}
      >
        {uri ? (
          <ExpoImage
            source={{ uri }}
            style={{ position: 'absolute', top: (screenH - frameH) / 2, left: 0, width: screenW, height: frameH }}
            contentFit={media.type === 'image' ? 'cover' : 'contain'}
            transition={0}
            cachePolicy="memory-disk"
            recyclingKey={`n-${media.id}`}
          />
        ) : null}
      </Animated.View>
    );
  };

  const renderMediaContent = () => {
    switch (currentMedia.type) {
      case 'image': {
        const srcW = currentMedia.width && currentMedia.width > 0 ? currentMedia.width : screenW;
        const srcH = currentMedia.height && currentMedia.height > 0 ? currentMedia.height : screenH;
        const naturalH = screenW * (srcH / srcW);
        const frameH = Math.min(naturalH, screenH);
        const box = { width: screenW, height: frameH };
        const placed = {
          ...box,
          position: 'absolute' as const,
          top: (screenH - frameH) / 2,
          left: 0,
        };
        return (
          <GestureDetector gesture={zoomGesture}>
            <Animated.View style={placed} collapsable={false}>
              <Animated.View style={[box, animatedImageStyle]}>
                <ExpoImage
                  source={{ uri: currentMedia.uri }}
                  style={box}
                  contentFit="cover"
                  transition={0}
                  priority="high"
                  onLoadStart={() => setIsLoading(false)}
                  onLoad={() => setIsLoading(false)}
                  onError={() => setIsLoading(false)}
                  cachePolicy="memory-disk"
                  recyclingKey={currentMedia.id}
                />
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        );
      }

      case 'video':
        return (
          <View style={{ width: screenW, height: screenH }}>
            {videoPosterUri && !videoPlaying ? (
              <ExpoImage
                source={{ uri: videoPosterUri }}
                style={styles.fullMediaInner}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : null}
            {isLoading && (
              <View style={styles.loadingContainer} pointerEvents="none">
                <ActivityIndicator size="large" color={iconColor} />
              </View>
            )}
            <Video
              ref={videoRef}
              source={{ uri: currentMedia.uri }}
              style={[
                styles.fullMediaInner,
                videoPosterUri && !videoPlaying ? styles.hiddenVideo : null,
              ]}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls={false}
              shouldPlay={videoPlaying}
              onLoad={() => {
                setIsLoading(false);
                videoRef.current?.setStatusAsync?.({ progressUpdateIntervalMillis: 100 });
              }}
              onError={() => setIsLoading(false)}
            />
          </View>
        );

      case 'audio':
        return (
          <View style={styles.audioContent}>
            <Pressable
              onPress={() => toggleAudio(currentMedia.id)}
              style={styles.audioPlayBtn}
            >
              {isPlaying[currentMedia.id] ? (
                <Pause size={48} color={iconColor} strokeWidth={1.5} />
              ) : (
                <Play size={48} color={iconColor} strokeWidth={1.5} fill={iconColor} />
              )}
            </Pressable>
            <Text style={[styles.audioTime, { color: iconColor }]}>
              {formatDuration(currentMedia.duration)}
            </Text>
            {currentMedia.name ? (
              <Text style={[styles.audioName, { color: iconColor }]}>
                {currentMedia.name}
              </Text>
            ) : null}
          </View>
        );

      case 'document':
        return (
          <View style={styles.documentContent}>
            <View
              style={styles.documentIcon}
            >
              <Ionicons name="document-text" size={64} color={iconColor} />
            </View>
            {currentMedia.name ? (
              <Text style={[styles.documentName, { color: iconColor }]}>
                {currentMedia.name}
              </Text>
            ) : null}
          </View>
        );

      default:
        return null;
    }
  };

  const RNAnimatedView = RNAnimated.View;
  const captionId = currentMedia.id;

  const shell = (
      <GestureHandlerRootView style={styles.modalRoot}>
        <RNAnimatedView
          style={[
            styles.container,
            {
              backgroundColor: 'transparent',
              opacity: modalOpacityAnim,
              transform: [{ scale: modalScaleAnim }],
            },
          ]}
        >
          <MediaBlurBackdrop
            uri={
              currentMedia.type === 'image'
                ? currentMedia.uri
                : currentMedia.type === 'video'
                  ? videoPosterUri
                  : null
            }
          />

          <View style={styles.mediaStage} pointerEvents="box-none">
            {renderNeighbor(localFiles[currentIndex - 1], prevPagerStyle)}
            {renderNeighbor(localFiles[currentIndex + 1], nextPagerStyle)}
            {renderMediaContent()}
          </View>

          <MediaKeyboardDim />

          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <Pressable
              onPress={onClose}
              style={[styles.iconBtn, styles.themeBtn, { backgroundColor: tokens.colors.background.cardSolid }]}
              accessibilityRole="button"
              accessibilityLabel="סגירה"
            >
              <X size={22} color={tokens.colors.text.primary} strokeWidth={2} />
            </Pressable>
            {localFiles.length > 1 ? (
              <Text style={[styles.counterText, { color: iconColor }]}>
                {currentIndex + 1}/{localFiles.length}
              </Text>
            ) : (
              <View style={styles.iconBtn} />
            )}
            {/* בלי כפתור מחיקה נוסף — X סוגר; יציאה מקובץ בודד דרך הסגירה */}
            <View style={styles.iconBtn} />
          </View>

          <Animated.View style={[styles.captionDock, captionLift]} pointerEvents="box-none">
            <Animated.View style={stayBehindKeyboard} pointerEvents="box-none">
            {currentMedia.type === 'video' ? (
              <View style={styles.videoControlsRow}>
                <TouchableOpacity
                  style={[styles.videoPlayBtn, styles.themeBtn, { backgroundColor: tokens.colors.background.cardSolid }]}
                  onPress={toggleVideoPlayPause}
                  accessibilityRole="button"
                  accessibilityLabel={videoPlaying ? 'השהיה' : 'ניגון'}
                >
                  <Ionicons name={videoPlaying ? 'pause' : 'play'} size={22} color={tokens.colors.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.videoTimeText, { color: iconColor }]}>
                  {formatDuration(videoDisplayPosition)}
                </Text>
                <GestureDetector gesture={videoTimelineGesture}>
                  <View
                    style={styles.timelineTrack}
                    onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}
                  >
                    <View style={[styles.timelineTrackBg, { backgroundColor: iconColor, opacity: 0.35 }]} />
                    <Animated.View
                      style={[styles.timelineFill, videoAnimatedFillStyle, { backgroundColor: iconColor }]}
                    />
                    <Animated.View
                      style={[styles.timelineThumb, videoAnimatedThumbStyle, { backgroundColor: iconColor }]}
                    />
                  </View>
                </GestureDetector>
                <Text style={[styles.videoTimeText, { color: iconColor }]}>
                  {formatDuration(videoDuration)}
                </Text>
              </View>
            ) : null}

            {localFiles.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailStrip}
                keyboardShouldPersistTaps="handled"
              >
                {localFiles.map((media, index) => (
                  <Pressable
                    key={media.id}
                    // לחיצה ארוכה על ממוזערת — הסרת הקובץ מהשליחה
                    onLongPress={() => {
                      void HapticFeedback.impactLight();
                      removeMedia(media.id);
                    }}
                    delayLongPress={350}
                    onPress={() => {
                      setCurrentIndex(index);
                      setIsLoading(true);
                    }}
                    style={[
                      styles.thumbnailContainer,
                      index === currentIndex && { borderColor: iconColor },
                    ]}
                  >
                    {media.type === 'image' ? (
                      <ExpoImage
                        source={{ uri: media.thumbnail_url || media.uri }}
                        style={styles.thumbnail}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={0}
                      />
                    ) : media.type === 'video' ? (
                      <View style={styles.thumbnailVideo}>
                        <ExpoImage
                          source={{ uri: media.uri }}
                          style={styles.thumbnail}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                        <View style={styles.thumbnailVideoOverlay}>
                          <Play size={16} color={iconColor} fill={iconColor} />
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.thumbnail, styles.thumbnailDocument]}>
                        <Ionicons name="document-text" size={24} color={iconColor} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            </Animated.View>

            <View style={styles.captionRow}>
              <Pressable
                onPress={handleSend}
                style={[styles.sendBtn, { backgroundColor: tokens.colors.primary.lightCta }]}
                accessibilityRole="button"
                accessibilityLabel="שליחה"
              >
                <Ionicons name="send" size={22} color={tokens.colors.text.inverse} style={styles.sendIcon} />
              </Pressable>
              <TextInput
                ref={captionRef}
                value={captions[captionId] || ''}
                onChangeText={(text) => setCaptions((prev) => ({ ...prev, [captionId]: text }))}
                placeholder="הוסף כיתוב..."
                placeholderTextColor={tokens.colors.text.tertiary}
                style={[
                  styles.captionInput,
                  {
                    backgroundColor: tokens.colors.background.cardSolid,
                    borderColor: tokens.colors.border.divider,
                    color: tokens.colors.text.primary,
                  },
                ]}
                maxLength={500}
                keyboardAppearance={isDarkMode ? 'dark' : 'light'}
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleSend}
              />
            </View>
          </Animated.View>
        </RNAnimatedView>
      </GestureHandlerRootView>
  );

  return shell;
}

export default function MediaPreviewModal(props: MediaPreviewModalProps) {
  if (props.embedded) return <MediaPreviewBody {...props} />;
  return (
    <Modal
      visible={props.visible}
      transparent={true}
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={props.onClose}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <MediaPreviewBody {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  themeBtn: {
    borderRadius: 22,
  },
  counterText: {
    ...CHAT_TYPE.groupLabel,
    textAlign: 'center',
  },
  mediaStage: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaFill: {
    ...StyleSheet.absoluteFill,
  },
  fullMediaInner: {
    ...StyleSheet.absoluteFill,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  navLeft: {
    left: 16,
  },
  navRight: {
    right: 16,
  },
  hiddenVideo: {
    opacity: 0,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    backgroundColor: 'transparent',
  },
  captionDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  captionRow: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: {
    transform: [{ scaleX: -1 }],
  },
  videoControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
  },
  videoPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTimeText: {
    ...CHAT_TYPE.caption,
    minWidth: 36,
    textAlign: 'center',
  },
  timelineTrack: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  timelineTrackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 7,
    height: 6,
    borderRadius: 3,
  },
  timelineFill: {
    position: 'absolute',
    left: 0,
    top: 7,
    height: 6,
    borderRadius: 3,
  },
  timelineThumb: {
    position: 'absolute',
    top: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
  },
  emojiBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionInput: {
    flex: 1,
    minHeight: 44,
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'right',
    ...chatPhysicalRightText,
    ...CHAT_TYPE.cardBody,
  },
  thumbnailStrip: {
    paddingHorizontal: 16,
    paddingTop: 12,
    // מרווח מעל שורת הכיתוב
    paddingBottom: 14,
    gap: 8,
    flexDirection: 'row',
  },
  thumbnailContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  thumbnailVideo: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbnailVideoOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  thumbnailDocument: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  audioContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  audioPlayBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  audioTime: {
    ...CHAT_TYPE.cardTitle,
    textAlign: 'center',
  },
  audioName: {
    ...CHAT_TYPE.cardSubtitle,
    marginTop: CHAT_LAYOUT.cardTitleToSubtitleGap,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  documentContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  documentIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  documentName: {
    ...CHAT_TYPE.cardTitle,
    marginTop: CHAT_LAYOUT.cardTitleToSubtitleGap,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
