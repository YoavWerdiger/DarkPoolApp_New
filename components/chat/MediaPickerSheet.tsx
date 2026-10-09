import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  AtSign,
  Camera,
  ChartColumnBig,
  FileText,
  Images,
  Mic,
  type LucideIcon,
} from 'lucide-react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import UIButton from '../ui/UIButton';
import { ChatBottomSheet, ChatSheetTopoHeader } from './ChatBottomSheet';
import { APP_LAYOUT } from '../ui/appLayout';
import { DAY_NAV_BUTTON_SIZE, headerExitButtonFill } from '../ui/DayNavBlurButton';
import { sheetContentBottomPadding } from '../ui/BottomSheet/sheetGlass';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { runAfterSheetDismiss } from './mediaPickerLaunch';
import { SHEET_CLOSE_MS } from '../ui/BottomSheet/sheetMotion';
import {
  MEDIA_ATTACH_EXPANDED_SNAP,
  MEDIA_ATTACH_FIRST_PAGE,
  MEDIA_ATTACH_GRID_COLS,
  MEDIA_ATTACH_GRID_GAP,
  MEDIA_ATTACH_GRID_ROW,
  MEDIA_ATTACH_ACTION_BTN_PX,
  MEDIA_ATTACH_ACTION_ROW_GAP,
  MEDIA_ATTACH_PRIMARY_ROW_PX,
  MEDIA_ATTACH_PEEK_THUMBS,
  MEDIA_ATTACH_PEEK_THUMB_GAP,
  MEDIA_ATTACH_PEEK_THUMB_PX,
  MEDIA_ATTACH_PEEK_THUMB_RADIUS,
  MEDIA_ATTACH_PEEK_STRIP_GAP,
  MEDIA_ATTACH_PERMISSION_CTA,
  mediaAttachActionColumns,
  MEDIA_ATTACH_SKELETON_CELLS,
  MEDIA_ATTACH_SNAP_POINTS,
  formatMediaDuration,
  mediaAttachActionsBlockHeightPx,
  mediaAttachCellSize,
  mediaAttachPeekPlan,
  mediaAttachPresentation,
  mediaAttachShouldQueryLibrary,
  toggleMediaSelection,
  type MediaAttachPermission,
} from '../../lib/mediaAttachSheet';
import { DayNavBlurButton } from '../ui/DayNavBlurButton';
import { ChatAttachCameraSheet } from './ChatAttachCameraSheet';
import {
  filterRecentsByKind,
  getMediaLibraryReadStatus,
  loadMediaRecentsPage,
  peekMediaRecents,
  prefetchMediaRecents,
  recentToPicked,
  requestMediaLibraryRead,
  scheduleMediaRecentsPrefetch,
  type MediaRecentAsset,
  type MediaRecentsKind,
  type PickedRecentMedia,
} from '../../lib/mediaRecentsCache';

export type { PickedRecentMedia };

const ATTACH_SNAP_POINTS: number[] = [...MEDIA_ATTACH_SNAP_POINTS];

type AttachOpenLock = {
  snaps: number[];
  thumbs: MediaRecentAsset[];
};

function countSecondaryAttachActions(input: {
  onDocument?: boolean;
  onMention?: boolean;
  onAudio?: boolean;
  onPoll?: boolean;
}): number {
  let n = 0;
  if (input.onDocument) n += 1;
  if (input.onMention) n += 1;
  if (input.onAudio) n += 1;
  if (input.onPoll) n += 1;
  return n;
}

