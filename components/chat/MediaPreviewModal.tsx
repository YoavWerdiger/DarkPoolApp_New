import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator, Animated as RNAnimated,
  Keyboard, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { X, Trash2, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react-native';
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
import { useGenericKeyboardHandler } from 'react-native-keyboard-controller';
import { useTheme } from '../../context/ThemeContext';

interface MediaPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (mediaFiles: MediaFile[], captions: Record<string, string>) => void;
  mediaFiles: MediaFile[];
}

import ChatComposerBar from './ChatComposerBar';
import { ChatComposerDock } from './ChatComposerDock';
import ReactionPicker from './ReactionPicker';
import { useDesignTokens } from '../ui/DesignTokens';
import { UI_CARD_RADIUS } from '../ui/appLayout';
import { CHAT_LAYOUT, CHAT_TYPE, chatPhysicalRightText } from './chatLayout';
import {
  CHAT_COMPOSER_KEYBOARD_GAP,
  chatComposerKeyboardTranslate,
  chatComposerSafeBottomInset,
} from './chatInputLayout';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useMediaZoomGestures } from './useMediaZoomGestures';

export default function MediaPreviewModal({
  visible,
  onClose,
  onSend,
  mediaFiles
}: MediaPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const tokens = useDesignTokens();
  const composerPaddingBottom = useMemo(
    () => chatComposerSafeBottomInset(insets.bottom),
    [insets.bottom],
  );
  const composerInsetSV = useSharedValue(composerPaddingBottom);
  /** כווץ את משבצת התמונה באותו שיעור שהקומפוזר עולה — בלי translateY על התמונה */
  const mediaShrinkSV = useSharedValue(0);
  const [videoPosterUri, setVideoPosterUri] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
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
  const modalScaleAnim = useRef(new RNAnimated.Value(0.9)).current;
  const modalOpacityAnim = useRef(new RNAnimated.Value(0)).current;
  // Controls are always visible - no animation needed
  
  useEffect(() => {
    composerInsetSV.value = composerPaddingBottom;
  }, [composerPaddingBottom, composerInsetSV]);

  useEffect(() => {
    if (!visible) {
      mediaShrinkSV.value = 0;
      setEmojiPickerOpen(false);
    }
  }, [visible, mediaShrinkSV]);

  /**
   * אותו מעקב פריים של react-native-keyboard-controller כמו ChatComposerDock.
   * paddingBottom (לא translateY) — ב-iOS פרודקשן translateY של Reanimated לא דוחף.
   */
  useGenericKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        mediaShrinkSV.value = -chatComposerKeyboardTranslate(
          event.height,
          composerInsetSV.value,
          CHAT_COMPOSER_KEYBOARD_GAP,
        );
      },
      onEnd: (event) => {
        'worklet';
        mediaShrinkSV.value = -chatComposerKeyboardTranslate(
          event.height,
          composerInsetSV.value,
          CHAT_COMPOSER_KEYBOARD_GAP,
        );
      },
    },
    [],
  );

  const mediaStageStyle = useAnimatedStyle(() => ({
    paddingBottom: 12 + mediaShrinkSV.value,
  }));

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const currentMedia = localFiles[currentIndex];

  const { zoomGesture, animatedStyle: animatedImageStyle, resetZoomImmediate } =
    useMediaZoomGestures({
      resetKey: visible ? `${currentIndex}:${currentMedia?.id ?? ''}` : false,
      onSingleTap: dismissKeyboard,
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
      mediaShrinkSV.value = 0;
    }
  }, [visible, resetZoomImmediate, mediaShrinkSV]);

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

  const goToNext = () => {
    if (currentIndex < localFiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsLoading(true);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsLoading(true);
    }
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

  const themeBorder = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.border.divider,
  } as const;

  const iconBtnStyle = [
    styles.iconBtn,
    themeBorder,
    { backgroundColor: tokens.colors.background.cardSolid },
  ];

  /** שדה על כרטיס — מילוי הקנבס מאחורי הכרטיס, מסגרת לפי ערכת הנושא */
  const captionPillStyle = [
    themeBorder,
    { backgroundColor: tokens.colors.background.primary },
  ];

  const renderMediaContent = () => {
    switch (currentMedia.type) {
      case 'image':
        return (
          <GestureDetector gesture={zoomGesture}>
            <Animated.View style={styles.mediaFill} collapsable={false}>
              <Animated.View style={[StyleSheet.absoluteFill, animatedImageStyle]}>
                {currentMedia.thumbnail_url ? (
                  <ExpoImage
                    source={{ uri: currentMedia.thumbnail_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                    recyclingKey={`${currentMedia.id}-thumb`}
                  />
                ) : null}
                <ExpoImage
                  source={{ uri: currentMedia.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
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

      case 'video':
        return (
          <View style={styles.mediaFill}>
            {videoPosterUri && !videoPlaying ? (
              <ExpoImage
                source={{ uri: videoPosterUri }}
                style={styles.fullMediaInner}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : null}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={tokens.colors.primary.main} />
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
              style={[
                styles.audioPlayBtn,
                themeBorder,
                { backgroundColor: tokens.colors.background.cardSolid },
              ]}
            >
              {isPlaying[currentMedia.id] ? (
                <Pause size={48} color={tokens.colors.text.primary} strokeWidth={1.5} />
              ) : (
                <Play size={48} color={tokens.colors.text.primary} strokeWidth={1.5} fill={tokens.colors.text.primary} />
              )}
            </Pressable>
            <Text style={[styles.audioTime, { color: tokens.colors.text.primary }]}>
              {formatDuration(currentMedia.duration)}
            </Text>
            {currentMedia.name ? (
              <Text style={[styles.audioName, { color: tokens.colors.text.secondary }]}>
                {currentMedia.name}
              </Text>
            ) : null}
          </View>
        );

      case 'document':
        return (
          <View style={styles.documentContent}>
            <View
              style={[
                styles.documentIcon,
                themeBorder,
                { backgroundColor: tokens.colors.background.cardSolid },
              ]}
            >
              <Ionicons name="document-text" size={64} color={tokens.colors.text.primary} />
            </View>
            {currentMedia.name ? (
              <Text style={[styles.documentName, { color: tokens.colors.text.primary }]}>
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <RNAnimatedView
          style={[
            styles.container,
            {
              backgroundColor: tokens.colors.background.primary,
              opacity: modalOpacityAnim,
              transform: [{ scale: modalScaleAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.topBar,
              {
                paddingTop: insets.top + 8,
                backgroundColor: tokens.colors.background.primary,
                borderBottomColor: tokens.colors.border.divider,
              },
            ]}
          >
            <Pressable
              onPress={onClose}
              style={iconBtnStyle}
              accessibilityRole="button"
              accessibilityLabel="סגירה"
            >
              <X size={22} color={tokens.colors.text.primary} strokeWidth={2} />
            </Pressable>

            {localFiles.length > 1 ? (
              <Text style={[styles.counterText, { color: tokens.colors.text.secondary }]}>
                {currentIndex + 1}/{localFiles.length}
              </Text>
            ) : (
              <View style={styles.iconBtn} />
            )}

            <Pressable
              onPress={() => removeMedia(currentMedia.id)}
              style={iconBtnStyle}
              accessibilityRole="button"
              accessibilityLabel="הסרת מדיה"
            >
              <Trash2 size={20} color={tokens.colors.danger.main} strokeWidth={2} />
            </Pressable>
          </View>

          <Animated.View style={[styles.mediaStage, mediaStageStyle]}>
            <View
              style={[
                styles.mediaSlot,
                themeBorder,
                { backgroundColor: tokens.colors.background.cardSolid },
              ]}
            >
              {renderMediaContent()}

              {localFiles.length > 1 && currentIndex > 0 ? (
                <Pressable
                  onPress={goToPrev}
                  style={[
                    styles.navArrow,
                    styles.navRight,
                    themeBorder,
                    { backgroundColor: tokens.colors.background.cardSolid },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="הקובץ הקודם"
                >
                  <ChevronRight size={26} color={tokens.colors.text.primary} strokeWidth={2} />
                </Pressable>
              ) : null}
              {localFiles.length > 1 && currentIndex < localFiles.length - 1 ? (
                <Pressable
                  onPress={goToNext}
                  style={[
                    styles.navArrow,
                    styles.navLeft,
                    themeBorder,
                    { backgroundColor: tokens.colors.background.cardSolid },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="הקובץ הבא"
                >
                  <ChevronLeft size={26} color={tokens.colors.text.primary} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>
          </Animated.View>

          <ChatComposerDock bottomInset={composerPaddingBottom} style={styles.composerDock}>
            <View
              style={[
                styles.composerSurface,
                {
                  backgroundColor: tokens.colors.background.cardSolid,
                  paddingBottom: composerPaddingBottom,
                  borderTopColor: tokens.colors.border.divider,
                },
              ]}
            >
              {currentMedia.type === 'video' ? (
                <View style={styles.videoControlsRow}>
                  <TouchableOpacity
                    style={[
                      styles.videoPlayBtn,
                      themeBorder,
                      { backgroundColor: tokens.colors.background.primary },
                    ]}
                    onPress={toggleVideoPlayPause}
                    accessibilityRole="button"
                    accessibilityLabel={videoPlaying ? 'השהיה' : 'ניגון'}
                  >
                    <Ionicons
                      name={videoPlaying ? 'pause' : 'play'}
                      size={22}
                      color={tokens.colors.text.primary}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.videoTimeText, { color: tokens.colors.text.secondary }]}>
                    {formatDuration(videoDisplayPosition)}
                  </Text>
                  <GestureDetector gesture={videoTimelineGesture}>
                    <View
                      style={styles.timelineTrack}
                      onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}
                    >
                      <View
                        style={[styles.timelineTrackBg, { backgroundColor: tokens.colors.border.divider }]}
                      />
                      <Animated.View
                        style={[
                          styles.timelineFill,
                          videoAnimatedFillStyle,
                          { backgroundColor: tokens.colors.primary.main },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.timelineThumb,
                          videoAnimatedThumbStyle,
                          { backgroundColor: tokens.colors.text.primary },
                        ]}
                      />
                    </View>
                  </GestureDetector>
                  <Text style={[styles.videoTimeText, { color: tokens.colors.text.secondary }]}>
                    {formatDuration(videoDuration)}
                  </Text>
                </View>
              ) : null}

              <ChatComposerBar
                inputRef={captionRef}
                value={captions[captionId] || ''}
                onChangeText={(text) => setCaptions((prev) => ({ ...prev, [captionId]: text }))}
                placeholder="הוסף כיתוב..."
                maxLength={500}
                onSend={handleSend}
                keyboardAppearance={isDarkMode ? 'dark' : 'light'}
                inputStyle={[styles.captionInput, { color: tokens.colors.text.primary }]}
                pillStyle={captionPillStyle}
                leading={
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setEmojiPickerOpen(true);
                    }}
                    style={styles.emojiBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="אימוג'י"
                  >
                    <Ionicons name="happy-outline" size={22} color={tokens.colors.text.primary} />
                  </Pressable>
                }
                trailing={
                  <View
                    style={[
                      styles.sendBtnOuter,
                      { backgroundColor: tokens.colors.primary.lightCta },
                    ]}
                    collapsable={false}
                  >
                    <Pressable
                      onPress={handleSend}
                      style={({ pressed }) => [
                        styles.sendBtnTouchable,
                        pressed ? { opacity: 0.82 } : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="שליחה"
                    >
                      <Ionicons name="send" size={22} color={tokens.colors.text.inverse} />
                    </Pressable>
                  </View>
                }
              />

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
                      onPress={() => {
                        setCurrentIndex(index);
                        setIsLoading(true);
                      }}
                      style={[
                        styles.thumbnailContainer,
                        index === currentIndex && {
                          borderColor: tokens.colors.primary.main,
                        },
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
                            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                          </View>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.thumbnail,
                            styles.thumbnailDocument,
                            { backgroundColor: tokens.colors.background.primary },
                          ]}
                        >
                          <Ionicons name="document-text" size={24} color={tokens.colors.text.primary} />
                        </View>
                      )}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          removeMedia(media.id);
                        }}
                        style={[styles.thumbnailRemove, { backgroundColor: tokens.colors.danger.main }]}
                        accessibilityRole="button"
                        accessibilityLabel="הסרת קובץ"
                      >
                        <X size={12} color={tokens.colors.text.inverse} strokeWidth={3} />
                      </Pressable>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          </ChatComposerDock>

          <ReactionPicker
            visible={emojiPickerOpen}
            embedded
            title="אימוג'י"
            onClose={() => setEmojiPickerOpen(false)}
            onReaction={(emoji) => {
              setCaptions((prev) => ({
                ...prev,
                [captionId]: `${prev[captionId] || ''}${emoji}`,
              }));
              setTimeout(() => captionRef.current?.focus(), 280);
            }}
          />
        </RNAnimatedView>
      </GestureHandlerRootView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 3,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    ...CHAT_TYPE.groupLabel,
    textAlign: 'center',
  },
  /** משבצת מעל הקומפוזר — מתכווצת עם המקלדת, בלי לכסות את הכיתוב */
  mediaStage: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  mediaSlot: {
    flex: 1,
    minHeight: 0,
    borderRadius: UI_CARD_RADIUS,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaFill: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 0,
  },
  fullMediaInner: {
    ...StyleSheet.absoluteFillObject,
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
  composerDock: {
    zIndex: 2,
  },
  composerSurface: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendBtnOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginStart: 8,
    alignSelf: 'flex-end',
    marginBottom: 3,
  },
  sendBtnTouchable: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
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
    ...chatPhysicalRightText,
    ...CHAT_TYPE.cardBody,
  },
  thumbnailStrip: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
