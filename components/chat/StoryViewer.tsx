import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { logger } from '../../utils/logger';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Modal,
  StatusBar,
  ActivityIndicator,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { chatPalette } from './chatDesignTokens';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  cancelAnimation,
  runOnJS,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import {
  FlatList,
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {
  UserStory,
  StoryWithUser,
  StoryViewer as StoryViewerRow,
  StoryReaction,
  getStoriesByUserId,
  markStoryViewed,
  deleteStory,
  reactToStory,
  getMyStoryReaction,
  getStoryViewers,
  getStoryReactions,
} from '../../services/storiesService';
import { useAuth } from '../../context/AuthContext';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 10000;
const VIDEO_MAX_DURATION = 60000;
const REACTION_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👏'];

/* ── Flying reaction emoji (one instance per tap, self-removes) ── */
interface FlyingEmoji {
  id: number;
  emoji: string;
  startX: number; // px, relative to bar center
}

function FlyingEmojiItem({
  emoji,
  startX,
  onDone,
}: {
  emoji: string;
  startX: number;
  onDone: () => void;
}) {
  const tx = useSharedValue(startX);
  const ty = useSharedValue(0);
  const sc = useSharedValue(0.4);
  const op = useSharedValue(1);

  // Slight horizontal drift so bursts don't look robotic
  const drift = React.useMemo(() => (Math.random() - 0.5) * 60, []);
  const rise = React.useMemo(() => -260 - Math.random() * 60, []);

  useEffect(() => {
    sc.value = withSpring(1.5, { damping: 8, stiffness: 140 });
    ty.value = withTiming(rise, { duration: 1300, easing: Easing.out(Easing.quad) });
    tx.value = withTiming(startX + drift, {
      duration: 1300,
      easing: Easing.inOut(Easing.quad),
    });
    op.value = withTiming(0, { duration: 1300 }, (finished) => {
      'worklet';
      if (finished) runOnJS(onDone)();
    });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: sc.value },
    ],
    opacity: op.value,
  }));

  return (
    <Reanimated.View style={[reactStyles.flying, style]} pointerEvents="none">
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
    </Reanimated.View>
  );
}