function lockAttachOpen(input: {
  kind: MediaRecentsKind;
  screenHeight: number;
  thumbSize: number;
  bottomPad: number;
  secondaryCount: number;
  primaryCount: number;
}): AttachOpenLock {
  const hit = peekMediaRecents(input.kind) ?? peekMediaRecents('all');
  const cached = filterRecentsByKind(hit?.assets ?? [], input.kind);
  const plan = mediaAttachPeekPlan({
    screenHeight: input.screenHeight,
    thumbSize: input.thumbSize,
    bottomPad: input.bottomPad,
    cachedCount: cached.length,
    secondaryCount: input.secondaryCount,
    primaryCount: input.primaryCount,
  });
  return {
    snaps: [plan.peekSnap, MEDIA_ATTACH_EXPANDED_SNAP],
    thumbs: plan.showPeekRecents ? cached.slice(0, MEDIA_ATTACH_PEEK_THUMBS) : [],
  };
}

type ActionId = 'camera' | 'gallery' | 'document' | 'audio' | 'poll' | 'mention';

type SheetAction = {
  id: ActionId;
  icon: LucideIcon;
  label: string;
  run: () => void;
};

export type MediaPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPickedMedia?: (items: PickedRecentMedia[]) => void;
  onCamera?: () => void;
  /** נשמר לתאימות — הגלריה נפתחת בתוך השיט, לא בבורר מערכת. */
  onGallery?: () => void;
  onVideo?: () => void;
  onDocument?: () => void;
  onAudio?: () => void;
  onPoll?: () => void;
  /** נשמר לתאימות — «שיתוף» הוסר מהשיט. */
  onEntity?: () => void;
  onMention?: () => void;
  kind?: MediaRecentsKind;
  allowsMultiple?: boolean;
  selectionLimit?: number;
  /** מצלמת אפליקציה מלאה (ברירת מחדל) או בורר מערכת — לסטוריז עם עריכה. */
  cameraLaunch?: 'builtin' | 'system';
  showCamera?: boolean;
  /** מצלמה מ-fullscreen מחוץ לשיט (מומלץ בצ'אט — Modal אחרי dismiss). */
  onBuiltinCamera?: () => void;
  /** שליחה מהפריביו של המצלמה, בלי לפתוח פריביו נוסף אחרי חזרה לצ'אט. */
  onCameraCommit?: (result: { uri: string; width?: number; height?: number; mediaType?: 'image' | 'video'; durationMs?: number }, caption: string) => void | Promise<void>;
};

