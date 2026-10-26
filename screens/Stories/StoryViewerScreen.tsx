/**
 * צופה הסטוריז — מסך ניווט (transparentModal בסטאק הראשי).
 *
 * מבנה (נבנה מחדש):
 *  • נתונים: בכניסה — שאילתה אחת לכל המשתמשים בשורה (getStoriesForUsers), URL חתום מהשרת.
 *    בלי קאש מקומי, בלי טעינה לפי משתמש תוך כדי מעבר.
 *  • מעבר בין משתמשים: קוביה (כמו באינסטגרם). כל משתמש הוא «פאה» עם key קבוע (userId),
 *    והמיקום שלה נגזר רק מ-p (אינדקס משתמש רציף). השכן שנכנס הוא אותו רכיב שנשאר על המסך —
 *    בלי טעינה מחדש ובלי הבהוב. החלפת המשתמש הנוכחי ב-state לא מזיזה שום פאה.
 *  • מעבר אוטומטי למשתמש הבא (סוף הסטוריז / הקשה) — אותה אנימציית קוביה.
 *  • שום דבר שנראה לא תלוי באנימציה: במנוחה כל הפאות בלי טרנספורם, והפאה הנוכחית מרונדרת אחרונה (למעלה).
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  cancelAnimation,
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../../context/AuthContext';
import {
  UserStory,
  StoryViewer as StoryViewerRow,
  StoryReaction,
  getStoriesForUsers,
  markStoryViewed,
  deleteStory,
  reactToStory,
  getMyStoryReaction,
  getStoryViewers,
  getStoryReactions,
} from '../../services/storiesService';
import { getStoryViewerUser, StoryViewerParams } from '../../lib/storyViewerSession';
import { logger } from '../../utils/logger';
import { APP_TYPE } from '../../components/ui/appType';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { InlineAppDialog } from '../../components/ui/InlineAppDialog';
import { UserBadges, badgeSizeForLineHeight } from '../../components/ui/badges/UserBadges';
import { chatPalette } from '../../components/chat/chatDesignTokens';
import {
  STORY_DURATION_MS,
  STORY_MEDIA_STALL_MS,
  STORY_REACTION_EMOJIS,
  STORY_SCREEN_HEIGHT as H,
  STORY_SCREEN_WIDTH as W,
  STORY_VIDEO_MAX_MS,
  formatStoryTime,
  isPlayableMediaUri,
  resolveStoryIndex,
} from '../../components/stories/storyLayout';
import { StoryImage, StoryOverlays, StoryTextCard, StoryVideo } from '../../components/stories/StoryMedia';
import {
  FlyingEmoji,
  FlyingEmojiItem,
  ProgressBarFill,
  ReactionButton,
  reactStyles,
} from '../../components/stories/StoryChrome';
import { StoryViewersSheet } from '../../components/stories/StoryViewersSheet';

/** 'forward' = לכיוון אינדקס נמוך (קדימה בשורה), 'back' = אינדקס גבוה */
type Dir = 'forward' | 'back';
type Flags = Record<string, true>;

const addFlag = (id: string) => (m: Flags): Flags => (m[id] ? m : { ...m, [id]: true });

const CUBE_PERSPECTIVE = 1000;
const SWITCH_MS = 320;

function prefetchStoryImage(story: UserStory | undefined) {
  const url = story?.media_type === 'image' ? story.media_url : null;
  if (!url || !url.startsWith('http')) return;
  ExpoImage.prefetch(url, 'memory').catch(() => {});
}

/** פאה בקוביה: מיקום וסיבוב נגזרים מ-p בלבד (o = (i - p) · W) */
function CubeFace({
  index,
  p,
  children,
}: {
  index: number;
  p: SharedValue<number>;
  children: React.ReactNode;
}) {
  const faceAnim = useAnimatedStyle(() => {
    const o = (index - p.value) * W;
    return {
      // הציר בקצה המשותף עם השכן
      transformOrigin: o >= 0 ? 'left center' : 'right center',
      transform: [
        { perspective: CUBE_PERSPECTIVE },
        { translateX: o },
        { rotateY: `${(o / W) * 90}deg` },
      ],
    };
  });
  const shadeAnim = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(index - p.value)) * 0.55,
  }));
  return (
    <Reanimated.View style={[styles.face, faceAnim]} pointerEvents="box-none">
      {children}
      <Reanimated.View style={[styles.cubeShade, shadeAnim]} pointerEvents="none" />
    </Reanimated.View>
  );
}

