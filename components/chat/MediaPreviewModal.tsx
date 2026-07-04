import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Modal, Pressable, Dimensions, StyleSheet, ActivityIndicator, Animated as RNAnimated,
  Keyboard, ScrollView, TouchableOpacity } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { X, Trash2, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import { MediaFile } from '../../services/mediaService';
import { logger } from '../../utils/logger';
import { BlurView } from 'expo-blur';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated';

interface MediaPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (mediaFiles: MediaFile[], captions: Record<string, string>) => void;
  mediaFiles: MediaFile[];
}

import { chatPalette as COLORS } from './chatDesignTokens';
import ChatComposerBar from './ChatComposerBar';
import * as VideoThumbnails from 'expo-video-thumbnails';

const { width: screenWidth } = Dimensions.get('window');

export default function MediaPreviewModal({
  visible,
  onClose,
  onSend,
  mediaFiles
}: MediaPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const [videoPosterUri, setVideoPosterUri] = useState<string | null>(null);
  
  // Store insets.bottom as a constant for use in worklet
  const safeAreaBottom = insets.bottom;
  
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
  
  // Animated style for the bottom bar — עולה עם המקלדת (סגנון וואטסאפ)
  const animatedBottomBarStyle = useAnimatedStyle(() => {
    'worklet';
    const kbHeight = Math.abs(keyboardHeight.value);
    const isKeyboardOpen = kbHeight > 10;
    const bottomPadding = isKeyboardOpen ? kbHeight : safeAreaBottom;

    return {
      paddingBottom: withTiming(bottomPadding, {
        duration: 150,
        easing: ReanimatedEasing.bezier(0.25, 0.1, 0.25, 1),
      }),
    };
  }, [safeAreaBottom]);
  
  // Gesture shared values using reanimated
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const lastTapTime = useSharedValue(0);

  const currentMedia = localFiles[currentIndex];

  useEffect(() => {
    if (currentMedia?.type !== 'video') return;
    if (!videoDragging) {
      videoPositionShared.value = withTiming(videoPosition, { duration: 120 });
    }
  }, [videoPosition, videoDragging, currentMedia?.type]);

  // Reset zoom when changing media
  useEffect(() => {
    resetZoom();
  }, [currentIndex]);

  const resetZoom = useCallback(() => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, []);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      resetZoom();
      // ⚡ OPTIMISTIC: אנימציה מהירה מאוד
      RNAnimated.parallel([
        RNAnimated.timing(modalScaleAnim, {
          toValue: 1,
          duration: 50, // ⚡ מהיר יותר
          useNativeDriver: true,
        }),
        RNAnimated.timing(modalOpacityAnim, {
          toValue: 1,
          duration: 50, // ⚡ מהיר יותר
          useNativeDriver: true,
        }),
      ]).start(() => {});
    } else {
      modalScaleAnim.setValue(0.9);
      modalOpacityAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    setLocalFiles(mediaFiles);
  }, [mediaFiles]);

  // Controls are always visible in preview mode - no toggle needed

  // Pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      // Clamp scale between 1 and 5
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (scale.value > 5) {
        scale.value = withSpring(5);
        savedScale.value = 5;
      } else {
        savedScale.value = scale.value;
      }
    });

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow pan when zoomed in
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      if (savedScale.value > 1) {
        // Limit pan boundaries based on zoom level
        const maxX = (screenWidth * (savedScale.value - 1)) / 2;
        const maxY = (screenWidth * (savedScale.value - 1)) / 2;
        
        let newX = Math.max(-maxX, Math.min(maxX, translateX.value));
        let newY = Math.max(-maxY, Math.min(maxY, translateY.value));
        
        translateX.value = withSpring(newX);
        translateY.value = withSpring(newY);
        savedTranslateX.value = newX;
        savedTranslateY.value = newY;
      }
    });

  // Tap gesture for double-tap zoom and single-tap toggle
  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      const now = Date.now();
      if (now - lastTapTime.value < 300) {
        // Double tap
        if (savedScale.value > 1) {
          // Zoom out
          scale.value = withSpring(1);
          savedScale.value = 1;
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          savedTranslateX.value = 0;
          savedTranslateY.value = 0;
        } else {
          // Zoom in to 2x
          scale.value = withSpring(2);
          savedScale.value = 2;
        }
      } else {
        // Single tap — סוגר את המקלדת (כמו לחיצה על אזור הצ'אט)
        runOnJS(Keyboard.dismiss)();
      }
      lastTapTime.value = now;
    });

  // Combine gestures
  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture, tapGesture);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

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

  // Animated style for image
  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

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
        if (status.durationMillis != null) setVideoDuration(status.durationMillis / 1000);
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

  const GlassButton = ({ onPress, children, style, size = 48 }: any) => (
    <Pressable onPress={onPress} style={[styles.glassButton, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <View style={[styles.blurFill, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
        <View style={styles.glassInner}>
          {children}
        </View>
      </View>
    </Pressable>
  );

  const renderMediaContent = () => {
    switch (currentMedia.type) {
      case 'image':
        return (
          <GestureDetector gesture={combinedGesture}>
            <Animated.View style={[styles.mediaFill, animatedImageStyle]}>
              <ExpoImage
                source={{ uri: currentMedia.uri }}
                style={styles.mediaFill}
                contentFit="contain"
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                placeholderContentFit="contain"
                transition={200}
                onLoadStart={() => setIsLoading(false)}
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
                cachePolicy="memory-disk"
                recyclingKey={currentMedia.id}
              />
            </Animated.View>
          </GestureDetector>
        );

      case 'video':
        return (
          <View style={styles.mediaFill}>
            {videoPosterUri && !videoPlaying ? (
              <ExpoImage
                source={{ uri: videoPosterUri }}
                style={styles.mediaFill}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : null}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            )}
            <Video
              ref={videoRef}
              source={{ uri: currentMedia.uri }}
              style={[styles.mediaFill, videoPosterUri && !videoPlaying ? styles.hiddenVideo : null]}
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
            <Pressable onPress={() => toggleAudio(currentMedia.id)} style={styles.audioPlayBtn}>
              <View style={[styles.blurFill, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
                <View style={styles.audioPlayInner}>
                  {isPlaying[currentMedia.id] ? (
                    <Pause size={48} color={COLORS.text} strokeWidth={1.5} />
                  ) : (
                    <Play size={48} color={COLORS.text} strokeWidth={1.5} fill={COLORS.text} />
                  )}
                </View>
              </View>
            </Pressable>
            <Text style={styles.audioTime}>{formatDuration(currentMedia.duration)}</Text>
            {currentMedia.name && (
              <Text style={styles.audioName}>{currentMedia.name}</Text>
            )}
          </View>
        );

      case 'document':
        return (
          <View style={styles.documentContent}>
            <View style={styles.documentIcon}>
              <View style={[styles.blurFill, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}>
                <View style={styles.documentIconInner}>
                  <Ionicons name="document-text" size={64} color={COLORS.text} />
                </View>
              </View>
            </View>
            {currentMedia.name && (
              <Text style={styles.documentName}>{currentMedia.name}</Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  // RN Animated View for modal wrapper
  const RNAnimatedView = RNAnimated.View;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RNAnimatedView style={[styles.container, { opacity: modalOpacityAnim, transform: [{ scale: modalScaleAnim }] }]}>
          {/* ── פס עליון זכוכית (כמו MediaViewer) ── */}
          <View style={styles.topGlassBar}>
            <BlurView intensity={80} tint="dark" style={styles.glassBarBlur}>
              <View style={[styles.topGlassContent, { paddingTop: insets.top + 8 }]}>
                <GlassButton onPress={onClose}>
                  <X size={24} color={COLORS.text} strokeWidth={2} />
                </GlassButton>

                {localFiles.length > 1 && (
                  <View style={styles.counterBadge}>
                    <View style={[styles.blurFill, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
                      <View style={styles.counterInner}>
                        <Text style={styles.counterText}>{currentIndex + 1}/{localFiles.length}</Text>
                      </View>
                    </View>
                  </View>
                )}

                <GlassButton onPress={() => removeMedia(currentMedia.id)}>
                  <Trash2 size={22} color={COLORS.danger} strokeWidth={2} />
                </GlassButton>
              </View>
            </BlurView>
          </View>

          {/* ── אזור מדיה באמצע: contain + letterbox שחור ── */}
          <Pressable style={styles.mediaViewport} onPress={dismissKeyboard}>
            <View style={styles.mediaContainLayer}>
              {renderMediaContent()}
            </View>

            {localFiles.length > 1 && (
              <>
                {currentIndex > 0 && (
                  <Pressable onPress={goToPrev} style={[styles.navArrow, styles.navRight]}>
                    <View style={[styles.blurFill, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}>
                      <View style={styles.navArrowInner}>
                        <ChevronRight size={28} color={COLORS.text} strokeWidth={2} />
                      </View>
                    </View>
                  </Pressable>
                )}
                {currentIndex < localFiles.length - 1 && (
                  <Pressable onPress={goToNext} style={[styles.navArrow, styles.navLeft]}>
                    <View style={[styles.blurFill, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}>
                      <View style={styles.navArrowInner}>
                        <ChevronLeft size={28} color={COLORS.text} strokeWidth={2} />
                      </View>
                    </View>
                  </Pressable>
                )}
              </>
            )}
          </Pressable>

          {/* ── פס תחתון זכוכית: בקרות וידאו + אינפוט + כפתור שליחה ירוק ── */}
          <Animated.View style={[styles.bottomGlassBar, animatedBottomBarStyle]}>
            <BlurView intensity={80} tint="dark" style={styles.glassBarBlur}>
              <View style={styles.bottomGlassContent}>
                {currentMedia?.type === 'video' && (
                  <View style={styles.videoControlsRow}>
                    <TouchableOpacity style={styles.videoPlayBtn} onPress={toggleVideoPlayPause}>
                      <Ionicons name={videoPlaying ? 'pause' : 'play'} size={24} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.videoTimeText}>{formatDuration(videoDisplayPosition)}</Text>
                    <GestureDetector gesture={videoTimelineGesture}>
                      <View
                        style={styles.timelineTrack}
                        onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}
                      >
                        <View style={styles.timelineTrackBg} />
                        <Animated.View style={[styles.timelineFill, videoAnimatedFillStyle]} />
                        <Animated.View style={[styles.timelineThumb, videoAnimatedThumbStyle]} />
                      </View>
                    </GestureDetector>
                    <Text style={styles.videoTimeText}>{formatDuration(videoDuration)}</Text>
                  </View>
                )}

                <ChatComposerBar
                  value={captions[currentMedia.id] || ''}
                  onChangeText={(text) => setCaptions(prev => ({ ...prev, [currentMedia.id]: text }))}
                  placeholder="הוסף כיתוב..."
                  maxLength={500}
                  onSend={handleSend}
                />

              {localFiles.length > 1 && (
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
                        index === currentIndex && styles.thumbnailActive,
                      ]}
                    >
                      {media.type === 'image' ? (
                        <ExpoImage
                          source={{ uri: media.uri }}
                          style={styles.thumbnail}
                          contentFit="cover"
                          cachePolicy="memory-disk"
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
                            <Play size={16} color="#fff" fill="#fff" />
                          </View>
                        </View>
                      ) : (
                        <View style={[styles.thumbnail, styles.thumbnailDocument]}>
                          <Ionicons name="document-text" size={24} color={COLORS.text} />
                        </View>
                      )}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          removeMedia(media.id);
                        }}
                        style={styles.thumbnailRemove}
                      >
                        <X size={12} color="#fff" strokeWidth={3} />
                      </Pressable>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              </View>
            </BlurView>
          </Animated.View>
        </RNAnimatedView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#000',
  },
  /** פס עליון — blur/glass כמו MediaViewer */
  topGlassBar: {
    zIndex: 2,
    overflow: 'hidden',
  },
  glassBarBlur: {
    width: '100%',
  },
  topGlassContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  /** אזור המדיה באמצע — letterbox בתוך viewport בלבד */
  mediaViewport: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
  },
  mediaContainLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  /** מילוי מלא של viewport — contain על תמונה/וידאו */
  mediaFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  hiddenVideo: {
    opacity: 0,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    backgroundColor: '#000',
  },
  glassButton: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  blurFill: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 100,
  },
  glassInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.glass,
  },
  counterBadge: {
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  counterInner: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.glass,
  },
  counterText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    zIndex: 10,
  },
  navArrowInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.glass,
  },
  navLeft: {
    left: 16,
  },
  navRight: {
    right: 16,
  },
  /** פס תחתון — blur/glass + אינפוט */
  bottomGlassBar: {
    width: '100%',
    zIndex: 2,
    overflow: 'hidden',
  },
  bottomGlassContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
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
  timelineTrackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 7,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
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
  captionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  captionGlass: {
    flex: 1,
    minHeight: 48,
    maxHeight: 100,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  captionInput: {
    fontSize: 16,
    maxHeight: 76,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  sendBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  thumbnailActive: {
    borderColor: COLORS.primary,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  thumbnailVideo: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbnailVideoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  thumbnailDocument: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  audioContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 24,
  },
  audioPlayInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.glass,
  },
  audioTime: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: 2,
  },
  audioName: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  documentContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 24,
  },
  documentIconInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.glass,
  },
  documentName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
});