export default function MediaPickerSheet({
  visible,
  onClose,
  onPickedMedia,
  onCamera,
  onDocument,
  onAudio,
  onPoll,
  onMention,
  kind = 'all',
  allowsMultiple = true,
  selectionLimit = 10,
  cameraLaunch,
  showCamera,
  onBuiltinCamera,
  onCameraCommit,
}: MediaPickerSheetProps) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const safeBottom = Math.max(insets.bottom, initialWindowMetrics?.insets.bottom ?? 0);
  const sheetBottomPad = useMemo(
    () => sheetContentBottomPadding(safeBottom),
    [safeBottom],
  );

  const cached = peekMediaRecents(kind) ?? peekMediaRecents('all');
  const [assets, setAssets] = useState<MediaRecentAsset[]>(() =>
    filterRecentsByKind(cached?.assets ?? [], kind).slice(0, MEDIA_ATTACH_FIRST_PAGE),
  );
  const [hasNextPage, setHasNextPage] = useState(cached?.hasNextPage ?? false);
  const [cursor, setCursor] = useState<string | null>(cached?.endCursor ?? null);
  const [permission, setPermission] = useState<MediaAttachPermission>(
    cached ? 'granted' : 'unknown',
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [snapIndex, setSnapIndex] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const loadingMoreRef = useRef(false);
  const openLockRef = useRef<AttachOpenLock | null>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const cellSize = useMemo(() => mediaAttachCellSize(screenW), [screenW]);
  const expanded = snapIndex > 0;
  const secondaryCount = useMemo(
    () =>
      countSecondaryAttachActions({
        onDocument: !!onDocument,
        onMention: !!onMention,
        onAudio: !!onAudio,
        onPoll: !!onPoll,
      }),
    [onAudio, onDocument, onMention, onPoll],
  );

  const cameraMode = cameraLaunch ?? (onCamera ? 'system' : 'builtin');
  const showCameraButton =
    showCamera !== false && (onCamera != null || onPickedMedia != null);

  if (visible && openLockRef.current == null) {
    openLockRef.current = lockAttachOpen({
      kind,
      screenHeight: screenH,
      thumbSize: MEDIA_ATTACH_PEEK_THUMB_PX,
      bottomPad: sheetBottomPad,
      secondaryCount,
      primaryCount: showCameraButton ? 2 : 1,
    });
  }
  const openLock = openLockRef.current;
  const attachSnaps = openLock?.snaps ?? ATTACH_SNAP_POINTS;
  const peekThumbs = openLock?.thumbs ?? [];

  const applyPage = useCallback(
    (page: { assets: MediaRecentAsset[]; hasNextPage: boolean; endCursor: string | null }) => {
      setAssets(filterRecentsByKind(page.assets, kind));
      setHasNextPage(page.hasNextPage);
      setCursor(page.endCursor);
      setPermission('granted');
      setLoading(false);
    },
    [kind],
  );

  useEffect(() => {
    if (visible) return;
    setSnapIndex(0);
    setSelectedIds([]);
    const t = setTimeout(() => {
      openLockRef.current = null;
    }, SHEET_CLOSE_MS + 50);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const warm = scheduleMediaRecentsPrefetch(kind);
    return () => warm.cancel();
  }, [kind, visible]);

  useEffect(() => {
    if (!visible || !mediaAttachShouldQueryLibrary(expanded)) return;
    const hit = peekMediaRecents(kind) ?? peekMediaRecents('all');
    if (hit) applyPage(hit);
    else setLoading(true);
    let cancelled = false;
    void (async () => {
      const status = await getMediaLibraryReadStatus();
      if (cancelled) return;
      if (!status.readable) {
        setPermission(hit ? 'granted' : 'denied');
        setLoading(false);
        return;
      }
      const page = await prefetchMediaRecents(kind);
      if (cancelled) return;
      if (page) applyPage(page);
      else {
        setPermission('denied');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyPage, expanded, kind, visible]);

  const loadMore = useCallback(async () => {
    if (!visible || !expanded || !hasNextPage || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await loadMediaRecentsPage(kind, cursor);
      setAssets((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...page.assets.filter((item) => !seen.has(item.id))];
      });
      setHasNextPage(page.hasNextPage);
      setCursor(page.endCursor);
    } catch {
      /* keep current page */
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [cursor, expanded, hasNextPage, kind, visible]);

  const emitPick = useCallback(
    (picked: MediaRecentAsset[]) => {
      if (picked.length === 0) return;
      void HapticFeedback.selection();
      const mapped = picked.map(recentToPicked);
      onClose();
      // פריוויו הוא Modal. פתיחה לפני שהשיט נסגר מקפיאה את המקלדת ב-iOS.
      runAfterSheetDismiss(() => {
        onPickedMedia?.(mapped);
      });
    },
    [onClose, onPickedMedia],
  );

  const onPressAsset = useCallback(
    (asset: MediaRecentAsset) => {
      if (!allowsMultiple) {
        emitPick([asset]);
        return;
      }
      setSelectedIds((prev) => toggleMediaSelection(prev, asset.id, selectionLimit));
    },
    [allowsMultiple, emitPick, selectionLimit],
  );

  const confirmSelection = useCallback(() => {
    const picked = selectedIds
      .map((id) => assets.find((asset) => asset.id === id))
      .filter((asset): asset is MediaRecentAsset => !!asset);
    emitPick(picked);
  }, [assets, emitPick, selectedIds]);

  const launchSystem = useCallback(
    (action?: () => void) => {
      if (!action) return;
      onClose();
      runAfterSheetDismiss(action);
    },
    [onClose],
  );

  const expandGallery = useCallback(() => {
    void HapticFeedback.selection();
    setSnapIndex(1);
  }, []);

  const collapseGallery = useCallback(() => {
    void HapticFeedback.selection();
    setSnapIndex(0);
  }, []);

  const openCamera = useCallback(() => {
    if (cameraMode === 'system' && onCamera) {
      launchSystem(onCamera);
      return;
    }
    void HapticFeedback.selection();
    onClose();
    runAfterSheetDismiss(() => {
      if (onBuiltinCamera) onBuiltinCamera();
      else setCameraOpen(true);
    });
  }, [cameraMode, launchSystem, onBuiltinCamera, onCamera, onClose]);

  const onBuiltinCapture = useCallback(
    (result: { uri: string; width?: number; height?: number; mediaType?: 'image' | 'video'; durationMs?: number }) => {
      const isVideo = result.mediaType === 'video';
      const picked: PickedRecentMedia = {
        id: `camera-${Date.now()}`,
        uri: result.uri,
        thumbnailUri: result.uri,
        type: isVideo ? 'video' : 'image',
        name: isVideo ? `video_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`,
        width: result.width,
        height: result.height,
        duration: result.durationMs != null ? result.durationMs / 1000 : undefined,
      };
      onPickedMedia?.([picked]);
    },
    [onPickedMedia],
  );

  const requestPermission = useCallback(() => {
    void requestMediaLibraryRead().then((ok) => {
      if (!ok) {
        setPermission('denied');
        return;
      }
      setPermission('granted');
      setLoading(true);
      void prefetchMediaRecents(kind).then((page) => {
        if (page) applyPage(page);
        else setLoading(false);
      });
    });
  }, [applyPage, kind]);

  const secondaryActions = useMemo<SheetAction[]>(() => {
    const next: SheetAction[] = [];
    if (onDocument) {
      next.push({ id: 'document', icon: FileText, label: 'מסמך', run: () => launchSystem(onDocument) });
    }
    if (onAudio) {
      next.push({ id: 'audio', icon: Mic, label: 'אודיו', run: () => launchSystem(onAudio) });
    }
    if (onPoll) {
      next.push({ id: 'poll', icon: ChartColumnBig, label: 'סקר', run: () => launchSystem(onPoll) });
    }
    if (onMention) {
      next.push({ id: 'mention', icon: AtSign, label: 'תיוג', run: () => launchSystem(onMention) });
    }
    return next;
  }, [launchSystem, onAudio, onDocument, onMention, onPoll]);

  const ui = mediaAttachPresentation({
    permission,
    cachedCount: assets.length,
    loading,
    expanded,
  });
  const fabBottom = expanded
    ? sheetBottomPad
    : sheetBottomPad +
      mediaAttachActionsBlockHeightPx(secondaryCount, showCameraButton ? 2 : 1) +
      12;
  // בגלריה המלאה הפאנל של השיט גבוה מהחלק הנראה — מודדים כמה ממנו מתחת לקצה המסך
  const rootRef = useRef<View>(null);
  const [hiddenBelow, setHiddenBelow] = useState(0);
  useEffect(() => {
    if (!expanded) {
      setHiddenBelow(0);
      return;
    }
    const t = setTimeout(() => {
      rootRef.current?.measureInWindow((_x, y, _w, h) => {
        setHiddenBelow(Math.max(0, Math.round(y + h - screenH)));
      });
    }, 420);
    return () => clearTimeout(t);
  }, [expanded, screenH]);

  const styles = useMemo(
    () => createStyles(tokens, sheetBottomPad, fabBottom + hiddenBelow),
    [fabBottom, hiddenBelow, sheetBottomPad, tokens],
  );

  const renderThumb = useCallback(
    (item: MediaRecentAsset, size: number, rounded: boolean) => {
      const selected = selectedSet.has(item.id);
      const order = selected ? selectedIds.indexOf(item.id) + 1 : 0;
      const duration = item.mediaType === 'video' ? formatMediaDuration(item.duration) : '';
      return (
        <TouchableOpacity
          onPress={() => onPressAsset(item)}
          activeOpacity={0.85}
          style={[{ width: size, height: size }, rounded && styles.thumbRounded]}
          accessibilityRole="button"
          accessibilityLabel={item.mediaType === 'video' ? 'סרטון' : 'תמונה'}
          accessibilityState={{ selected }}
        >
          <ExpoImage
            source={{ uri: item.uri }}
            style={styles.thumb}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={item.id}
            transition={0}
          />
          {item.mediaType === 'video' ? (
            <View style={styles.videoBadge} pointerEvents="none">
              <Text style={styles.videoDuration}>{duration || '0:00'}</Text>
            </View>
          ) : null}
          {allowsMultiple ? (
            <View style={[styles.check, selected && styles.checkOn]} pointerEvents="none">
              {selected ? <Text style={styles.checkNum}>{order}</Text> : null}
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [allowsMultiple, onPressAsset, selectedIds, selectedSet, styles],
  );

  const renderItem = useCallback(
    ({ item }: { item: MediaRecentAsset }) => renderThumb(item, cellSize, false),
    [cellSize, renderThumb],
  );

  const primaryActions = useMemo<SheetAction[]>(() => {
    const next: SheetAction[] = [
      { id: 'gallery', icon: Images, label: 'גלריה', run: expandGallery },
    ];
    if (showCameraButton) {
      next.push({ id: 'camera', icon: Camera, label: 'מצלמה', run: openCamera });
    }
    return next;
  }, [expandGallery, openCamera, showCameraButton]);

  const actionCols = mediaAttachActionColumns(secondaryActions.length);

  const peekActions = (
    <View style={styles.peekActions}>
      <View style={styles.primaryRow}>
        {primaryActions.map((action) => {
          const Icon = action.icon;
          return (
            <TouchableOpacity
              key={action.id}
              style={styles.primaryPill}
              onPress={action.run}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              {/* RTL: הטקסט קודם (מימין) והאייקון אחריו */}
              <Text style={styles.primaryPillLabel} numberOfLines={1}>
                {action.label}
              </Text>
              <Icon size={22} color={tokens.colors.text.primary} strokeWidth={2} />
            </TouchableOpacity>
          );
        })}
      </View>

      {secondaryActions.length > 0 ? (
        <View style={styles.actionGrid}>
          {secondaryActions.map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionItem, { width: `${100 / actionCols}%` }]}
                onPress={action.run}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View style={styles.actionCircle}>
                  <Icon size={22} color={tokens.colors.text.primary} strokeWidth={2} />
                </View>
                <Text style={styles.actionLabel} numberOfLines={1}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  const galleryChrome = (
    <View style={styles.galleryChrome}>
      <DayNavBlurButton
        size={DAY_NAV_BUTTON_SIZE}
        glass={false}
        style={{ backgroundColor: headerExitButtonFill(tokens.colors.background.cardSolid) }}
        onPress={collapseGallery}
        accessibilityLabel="חזרה לתפריט"
      >
        <Ionicons name="chevron-down" size={22} color={tokens.colors.text.primary} />
      </DayNavBlurButton>
      <View style={styles.galleryTitleWrap}>
        <Text style={styles.galleryTitle}>גלריה</Text>
      </View>
      <View style={styles.galleryChromeSpacer} />
    </View>
  );

  return (
    <>
    <ChatBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={attachSnaps}
      openSnapIndex={0}
      snapIndex={snapIndex}
      onSnapPointChange={setSnapIndex}
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
      // לפי הטופו: קנבס ערכת הנושא ופינות xl, הכפתורים במילוי cardSolid
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
    >
      <View ref={rootRef} collapsable={false} style={[styles.root, expanded && styles.rootExpanded]}>
        {expanded ? (
          <View style={styles.gridWrap}>
            {galleryChrome}
            {ui.showPermissionCta ? (
              <View style={styles.permission}>
                <Text style={[styles.permissionTitle, { color: tokens.colors.text.primary }]}>
                  גישה לתמונות
                </Text>
                <Text style={[styles.permissionBody, { color: tokens.colors.text.secondary }]}>
                  אפשר גישה כדי לצרף מהגלריה בלי לעזוב את השיחה
                </Text>
                <TouchableOpacity
                  onPress={requestPermission}
                  style={styles.permissionBtn}
                  accessibilityRole="button"
                  accessibilityLabel={MEDIA_ATTACH_PERMISSION_CTA}
                >
                  <Text style={styles.permissionBtnLabel}>{MEDIA_ATTACH_PERMISSION_CTA}</Text>
                </TouchableOpacity>
              </View>
            ) : ui.showSkeleton ? (
              <View style={styles.skeletonGrid}>
                {Array.from({ length: MEDIA_ATTACH_SKELETON_CELLS }).map((_, index) => (
                  <View key={`sk-${index}`} style={[styles.skeletonCell, { width: cellSize, height: cellSize }]} />
                ))}
              </View>
            ) : (
              <FlatList
                data={assets}
                keyExtractor={(item) => item.id}
                numColumns={MEDIA_ATTACH_GRID_COLS}
                renderItem={renderItem}
                onEndReached={() => {
                  void loadMore();
                }}
                onEndReachedThreshold={0.55}
                initialNumToRender={MEDIA_ATTACH_SKELETON_CELLS}
                maxToRenderPerBatch={12}
                windowSize={5}
                removeClippedSubviews
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={
                  assets.length === 0
                    ? styles.emptyWrap
                    : selectedIds.length > 0
                      ? styles.gridWithFab
                      : undefined
                }
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: tokens.colors.text.secondary }]}>
                    אין תמונות עדיין
                  </Text>
                }
                ListFooterComponent={
                  loadingMore ? (
                    <ActivityIndicator style={styles.more} color={tokens.colors.text.tertiary} />
                  ) : null
                }
              />
            )}
          </View>
        ) : (
          <View style={styles.peek}>
            <View style={styles.peekHeader}>
              <ChatSheetTopoHeader title="צירוף" onClose={onClose} />
            </View>
            {peekThumbs.length > 0 ? (
              <View style={styles.peekRecentsBlock}>
                <View style={styles.peekRecentsHeader}>
                  <Text style={styles.peekRecentsTitle}>אחרונים</Text>
                  <TouchableOpacity
                    onPress={expandGallery}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="פתח את כל הגלריה"
                  >
                    <Text style={styles.peekRecentsLink}>הכל</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.peekStrip}
                  keyboardShouldPersistTaps="handled"
                >
                  {peekThumbs.map((item) => (
                    <React.Fragment key={item.id}>
                      {renderThumb(item, MEDIA_ATTACH_PEEK_THUMB_PX, true)}
                    </React.Fragment>
                  ))}
                  <TouchableOpacity
                    style={styles.peekMoreTile}
                    onPress={expandGallery}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="פתח את כל הגלריה"
                  >
                    <Images size={22} color={tokens.colors.text.primary} strokeWidth={2} />
                    <Text style={styles.peekMoreLabel}>הכל</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            ) : null}
            {/* בתצוגה המקוצרת: אחרי בחירה — כפתור העלאה במקום שורת הפעולות (לא מעל התמונות) */}
            {/* הפעולות נשארות בפריסה (גובה קבוע) אבל מוסתרות כשנבחרו קבצים — ה-CTA מונח מעליהן */}
            <View
              style={allowsMultiple && selectedIds.length > 0 ? styles.peekActionsHidden : undefined}
              pointerEvents={allowsMultiple && selectedIds.length > 0 ? 'none' : 'auto'}
            >
              {peekActions}
            </View>
            {allowsMultiple && selectedIds.length > 0 ? (
              <View style={styles.peekCta} pointerEvents="box-none">
                <UploadCta count={selectedIds.length} onPress={confirmSelection} fullWidth />
              </View>
            ) : null}
          </View>
        )}

        {expanded && allowsMultiple && selectedIds.length > 0 ? (
          // CTA ממורכז כמו «חזרה להיום» ביומן הכלכלי
          <View style={styles.confirmWrap} pointerEvents="box-none">
            <UploadCta count={selectedIds.length} onPress={confirmSelection} />
          </View>
        ) : null}
      </View>
    </ChatBottomSheet>
    <ChatAttachCameraSheet
      visible={cameraOpen}
      onClose={() => setCameraOpen(false)}
      onCapture={onBuiltinCapture}
      onCommit={onCameraCommit}
    />
    </>
  );
}

/**
 * CTA «העלאה» — מראה של UIButton primary, אבל הלחיצה ב-TouchableOpacity:
 * Pressable של UIButton לא מקבל לחיצות בתוך השיט (מחוות הגרירה של השיט בולעת אותן).
 */
function UploadCta({ count, onPress, fullWidth = false }: { count: number; onPress: () => void; fullWidth?: boolean }) {
  return (
    <TouchableOpacity
      onPress={() => {
        void HapticFeedback.selection();
        onPress();
      }}
      activeOpacity={0.85}
      style={fullWidth ? { alignSelf: 'stretch' } : undefined}
      accessibilityRole="button"
      accessibilityLabel={`העלאה של ${count} קבצים`}
    >
      <View pointerEvents="none">
        <UIButton
          title={count > 1 ? `העלאה · ${count}` : 'העלאה'}
          variant="primary"
          icon="arrow-up"
          iconPosition="right"
          fullWidth={fullWidth}
          haptic={false}
        />
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (
  tokens: ReturnType<typeof useDesignTokens>,
  sheetBottomPad: number,
  fabBottom: number,
) =>
  StyleSheet.create({
    root: {
      direction: 'rtl',
      backgroundColor: 'transparent',
    },
    rootExpanded: {
      flex: 1,
      minHeight: 0,
    },
    peek: {
      paddingTop: 4,
    },
    peekHeader: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginBottom: 12,
    },
    peekStrip: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      gap: MEDIA_ATTACH_PEEK_THUMB_GAP,
    },
    thumbRounded: {
      borderRadius: MEDIA_ATTACH_PEEK_THUMB_RADIUS,
      overflow: 'hidden',
    },
    peekMoreTile: {
      width: MEDIA_ATTACH_PEEK_THUMB_PX,
      height: MEDIA_ATTACH_PEEK_THUMB_PX,
      borderRadius: MEDIA_ATTACH_PEEK_THUMB_RADIUS,
      backgroundColor: tokens.colors.background.cardSolid,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    peekMoreLabel: {
      ...APP_TYPE.caption,
      color: tokens.colors.text.primary,
    },
    gridWrap: {
      flex: 1,
      minHeight: 0,
    },
    gridWithFab: {
      paddingBottom: fabBottom + 56 + 12,
    },
    gridRow: {
      ...MEDIA_ATTACH_GRID_ROW,
      gap: MEDIA_ATTACH_GRID_GAP,
      marginBottom: MEDIA_ATTACH_GRID_GAP,
    },
    thumb: {
      width: '100%',
      height: '100%',
      backgroundColor: tokens.colors.background.cardSolid,
    },
    videoBadge: {
      position: 'absolute',
      left: 6,
      bottom: 6,
      backgroundColor: 'rgba(0,0,0,0.58)',
      borderRadius: 6,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    videoDuration: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    check: {
      position: 'absolute',
      top: 6,
      left: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.92)',
      backgroundColor: 'rgba(0,0,0,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: {
      backgroundColor: tokens.colors.primary.main,
      borderColor: tokens.colors.primary.main,
    },
    checkNum: {
      color: '#111',
      fontSize: 11,
      fontWeight: '700',
    },
    skeletonGrid: {
      ...MEDIA_ATTACH_GRID_ROW,
      flexWrap: 'wrap',
      gap: MEDIA_ATTACH_GRID_GAP,
    },
    skeletonCell: {
      backgroundColor: tokens.colors.background.cardSolid,
    },
    emptyWrap: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingVertical: 32,
    },
    empty: {
      ...appPhysicalRightText,
      fontSize: APP_TYPE.body.fontSize,
      textAlign: 'center',
      width: '100%',
    },
    more: {
      marginVertical: 16,
    },
    permission: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: tokens.spacing.lg,
      gap: 10,
    },
    permissionTitle: {
      ...appPhysicalRightText,
      fontSize: APP_TYPE.sectionTitle.fontSize,
      fontWeight: '700',
      textAlign: 'center',
    },
    permissionBody: {
      ...appPhysicalRightText,
      fontSize: APP_TYPE.body.fontSize,
      textAlign: 'center',
    },
    permissionBtn: {
      marginTop: 8,
      borderRadius: 18,
      paddingHorizontal: 18,
      paddingVertical: 10,
      backgroundColor: tokens.colors.background.cardSolid,
      borderWidth: 0,
    },
    permissionBtnLabel: {
      color: tokens.colors.text.primary,
      fontSize: APP_TYPE.body.fontSize,
      fontWeight: '700',
    },
    peekActions: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: 4,
      paddingBottom: sheetBottomPad,
    },
    peekRecentsBlock: {
      marginBottom: MEDIA_ATTACH_PEEK_STRIP_GAP,
    },
    peekRecentsHeader: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginBottom: 8,
    },
    peekRecentsTitle: {
      ...appPhysicalRightText,
      ...APP_TYPE.groupLabel,
      color: tokens.colors.text.secondary,
    },
    peekRecentsLink: {
      ...appPhysicalRightText,
      ...APP_TYPE.groupLabel,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      color: tokens.colors.text.primary,
    },
    primaryRow: {
      ...MEDIA_ATTACH_GRID_ROW,
      gap: 12,
    },
    primaryPill: {
      flex: 1,
      height: MEDIA_ATTACH_PRIMARY_ROW_PX,
      borderRadius: MEDIA_ATTACH_PRIMARY_ROW_PX / 2,
      backgroundColor: tokens.colors.background.cardSolid,
      flexDirection: 'row',
      direction: 'rtl',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryPillLabel: {
      ...APP_TYPE.cardTitle,
      color: tokens.colors.text.primary,
    },
    actionGrid: {
      ...MEDIA_ATTACH_GRID_ROW,
      flexWrap: 'wrap',
      rowGap: MEDIA_ATTACH_ACTION_ROW_GAP,
      marginTop: MEDIA_ATTACH_ACTION_ROW_GAP,
    },
    galleryChrome: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: 10,
    },
    galleryTitleWrap: {
      flex: 1,
      alignItems: 'center',
    },
    // כמו ChatSheetTopoHeader: כותרת ממורכזת בגודל sectionTitle
    galleryTitle: {
      fontSize: APP_TYPE.sectionTitle.fontSize,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      color: tokens.colors.text.primary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    galleryChromeSpacer: {
      width: DAY_NAV_BUTTON_SIZE,
      height: DAY_NAV_BUTTON_SIZE,
    },
    actionItem: {
      alignItems: 'center',
      gap: 6,
    },
    actionCircle: {
      width: MEDIA_ATTACH_ACTION_BTN_PX,
      height: MEDIA_ATTACH_ACTION_BTN_PX,
      borderRadius: MEDIA_ATTACH_ACTION_BTN_PX / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.background.cardSolid,
      borderWidth: 0,
    },
    actionLabel: {
      ...appPhysicalRightText,
      ...APP_TYPE.caption,
      color: tokens.colors.text.primary,
      textAlign: 'center',
      width: '100%',
    },
    peekCta: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: sheetBottomPad + 12,
      zIndex: 6,
    },
    peekActionsHidden: {
      opacity: 0,
    },
    confirmWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: fabBottom,
      alignItems: 'center',
      zIndex: 6,
    },
  });