export default function StoryViewerScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ StoryViewer: StoryViewerParams }, 'StoryViewer'>>();
  const params = route.params;
  const insets = useSafeAreaInsets();
  const designTokens = useDesignTokens();
  const { user } = useAuth();
  const isFocused = useIsFocused();

  const requestedIds = useMemo(() => (Array.isArray(params?.userIds) ? params.userIds : []), [params?.userIds]);

  /* ── נתונים: הכל בבת אחת מהשרת ── */
  const [storiesMap, setStoriesMap] = useState<Record<string, UserStory[]> | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let alive = true;
    getStoriesForUsers(requestedIds)
      .then((map) => {
        if (!alive) return;
        setStoriesMap(map);
        for (const list of Object.values(map)) {
          prefetchStoryImage(list[0]);
          prefetchStoryImage(list[list.length - 1]);
        }
      })
      .catch((e) => {
        logger.error('StoryViewerScreen', 'Failed to load stories', e);
        if (alive) {
          setLoadError(true);
          setStoriesMap({});
        }
      });
    return () => {
      alive = false;
    };
  }, [requestedIds]);

  // רק משתמשים שיש להם סטוריז פעילים (הסדר כמו בשורה: [ישן … «שלי»])
  const userIds = useMemo(
    () => (storiesMap ? requestedIds.filter((id) => (storiesMap[id]?.length ?? 0) > 0) : []),
    [storiesMap, requestedIds],
  );

  /* ── מיקום ── */
  const [cur, setCur] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const p = useSharedValue(0);
  const curSV = useSharedValue(0);
  const countSV = useSharedValue(0);
  const startedRef = useRef(false);

  // ברגע שהנתונים הגיעו — משתמש ההתחלה
  useLayoutEffect(() => {
    if (!storiesMap || startedRef.current) return;
    startedRef.current = true;
    const start = Math.max(0, userIds.indexOf(params?.startUserId ?? ''));
    const list = storiesMap[userIds[start]] ?? [];
    setCur(start);
    setStoryIndex(resolveStoryIndex(list.length, params?.startStoryIndex ?? 0));
    p.value = start;
  }, [storiesMap, userIds, params?.startUserId, params?.startStoryIndex, p]);

  useLayoutEffect(() => {
    curSV.value = cur;
    countSV.value = userIds.length;
  }, [cur, userIds.length, curSV, countSV]);

  const currentUserId = userIds[cur];
  const stories = (currentUserId && storiesMap?.[currentUserId]) || undefined;
  const safeStoryIndex = resolveStoryIndex(stories?.length ?? 0, storyIndex);
  const currentStory: UserStory | undefined = stories?.[safeStoryIndex];
  const isOwnStory = !!currentUserId && currentUserId === user?.id;

  const curRef = useRef(cur);
  curRef.current = cur;
  const storyIndexRef = useRef(safeStoryIndex);
  storyIndexRef.current = safeStoryIndex;
  const storiesLenRef = useRef(stories?.length ?? 0);
  storiesLenRef.current = stories?.length ?? 0;
  const userIdsRef = useRef(userIds);
  userIdsRef.current = userIds;
  const storiesMapRef = useRef(storiesMap);
  storiesMapRef.current = storiesMap;

  /** הסטורי שמוצג בפאה של משתמש i: הנוכחי — לפי המצב; קדימה (שמאל) — הראשון; אחורה (ימין) — האחרון */
  const faceStoryIndex = useCallback(
    (i: number): number => {
      if (i === cur) return safeStoryIndex;
      const len = storiesMap?.[userIds[i]]?.length ?? 0;
      return i < cur ? 0 : Math.max(0, len - 1);
    },
    [cur, safeStoryIndex, storiesMap, userIds],
  );

  /* ── סגירה / מעבר ── */
  const closingRef = useRef(false);
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const [switching, setSwitching] = useState(false);
  const restartTokenRef = useRef(0);
  const [restartTick, setRestartTick] = useState(0);

  /** סוף המעבר: המשתמש החדש הופך לנוכחי. p כבר על היעד — אף פאה לא זזה */
  const commitUser = useCallback((target: number) => {
    const ids = userIdsRef.current;
    if (target < 0 || target >= ids.length) {
      setSwitching(false);
      return;
    }
    const len = storiesMapRef.current?.[ids[target]]?.length ?? 0;
    const forward = target < curRef.current;
    setCur(target);
    setStoryIndex(forward ? 0 : Math.max(0, len - 1));
    setSwitching(false);
  }, []);

  /** מעבר מונפש למשתמש שכן (הקשה / סוף הסטוריז) */
  const animateToUser = useCallback((target: number) => {
    if (target < 0 || target >= userIdsRef.current.length) return;
    setSwitching(true);
    p.value = withTiming(target, { duration: SWITCH_MS, easing: Easing.out(Easing.cubic) }, (fin) => {
      if (fin) runOnJS(commitUser)(target);
      else runOnJS(setSwitching)(false);
    });
  }, [p, commitUser]);

  /**
   * שורת הסטוריז: [ישן … «שלי»]. קדימה = אינדקס נמוך יותר; בסוף (אינדקס 0) — סגירה.
   * אחורה למשתמש קודם → הסטורי האחרון שלו.
   */
  const goNext = useCallback(() => {
    const sIdx = storyIndexRef.current;
    if (sIdx < storiesLenRef.current - 1) {
      setStoryIndex(sIdx + 1);
    } else if (curRef.current > 0) {
      animateToUser(curRef.current - 1);
    } else {
      close();
    }
  }, [animateToUser, close]);

  const goPrev = useCallback(() => {
    const sIdx = storyIndexRef.current;
    if (sIdx > 0) {
      setStoryIndex(sIdx - 1);
    } else if (curRef.current < userIdsRef.current.length - 1) {
      animateToUser(curRef.current + 1);
    } else {
      // הסטורי הראשון של המשתמש האחרון — מתחילים אותו מחדש
      restartTokenRef.current += 1;
      setRestartTick((t) => t + 1);
    }
  }, [animateToUser]);
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;
  const goPrevRef = useRef(goPrev);
  goPrevRef.current = goPrev;

  // הסטורי הבא אצל אותו משתמש
  useEffect(() => {
    prefetchStoryImage(stories?.[safeStoryIndex + 1]);
  }, [stories, safeStoryIndex]);

  /* ── מצב המדיה (לפי מזהה סטורי) ── */
  const [loaded, setLoaded] = useState<Flags>({});
  const [failed, setFailed] = useState<Flags>({});
  const [stalled, setStalled] = useState<Flags>({});
  const [videoDurMs, setVideoDurMs] = useState<Record<string, number>>({});

  const storyId = currentStory?.id ?? null;
  const isMedia = currentStory?.media_type === 'image' || currentStory?.media_type === 'video';
  const playable = isMedia && isPlayableMediaUri(currentStory?.media_url);
  const mediaLoaded = !!storyId && !!loaded[storyId];
  const mediaFailed = !!storyId && (!!failed[storyId] || (isMedia && !playable));
  const canRun = !!currentStory && (
    currentStory.media_type === 'text' || mediaLoaded || mediaFailed || !!stalled[storyId!]
  );
  const showMediaSpinner = !!currentStory && playable && !mediaLoaded && !mediaFailed;

  useEffect(() => {
    if (!storyId || !showMediaSpinner) return;
    const t = setTimeout(() => setStalled(addFlag(storyId)), STORY_MEDIA_STALL_MS);
    return () => clearTimeout(t);
  }, [storyId, showMediaSpinner]);

  /* ── עצירה ── */
  const [holdPaused, setHoldPaused] = useState(false);
  const [dragPaused, setDragPaused] = useState(false);
  const [viewersSheetOpen, setViewersSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ visible: boolean; error?: string }>({ visible: false });
  const [deleting, setDeleting] = useState(false);
  const paused =
    holdPaused || dragPaused || switching || viewersSheetOpen || confirmDelete.visible || !isFocused;

  /* ── התקדמות: טיימר JS קובע את המעבר; Reanimated רק מצייר את הפסים ── */
  const progress = useSharedValue(0);
  const runRef = useRef<{ id: string | null; remaining: number; token: number }>({ id: null, remaining: 0, token: 0 });
  const duration = currentStory?.media_type === 'video' && !mediaFailed
    ? (storyId && videoDurMs[storyId]) || STORY_VIDEO_MAX_MS
    : STORY_DURATION_MS;
  const isVideoPlaying = currentStory?.media_type === 'video' && playable && !mediaFailed;

  useEffect(() => {
    if (!storyId || !canRun) {
      cancelAnimation(progress);
      progress.value = safeStoryIndex;
      return;
    }
    const run = runRef.current;
    if (run.id !== storyId || run.token !== restartTokenRef.current) {
      runRef.current = { id: storyId, remaining: duration, token: restartTokenRef.current };
      progress.value = safeStoryIndex;
    }
    if (paused) return;
    const remaining = Math.max(50, runRef.current.remaining);
    const startedAt = Date.now();
    progress.value = withTiming(safeStoryIndex + 1, { duration: remaining, easing: Easing.linear });
    // וידאו: playToEnd מעביר; הטיימר רק גיבוי
    const timer = setTimeout(() => goNextRef.current(), remaining + (isVideoPlaying ? 1500 : 0));
    return () => {
      clearTimeout(timer);
      cancelAnimation(progress);
      if (runRef.current.id === storyId) {
        runRef.current.remaining = remaining - (Date.now() - startedAt);
      }
    };
  }, [storyId, canRun, paused, duration, safeStoryIndex, isVideoPlaying, restartTick, progress]);

  // סימון כנצפה — גם בסטורי שלי (כדי שהטבעת תתעדכן); אני מסונן מרשימת הצופים
  useEffect(() => {
    if (!storyId || !user?.id) return;
    markStoryViewed(storyId, user.id).catch(() => {});
  }, [storyId, user?.id]);

  /* ── ריאקציות ── */
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [flyingEmojis, setFlyingEmojis] = useState<FlyingEmoji[]>([]);
  const [barWidth, setBarWidth] = useState<number>(W - 60);
  const flyingIdRef = useRef(0);

  useEffect(() => {
    setFlyingEmojis([]);
    if (!storyId || !user?.id || isOwnStory) {
      setMyReaction(null);
      return;
    }
    let cancelled = false;
    getMyStoryReaction(storyId, user.id).then((r) => {
      if (!cancelled) setMyReaction(r?.emoji || null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [storyId, user?.id, isOwnStory]);

  const removeFlying = useCallback((id: number) => {
    setFlyingEmojis((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleReactionPress = useCallback((emoji: string, index: number) => {
    if (!storyId || !user?.id || isOwnStory) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const slotWidth = barWidth / STORY_REACTION_EMOJIS.length;
    const startX = slotWidth * (index + 0.5) - barWidth / 2;
    const id = ++flyingIdRef.current;
    setFlyingEmojis((prev) => [...prev, { id, emoji, startX }]);
    setMyReaction(emoji);
    reactToStory(storyId, user.id, emoji)
      .then((err) => {
        if (err) logger.debug('StoryViewerScreen', `reactToStory: ${err}`);
        else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      })
      .catch((e) => logger.debug('StoryViewerScreen', 'reactToStory exception', e));
  }, [storyId, user?.id, isOwnStory, barWidth]);

  /* ── צפיות / ריאקציות (סטורי שלי) ── */
  type ViewerWithReaction = StoryViewerRow & { emoji?: string | null };
  type ReactionRow = StoryReaction & { user: StoryViewerRow['user'] };
  const [viewersTab, setViewersTab] = useState<'viewers' | 'reactions'>('viewers');
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersList, setViewersList] = useState<ViewerWithReaction[]>([]);
  const [reactionsList, setReactionsList] = useState<ReactionRow[]>([]);

  const loadViewersAndReactions = useCallback(async (id: string) => {
    setViewersLoading(true);
    try {
      const [viewers, reactions] = await Promise.all([getStoryViewers(id), getStoryReactions(id)]);
      const reactionByUser = new Map(reactions.map((r) => [r.reactor_id, r.emoji]));
      setViewersList(
        viewers
          .filter((v) => v.viewer_id !== user?.id)
          .map((v) => ({ ...v, emoji: reactionByUser.get(v.viewer_id) ?? null })),
      );
      setReactionsList(reactions as ReactionRow[]);
    } catch (e) {
      logger.debug('StoryViewerScreen', 'loadViewersAndReactions failed', e);
    } finally {
      setViewersLoading(false);
    }
  }, [user?.id]);

  const openViewersSheet = useCallback(() => {
    if (!storyId || !isOwnStory) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setViewersTab('viewers');
    setViewersSheetOpen(true);
    void loadViewersAndReactions(storyId);
  }, [storyId, isOwnStory, loadViewersAndReactions]);

  const closeViewersSheet = useCallback(() => setViewersSheetOpen(false), []);

  useEffect(() => {
    setViewersSheetOpen(false);
  }, [storyId]);

  /* ── מחיקה ── */
  const openDeleteConfirm = useCallback(() => {
    if (!currentStory || !user?.id) return;
    setConfirmDelete({ visible: true });
  }, [currentStory, user?.id]);

  const closeDeleteConfirm = useCallback(() => setConfirmDelete({ visible: false }), []);

  const confirmDeleteStory = useCallback(async () => {
    if (!currentStory || !user?.id || !currentUserId || !storiesMap) return;
    setDeleting(true);
    try {
      await deleteStory(currentStory.id, user.id);
      setConfirmDelete({ visible: false });
      const remaining = (storiesMap[currentUserId] ?? []).filter((s) => s.id !== currentStory.id);
      const nextMap = { ...storiesMap, [currentUserId]: remaining };
      if (remaining.length > 0) {
        setStoriesMap(nextMap);
        setStoryIndex(Math.min(storyIndexRef.current, remaining.length - 1));
        return;
      }
      // לא נשארו סטוריז למשתמש — עוברים לשכן (או סוגרים)
      const nextIds = requestedIds.filter((id) => (nextMap[id]?.length ?? 0) > 0);
      if (nextIds.length === 0) {
        close();
        return;
      }
      const nextCur = Math.min(cur, nextIds.length - 1);
      setStoriesMap(nextMap);
      setCur(nextCur);
      setStoryIndex(0);
      p.value = nextCur;
    } catch (err) {
      logger.error('StoryViewerScreen', 'Delete failed', err);
      setConfirmDelete({ visible: true, error: 'לא הצלחנו למחוק. נסה שוב.' });
    } finally {
      setDeleting(false);
    }
  }, [currentStory, user?.id, currentUserId, storiesMap, requestedIds, cur, close, p]);

  /* ── מחוות ── */
  const dragY = useSharedValue(0);

  const requestClose = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    close();
  }, [close]);

  const endDrag = useCallback(() => {
    if (!closingRef.current) setDragPaused(false);
  }, []);

  const handleTap = useCallback((x: number) => {
    // אזורים קלאסיים (מיכל LTR): שמאל 2/3 = הבא, ימין 1/3 = הקודם
    if (x < (W * 2) / 3) goNextRef.current();
    else goPrevRef.current();
  }, []);

  const swipeHaptic = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    setSwitching(true);
  }, []);

  const gesture = useMemo(() => {
    const dismissPan = Gesture.Pan()
      .activeOffsetY(14)
      .failOffsetX([-16, 16])
      .onStart(() => {
        'worklet';
        runOnJS(setDragPaused)(true);
      })
      .onUpdate((e) => {
        'worklet';
        dragY.value = Math.max(0, e.translationY);
      })
      .onEnd((e) => {
        'worklet';
        if (dragY.value > 120 || e.velocityY > 900) {
          dragY.value = withTiming(H * 0.6, { duration: 220, easing: Easing.in(Easing.cubic) });
          runOnJS(close)();
        } else {
          dragY.value = withSpring(0, { damping: 20, stiffness: 240, mass: 0.6 });
        }
      })
      .onFinalize(() => {
        'worklet';
        runOnJS(endDrag)();
      });

    // גרירה ימינה = השכן משמאל (אינדקס נמוך = קדימה); שמאלה = השכן מימין (אחורה)
    const swipePan = Gesture.Pan()
      .activeOffsetX([-16, 16])
      .failOffsetY([-14, 14])
      .onStart(() => {
        'worklet';
        runOnJS(setDragPaused)(true);
      })
      .onUpdate((e) => {
        'worklet';
        const c = curSV.value;
        const t = e.translationX;
        const canFwd = c > 0;
        const canBack = c < countSV.value - 1;
        const blocked = (t > 0 && !canFwd) || (t < 0 && !canBack);
        const dx = blocked ? t * 0.2 : Math.max(-W, Math.min(W, t));
        p.value = c - dx / W;
      })
      .onEnd((e) => {
        'worklet';
        const c = curSV.value;
        const t = e.translationX;
        const v = e.velocityX;
        let target = c;
        if (c > 0 && t > 0 && (t > W * 0.3 || v > 800)) target = c - 1;
        else if (c < countSV.value - 1 && t < 0 && (t < -W * 0.3 || v < -800)) target = c + 1;
        if (target !== c) {
          runOnJS(swipeHaptic)();
          p.value = withTiming(target, { duration: 260, easing: Easing.out(Easing.cubic) }, (fin) => {
            if (fin) runOnJS(commitUser)(target);
            else runOnJS(setSwitching)(false);
          });
        } else {
          p.value = withSpring(c, { damping: 22, stiffness: 260, mass: 0.6 });
        }
      })
      .onFinalize(() => {
        'worklet';
        runOnJS(endDrag)();
      });

    const longPress = Gesture.LongPress()
      .minDuration(180)
      .maxDistance(24)
      .onStart(() => {
        'worklet';
        runOnJS(setHoldPaused)(true);
      })
      .onFinalize(() => {
        'worklet';
        runOnJS(setHoldPaused)(false);
      });

    const tap = Gesture.Tap()
      .maxDuration(400)
      .onEnd((e, success) => {
        'worklet';
        if (success) runOnJS(handleTap)(e.x);
      });

    return Gesture.Race(dismissPan, swipePan, Gesture.Exclusive(longPress, tap));
  }, [dragY, p, curSV, countSV, close, endDrag, commitUser, swipeHaptic, handleTap]);

  // משיכה למטה: כל הבמה קטנה ויורדת (ערכי ההתחלה = מצב רגיל וגלוי)
  const stageAnim = useAnimatedStyle(() => {
    const d = Math.min(1, dragY.value / H);
    return {
      borderRadius: d > 0 ? 18 : 0,
      transform: [{ translateY: dragY.value }, { scale: 1 - d * 0.25 }],
    };
  });
  // הכפתורים התחתונים דועכים בזמן סיבוב (במנוחה — גלויים גם בלי אנימציה)
  const chromeAnim = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.abs(p.value - curSV.value) * 4),
  }));
  const backdropAnim = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, dragY.value / (H * 0.5)) * 0.9,
  }));

  /* ── רינדור ── */
  const userInfo = (id: string) => {
    const u = getStoryViewerUser(id)?.user;
    return { name: u?.display_name || u?.full_name || 'משתמש', avatar: u?.profile_picture ?? null };
  };

  /** מדיה של סטורי — אותו רכיב לפאה פעילה ולשכנה (key לפי סטורי → בלי טעינה מחדש במעבר) */
  const renderStoryMedia = (story: UserStory, active: boolean) => {
    if (story.media_type === 'text') {
      return <StoryTextCard key={story.id} content={story.content} backgroundColor={story.background_color} />;
    }
    const uri = story.media_url ?? '';
    if (!isPlayableMediaUri(uri)) return null;
    const sid = story.id;
    if (story.media_type === 'image') {
      return (
        <StoryImage
          key={sid}
          uri={uri}
          content={story.content}
          onLoad={() => setLoaded(addFlag(sid))}
          onError={() => setFailed(addFlag(sid))}
        />
      );
    }
    // וידאו רק בפאה הפעילה (שכן — רקע שחור עד שנכנסים)
    if (!active) return null;
    return (
      <StoryVideo
        key={sid}
        uri={uri}
        content={story.content}
        paused={paused}
        onReady={(ms) => {
          if (ms > 0) setVideoDurMs((m) => (m[sid] ? m : { ...m, [sid]: ms }));
          setLoaded(addFlag(sid));
        }}
        onEnd={() => {
          if (storyIndexRef.current === safeStoryIndex && curRef.current === cur) goNextRef.current();
        }}
        onError={() => setFailed(addFlag(sid))}
      />
    );
  };

  const renderHeader = (id: string, story: UserStory | undefined, active: boolean) => {
    const { name, avatar } = userInfo(id);
    const list = storiesMap?.[id] ?? [];
    return (
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']}
        locations={[0, 0.6, 1]}
        style={[styles.topGradient, { paddingTop: insets.top + 10 }]}
        pointerEvents="none"
      >
        <View style={styles.progressRow}>
          {list.map((_, idx, arr) => {
            const i = arr.length - 1 - idx;
            return active ? (
              <ProgressBarFill key={`${id}-${i}`} index={i} progress={progress} />
            ) : (
              <StaticBar key={`${id}-${i}`} filled={i < faceStoryIndex(userIds.indexOf(id))} />
            );
          })}
        </View>

        <View style={styles.header} pointerEvents="box-none">
          {/* ויזואלי בלבד — הלחיצה בשכבת הכפתורים מחוץ למחוות */}
          <View style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </View>

          <View style={styles.headerInfo} pointerEvents="none">
            <Text style={styles.headerTime}>{story?.created_at ? formatStoryTime(story.created_at) : ''}</Text>
            <UserBadges userId={id} interactive={false} size={badgeSizeForLineHeight(20)} style={styles.headerBadges} />
            <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
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
    );
  };

  const renderBottom = () => {
    if (!currentStory) return null;
    if (isOwnStory) {
      return (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
          style={[styles.bottomGradient, { paddingBottom: insets.bottom + 20 }]}
          pointerEvents="box-none"
        >
          <View style={styles.bottomActions} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.actionBtnRound, { backgroundColor: designTokens.colors.background.primary }]}
              onPress={openViewersSheet}
              activeOpacity={0.75}
              accessibilityLabel="צפיות"
            >
              <Ionicons name="eye-outline" size={20} color={designTokens.colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnRound, { backgroundColor: designTokens.colors.background.primary }]}
              onPress={openDeleteConfirm}
              activeOpacity={0.75}
              accessibilityLabel="מחיקת הסטורי"
            >
              <Ionicons name="trash-outline" size={20} color={designTokens.colors.danger.main} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      );
    }
    return (
      <View style={[reactStyles.wrapper, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <View style={reactStyles.flyLayer} pointerEvents="none">
          {flyingEmojis.map((f) => (
            <FlyingEmojiItem key={f.id} emoji={f.emoji} startX={f.startX} onDone={() => removeFlying(f.id)} />
          ))}
        </View>
        <View
          style={[reactStyles.bar, { backgroundColor: designTokens.colors.background.primary }]}
          pointerEvents="box-none"
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
        >
          {STORY_REACTION_EMOJIS.map((emoji, i) => (
            <ReactionButton
              key={emoji}
              emoji={emoji}
              isSelected={myReaction === emoji}
              onPress={() => handleReactionPress(emoji, i)}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderFace = (i: number) => {
    const id = userIds[i];
    if (!id) return null;
    const active = i === cur;
    const list = storiesMap?.[id] ?? [];
    const story = list[faceStoryIndex(i)];
    return (
      <CubeFace key={id} index={i} p={p}>
        <View style={styles.mediaLayer} pointerEvents="none">
          {story ? renderStoryMedia(story, active) : null}
          {story && (story.media_type !== 'text') && loaded[story.id] ? <StoryOverlays content={story.content} /> : null}
          {active && showMediaSpinner && (
            <View style={[styles.center, StyleSheet.absoluteFill]}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          {active && mediaFailed && (
            <View style={[styles.center, StyleSheet.absoluteFill]}>
              <Ionicons name="cloud-offline-outline" size={48} color="rgba(255,255,255,0.4)" />
              <Text style={styles.errorText}>שגיאה בטעינת המדיה</Text>
            </View>
          )}
        </View>
        {renderHeader(id, story, active)}
      </CubeFace>
    );
  };

  if (!storiesMap) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar hidden />
        <Pressable style={[styles.center, styles.emptyRoot]} onPress={close}>
          <ActivityIndicator size="large" color={chatPalette.primary} />
        </Pressable>
      </GestureHandlerRootView>
    );
  }

  if (userIds.length === 0 || !currentUserId) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar hidden />
        <Pressable style={[styles.center, styles.emptyRoot]} onPress={close}>
          <Ionicons name={loadError ? 'cloud-offline-outline' : 'images-outline'} size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>{loadError ? 'שגיאה בטעינת הסטטוס' : 'אין סטטוסים'}</Text>
        </Pressable>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <Reanimated.View style={[styles.backdrop, backdropAnim]} pointerEvents="none" />

      <GestureDetector gesture={gesture}>
        <Reanimated.View style={[styles.stage, stageAnim]} collapsable={false}>
          {/* השכנים קודם, הנוכחי אחרון (מעליהם) */}
          {renderFace(cur - 1)}
          {renderFace(cur + 1)}
          {renderFace(cur)}
        </Reanimated.View>
      </GestureDetector>

      {/* כפתורים — מחוץ לאזור המחוות (הקשה עליהם לא מעבירה סטורי). נעלמים בזמן סיבוב הקוביה */}
      <Reanimated.View style={[StyleSheet.absoluteFill, stageAnim]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={requestClose}
          style={[styles.closeHit, { top: insets.top + 10 + 3.5 + 12 - 4 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="סגור סטטוס"
        />
        <Reanimated.View style={[StyleSheet.absoluteFill, chromeAnim]} pointerEvents="box-none">
          {renderBottom()}
        </Reanimated.View>
      </Reanimated.View>

      {viewersSheetOpen && (
        <StoryViewersSheet
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

      <InlineAppDialog
        visible={confirmDelete.visible}
        title="מחיקת סטטוס"
        message={confirmDelete.error || 'האם למחוק את הסטטוס? לא ניתן לשחזר.'}
        icon="trash-outline"
        onBackdropPress={deleting ? undefined : closeDeleteConfirm}
        buttons={[
          { text: 'מחק', style: 'destructive', onPress: () => void confirmDeleteStory(), loading: deleting },
          { text: 'ביטול', style: 'cancel', onPress: closeDeleteConfirm },
        ]}
      />
    </GestureHandlerRootView>
  );
}

/** פס התקדמות סטטי לפאה שכנה */
function StaticBar({ filled }: { filled: boolean }) {
  return (
    <View style={styles.staticBarTrack}>
      <View style={[styles.staticBarFill, { width: filled ? '100%' : '0%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // שקוף: השחור מגיע מ-backdrop (דועך במשיכה). direction:ltr — הפריסה כמו בצופה הקודם
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    direction: 'ltr',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  // פאה בקוביה — גלויה במנוחה גם בלי אנימציה (הנוכחית מרונדרת אחרונה, מעל השכנים)
  face: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  // הצללה: אטימות בסיס 0 — אם העדכון המונפש לא מגיע למסך היא שקופה ולא מכסה את הסטורי
  cubeShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    opacity: 0,
  },
  staticBarTrack: {
    flex: 1,
    marginHorizontal: 1.5,
    height: 3.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  staticBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  stage: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  mediaLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  emptyRoot: {
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
    fontSize: 14,
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
  headerBadges: {
    marginRight: 6,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  closeHit: {
    position: 'absolute',
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
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
  // צפיות (עין) + מחיקה — שני עיגולים ממורכזים
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 14,
  },
  actionBtnRound: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
