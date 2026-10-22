/**
 * צופה הסטוריז — מסך ניווט (transparentModal בסטאק הראשי), במקום components/chat/StoryViewer.
 *
 * למה מסך ולא Modal: הצופה הקודם (RN Modal + FlatList pager עם initialScrollIndex/scrollTo,
 * ונראות שתלויה בערך Reanimated) נפתח בבילד iOS פרודקשן על מסך שחור / שקוף-חוסם עד החלקה.
 * כאן:
 *  • עמוד משתמש אחד בכל רגע — מעבר משתמש = החלפת state (בלי pager, בלי scrollTo).
 *  • שום דבר שנראה לא תלוי באנימציה: הרקע השחור והמדיה באטימות מלאה מהפריים הראשון;
 *    עד שהמדיה נטענת — ספינר. Reanimated רק לפסי ההתקדמות ולמשיכה למטה (יציאה).
 *  • ההתקדמות האוטומטית בטיימר JS (פסי ההתקדמות הם רק תצוגה).
 *  • וידאו דרך expo-video ישירות (readyToPlay / playToEnd).
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
  getStoriesByUserId,
  peekStoriesCache,
  markStoryViewed,
  deleteStory,
  reactToStory,
  getMyStoryReaction,
  getStoryViewers,
  getStoryReactions,
} from '../../services/storiesService';
import { localUriForStoryMedia } from '../../lib/pendingStories';
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
type Position = { userIndex: number; storyIndex: number | 'last'; dir: Dir };
type Flags = Record<string, true>;

const addFlag = (id: string) => (m: Flags): Flags => (m[id] ? m : { ...m, [id]: true });

/** רענון שקט: שומרים את אובייקט הסטורי הקיים (אותו URL חתום → בלי טעינה מחדש של המדיה) */
function mergeStories(prev: UserStory[] | undefined, next: UserStory[]): UserStory[] {
  if (!prev?.length) return next;
  const byId = new Map(prev.map((s) => [s.id, s]));
  return next.map((s) => byId.get(s.id) ?? s);
}

function prefetchStoryImage(story: UserStory | undefined) {
  const url = story?.media_type === 'image' ? story.media_url : null;
  if (!url || !url.startsWith('http')) return;
  if (localUriForStoryMedia(url)) return;
  ExpoImage.prefetch(url, 'memory-disk').catch(() => {});
}