/* ── Single reaction button with subtle press animation ── */
function ReactionButton({
  emoji,
  isSelected,
  onPress,
}: {
  emoji: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  // Initialize scale to final value so there's NO entrance animation when
  // the bar first mounts (or when story changes). Only tap interactions
  // (press-in / press-out) animate afterwards.
  const scale = useSharedValue(isSelected ? 1.15 : 1);
  const didMountRef = useRef(false);

  const handlePressIn = () => {
    scale.value = withSpring(0.85, { damping: 12, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(isSelected ? 1.15 : 1, { damping: 10, stiffness: 220 });
  };

  useEffect(() => {
    // Skip the mount pass so the button doesn't "pop in" on story entrance
    // — only animate real subsequent selection changes (e.g. user taps).
    if (!didMountRef.current) {
      didMountRef.current = true;
      scale.value = isSelected ? 1.15 : 1;
      return;
    }
    scale.value = withSpring(isSelected ? 1.15 : 1, { damping: 10, stiffness: 220 });
  }, [isSelected]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={reactStyles.btn}
      pointerEvents="auto"
    >
      <Reanimated.View style={[reactStyles.btnInner, isSelected && reactStyles.btnInnerSelected, style]}>
        <Text style={reactStyles.emoji}>{emoji}</Text>
      </Reanimated.View>
    </Pressable>
  );
}

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

/* ── Viewers / reactions sheet (inline, no nested Modal) ── */
type ViewersSheetProps = {
  insetsBottom: number;
  insetsTop: number;
  loading: boolean;
  viewers: Array<{
    story_id: string;
    viewer_id: string;
    viewed_at: string;
    emoji?: string | null;
    user: { id: string; display_name: string | null; full_name: string | null; profile_picture: string | null };
  }>;
  reactions: Array<{
    id: string;
    story_id: string;
    reactor_id: string;
    emoji: string;
    created_at: string;
    updated_at: string;
    user: { id: string; display_name: string | null; full_name: string | null; profile_picture: string | null };
  }>;
  tab: 'viewers' | 'reactions';
  onChangeTab: (tab: 'viewers' | 'reactions') => void;
  onClose: () => void;
};

function ViewersSheet({
  insetsBottom,
  insetsTop,
  loading,
  viewers,
  reactions,
  tab,
  onChangeTab,
  onClose,
}: ViewersSheetProps) {
  const SHEET_HEIGHT = Math.max(SCREEN_HEIGHT * 0.6, 420);
  const MAX_TRANSLATE = SHEET_HEIGHT;

  const translateY = useSharedValue(MAX_TRANSLATE);
  const startY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
    opacity.value = withTiming(1, { duration: 220 });
  }, []);

  const handleClose = useCallback(() => {
    opacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(MAX_TRANSLATE, { duration: 220 }, (finished) => {
      'worklet';
      if (finished) runOnJS(onClose)();
    });
  }, [onClose, MAX_TRANSLATE]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([12, 9999])
    .failOffsetX([-24, 24])
    .onStart(() => {
      'worklet';
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      const y = Math.max(0, startY.value + e.translationY);
      translateY.value = y;
    })
    .onEnd((e) => {
      'worklet';
      const shouldClose = translateY.value > MAX_TRANSLATE * 0.28 || e.velocityY > 900;
      if (shouldClose) {
        translateY.value = withTiming(MAX_TRANSLATE, { duration: 200 }, (finished) => {
          'worklet';
          if (finished) runOnJS(onClose)();
        });
        opacity.value = withTiming(0, { duration: 200 });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value * 0.7 }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const displayName = (u: { display_name: string | null; full_name: string | null }) =>
    u.display_name || u.full_name || 'משתמש';

  const listData = tab === 'viewers' ? viewers : reactions;

  return (
    <View style={sheetStyles.root} pointerEvents="box-none">
      <Reanimated.View style={[sheetStyles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Reanimated.View>

      <GestureDetector gesture={panGesture}>
        <Reanimated.View
          style={[
            sheetStyles.sheet,
            { height: SHEET_HEIGHT, top: SCREEN_HEIGHT - SHEET_HEIGHT },
            sheetStyle,
          ]}
        >
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={sheetStyles.sheetTint} pointerEvents="none" />

          {/* Grabber */}
          <View style={sheetStyles.grabberWrap} pointerEvents="none">
            <View style={sheetStyles.grabber} />
          </View>

          {/* Tabs */}
          <View style={sheetStyles.tabsRow}>
            <TouchableOpacity
              style={[sheetStyles.tab, tab === 'viewers' && sheetStyles.tabActive]}
              onPress={() => onChangeTab('viewers')}
              activeOpacity={0.7}
            >
              <Ionicons name="eye-outline" size={18} color={tab === 'viewers' ? '#fff' : 'rgba(255,255,255,0.55)'} />
              <Text style={[sheetStyles.tabText, tab === 'viewers' && sheetStyles.tabTextActive]}>
                {`צפיות${viewers.length ? ` · ${viewers.length}` : ''}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[sheetStyles.tab, tab === 'reactions' && sheetStyles.tabActive]}
              onPress={() => onChangeTab('reactions')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16 }}>❤️</Text>
              <Text style={[sheetStyles.tabText, tab === 'reactions' && sheetStyles.tabTextActive]}>
                {`ריאקציות${reactions.length ? ` · ${reactions.length}` : ''}`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* List / states */}
          {loading ? (
            <View style={sheetStyles.center}>
              <ActivityIndicator color={chatPalette.primary} />
            </View>
          ) : listData.length === 0 ? (
            <View style={sheetStyles.center}>
              <Ionicons
                name={tab === 'viewers' ? 'eye-off-outline' : 'heart-outline'}
                size={40}
                color="rgba(255,255,255,0.25)"
              />
              <Text style={sheetStyles.emptyText}>
                {tab === 'viewers' ? 'עדיין אף אחד לא צפה' : 'עדיין אין ריאקציות'}
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {listData.map((row: any, idx) => {
                const emoji = tab === 'viewers' ? row.emoji : row.emoji;
                return (
                  <View key={`${row.viewer_id || row.reactor_id}-${idx}`} style={sheetStyles.row}>
                    {emoji ? <Text style={sheetStyles.rowEmoji}>{emoji}</Text> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={sheetStyles.rowName} numberOfLines={1}>{displayName(row.user)}</Text>
                    </View>
                    {row.user.profile_picture ? (
                      <Image source={{ uri: row.user.profile_picture }} style={sheetStyles.avatar} />
                    ) : (
                      <View style={[sheetStyles.avatar, sheetStyles.avatarPlaceholder]}>
                        <Ionicons name="person" size={18} color="rgba(255,255,255,0.7)" />
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={{ height: insetsBottom + 12 }} />
            </View>
          )}
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  sheetTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,14,10,0.82)',
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  tabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  rowEmoji: {
    fontSize: 22,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
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

  const [userIndex, setUserIndex] = useState(() =>
    Math.max(0, initialUserIndex),
  );
  const [stories, setStories] = useState<UserStory[]>([]);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  // Own-story viewers/reactions sheet visibility (declared early so it can
  // gate the swipe/dismiss gestures below).
  const [viewersSheetOpen, setViewersSheetOpen] = useState(false);

  const progress = useSharedValue(0);
  const startTimeRef = useRef(0);
  const remainingRef = useRef(STORY_DURATION);
  const goNextRef = useRef<() => void>(() => {});
  const goPrevRef = useRef<() => void>(() => {});
  const isTransitioningRef = useRef(false);
  const progressStartedFor = useRef<string | null>(null);
  /**
   * When switching users, load effect usually opens story 0.
   * Going "back" to the previous user should land on their last story.
   */
  const pendingStoryIndexRef = useRef<number | 'last' | null>(null);
  /** Cache stories per user for instant user↔user switches (kills black flash). */
  const storiesCacheRef = useRef<Map<string, UserStory[]>>(new Map());
  /** When switchToUser already applied cache, load effect should not reset storyIndex. */
  const skipLoadApplyRef = useRef(false);
  // Keep latest indices for timers/video callbacks (avoid stale closures).
  const userIndexRef = useRef(userIndex);
  const storyIndexRef = useRef(storyIndex);
  const storiesLenRef = useRef(0);
  const usersLenRef = useRef(storiesByUser.length);
  userIndexRef.current = userIndex;
  storyIndexRef.current = storyIndex;
  storiesLenRef.current = stories.length;
  usersLenRef.current = storiesByUser.length;

  /** Keep last media on screen until the next story's media is ready. */
  type HoldMedia = {
    media_type: string;
    media_url: string | null;
    content: string | null;
    background_color: string | null;
  };
  const [holdMedia, setHoldMedia] = useState<HoldMedia | null>(null);
  /** Bump when neighbor caches fill so inactive pager pages paint media. */
  const [cacheEpoch, setCacheEpoch] = useState(0);

  const pagerRef = useRef<FlatList<StoryWithUser>>(null);
  const ignorePagerSyncRef = useRef(false);
  /** True only while the user is dragging the pager — prevents viewability→pauseEnd loops. */
  const pausedByPagerRef = useRef(false);
  /** Last index we programmatically scrolled to (skip redundant scrollToIndex). */
  const lastScrolledIndexRef = useRef<number | null>(null);
  const scrollSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goToUserPageRef = useRef<(next: number, pending: number | 'last', animated?: boolean) => void>(() => {});
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Sync open target during render (before effects) so «שלי» at list-end
  // never briefly loads userIndex 0 and thrash the pager.
  const [openGate, setOpenGate] = useState({ visible, initialUserIndex });
  if (visible !== openGate.visible || (visible && initialUserIndex !== openGate.initialUserIndex)) {
    setOpenGate({ visible, initialUserIndex });
    if (visible) {
      const openIndex = storiesByUser.length === 0
        ? 0
        : Math.max(0, Math.min(storiesByUser.length - 1, initialUserIndex));
      setUserIndex(openIndex);
      userIndexRef.current = openIndex;
      setStoryIndex(0);
      storyIndexRef.current = 0;
      setStories([]);
      setIsLoading(true);
      setMediaReady(false);
      setMediaError(false);
      setVideoDuration(null);
      setViewersSheetOpen(false);
      setIsPaused(false);
      setHoldMedia(null);
      ignorePagerSyncRef.current = true;
      pausedByPagerRef.current = false;
      lastScrolledIndexRef.current = null;
      progressStartedFor.current = null;
      skipLoadApplyRef.current = false;
      pendingStoryIndexRef.current = null;
    }
  }

  const clearStoryTimers = useCallback(() => {
    if (scrollSettleTimerRef.current) {
      clearTimeout(scrollSettleTimerRef.current);
      scrollSettleTimerRef.current = null;
    }
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (mediaFallbackTimerRef.current) {
      clearTimeout(mediaFallbackTimerRef.current);
      mediaFallbackTimerRef.current = null;
    }
  }, []);

  const clampUserIndex = useCallback((idx: number) => {
    if (storiesByUser.length === 0) return 0;
    return Math.max(0, Math.min(storiesByUser.length - 1, idx));
  }, [storiesByUser.length]);

  const safeScrollToUser = useCallback((index: number, animated: boolean) => {
    const clamped = clampUserIndex(index);
    if (!animated && lastScrolledIndexRef.current === clamped) return;
    lastScrolledIndexRef.current = clamped;
    try {
      pagerRef.current?.scrollToIndex({ index: clamped, animated });
    } catch {
      pagerRef.current?.scrollToOffset({
        offset: clamped * SCREEN_WIDTH,
        animated,
      });
    }
  }, [clampUserIndex]);

  const currentUser = storiesByUser[userIndex];
  const currentStory = stories[storyIndex];
  const isOwnStory = currentUser?.user_id === user?.id;

  const resolveStoryIndex = (data: UserStory[], pending: number | 'last' | null) => {
    if (pending === 'last') return Math.max(0, data.length - 1);
    if (typeof pending === 'number') return Math.max(0, Math.min(pending, Math.max(0, data.length - 1)));
    return 0;
  };

  /** Local file:// / content:// / http(s) — skip remote prefetch for local URIs. */
  const isPlayableMediaUri = (uri: string | null | undefined): uri is string => {
    if (!uri || typeof uri !== 'string') return false;
    const t = uri.trim();
    if (!t) return false;
    return (
      t.startsWith('http://') ||
      t.startsWith('https://') ||
      t.startsWith('file://') ||
      t.startsWith('content://') ||
      t.startsWith('ph://') ||
      t.startsWith('assets-library://') ||
      t.startsWith('data:')
    );
  };

  const prefetchMedia = useCallback((story: UserStory | undefined) => {
    if (!story?.media_url || !isPlayableMediaUri(story.media_url)) return;
    if (story.media_url.startsWith('file://') || story.media_url.startsWith('content://')) return;
    if (story.media_type === 'image') {
      Image.prefetch(story.media_url).catch(() => {});
    }
  }, []);

  const captureHoldMedia = useCallback(() => {
    const s = stories[storyIndexRef.current];
    if (!s) return;
    if (s.media_type === 'image' || s.media_type === 'video' || s.media_type === 'text') {
      setHoldMedia({
        media_type: s.media_type,
        media_url: s.media_url ?? null,
        content: s.content ?? null,
        background_color: s.background_color ?? null,
      });
    }
  }, [stories]);

  // Scroll + cache reset on open/close only (index already synced in render via openGate).
  // Own story («שלי») sits at the END of the strip — guard pager sync until scroll settles.
  useLayoutEffect(() => {
    if (!visible) {
      clearStoryTimers();
      cancelAnimation(progress);
      storiesCacheRef.current.clear();
      setHoldMedia(null);
      ignorePagerSyncRef.current = false;
      pausedByPagerRef.current = false;
      lastScrolledIndexRef.current = null;
      return;
    }

    const len = storiesByUser.length;
    const openIndex = len === 0 ? 0 : Math.max(0, Math.min(len - 1, initialUserIndex));
    clearStoryTimers();
    storiesCacheRef.current.clear();
    isTransitioningRef.current = false;
    ignorePagerSyncRef.current = true;
    lastScrolledIndexRef.current = null;
    setCacheEpoch(0);
    cancelAnimation(progress);
    progress.value = 0;

    requestAnimationFrame(() => {
      safeScrollToUser(openIndex, false);
      scrollSettleTimerRef.current = setTimeout(() => {
        ignorePagerSyncRef.current = false;
        scrollSettleTimerRef.current = null;
      }, 120);
    });
    // Intentionally omit storiesByUser.length — mid-view list refresh must not re-reset the pager.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialUserIndex]);

  // Cleanup timers if viewer unmounts mid-session
  useEffect(() => () => clearStoryTimers(), [clearStoryTimers]);

  // Load stories for current user (cache-first to avoid black flash)
  useEffect(() => {
    if (!visible || !currentUser) return;
    let cancelled = false;
    progressStartedFor.current = null;
    cancelAnimation(progress);
    progress.value = 0;

    const pending = pendingStoryIndexRef.current;
    const cached = storiesCacheRef.current.get(currentUser.user_id);
    const alreadyApplied = skipLoadApplyRef.current;
    if (alreadyApplied) {
      skipLoadApplyRef.current = false;
      pendingStoryIndexRef.current = null;
    }

    const apply = (data: UserStory[], indexPending: number | 'last' | null) => {
      if (data.length === 0) {
        setStories([]);
        setStoryIndex(0);
        setMediaReady(true);
        setIsLoading(false);
        setHoldMedia(null);
        // Empty page (deleted / expired / race after upload) — skip instead of hanging on spinner
        const uIdx = userIndexRef.current;
        const uLen = usersLenRef.current;
        requestAnimationFrame(() => {
          if (uIdx > 0) {
            goToUserPageRef.current?.(uIdx - 1, 0, false);
          } else if (uIdx < uLen - 1) {
            goToUserPageRef.current?.(uIdx + 1, 0, false);
          } else {
            onCloseRef.current();
          }
        });
        return;
      }
      const idx = resolveStoryIndex(data, indexPending);
      setStories(data);
      setStoryIndex(idx);
      setMediaError(false);
      setVideoDuration(null);
      const story = data[idx];
      const hasMedia = story?.media_type === 'text'
        || (isPlayableMediaUri(story?.media_url) && (story?.media_type === 'image' || story?.media_type === 'video'));
      if (story && (story.media_type === 'image' || story.media_type === 'video') && !isPlayableMediaUri(story.media_url)) {
        setMediaError(true);
        setMediaReady(true);
      } else {
        setMediaReady(story?.media_type === 'text');
      }
      setIsLoading(false);
      if (hasMedia) {
        prefetchMedia(story);
        prefetchMedia(data[idx + 1]);
        prefetchMedia(data[idx - 1]);
      }
    };

    if (!alreadyApplied) {
      if (cached && cached.length > 0) {
        pendingStoryIndexRef.current = null;
        apply(cached, pending);
      } else {
        // Keep holdMedia on screen — spinner only on cold first open
        if (storiesLenRef.current === 0) {
          setIsLoading(true);
        }
        setMediaReady(false);
        setMediaError(false);
        setVideoDuration(null);
      }
    }

    (async () => {
      try {
        const data = await getStoriesByUserId(currentUser.user_id);
        if (cancelled) return;
        storiesCacheRef.current.set(currentUser.user_id, data);
        if (!alreadyApplied && (!cached || cached.length === 0)) {
          const p = pendingStoryIndexRef.current;
          pendingStoryIndexRef.current = null;
          apply(data, p ?? pending);
        } else {
          // Quiet refresh — keep current storyIndex
          setStories(data);
          setIsLoading(false);
        }
      } catch (e) {
        logger.error('StoryViewer', 'Failed to load stories', e);
        if (!cancelled && !alreadyApplied && (!cached || cached.length === 0)) {
          pendingStoryIndexRef.current = null;
          setStories([]);
          setIsLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [visible, userIndex, currentUser?.user_id, prefetchMedia, progress]);

  // Prefetch neighbor pages so the pager shows real media while scrolling
  useEffect(() => {
    if (!visible || storiesByUser.length === 0) return;
    let cancelled = false;
    const neighbors = [userIndex - 1, userIndex, userIndex + 1].filter(
      (i) => i >= 0 && i < storiesByUser.length,
    );
    (async () => {
      let bumped = false;
      for (const i of neighbors) {
        const u = storiesByUser[i];
        if (!u || storiesCacheRef.current.has(u.user_id)) {
          const cached = u ? storiesCacheRef.current.get(u.user_id) : undefined;
          if (cached) {
            prefetchMedia(cached[0]);
            prefetchMedia(cached[cached.length - 1]);
          }
          continue;
        }
        try {
          const data = await getStoriesByUserId(u.user_id);
          if (cancelled) return;
          storiesCacheRef.current.set(u.user_id, data);
          prefetchMedia(data[0]);
          prefetchMedia(data[data.length - 1]);
          bumped = true;
        } catch {
          /* ignore */
        }
      }
      if (!cancelled && bumped) setCacheEpoch((e) => e + 1);
    })();
    return () => { cancelled = true; };
  }, [visible, userIndex, storiesByUser, prefetchMedia]);

  // Clear hold once the new media is ready
  useEffect(() => {
    if (mediaReady || mediaError) {
      setHoldMedia(null);
    }
  }, [mediaReady, mediaError, currentStory?.id]);

  // Mark viewed (skip own stories — no self-view rows, and avoids extra write on «שלי»)
  useEffect(() => {
    if (!currentStory || !user?.id) return;
    if (currentStory.user_id === user.id) return;
    markStoryViewed(currentStory.id, user.id).catch(() => {});
  }, [currentStory?.id, currentStory?.user_id, user?.id]);

  // Prefetch next story image within current user
  useEffect(() => {
    if (!visible || stories.length === 0) return;
    prefetchMedia(stories[storyIndex + 1]);
  }, [visible, storyIndex, stories, prefetchMedia]);

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

  /**
   * Strip (ChatGroupsListScreen): array [oldest … «שלי»], visual LEFT→RIGHT
   * oldest→mine, with «הוסף» on the far right (row-reverse). Forward through the
   * strip = right→left = lower index. Close only at index 0.
   */
  const switchToUser = useCallback((nextUserIndex: number, pending: number | 'last') => {
    if (nextUserIndex < 0 || nextUserIndex >= storiesByUser.length) return;
    cancelAnimation(progress);
    progressStartedFor.current = null;
    setMediaError(false);
    setVideoDuration(null);
    setIsPaused(false);

    const nextUser = storiesByUser[nextUserIndex];
    const cached = nextUser ? storiesCacheRef.current.get(nextUser.user_id) : undefined;
    if (cached && cached.length > 0) {
      // Neighbor FlatList cell already paints this story — keep media mounted,
      // do NOT opacity-gate or hold previous user's frame (that caused black flash).
      const idx = resolveStoryIndex(cached, pending);
      setStories(cached);
      setStoryIndex(idx);
      setIsLoading(false);
      setMediaReady(true);
      setHoldMedia(null);
      prefetchMedia(cached[idx]);
      pendingStoryIndexRef.current = null;
      skipLoadApplyRef.current = true;
    } else {
      captureHoldMedia();
      pendingStoryIndexRef.current = pending;
      skipLoadApplyRef.current = false;
      setMediaReady(false);
      setStories([]);
      setStoryIndex(0);
      setIsLoading(true);
    }
    setUserIndex(nextUserIndex);
  }, [captureHoldMedia, progress, storiesByUser, prefetchMedia]);

  const switchToUserRef = useRef(switchToUser);
  switchToUserRef.current = switchToUser;

  /** Resolve pager page → userIndex + landing story (0 forward / last backward). */
  const syncPagerToIndex = useCallback((idx: number) => {
    if (ignorePagerSyncRef.current) {
      return;
    }
    const clamped = Math.max(0, Math.min(storiesByUser.length - 1, idx));
    if (clamped === userIndexRef.current) {
      // Resume progress only after a real user drag — never on viewability ticks
      // (those fire constantly at list ends / own-story index and caused freezes).
      if (pausedByPagerRef.current) {
        pausedByPagerRef.current = false;
        handlePauseEndRef.current?.();
      }
      return;
    }
    // Forward (lower index) → first story; back (higher index) → last story
    const pending: number | 'last' = clamped < userIndexRef.current ? 0 : 'last';
    pausedByPagerRef.current = false;
    switchToUserRef.current(clamped, pending);
  }, [storiesByUser.length]);

  const syncPagerToIndexRef = useRef(syncPagerToIndex);
  syncPagerToIndexRef.current = syncPagerToIndex;

  /** Connected pager: scroll to user page; sync story landing index. */
  const goToUserPage = useCallback((nextUserIndex: number, pending: number | 'last', animated = true) => {
    if (nextUserIndex < 0 || nextUserIndex >= storiesByUser.length) return;
    if (scrollSettleTimerRef.current) {
      clearTimeout(scrollSettleTimerRef.current);
      scrollSettleTimerRef.current = null;
    }
    ignorePagerSyncRef.current = true;
    switchToUser(nextUserIndex, pending);
    requestAnimationFrame(() => {
      safeScrollToUser(nextUserIndex, animated);
      scrollSettleTimerRef.current = setTimeout(() => {
        ignorePagerSyncRef.current = false;
        scrollSettleTimerRef.current = null;
      }, animated ? 350 : 50);
    });
  }, [storiesByUser.length, switchToUser, safeScrollToUser]);
  goToUserPageRef.current = goToUserPage;

  const goNext = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    cancelAnimation(progress);
    progressStartedFor.current = null;
    const sIdx = storyIndexRef.current;
    const sLen = storiesLenRef.current;
    const uIdx = userIndexRef.current;
    if (sIdx < sLen - 1) {
      captureHoldMedia();
      setMediaReady(false);
      setMediaError(false);
      setVideoDuration(null);
      setStoryIndex(prev => prev + 1);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => {
        isTransitioningRef.current = false;
        transitionTimerRef.current = null;
      }, 100);
    } else if (uIdx > 0) {
      // Toward lower index (left page) — strip forward
      isTransitioningRef.current = false;
      goToUserPage(uIdx - 1, 0, true);
    } else {
      isTransitioningRef.current = false;
      onClose();
    }
  }, [onClose, progress, captureHoldMedia, goToUserPage]);

  useEffect(() => { goNextRef.current = goNext; }, [goNext]);

  const goPrev = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    cancelAnimation(progress);
    progressStartedFor.current = null;
    const sIdx = storyIndexRef.current;
    const uIdx = userIndexRef.current;
    const uLen = usersLenRef.current;
    if (sIdx > 0) {
      captureHoldMedia();
      setMediaReady(false);
      setMediaError(false);
      setVideoDuration(null);
      setStoryIndex(prev => prev - 1);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = setTimeout(() => {
        isTransitioningRef.current = false;
        transitionTimerRef.current = null;
      }, 100);
    } else if (uIdx < uLen - 1) {
      isTransitioningRef.current = false;
      goToUserPage(uIdx + 1, 'last', true);
    } else {
      isTransitioningRef.current = false;
    }
  }, [progress, captureHoldMedia, goToUserPage]);

  useEffect(() => { goPrevRef.current = goPrev; }, [goPrev]);

  const handlePauseStartRef = useRef<(() => void) | undefined>(undefined);
  const handlePauseEndRef = useRef<(() => void) | undefined>(undefined);

  const onPagerScrollBegin = useCallback(() => {
    pausedByPagerRef.current = true;
    handlePauseStartRef.current?.();
  }, []);

  const pageIndexFromOffset = useCallback((x: number) => {
    return Math.max(0, Math.min(storiesByUser.length - 1, Math.round(x / SCREEN_WIDTH)));
  }, [storiesByUser.length]);

  const onPagerMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncPagerToIndex(pageIndexFromOffset(e.nativeEvent.contentOffset.x));
  }, [syncPagerToIndex, pageIndexFromOffset]);

  const onPagerScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // When there is no fling, momentum end may not fire — sync from final offset.
    const vx = e.nativeEvent.velocity?.x ?? 0;
    if (Math.abs(vx) > 0.08) return;
    syncPagerToIndex(pageIndexFromOffset(e.nativeEvent.contentOffset.x));
  }, [syncPagerToIndex, pageIndexFromOffset]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 30,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (ignorePagerSyncRef.current) return;
    const best = viewableItems
      .filter((v) => v.isViewable && typeof v.index === 'number')
      .sort((a, b) => ((b as ViewToken<any> & { percentVisible?: number }).percentVisible ?? 0) - ((a as ViewToken<any> & { percentVisible?: number }).percentVisible ?? 0))[0];
    if (typeof best?.index === 'number') {
      syncPagerToIndexRef.current(best.index);
    }
  }).current;

  // Kick off progress
  useEffect(() => {
    if (!visible || isLoading || !currentStory || stories.length === 0) return;
    if (progressStartedFor.current === currentStory.id) return;

    if (mediaFallbackTimerRef.current) {
      clearTimeout(mediaFallbackTimerRef.current);
      mediaFallbackTimerRef.current = null;
    }

    if (currentStory.media_type === 'text') {
      progressStartedFor.current = currentStory.id;
      startProgress(storyIndex, STORY_DURATION);
      return;
    }

    if (!mediaReady && !mediaError) {
      mediaFallbackTimerRef.current = setTimeout(() => {
        mediaFallbackTimerRef.current = null;
        setMediaReady(true);
      }, 4000);
      return () => {
        if (mediaFallbackTimerRef.current) {
          clearTimeout(mediaFallbackTimerRef.current);
          mediaFallbackTimerRef.current = null;
        }
      };
    }

    const duration = currentStory.media_type === 'video'
      ? (videoDuration || VIDEO_MAX_DURATION)
      : STORY_DURATION;

    progressStartedFor.current = currentStory.id;
    startProgress(storyIndex, duration);
  }, [visible, isLoading, storyIndex, currentStory?.id, mediaReady, mediaError, videoDuration, startProgress, stories.length]);

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

  useEffect(() => {
    handlePauseStartRef.current = handlePauseStart;
    handlePauseEndRef.current = handlePauseEnd;
  }, [handlePauseStart, handlePauseEnd]);

  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; error?: string }>({
    visible: false,
  });
  const [deleting, setDeleting] = useState(false);

  /* ── Reactions bar state ── */
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [flyingEmojis, setFlyingEmojis] = useState<FlyingEmoji[]>([]);
  const [barWidth, setBarWidth] = useState<number>(SCREEN_WIDTH - 60);
  const flyingIdRef = useRef(0);

  // Load the user's existing reaction to this story (if any)
  useEffect(() => {
    if (!currentStory?.id || !user?.id || isOwnStory) {
      setMyReaction(null);
      return;
    }
    let cancelled = false;
    getMyStoryReaction(currentStory.id, user.id).then((r) => {
      if (cancelled) return;
      setMyReaction(r?.emoji || null);
    });
    return () => { cancelled = true; };
  }, [currentStory?.id, user?.id, isOwnStory]);

  // Cleanup flying emojis when story changes
  useEffect(() => {
    setFlyingEmojis([]);
  }, [currentStory?.id]);

  const removeFlying = useCallback((id: number) => {
    setFlyingEmojis((prev) => prev.filter((f) => f.id !== id));
  }, []);

  /* ── Viewers / reactions sheet (own stories only) ── */
  type ViewerWithReaction = StoryViewerRow & { emoji?: string | null };
  type ReactionRow = StoryReaction & { user: StoryViewerRow['user'] };
  const [viewersTab, setViewersTab] = useState<'viewers' | 'reactions'>('viewers');
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersList, setViewersList] = useState<ViewerWithReaction[]>([]);
  const [reactionsList, setReactionsList] = useState<ReactionRow[]>([]);

  const loadViewersAndReactions = useCallback(async (storyId: string) => {
    setViewersLoading(true);
    try {
      const [viewers, reactions] = await Promise.all([
        getStoryViewers(storyId),
        getStoryReactions(storyId),
      ]);
      const reactionByUser = new Map(reactions.map((r) => [r.reactor_id, r.emoji]));
      const merged: ViewerWithReaction[] = viewers.map((v) => ({
        ...v,
        emoji: reactionByUser.get(v.viewer_id) ?? null,
      }));
      setViewersList(merged);
      setReactionsList(reactions as ReactionRow[]);
    } catch (e) {
      logger.debug('StoryViewer', 'loadViewersAndReactions failed', e);
    } finally {
      setViewersLoading(false);
    }
  }, []);

  const openViewersSheet = useCallback(() => {
    if (!currentStory?.id || !isOwnStory) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setViewersTab('viewers');
    setViewersSheetOpen(true);
    handlePauseStartRef.current?.();
    loadViewersAndReactions(currentStory.id);
  }, [currentStory?.id, isOwnStory, loadViewersAndReactions]);

  const closeViewersSheet = useCallback(() => {
    setViewersSheetOpen(false);
    handlePauseEndRef.current?.();
  }, []);

  // Auto-close sheet when story changes
  useEffect(() => {
    if (viewersSheetOpen) {
      setViewersSheetOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id]);

  const handleReactionPress = useCallback((emoji: string, index: number) => {
    if (!currentStory?.id || !user?.id || isOwnStory) return;

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Spawn a flying emoji at this button's slot center (relative to bar center)
    const slotWidth = barWidth / REACTION_EMOJIS.length;
    const startX = slotWidth * (index + 0.5) - barWidth / 2;
    const id = ++flyingIdRef.current;
    setFlyingEmojis((prev) => [...prev, { id, emoji, startX }]);

    // Optimistically mark selected
    setMyReaction(emoji);

    // Fire-and-forget to DB. Errors are already handled inside reactToStory
    // (missing table is silent-debug, real failures return a message).
    reactToStory(currentStory.id, user.id, emoji)
      .then((err) => {
        if (err) {
          logger.debug('StoryViewer', `reactToStory: ${err}`);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      })
      .catch((e) => logger.debug('StoryViewer', 'reactToStory exception', e));
  }, [currentStory?.id, user?.id, isOwnStory, barWidth]);

  const openDeleteConfirm = useCallback(() => {
    if (!currentStory || !user?.id) return;
    cancelAnimation(progress);
    setIsPaused(true);
    setConfirmDelete({ visible: true });
  }, [currentStory, user?.id, progress]);

  const closeDeleteConfirm = useCallback(() => {
    setConfirmDelete({ visible: false });
    setIsPaused(false);
  }, []);

  const confirmDeleteStory = useCallback(async () => {
    if (!currentStory || !user?.id) return;
    setDeleting(true);
    try {
      await deleteStory(currentStory.id, user.id);
      onStoriesChanged?.();
      setConfirmDelete({ visible: false });
      if (stories.length <= 1) {
        if (userIndex > 0) {
          goToUserPage(userIndex - 1, 0);
        } else if (userIndex < storiesByUser.length - 1) {
          goToUserPage(userIndex + 1, 0);
        } else {
          onClose();
        }
      } else {
        const newStories = stories.filter(s => s.id !== currentStory.id);
        setStories(newStories);
        storiesCacheRef.current.set(currentUser!.user_id, newStories);
        progressStartedFor.current = null;
        setStoryIndex(Math.min(storyIndex, newStories.length - 1));
        setMediaReady(false);
        setIsPaused(false);
      }
    } catch (err) {
      logger.error('StoryViewer', 'Delete failed', err);
      setConfirmDelete({ visible: true, error: 'לא הצלחנו למחוק. נסה שוב.' });
    } finally {
      setDeleting(false);
    }
  }, [currentStory, user?.id, stories, storyIndex, userIndex, storiesByUser.length, onClose, onStoriesChanged, progress, goToUserPage, currentUser]);

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
    !mediaReady && !mediaError && !holdMedia;
  const showPager = storiesByUser.length > 0;

  /** Within-user story change only — keep last frame under the next media. */
  const renderHoldMedia = () => {
    if (!holdMedia || mediaReady) return null;
    if (holdMedia.media_type === 'image' && holdMedia.media_url) {
      return (
        <View pointerEvents="none"><Image source={{ uri: holdMedia.media_url }} style={styles.fullMedia} resizeMode="contain" /></View>
      );
    }
    if (holdMedia.media_type === 'video' && holdMedia.media_url) {
      return (
        <View style={styles.fullMedia} pointerEvents="none">
          <Video
            source={{ uri: holdMedia.media_url }}
            style={styles.fullMedia}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            isMuted
            isLooping={false}
            pointerEvents="none"
          />
        </View>
      );
    }
    if (holdMedia.media_type === 'text') {
      return (
        <View style={[styles.textBg, { backgroundColor: holdMedia.background_color || '#1B5E20' }]} pointerEvents="none">
          <Text style={styles.textContent}>{holdMedia.content || ''}</Text>
        </View>
      );
    }
    return null;
  };

  /**
   * Stable media for a pager page. Keyed by story.id so activating a page
   * (preview → overlays) does NOT remount Image/Video — that was the black flash.
   * Opacity gate only while loading a NEW story on the active page (within-user).
   */
  const renderPageMedia = (story: UserStory | undefined, isActive: boolean) => {
    const gateOpacity = isActive && !mediaReady && !mediaError && !!holdMedia;

    if (!story) {
      // CRITICAL: return null (not an opaque black `pageFill`) so that:
      //  • On the ACTIVE page during a user-switch where the next user's stories
      //    haven't loaded yet, holdMedia (previous frame) stays visible instead
      //    of being covered by a black View — this was the "black screen on
      //    second user" bug.
      //  • On inactive pages, the parent `styles.page` already has a black
      //    backgroundColor, so nothing visually regresses.
      return null;
    }

    if (story.media_type === 'image') {
      if (!isPlayableMediaUri(story.media_url)) {
        return (
          <View style={[styles.center, styles.pageFill]} pointerEvents="none">
            <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.35)" />
          </View>
        );
      }
      return (
        <View pointerEvents="none">
          <Image
            key={story.id}
            source={{ uri: story.media_url }}
            style={[styles.fullMedia, gateOpacity && { opacity: 0 }]}
            resizeMode="contain"
            onLoad={() => { if (isActive) setMediaReady(true); }}
            onError={() => {
              if (isActive) {
                setMediaError(true);
                setMediaReady(true);
              }
            }}
          />
        </View>
      );
    }

    if (story.media_type === 'video') {
      if (!isPlayableMediaUri(story.media_url)) {
        return (
          <View style={[styles.center, styles.pageFill]} pointerEvents="none">
            <Ionicons name="videocam-off-outline" size={48} color="rgba(255,255,255,0.35)" />
          </View>
        );
      }
      return (
        <View key={story.id} style={styles.fullMedia} pointerEvents="none">
          <Video
            source={{ uri: story.media_url }}
            style={[styles.fullMedia, gateOpacity && { opacity: 0 }]}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={isActive && !isPaused && mediaReady}
            isMuted={!isActive}
            isLooping={false}
            pointerEvents="none"
            onReadyForDisplay={() => { if (isActive) setMediaReady(true); }}
            onLoad={(status) => {
              if (isActive && status.isLoaded && status.durationMillis) {
                setVideoDuration(status.durationMillis);
              }
            }}
            onPlaybackStatusUpdate={(status) => {
              if (isActive && status.isLoaded && status.didJustFinish) {
                goNextRef.current();
              }
            }}
            onError={() => {
              if (isActive) {
                setMediaError(true);
                setMediaReady(true);
              }
            }}
          />
        </View>
      );
    }

    if (story.media_type === 'text') {
      return (
        <View
          key={story.id}
          style={[styles.textBg, { backgroundColor: story.background_color || '#1B5E20' }]}
          pointerEvents="none"
        >
          <Text style={styles.textContent}>{story.content || ''}</Text>
        </View>
      );
    }

    return <View style={styles.pageFill} pointerEvents="none" />;
  };

  /** Header / progress / reactions — remount OK; must not wrap media. */
  const renderActiveOverlays = () => (
    <>
      {isLoading && !currentStory && !holdMedia && (
        <View style={[styles.center, StyleSheet.absoluteFillObject]} pointerEvents="none">
          <ActivityIndicator size="large" color={chatPalette.primary} />
        </View>
      )}
      {showMediaSpinner && (
        <View style={styles.mediaSpinner} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
      {mediaError && (
        <View style={[styles.center, StyleSheet.absoluteFillObject]} pointerEvents="none">
          <Ionicons name="cloud-offline-outline" size={48} color="rgba(255,255,255,0.4)" />
          <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8, fontSize: 14 }}>
            שגיאה בטעינת המדיה
          </Text>
        </View>
      )}

      {/* ===== Text / emoji / drawing overlays from JSON content ===== */}
      {mediaReady && currentStory && (currentStory.media_type === 'video' || currentStory.media_type === 'image') && currentStory.content && (() => {
        try {
          const parsed = JSON.parse(currentStory.content);
          const overlaysArr: any[] = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.overlays)
              ? parsed.overlays
              : [];
          const drawingsArr: any[] = Array.isArray(parsed?.drawings)
            ? parsed.drawings
            : [];

          const authoredW = typeof parsed?.canvasWidth === 'number' ? parsed.canvasWidth : SCREEN_WIDTH;
          const authoredH = typeof parsed?.canvasHeight === 'number' ? parsed.canvasHeight : SCREEN_HEIGHT;
          const scaleX = SCREEN_WIDTH / authoredW;
          const scaleY = SCREEN_HEIGHT / authoredH;

          return (
            <>
              {drawingsArr.length > 0 && (
                <Svg
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                  viewBox={`0 0 ${authoredW} ${authoredH}`}
                  preserveAspectRatio="none"
                >
                  {drawingsArr.map((p: any, idx: number) => (
                    <Path
                      key={idx}
                      d={p.d || ''}
                      stroke={p.color || '#fff'}
                      strokeWidth={p.strokeWidth || 4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  ))}
                </Svg>
              )}

              {overlaysArr.map((o: any, idx: number) => {
                const isEmoji = o.type === 'emoji';
                const bgColor = isEmoji
                  ? 'transparent'
                  : o.bgStyle === 'solid'
                    ? (o.color === '#FFFFFF' ? '#000000' : '#FFFFFF')
                    : o.bgStyle === 'semi'
                      ? 'rgba(0,0,0,0.45)'
                      : 'transparent';
                const tx = (typeof o.x === 'number' ? o.x : 0) * scaleX;
                const ty = (typeof o.y === 'number' ? o.y : 0) * scaleY;
                const sc = typeof o.scale === 'number' ? o.scale : 1;
                return (
                  <View
                    key={idx}
                    style={{
                      position: 'absolute',
                      top: SCREEN_HEIGHT / 2 - 60,
                      alignSelf: 'center',
                      zIndex: 12,
                      transform: [
                        { translateX: tx },
                        { translateY: ty },
                        { scale: sc },
                      ],
                    }}
                    pointerEvents="none"
                  >
                    <View style={{
                      backgroundColor: bgColor,
                      borderRadius: !isEmoji && o.bgStyle !== 'none' ? 12 : 0,
                      paddingHorizontal: !isEmoji && o.bgStyle !== 'none' ? 16 : 0,
                      paddingVertical: !isEmoji && o.bgStyle !== 'none' ? 8 : 0,
                      maxWidth: SCREEN_WIDTH * 0.85,
                    }}>
                      <Text style={{
                        color: isEmoji ? '#fff' : (o.color || '#fff'),
                        fontSize: o.fontSize || 28,
                        fontWeight: !isEmoji && o.bold ? '800' : '400',
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
              })}
            </>
          );
        } catch { return null; }
      })()}

      {/* ===== Top overlay: progress + header ===== */}
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']}
        locations={[0, 0.6, 1]}
        style={[styles.topGradient, { paddingTop: insets.top + 10 }]}
        pointerEvents="box-none"
      >
        <View style={styles.progressRow} pointerEvents="none">
          {stories.map((_, idx) => {
            const i = stories.length - 1 - idx;
            return (
              <ProgressBarFill
                key={`${currentUser?.user_id ?? 'u'}-${i}`}
                index={i}
                progress={progress}
              />
            );
          })}
        </View>

        <View style={styles.header} pointerEvents="box-none">
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerInfo} pointerEvents="none">
            <Text style={styles.headerTime}>
              {currentStory?.created_at ? formatTime(currentStory.created_at) : ''}
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

      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
        style={[styles.bottomGradient, { paddingBottom: insets.bottom + 20 }]}
        pointerEvents="box-none"
      >
        {isOwnStory && (
          <View style={styles.bottomActions} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={openViewersSheet}
              activeOpacity={0.75}
            >
              <Ionicons name="eye-outline" size={20} color="#fff" />
              <Text style={styles.actionText}>צפיות</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={openDeleteConfirm}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {!isOwnStory && (
        <View
          style={[reactStyles.wrapper, { bottom: insets.bottom + 12 }]}
          pointerEvents="box-none"
        >
          <View style={reactStyles.flyLayer} pointerEvents="none">
            {flyingEmojis.map((f) => (
              <FlyingEmojiItem
                key={f.id}
                emoji={f.emoji}
                startX={f.startX}
                onDone={() => removeFlying(f.id)}
              />
            ))}
          </View>

          <BlurView
            intensity={60}
            tint="dark"
            style={reactStyles.bar}
            pointerEvents="box-none"
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
              locations={[0, 0.6, 1]}
              style={reactStyles.barSheen}
              pointerEvents="none"
            />
            {REACTION_EMOJIS.map((emoji, i) => (
              <ReactionButton
                key={emoji}
                emoji={emoji}
                isSelected={myReaction === emoji}
                onPress={() => handleReactionPress(emoji, i)}
              />
            ))}
          </BlurView>
        </View>
      )}
    </>
  );

  const renderUserPage = ({ item, index }: { item: StoryWithUser; index: number }) => {
    void cacheEpoch;
    const isActive = index === userIndex;
    const cached = storiesCacheRef.current.get(item.user_id) ?? [];
    // Prefer live stories only when they belong to this page's user
    const storiesBelongToPage =
      isActive
      && currentUser?.user_id === item.user_id
      && stories.length > 0
      && stories[0]?.user_id === item.user_id;
    const pageStories = storiesBelongToPage ? stories : cached;

    // Match landing logic: forward (lower index) → first; back (higher) → last
    let pageStoryIdx = 0;
    if (storiesBelongToPage) {
      pageStoryIdx = storyIndex;
    } else if (pageStories.length > 0 && index > userIndex) {
      pageStoryIdx = pageStories.length - 1;
    }

    const story = pageStories[pageStoryIdx];

    return (
      <View style={styles.page} pointerEvents="box-none">
        {isActive ? renderHoldMedia() : null}
        {renderPageMedia(story, isActive)}
        {isActive ? renderActiveOverlays() : null}
        {/* Classic half-screen taps (from pre-pager StoryViewer) — left=next, right=prev */}
        {isActive && !viewersSheetOpen ? (
          <View style={styles.touchZone}>
            <TouchableWithoutFeedback
              onPress={() => goNextRef.current()}
              onLongPress={handlePauseStart}
              delayLongPress={350}
              onPressOut={() => { if (isPaused) handlePauseEnd(); }}
            >
              <View style={styles.touchLeft} collapsable={false} />
            </TouchableWithoutFeedback>
            <TouchableWithoutFeedback
              onPress={() => goPrevRef.current()}
              onLongPress={handlePauseStart}
              delayLongPress={350}
              onPressOut={() => { if (isPaused) handlePauseEnd(); }}
            >
              <View style={styles.touchRight} collapsable={false} />
            </TouchableWithoutFeedback>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.container}>
        {showPager ? (
          <View style={styles.stageRoot}>
            <View style={styles.blackBackdrop} pointerEvents="none" />
            {/*
              forceRTL(true) breaks horizontal paging (offset/index mirror).
              Keep pager LTR so FlatList owns horizontal swipe reliably.
              GH FlatList (not Pan GestureDetector) works inside Modal + GHRV.
              Vertical dismiss intentionally disabled — it fought horizontal scroll.
            */}
            <FlatList
              ref={pagerRef}
              data={storiesByUser}
              keyExtractor={(item) => item.user_id}
              // Remount when opening so initialScrollIndex matches «שלי» (last) cleanly.
              key={`story-pager-${visible ? 1 : 0}-${clampUserIndex(initialUserIndex)}-${storiesByUser.length}`}
              // Re-render cells for overlay sync; media stays keyed by story.id so it won't remount.
              extraData={`${userIndex}|${storyIndex}|${currentUser?.user_id ?? ''}|${stories.length}|${cacheEpoch}`}
              horizontal
              pagingEnabled
              scrollEnabled
              bounces={false}
              nestedScrollEnabled
              directionalLockEnabled
              decelerationRate="fast"
              removeClippedSubviews={false}
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={clampUserIndex(initialUserIndex)}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              windowSize={7}
              maxToRenderPerBatch={5}
              initialNumToRender={Math.min(storiesByUser.length, Math.max(3, clampUserIndex(initialUserIndex) + 2))}
              onScrollBeginDrag={onPagerScrollBegin}
              onScrollEndDrag={onPagerScrollEndDrag}
              onMomentumScrollEnd={onPagerMomentumEnd}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              onScrollToIndexFailed={(info) => {
                const offset = info.index * SCREEN_WIDTH;
                requestAnimationFrame(() => {
                  pagerRef.current?.scrollToOffset({ offset, animated: false });
                });
              }}
              renderItem={renderUserPage}
              style={styles.pager}
              contentContainerStyle={styles.pagerContent}
            />
          </View>
        ) : (
          <TouchableOpacity style={[styles.center, styles.stageRoot]} onPress={onClose} activeOpacity={0.9}>
            <Ionicons name="images-outline" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>אין סטטוסים</Text>
          </TouchableOpacity>
        )}

        {/* ===== Viewers + reactions sheet (own story only) ===== */}
        {viewersSheetOpen && (
          <ViewersSheet
            insetsBottom={insets.bottom}
            insetsTop={insets.top}
            loading={viewersLoading}
            viewers={viewersList}
            reactions={reactionsList}
            tab={viewersTab}
            onChangeTab={setViewersTab}
            onClose={closeViewersSheet}
          />
        )}

        {/* Inline delete-confirmation overlay (rendered inside the Story Modal
             so it never gets stacked below it, unlike a nested <Modal>). */}
        {confirmDelete.visible && (
          <View style={dialogStyles.root} pointerEvents="box-none">
            <Pressable
              style={dialogStyles.backdrop}
              onPress={deleting ? undefined : closeDeleteConfirm}
            />
            <View style={dialogStyles.card}>
              <View style={dialogStyles.iconWrap}>
                <View style={dialogStyles.iconCircle}>
                  <Ionicons name="trash" size={28} color="#FF453A" />
                </View>
              </View>

              <Text style={dialogStyles.title}>מחיקת סטטוס</Text>
              <Text style={dialogStyles.message}>
                {confirmDelete.error || 'האם למחוק את הסטטוס? לא ניתן לשחזר.'}
              </Text>

              <View style={dialogStyles.buttonsRow}>
                <TouchableOpacity
                  style={[dialogStyles.btn, dialogStyles.btnDelete, deleting && { opacity: 0.6 }]}
                  onPress={confirmDeleteStory}
                  disabled={deleting}
                  activeOpacity={0.7}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={dialogStyles.btnDeleteText}>מחק</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[dialogStyles.btn, dialogStyles.btnCancel]}
                  onPress={closeDeleteConfirm}
                  disabled={deleting}
                  activeOpacity={0.7}
                >
                  <Text style={dialogStyles.btnCancelText}>ביטול</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const reactStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 11,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Pure translucent glass on top of BlurView – uniform tone, subtle border.
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 32,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
  },
  barSheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  btnInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnInnerSelected: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  emoji: {
    fontSize: 24,
  },
  flyLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    height: 0,
  },
  flying: {
    position: 'absolute',
    bottom: 0,
  },
});

const dialogStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(28,28,32,0.98)',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,69,58,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.35)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  btnCancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnDelete: {
    backgroundColor: '#FF3B30',
  },
  btnDeleteText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  stageRoot: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
    // Critical: app uses forceRTL — horizontal pager must stay LTR
    direction: 'ltr',
  },
  blackBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  pager: {
    flex: 1,
    backgroundColor: '#000',
    direction: 'ltr',
  },
  pagerContent: {
    backgroundColor: '#000',
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
    overflow: 'hidden',
    direction: 'ltr',
  },
  /** Classic Instagram zones (restored from git): left 2/3 = next, right 1/3 = prev. */
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
  pageFill: {
    ...StyleSheet.absoluteFillObject,
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
    direction: 'ltr',
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
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  actionBtnDanger: {
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderColor: 'rgba(255,107,107,0.30)',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
