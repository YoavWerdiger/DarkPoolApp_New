import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { View, Text, Image, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, Dimensions, Modal, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { chatPalette } from './chatDesignTokens';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import {
  UserStory,
  StoryWithUser,
  getStoriesByUserId,
  markStoryViewed,
  deleteStory,
} from '../../services/storiesService';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 10000;
const VIDEO_MAX_DURATION = 60000;

/* ── Progress bar item (separate component so useAnimatedStyle works per bar) ── */
function ProgressBarFill({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const animStyle = useAnimatedStyle(() => {
    'worklet';
    const val = Math.max(0, Math.min(1, progress.value - index));
    return { transform: [{ scaleX: val }] };
  });

  return (
    <View style={[barStyles.track, { flex: 1, marginHorizontal: 1.5 }]}>
      <Reanimated.View style={[barStyles.fill, animStyle]} />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
    transformOrigin: 'right center',
  },
});

/* ── Main component ── */
interface StoryViewerProps {
  visible: boolean;
  onClose: () => void;
  storiesByUser: StoryWithUser[];
  initialUserIndex?: number;
  onStoriesChanged?: () => void;
}

export default function StoryViewer({
  visible,
  onClose,
  storiesByUser,
  initialUserIndex = 0,
  onStoriesChanged,
}: StoryViewerProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [stories, setStories] = useState<UserStory[]>([]);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const progress = useSharedValue(0);
  const startTimeRef = useRef(0);
  const remainingRef = useRef(STORY_DURATION);
  const goNextRef = useRef<() => void>(() => {});
  const isTransitioningRef = useRef(false);
  const progressStartedFor = useRef<string | null>(null);

  const currentUser = storiesByUser[userIndex];
  const currentStory = stories[storyIndex];
  const isOwnStory = currentUser?.user_id === user?.id;

  // Reset on open
  useEffect(() => {
    if (visible) {
      setUserIndex(initialUserIndex);
      setStoryIndex(0);
      setStories([]);
      setIsLoading(true);
      setMediaReady(false);
      setMediaError(false);
    } else {
      cancelAnimation(progress);
    }
  }, [visible, initialUserIndex]);

  // Load stories for current user
  useEffect(() => {
    if (!visible || !currentUser) return;
    let cancelled = false;
    progressStartedFor.current = null;
    cancelAnimation(progress);
    progress.value = 0;
    (async () => {
      setIsLoading(true);
      setMediaReady(false);
      setMediaError(false);
      setVideoDuration(null);
      try {
        const data = await getStoriesByUserId(currentUser.user_id);
        if (!cancelled) {
          setStories(data);
          setStoryIndex(0);
        }
      } catch (e) {
        logger.error('StoryViewer', 'Failed to load stories', e);
        if (!cancelled) setStories([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, userIndex]);

  // Mark viewed
  useEffect(() => {
    if (!currentStory || !user?.id) return;
    markStoryViewed(currentStory.id, user.id).catch(() => {});
  }, [currentStory?.id, user?.id]);

  // Prefetch next story image
  useEffect(() => {
    if (!visible || stories.length === 0) return;
    const nextStory = stories[storyIndex + 1];
    if (nextStory?.media_url && nextStory.media_type === 'image') {
      Image.prefetch(nextStory.media_url).catch(() => {});
    }
  }, [visible, storyIndex, stories]);

  const handleAutoNext = useCallback(() => {
    goNextRef.current();
  }, []);

  const startProgress = useCallback((index: number, duration: number) => {
    cancelAnimation(progress);
    progress.value = index;
    remainingRef.current = duration;
    startTimeRef.current = Date.now();
    progress.value = withTiming(index + 1, {
      duration,
      easing: Easing.linear,
    }, (finished) => {
      'worklet';
      if (finished) runOnJS(handleAutoNext)();
    });
  }, [handleAutoNext, progress]);

  const goNext = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    cancelAnimation(progress);
    progressStartedFor.current = null;
    if (storyIndex < stories.length - 1) {
      setMediaReady(false);
      setMediaError(false);
      setVideoDuration(null);
      setStoryIndex(prev => prev + 1);
    } else if (userIndex < storiesByUser.length - 1) {
      setMediaReady(false);
      setMediaError(false);
      setVideoDuration(null);
      setUserIndex(prev => prev + 1);
    } else {
      onClose();
    }
    setTimeout(() => { isTransitioningRef.current = false; }, 100);
  }, [storyIndex, stories.length, userIndex, storiesByUser.length, onClose, progress]);

  useEffect(() => { goNextRef.current = goNext; }, [goNext]);

  const goPrev = useCallback(() => {
    cancelAnimation(progress);
    progressStartedFor.current = null;
    if (storyIndex > 0) {
      setMediaReady(false);
      setMediaError(false);
      setVideoDuration(null);
      setStoryIndex(prev => prev - 1);
    } else if (userIndex > 0) {
      setMediaReady(false);
      setMediaError(false);
      setVideoDuration(null);
      setUserIndex(prev => prev - 1);
    }
  }, [storyIndex, userIndex, progress]);

  // Kick off progress
  useEffect(() => {
    if (!visible || isLoading || !currentStory || stories.length === 0) return;
    if (progressStartedFor.current === currentStory.id) return;

    if (currentStory.media_type === 'text') {
      progressStartedFor.current = currentStory.id;
      startProgress(storyIndex, STORY_DURATION);
      return;
    }

    if (!mediaReady && !mediaError) {
      const fallback = setTimeout(() => setMediaReady(true), 4000);
      return () => clearTimeout(fallback);
    }

    const duration = currentStory.media_type === 'video'
      ? (videoDuration || VIDEO_MAX_DURATION)
      : STORY_DURATION;

    progressStartedFor.current = currentStory.id;
    startProgress(storyIndex, duration);
  }, [visible, isLoading, storyIndex, currentStory?.id, mediaReady, mediaError, videoDuration, startProgress]);

  // Stop animation when viewer closes
  useEffect(() => {
    if (!visible) {
      cancelAnimation(progress);
      progressStartedFor.current = null;
    }
  }, [visible, progress]);

  const handlePauseStart = useCallback(() => {
    setIsPaused(true);
    cancelAnimation(progress);
    const elapsed = Date.now() - startTimeRef.current;
    remainingRef.current = Math.max(remainingRef.current - elapsed, 500);
  }, [progress]);

  const handlePauseEnd = useCallback(() => {
    setIsPaused(false);
    startTimeRef.current = Date.now();
    progress.value = withTiming(storyIndex + 1, {
      duration: remainingRef.current,
      easing: Easing.linear,
    }, (finished) => {
      'worklet';
      if (finished) runOnJS(handleAutoNext)();
    });
  }, [storyIndex, progress, handleAutoNext]);

  const handleDeleteStory = useCallback(() => {
    if (!currentStory || !user?.id) return;
    cancelAnimation(progress);
    legacyAlert('מחיקת סטטוס', 'האם למחוק את הסטטוס?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStory(currentStory.id, user.id);
            onStoriesChanged?.();
            if (stories.length <= 1) {
              if (userIndex < storiesByUser.length - 1) {
                setUserIndex(prev => prev + 1);
              } else {
                onClose();
              }
            } else {
              const newStories = stories.filter(s => s.id !== currentStory.id);
              setStories(newStories);
              progressStartedFor.current = null;
              setStoryIndex(Math.min(storyIndex, newStories.length - 1));
              setMediaReady(false);
            }
          } catch {
            legacyAlert('שגיאה', 'לא הצלחנו למחוק');
          }
        },
      },
    ]);
  }, [currentStory, user?.id, stories, storyIndex, userIndex, storiesByUser.length, onClose, onStoriesChanged, progress]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'עכשיו';
    if (diffMin < 60) return `לפני ${diffMin} דק׳`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `לפני ${diffHrs} שע׳`;
    return `לפני ${Math.floor(diffHrs / 24)} ימים`;
  };

  if (!visible) return null;

  const displayName = currentUser?.user?.display_name || currentUser?.user?.full_name || 'משתמש';
  const avatar = currentUser?.user?.profile_picture;
  const showMediaSpinner = currentStory &&
    (currentStory.media_type === 'image' || currentStory.media_type === 'video') &&
    !mediaReady && !mediaError;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={chatPalette.primary} />
          </View>
        ) : currentStory ? (
          <>
            {/* ===== Media layer ===== */}
            {currentStory.media_type === 'image' && currentStory.media_url ? (
              <Image
                source={{ uri: currentStory.media_url }}
                style={styles.fullMedia}
                resizeMode="contain"
                onLoad={() => setMediaReady(true)}
                onError={() => { setMediaError(true); setMediaReady(true); }}
              />
            ) : currentStory.media_type === 'video' && currentStory.media_url ? (
              <Video
                source={{ uri: currentStory.media_url }}
                style={styles.fullMedia}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={!isPaused}
                isLooping={false}
                onReadyForDisplay={() => setMediaReady(true)}
                onLoad={(status) => {
                  if (status.isLoaded && status.durationMillis) {
                    setVideoDuration(status.durationMillis);
                  }
                }}
                onPlaybackStatusUpdate={(status) => {
                  if (status.isLoaded && status.didJustFinish) {
                    goNextRef.current();
                  }
                }}
                onError={() => { setMediaError(true); setMediaReady(true); }}
              />
            ) : currentStory.media_type === 'text' ? (
              <View style={[styles.textBg, { backgroundColor: currentStory.background_color || '#1B5E20' }]}>
                <Text style={styles.textContent}>{currentStory.content || ''}</Text>
              </View>
            ) : (
              <View style={[styles.center, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
                <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>לא ניתן להציג</Text>
              </View>
            )}

            {showMediaSpinner && (
              <View style={styles.mediaSpinner}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}

            {mediaError && (
              <View style={styles.center}>
                <Ionicons name="cloud-offline-outline" size={48} color="rgba(255,255,255,0.4)" />
                <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 14 }}>
                  שגיאה בטעינת המדיה
                </Text>
              </View>
            )}

            {/* ===== Text overlays (video, or image fallback when content has JSON) ===== */}
            {mediaReady && (currentStory.media_type === 'video' || currentStory.media_type === 'image') && currentStory.content && (() => {
              try {
                const parsed = JSON.parse(currentStory.content);
                if (!Array.isArray(parsed)) return null;
                return parsed.map((o: any, idx: number) => {
                  const bgColor = o.bgStyle === 'solid'
                    ? (o.color === '#FFFFFF' ? '#000000' : '#FFFFFF')
                    : o.bgStyle === 'semi'
                      ? 'rgba(0,0,0,0.45)'
                      : 'transparent';
                  return (
                    <View
                      key={idx}
                      style={[styles.overlayText, { zIndex: 12 }]}
                      pointerEvents="none"
                    >
                      <View style={{
                        backgroundColor: bgColor,
                        borderRadius: o.bgStyle !== 'none' ? 12 : 0,
                        paddingHorizontal: o.bgStyle !== 'none' ? 16 : 0,
                        paddingVertical: o.bgStyle !== 'none' ? 8 : 0,
                        maxWidth: SCREEN_WIDTH * 0.85,
                      }}>
                        <Text style={{
                          color: o.color || '#fff',
                          fontSize: o.fontSize || 28,
                          fontWeight: o.bold ? '800' : '400',
                          textAlign: 'center',
                          textShadowColor: 'rgba(0,0,0,0.5)',
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 4,
                        }}>
                          {o.text}
                        </Text>
                      </View>
                    </View>
                  );
                });
              } catch { return null; }
            })()}

            {/* ===== Top overlay: progress + header ===== */}
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']}
              locations={[0, 0.6, 1]}
              style={[styles.topGradient, { paddingTop: insets.top + 10 }]}
              pointerEvents="box-none"
            >
              {/* Progress bars */}
              <View style={styles.progressRow}>
                {stories.map((_, i) => (
                  <ProgressBarFill key={i} index={i} progress={progress} />
                ))}
              </View>

              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>

                <View style={styles.headerInfo}>
                  <Text style={styles.headerTime}>
                    {currentStory.created_at ? formatTime(currentStory.created_at) : ''}
                  </Text>
                  <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.headerAvatar} />
                  ) : (
                    <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
                      <Ionicons name="person" size={18} color="rgba(255,255,255,0.7)" />
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>

            {/* ===== Bottom overlay ===== */}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
              style={[styles.bottomGradient, { paddingBottom: insets.bottom + 20 }]}
              pointerEvents="box-none"
            >
              {isOwnStory && (
                <View style={styles.bottomActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={handleDeleteStory}>
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.actionText}>מחק</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>

            {/* ===== Touch zones (left=forward, right=back) ===== */}
            <View style={styles.touchZone} pointerEvents="box-none">
              <TouchableWithoutFeedback
                onPress={goNext}
                onLongPress={handlePauseStart}
                onPressOut={() => { if (isPaused) handlePauseEnd(); }}
              >
                <View style={styles.touchLeft} />
              </TouchableWithoutFeedback>
              <TouchableWithoutFeedback
                onPress={goPrev}
                onLongPress={handlePauseStart}
                onPressOut={() => { if (isPaused) handlePauseEnd(); }}
              >
                <View style={styles.touchRight} />
              </TouchableWithoutFeedback>
            </View>
          </>
        ) : (
          <TouchableOpacity style={styles.center} onPress={onClose} activeOpacity={0.9}>
            <Ionicons name="images-outline" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>אין סטטוסים</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullMedia: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  textBg: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  textContent: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 40,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  mediaSpinner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },

  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerAvatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    maxWidth: 180,
  },
  headerTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginRight: 8,
  },
  closeBtn: {
    padding: 6,
  },

  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    gap: 6,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  touchZone: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    direction: 'ltr',
    zIndex: 5,
  },
  touchLeft: {
    flex: 2,
  },
  touchRight: {
    flex: 1,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    marginTop: 12,
  },
  overlayText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
