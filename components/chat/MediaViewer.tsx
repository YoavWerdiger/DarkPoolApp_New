// ============================================
// Media Viewer Component - Glass Design
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { View, Text, Modal, Pressable, StyleSheet, Dimensions, ActivityIndicator, Share as RNShare, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { X, Share, Forward, Copy, Download, Reply } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';
import { chatPalette as COLORS } from './chatDesignTokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Soft spring — WhatsApp / Photos-like zoom settle */
const ZOOM_SPRING = { damping: 22, stiffness: 180, mass: 0.85 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2.5;

function isDisplayableMediaUri(u: string | null | undefined): u is string {
  return !!u && (u.startsWith('http') || u.startsWith('file:') || u.startsWith('content:'));
}

interface MediaViewerProps {
  visible: boolean;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  onClose: () => void;
  onReply?: () => void;
  onForward?: () => void;
}

export default function MediaViewer({
  visible,
  mediaUrl,
  mediaType,
  caption,
  onClose,
  onReply,
  onForward,
}: MediaViewerProps) {
  const insets = useSafeAreaInsets();
  const [displayUri, setDisplayUri] = useState(mediaUrl);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const positionRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastSeekTargetRef = useRef<number | null>(null);
  const durationVal = useSharedValue(0);
  const timelineWidthVal = useSharedValue(0);
  const startPositionVal = useSharedValue(0);
  const positionShared = useSharedValue(0);
  positionRef.current = position;

  const displayPosition = isDragging ? dragPosition : position;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!visible || !mediaUrl) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);
    getChatMediaDisplayUri(mediaUrl).then((u) => {
      if (cancelled) return;
      if (u) setDisplayUri(u);
      else if (isDisplayableMediaUri(mediaUrl)) setDisplayUri(mediaUrl);
      else setLoadError(true);
      setIsLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setLoadError(true);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, mediaUrl]);

  useEffect(() => {
    if (!visible && videoRef.current) {
      videoRef.current.stopAsync().catch(() => {});
      videoRef.current.unloadAsync().catch(() => {});
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    }
  }, [visible]);

  React.useEffect(() => {
    if (!isDragging) {
      positionShared.value = withTiming(position, { duration: 120 });
    }
  }, [position, isDragging]);

  React.useEffect(() => {
    durationVal.value = duration;
    timelineWidthVal.value = timelineWidth;
  }, [duration, timelineWidth]);

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

  const handleTimelinePress = useCallback((evt: { nativeEvent: { locationX: number } }) => {
    if (timelineWidth <= 0 || duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, evt.nativeEvent.locationX / timelineWidth));
    handleSeek(ratio * duration);
  }, [timelineWidth, duration, handleSeek]);

  isDraggingRef.current = isDragging;

  const recordDragStart = useCallback(() => {
    startPositionVal.value = position;
    positionShared.value = position;
    setDragPosition(position);
    setIsDragging(true);
    isDraggingRef.current = true;
  }, [position]);

  const commitSeek = useCallback((finalPositionSeconds: number) => {
    positionShared.value = finalPositionSeconds;
    setPosition(finalPositionSeconds);
    setIsDragging(false);
    isDraggingRef.current = false;
    handleSeek(finalPositionSeconds);
  }, [handleSeek]);

  const handleTimelineTap = useCallback((x: number) => {
    if (timelineWidth <= 0 || duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / timelineWidth));
    const sec = ratio * duration;
    positionShared.value = sec;
    setPosition(sec);
    handleSeek(sec);
  }, [timelineWidth, duration, handleSeek]);

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

  const timelineTapGesture = Gesture.Tap()
    .onEnd((e) => {
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

  // Reset video state when modal closes or url changes
  React.useEffect(() => {
    if (!visible) {
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    }
  }, [visible, mediaUrl]);

  // Animation values for zoom and pan
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Pinch start snapshot (focal kept fixed under fingers)
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartTranslateX = useSharedValue(0);
  const pinchStartTranslateY = useSharedValue(0);
  const isPinching = useSharedValue(false);

  const clampTranslation = (tx: number, ty: number, s: number) => {
    'worklet';
    if (s <= 1) return { x: 0, y: 0 };
    const maxX = (SCREEN_WIDTH * (s - 1)) / 2;
    const maxY = (SCREEN_HEIGHT * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    };
  };

  const commitTransform = (s: number, tx: number, ty: number, animate: boolean) => {
    'worklet';
    const clamped = clampTranslation(tx, ty, s);
    if (animate) {
      scale.value = withSpring(s, ZOOM_SPRING);
      translateX.value = withSpring(clamped.x, ZOOM_SPRING);
      translateY.value = withSpring(clamped.y, ZOOM_SPRING);
    } else {
      scale.value = s;
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    }
    savedScale.value = s;
    savedTranslateX.value = clamped.x;
    savedTranslateY.value = clamped.y;
  };

  const resetZoom = () => {
    'worklet';
    commitTransform(1, 0, 0, true);
  };

  // Reset when modal closes
  React.useEffect(() => {
    if (!visible) {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      isPinching.value = false;
    }
  }, [visible]);

  // Pinch — Apple Photos focal-point math (keeps point under fingers fixed)
  // newTranslate = focalOffset * (1 - ratio) + startTranslate * ratio
  // where ratio = newScale / startScale. Using event.scale alone + bare startTranslate jumps when already panned.
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      'worklet';
      isPinching.value = true;
      // Live values (not saved*) so mid-spring double-tap does not jump
      pinchStartScale.value = scale.value;
      pinchStartTranslateX.value = translateX.value;
      pinchStartTranslateY.value = translateY.value;
      pinchFocalX.value = event.focalX - SCREEN_WIDTH / 2;
      pinchFocalY.value = event.focalY - SCREEN_HEIGHT / 2;
    })
    .onUpdate((event) => {
      'worklet';
      if (event.numberOfPointers < 2) return;
      const rawScale = pinchStartScale.value * event.scale;
      // Soft rubber-band below 1 / above max while dragging
      let newScale = rawScale;
      if (rawScale < MIN_ZOOM) {
        newScale = MIN_ZOOM - (MIN_ZOOM - rawScale) * 0.35;
      } else if (rawScale > MAX_ZOOM) {
        newScale = MAX_ZOOM + (rawScale - MAX_ZOOM) * 0.25;
      }
      // Guard divide-by-zero if start scale was cleared mid-gesture
      const start = pinchStartScale.value || 1;
      const scaleRatio = newScale / start;
      const focalX = pinchFocalX.value;
      const focalY = pinchFocalY.value;
      scale.value = newScale;
      translateX.value =
        focalX * (1 - scaleRatio) + pinchStartTranslateX.value * scaleRatio;
      translateY.value =
        focalY * (1 - scaleRatio) + pinchStartTranslateY.value * scaleRatio;
    })
    .onEnd(() => {
      'worklet';
      isPinching.value = false;
      if (scale.value < MIN_ZOOM) {
        resetZoom();
        return;
      }
      const targetScale = Math.min(MAX_ZOOM, scale.value);
      const clamped = clampTranslation(translateX.value, translateY.value, targetScale);
      commitTransform(targetScale, clamped.x, clamped.y, true);
    });

  // Pan — one finger only so it never fights pinch translation
  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .minDistance(8)
    .onStart(() => {
      'worklet';
      if (isPinching.value) return;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      'worklet';
      if (isPinching.value || scale.value <= 1) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd((event) => {
      'worklet';
      if (isPinching.value) return;
      if (scale.value <= 1) {
        resetZoom();
        return;
      }
      // Light momentum then clamp
      const nextX = translateX.value + event.velocityX * 0.08;
      const nextY = translateY.value + event.velocityY * 0.08;
      const clamped = clampTranslation(nextX, nextY, scale.value);
      translateX.value = withSpring(clamped.x, ZOOM_SPRING);
      translateY.value = withSpring(clamped.y, ZOOM_SPRING);
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
      savedScale.value = scale.value;
    });

  // Double tap — spring zoom in on tap point / spring zoom out
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd((event) => {
      'worklet';
      if (scale.value > 1.05) {
        resetZoom();
        return;
      }
      const fX = event.x - SCREEN_WIDTH / 2;
      const fY = event.y - SCREEN_HEIGHT / 2;
      const nextX = -fX * (DOUBLE_TAP_ZOOM - 1);
      const nextY = -fY * (DOUBLE_TAP_ZOOM - 1);
      commitTransform(DOUBLE_TAP_ZOOM, nextX, nextY, true);
    });

  // Simultaneous: pinch+pan coexist; double-tap recognized without Exclusive delay on pan
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleShare = async () => {
    try {
      await RNShare.share({ url: displayUri });
    } catch (error) {
      logger.error('MediaViewer', 'Share failed', error);
    }
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(displayUri);
      legacyAlert('הועתק', 'הקישור הועתק ללוח');
    } catch (error) {
      logger.error('MediaViewer', 'Copy URL failed', error);
    }
  };

  const handleDownload = async () => {
    try {
      if (Platform.OS === 'web') {
        legacyAlert('מידע', 'הורדה לא זמינה בפלטפורמה זו');
        return;
      }
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        legacyAlert('שגיאה', 'לא ניתן לגשת לתיקייה');
        return;
      }
      const fileUri = `${cacheDir}media_${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
      const downloadResult = await FileSystem.downloadAsync(displayUri, fileUri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri);
      } else {
        legacyAlert('הורד', 'הקובץ נשמר בהצלחה');
      }
    } catch (error) {
      legacyAlert('שגיאה', 'לא ניתן להוריד את הקובץ');
    }
  };

  if (!visible) return null;

  const ActionButton = ({ onPress, icon: Icon }: any) => (
    <Pressable onPress={onPress} style={styles.actionButton}>
      <Icon size={24} color={COLORS.text} strokeWidth={1.5} />
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.container}>
        {/* Media Content */}
        <View style={styles.mediaContainer}>
          {mediaType === 'image' ? (
            <>
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
              )}
              {loadError ? (
                <View style={styles.mediaErrorContainer}>
                  <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.mediaErrorText}>לא ניתן לטעון את התמונה</Text>
                  <TouchableOpacity
                    style={styles.mediaErrorRetry}
                    onPress={() => { setLoadError(false); setIsLoading(true); }}
                  >
                    <Text style={styles.mediaErrorRetryText}>נסה שוב</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <GestureDetector gesture={composedGesture}>
                  <Animated.View style={styles.fullImage} collapsable={false}>
                    <Animated.Image
                      source={{ uri: displayUri }}
                      style={[StyleSheet.absoluteFillObject, imageAnimatedStyle]}
                      resizeMode="contain"
                      onLoadStart={() => { setIsLoading(true); setLoadError(false); }}
                      onLoadEnd={() => setIsLoading(false)}
                      onError={() => { setIsLoading(false); setLoadError(true); }}
                    />
                  </Animated.View>
                </GestureDetector>
              )}
            </>
          ) : mediaType === 'video' ? (
            <>
              {(!isDisplayableMediaUri(displayUri) || isLoading) && !loadError && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
              )}
              {loadError ? (
                <View style={styles.mediaErrorContainer}>
                  <Ionicons name="videocam-outline" size={64} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.mediaErrorText}>לא ניתן לטעון את הסרטון</Text>
                </View>
              ) : isDisplayableMediaUri(displayUri) ? (
                <Video
                  ref={videoRef}
                  source={{ uri: displayUri }}
                  style={styles.fullVideo}
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
                  }}
                  onLoadStart={() => { setIsLoading(true); setLoadError(false); }}
                  onLoad={() => {
                    setIsLoading(false);
                    (videoRef.current as any)?.setStatusAsync?.({ progressUpdateIntervalMillis: 100 });
                  }}
                  onError={() => { setIsLoading(false); setLoadError(true); }}
                />
              ) : null}
            </>
          ) : null}
        </View>

        {/* Top Bar - Full Width (always visible like MediaPreviewModal) */}
        <View style={styles.topBar}>
            <BlurView intensity={80} tint="dark" style={styles.topBlur}>
              <View style={[styles.topContent, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <X size={24} color={COLORS.text} strokeWidth={2} />
                </Pressable>
                <View style={styles.topSpacer} />
              </View>
            </BlurView>
          </View>

        {/* Bottom Bar - Full Width (always visible like MediaPreviewModal) */}
        <View style={styles.bottomBar}>
            <BlurView intensity={80} tint="dark" style={styles.bottomBlur}>
              <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 12 }]}>
                {/* Video controls: טיימליין + play/pause */}
                {mediaType === 'video' && (
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
                )}

                {/* Caption */}
                {caption && caption.trim().length > 0 && (
                  <View style={styles.captionContainer}>
                    <Text style={styles.captionText} numberOfLines={2}>{caption}</Text>
                  </View>
                )}

                {/* Actions Row */}
                <View style={styles.actionsRow}>
                  <ActionButton onPress={handleShare} icon={Share} />
                  {onReply && (
                    <ActionButton 
                      onPress={() => { onClose(); onReply(); }} 
                      icon={Reply} 
                    />
                  )}
                  {onForward && (
                    <ActionButton 
                      onPress={() => { onClose(); onForward(); }} 
                      icon={Forward} 
                    />
                  )}
                  <ActionButton onPress={handleCopy} icon={Copy} />
                  <ActionButton onPress={handleDownload} icon={Download} />
                </View>
              </View>
            </BlurView>
          </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
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
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSpacer: {
    flex: 1,
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