export default function StoryViewerScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ StoryViewer: StoryViewerParams }, 'StoryViewer'>>();
  const params = route.params;
  const insets = useSafeAreaInsets();
  const designTokens = useDesignTokens();
  const { user } = useAuth();
  const isFocused = useIsFocused();

  // רשימת המשתמשים קבועה לכל חיי המסך
  const userIds = useMemo(() => (Array.isArray(params?.userIds) ? params.userIds : []), [params?.userIds]);

  const [pos, setPos] = useState<Position>(() => ({
    userIndex: Math.max(0, userIds.indexOf(params?.startUserId ?? '')),
    storyIndex: params?.startStoryIndex ?? 0,
    dir: 'forward',
  }));

  /* ── סטוריז לפי משתמש (קאש השירות → מיידי; רענון ברשת ברקע) ── */
  const [storiesMap, setStoriesMap] = useState<Record<string, UserStory[]>>(() => {
    const seed: Record<string, UserStory[]> = {};
    const i = Math.max(0, userIds.indexOf(params?.startUserId ?? ''));
    for (const idx of [i, i - 1, i + 1]) {
      const id = userIds[idx];
      const hit = id ? peekStoriesCache(id) : undefined;
      if (id && hit?.length) seed[id] = hit;
    }
    return seed;
  });
  const [fetched, setFetched] = useState<Record<string, 'done' | 'error'>>({});
  const storiesMapRef = useRef(storiesMap);
  storiesMapRef.current = storiesMap;

  const currentUserId = userIds[pos.userIndex];
  const currentUser = currentUserId ? getStoryViewerUser(currentUserId) : null;
  const stories = (currentUserId && storiesMap[currentUserId]) || undefined;
  const storyIndex = resolveStoryIndex(stories?.length ?? 0, pos.storyIndex);
  const currentStory: UserStory | undefined = stories?.[storyIndex];
  const isOwnStory = !!currentUserId && currentUserId === user?.id;

  // refs לטיימרים / מחוות (בלי סגירות ישנות)
  const posRef = useRef(pos);
  posRef.current = pos;
  const storyIndexRef = useRef(storyIndex);
  storyIndexRef.current = storyIndex;
  const storiesLenRef = useRef(stories?.length ?? 0);
  storiesLenRef.current = stories?.length ?? 0;

  // 'last' → אינדקס מספרי ברגע שהסטוריז ידועים (רענון שמוסיף סטורי לא יזיז את המיקום)
  useLayoutEffect(() => {
    if (pos.storyIndex === 'last' && stories && stories.length > 0) {
      setPos((p) => (p.storyIndex === 'last' ? { ...p, storyIndex: stories.length - 1 } : p));
    }
  }, [pos.storyIndex, stories]);

  const loadUser = useCallback((id: string) => {
    return getStoriesByUserId(id)
      .then((data) => {
        setStoriesMap((m) => ({ ...m, [id]: mergeStories(m[id], data) }));
        setFetched((f) => ({ ...f, [id]: 'done' }));
        return data;
      })
      .catch((e) => {
        logger.error('StoryViewerScreen', 'Failed to load stories', e);
        setFetched((f) => ({ ...f, [id]: 'error' }));
        return undefined;
      });
  }, []);

  // המשתמש הנוכחי — תמיד מרעננים מהרשת (הקאש מוצג בינתיים)
  const requestedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUserId) return;
    requestedRef.current.add(currentUserId);
    void loadUser(currentUserId);
  }, [currentUserId, loadUser]);

  // טעינה מראש של השכנים (רשימה + תמונה ראשונה/אחרונה)
  useEffect(() => {
    for (const idx of [pos.userIndex - 1, pos.userIndex + 1]) {
      const id = userIds[idx];
      if (!id) continue;
      const have = storiesMapRef.current[id];
      if (have?.length) {
        prefetchStoryImage(have[0]);
        prefetchStoryImage(have[have.length - 1]);
        continue;
      }
      const hit = peekStoriesCache(id);
      if (hit?.length) {
        setStoriesMap((m) => (m[id] ? m : { ...m, [id]: hit }));
        prefetchStoryImage(hit[0]);
        prefetchStoryImage(hit[hit.length - 1]);
        continue;
      }
      if (requestedRef.current.has(id)) continue;
      requestedRef.current.add(id);
      void loadUser(id).then((data) => {
        prefetchStoryImage(data?.[0]);
        prefetchStoryImage(data?.[data.length - 1]);
      });
    }
  }, [pos.userIndex, userIds, loadUser]);

  // הסטורי הבא אצל אותו משתמש
  useEffect(() => {
    prefetchStoryImage(stories?.[storyIndex + 1]);
  }, [stories, storyIndex]);

  /* ── סגירה / מעבר ── */
  // «הקודם» בסטורי הראשון של המשתמש האחרון בשורה — מתחילים אותו מחדש
  const restartTokenRef = useRef(0);
  const [restartTick, setRestartTick] = useState(0);
  const closingRef = useRef(false);
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const switchUser = useCallback((userIndex: number, storyIdx: number | 'last', dir: Dir) => {
    if (userIndex < 0 || userIndex >= userIds.length) return;
    const id = userIds[userIndex];
    const cached = storiesMapRef.current[id];
    // אם הסטוריז כבר ידועים — 'last' נפתר מיד
    const resolved = storyIdx === 'last' && cached?.length ? cached.length - 1 : storyIdx;
    setPos({ userIndex, storyIndex: resolved, dir });
  }, [userIds]);

  /**
   * שורת הסטוריז (ChatGroupsListScreen): [ישן … «שלי»]. קדימה = אינדקס נמוך יותר;
   * בסוף (אינדקס 0) — סגירה. אחורה למשתמש קודם → הסטורי האחרון שלו.
   */
  const goNext = useCallback(() => {
    const { userIndex } = posRef.current;
    const sIdx = storyIndexRef.current;
    if (sIdx < storiesLenRef.current - 1) {
      setPos({ userIndex, storyIndex: sIdx + 1, dir: 'forward' });
    } else if (userIndex > 0) {
      switchUser(userIndex - 1, 0, 'forward');
    } else {
      close();
    }
  }, [switchUser, close]);

  const goPrev = useCallback(() => {
    const { userIndex } = posRef.current;
    const sIdx = storyIndexRef.current;
    if (sIdx > 0) {
      setPos({ userIndex, storyIndex: sIdx - 1, dir: 'back' });
    } else if (userIndex < userIds.length - 1) {
      switchUser(userIndex + 1, 'last', 'back');
    } else {
      // הסטורי הראשון של המשתמש הראשון — מתחילים אותו מחדש
      restartTokenRef.current += 1;
      setRestartTick((t) => t + 1);
    }
  }, [switchUser, userIds.length]);
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;
  const goPrevRef = useRef(goPrev);
  goPrevRef.current = goPrev;

  // משתמש בלי סטוריז (נמחקו / פגו) — מדלגים בכיוון התנועה
  useEffect(() => {
    if (!currentUserId || fetched[currentUserId] !== 'done') return;
    if ((storiesMap[currentUserId]?.length ?? 0) > 0) return;
    if (pos.dir === 'forward') {
      if (pos.userIndex > 0) switchUser(pos.userIndex - 1, 0, 'forward');
      else close();
    } else if (pos.userIndex < userIds.length - 1) {
      switchUser(pos.userIndex + 1, 'last', 'back');
    } else {
      close();
    }
  }, [currentUserId, fetched, storiesMap, pos.dir, pos.userIndex, userIds.length, switchUser, close]);

  /* ── מצב המדיה (לפי מזהה סטורי — בלי איפוסים במעבר) ── */
  const [loaded, setLoaded] = useState<Flags>({});
  const [failed, setFailed] = useState<Flags>({});
  const [stalled, setStalled] = useState<Flags>({});
  const [videoDurMs, setVideoDurMs] = useState<Record<string, number>>({});

  // הסטורי שלי מוצג מהקובץ המקומי שממנו הועלה (מיידי). אם הקובץ נעלם — נפילה ל-URL בשרת
  const [failedLocal, setFailedLocal] = useState<Flags>({});
  const storyMediaUri = useCallback((remote: string | null | undefined): string => {
    const local = localUriForStoryMedia(remote);
    return local && !failedLocal[local] ? local : (remote ?? '');
  }, [failedLocal]);
  /** true = היה מקומי ועכשיו עוברים לשרת (לא שגיאה) */
  const fallBackFromLocal = useCallback((remote: string | null | undefined): boolean => {
    const local = localUriForStoryMedia(remote);
    if (!local || failedLocal[local]) return false;
    setFailedLocal(addFlag(local));
    return true;
  }, [failedLocal]);

  const storyId = currentStory?.id ?? null;
  const isMedia = currentStory?.media_type === 'image' || currentStory?.media_type === 'video';
  const playable = isMedia && isPlayableMediaUri(currentStory?.media_url);
  const mediaLoaded = !!storyId && !!loaded[storyId];
  const mediaFailed = !!storyId && (!!failed[storyId] || (isMedia && !playable));
  const canRun = !!currentStory && (
    currentStory.media_type === 'text' || mediaLoaded || mediaFailed || !!stalled[storyId!]
  );
  const showMediaSpinner = !!currentStory && playable && !mediaLoaded && !mediaFailed;

  // מדיה שלא נטענה אחרי כמה שניות — מתחילים לספור (הספינר נשאר)
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
  const paused = holdPaused || dragPaused || viewersSheetOpen || confirmDelete.visible || !isFocused;

  /* ── התקדמות: טיימר JS קובע את המעבר; Reanimated רק מצייר את הפסים ── */
  const progress = useSharedValue(typeof pos.storyIndex === 'number' ? pos.storyIndex : 0);
  const runRef = useRef<{ id: string | null; remaining: number; token: number }>({ id: null, remaining: 0, token: 0 });
  const duration = currentStory?.media_type === 'video' && !mediaFailed
    ? (storyId && videoDurMs[storyId]) || STORY_VIDEO_MAX_MS
    : STORY_DURATION_MS;
  const isVideoPlaying = currentStory?.media_type === 'video' && playable && !mediaFailed;

  useEffect(() => {
    if (!storyId || !canRun) {
      cancelAnimation(progress);
      progress.value = storyIndex;
      return;
    }
    const run = runRef.current;
    if (run.id !== storyId || run.token !== restartTokenRef.current) {
      runRef.current = { id: storyId, remaining: duration, token: restartTokenRef.current };
      progress.value = storyIndex;
    }
    if (paused) return;
    const remaining = Math.max(50, runRef.current.remaining);
    const startedAt = Date.now();
    progress.value = withTiming(storyIndex + 1, { duration: remaining, easing: Easing.linear });
    // וידאו: playToEnd מעביר; הטיימר רק גיבוי
    const timer = setTimeout(() => goNextRef.current(), remaining + (isVideoPlaying ? 1500 : 0));
    return () => {
      clearTimeout(timer);
      cancelAnimation(progress);
      if (runRef.current.id === storyId) {
        runRef.current.remaining = remaining - (Date.now() - startedAt);
      }
    };
  }, [storyId, canRun, paused, duration, storyIndex, isVideoPlaying, restartTick, progress]);

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
      // הבעלים רואה את הסטורי של עצמו — לא נספר כצופה
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

  // מעבר סטורי סוגר את השיט
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
    if (!currentStory || !user?.id || !currentUserId) return;
    setDeleting(true);
    try {
      await deleteStory(currentStory.id, user.id);
      setConfirmDelete({ visible: false });
      const remaining = (storiesMapRef.current[currentUserId] ?? []).filter((s) => s.id !== currentStory.id);
      setStoriesMap((m) => ({ ...m, [currentUserId]: remaining }));
      if (remaining.length === 0) {
        const { userIndex } = posRef.current;
        if (userIndex > 0) switchUser(userIndex - 1, 0, 'forward');
        else if (userIndex < userIds.length - 1) switchUser(userIndex + 1, 0, 'back');
        else close();
      } else {
        setPos((p) => ({ ...p, storyIndex: Math.min(storyIndexRef.current, remaining.length - 1) }));
      }
    } catch (err) {
      logger.error('StoryViewerScreen', 'Delete failed', err);
      setConfirmDelete({ visible: true, error: 'לא הצלחנו למחוק. נסה שוב.' });
    } finally {
      setDeleting(false);
    }
  }, [currentStory, user?.id, currentUserId, userIds.length, switchUser, close]);

  /* ── מחוות ── */
  const dragY = useSharedValue(0);
  const slideX = useSharedValue(0);

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

  const handleSwipe = useCallback((toRight: boolean) => {
    // כמו ה-pager הקודם (LTR): גרירה ימינה חושפת את העמוד משמאל = אינדקס נמוך = קדימה
    const { userIndex } = posRef.current;
    if (toRight) {
      if (userIndex > 0) {
        void Haptics.selectionAsync().catch(() => {});
        switchUser(userIndex - 1, 0, 'forward');
      }
    } else if (userIndex < userIds.length - 1) {
      void Haptics.selectionAsync().catch(() => {});
      switchUser(userIndex + 1, 'last', 'back');
    }
  }, [switchUser, userIds.length]);

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
          // הניווט סוגר (fade נייטיב) — לא מחכים לסוף האנימציה
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

    const swipePan = Gesture.Pan()
      .activeOffsetX([-16, 16])
      .failOffsetY([-14, 14])
      .onStart(() => {
        'worklet';
        runOnJS(setDragPaused)(true);
      })
      .onUpdate((e) => {
        'worklet';
        slideX.value = e.translationX * 0.5;
      })
      .onEnd((e) => {
        'worklet';
        if (e.translationX > 70 || e.velocityX > 700) runOnJS(handleSwipe)(true);
        else if (e.translationX < -70 || e.velocityX < -700) runOnJS(handleSwipe)(false);
        slideX.value = withSpring(0, { damping: 22, stiffness: 260, mass: 0.6 });
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
  }, [dragY, slideX, close, endDrag, handleSwipe, handleTap]);

  // ערכי ההתחלה (0) = מצב רגיל וגלוי; גם אם עדכון מונפש לא מגיע למסך — התוכן נראה
  const stageAnim = useAnimatedStyle(() => {
    const d = Math.min(1, dragY.value / H);
    return {
      borderRadius: d > 0 ? 18 : 0,
      transform: [
        { translateX: slideX.value },
        { translateY: dragY.value },
        { scale: 1 - d * 0.25 },
      ],
    };
  });
  // הרקע השחור דועך במשיכה — רואים את המסך שמתחת (transparentModal)
  const backdropAnim = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, dragY.value / (H * 0.5)) * 0.9,
  }));

  /* ── רינדור ── */
  const displayName = currentUser?.user?.display_name || currentUser?.user?.full_name || 'משתמש';
  const avatar = currentUser?.user?.profile_picture;
  const loadingStories = !!currentUserId && !stories?.length && fetched[currentUserId] !== 'error';
  const loadError = !!currentUserId && !stories?.length && fetched[currentUserId] === 'error';

  const renderMedia = () => {
    if (!currentStory) return null;
    if (currentStory.media_type === 'text') {
      return <StoryTextCard content={currentStory.content} backgroundColor={currentStory.background_color} />;
    }
    if (!playable) return null;
    const sid = currentStory.id;
    const remote = currentStory.media_url;
    const uri = storyMediaUri(remote);
    if (currentStory.media_type === 'image') {
      return (
        <StoryImage
          uri={uri}
          content={currentStory.content}
          onLoad={() => setLoaded(addFlag(sid))}
          onError={() => {
            if (fallBackFromLocal(remote)) return;
            setFailed(addFlag(sid));
          }}
        />
      );
    }
    return (
      <StoryVideo
        key={`${sid}|${uri}`}
        uri={uri}
        content={currentStory.content}
        paused={paused}
        onReady={(ms) => {
          if (ms > 0) setVideoDurMs((m) => (m[sid] ? m : { ...m, [sid]: ms }));
          setLoaded(addFlag(sid));
        }}
        onEnd={() => {
          if (storyIndexRef.current === storyIndex && posRef.current.userIndex === pos.userIndex) {
            goNextRef.current();
          }
        }}
        onError={() => {
          if (fallBackFromLocal(remote)) return;
          setFailed(addFlag(sid));
        }}
      />
    );
  };

  if (userIds.length === 0 || !currentUserId) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <StatusBar hidden />
        <Pressable style={[styles.center, styles.emptyRoot]} onPress={close}>
          <Ionicons name="images-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>אין סטטוסים</Text>
        </Pressable>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <Reanimated.View style={[styles.backdrop, backdropAnim]} pointerEvents="none" />

      <Reanimated.View style={[styles.stage, stageAnim]}>
        <GestureDetector gesture={gesture}>
          <View style={styles.mediaLayer} collapsable={false}>
            {renderMedia()}
            {mediaLoaded && isMedia ? <StoryOverlays content={currentStory?.content} /> : null}

            {(loadingStories || showMediaSpinner) && (
              <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none">
                <ActivityIndicator size="large" color={loadingStories ? chatPalette.primary : '#fff'} />
              </View>
            )}
            {(mediaFailed || loadError) && (
              <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none">
                <Ionicons name="cloud-offline-outline" size={48} color="rgba(255,255,255,0.4)" />
                <Text style={styles.errorText}>
                  {loadError ? 'שגיאה בטעינת הסטטוס' : 'שגיאה בטעינת המדיה'}
                </Text>
              </View>
            )}
          </View>
        </GestureDetector>

        {/* ===== למעלה: פסי התקדמות + כותרת ===== */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']}
          locations={[0, 0.6, 1]}
          style={[styles.topGradient, { paddingTop: insets.top + 10 }]}
          pointerEvents="box-none"
        >
          <View style={styles.progressRow} pointerEvents="none">
            {(stories ?? []).map((_, idx, arr) => {
              const i = arr.length - 1 - idx;
              return <ProgressBarFill key={`${currentUserId}-${i}`} index={i} progress={progress} />;
            })}
          </View>

          <View style={styles.header} pointerEvents="box-none">
            <TouchableOpacity
              onPress={requestClose}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="סגור סטטוס"
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerInfo} pointerEvents="none">
              <Text style={styles.headerTime}>
                {currentStory?.created_at ? formatStoryTime(currentStory.created_at) : ''}
              </Text>
              <UserBadges
                userId={currentUserId}
                interactive={false}
                size={badgeSizeForLineHeight(20)}
                style={styles.headerBadges}
              />
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

        {/* ===== למטה: פעולות על הסטורי שלי / ריאקציות ===== */}
        {isOwnStory ? (
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
            style={[styles.bottomGradient, { paddingBottom: insets.bottom + 20 }]}
            pointerEvents="box-none"
          >
            {currentStory ? (
              <View style={styles.bottomActions} pointerEvents="box-none">
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: designTokens.colors.background.primary }]}
                  onPress={openViewersSheet}
                  activeOpacity={0.75}
                >
                  <Ionicons name="eye-outline" size={20} color={designTokens.colors.text.primary} />
                  <Text style={[styles.actionText, { color: designTokens.colors.text.primary }]}>צפיות</Text>
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
            ) : null}
          </LinearGradient>
        ) : currentStory ? (
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
        ) : null}
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
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 999,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
  actionText: {
    fontSize: APP_TYPE.cardTitle.fontSize,
    fontWeight: '600',
  },
});
