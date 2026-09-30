import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatBottomSheet } from './ChatBottomSheet';
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
  MEDIA_ATTACH_PEEK_THUMBS,
  MEDIA_ATTACH_PERMISSION_CTA,
  MEDIA_ATTACH_SECONDARY_COLS,
  MEDIA_ATTACH_SKELETON_CELLS,
  MEDIA_ATTACH_SNAP_POINTS,
  formatMediaDuration,
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
  onEntity?: boolean;
  onMention?: boolean;
  onAudio?: boolean;
  onPoll?: boolean;
}): number {
  let n = 0;
  if (input.onDocument) n += 1;
  if (input.onEntity) n += 1;
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
}): AttachOpenLock {
  const hit = peekMediaRecents(input.kind) ?? peekMediaRecents('all');
  const cached = filterRecentsByKind(hit?.assets ?? [], input.kind);
  const plan = mediaAttachPeekPlan({
    screenHeight: input.screenHeight,
    thumbSize: input.thumbSize,
    bottomPad: input.bottomPad,
    cachedCount: cached.length,
    secondaryCount: input.secondaryCount,
  });
  return {
    snaps: [plan.peekSnap, MEDIA_ATTACH_EXPANDED_SNAP],
    thumbs: plan.showPeekRecents ? cached.slice(0, MEDIA_ATTACH_PEEK_THUMBS) : [],
  };
}

type ActionId = 'camera' | 'gallery' | 'document' | 'audio' | 'poll' | 'entity' | 'mention';

type SheetAction = {
  id: ActionId;
  icon: keyof typeof Ionicons.glyphMap | 'poll-image';
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
};

export default function MediaPickerSheet({
  visible,
  onClose,
  onPickedMedia,
  onCamera,
  onDocument,
  onAudio,
  onPoll,
  onEntity,
  onMention,
  kind = 'all',
  allowsMultiple = true,
  selectionLimit = 10,
  cameraLaunch,
  showCamera,
  onBuiltinCamera,
}: MediaPickerSheetProps) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const sheetBottomPad = useMemo(
    () => sheetContentBottomPadding(insets.bottom),
    [insets.bottom],
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
        onEntity: !!onEntity,
        onMention: !!onMention,
        onAudio: !!onAudio,
        onPoll: !!onPoll,
      }),
    [onAudio, onDocument, onEntity, onMention, onPoll],
  );

  if (visible && openLockRef.current == null) {
    openLockRef.current = lockAttachOpen({
      kind,
      screenHeight: screenH,
      thumbSize: cellSize,
      bottomPad: sheetBottomPad,
      secondaryCount,
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

  const cameraMode = cameraLaunch ?? (onCamera ? 'system' : 'builtin');
  const showCameraButton =
    showCamera !== false && (onCamera != null || onPickedMedia != null);

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
      onPickedMedia?.(picked.map(recentToPicked));
      onClose();
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
    (result: { uri: string; width?: number; height?: number }) => {
      const picked: PickedRecentMedia = {
        id: `camera-${Date.now()}`,
        uri: result.uri,
        thumbnailUri: result.uri,
        type: 'image',
        name: `photo_${Date.now()}.jpg`,
        width: result.width,
        height: result.height,
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
      next.push({
        id: 'document',
        icon: 'document-text',
        label: 'מסמך',
        run: () => launchSystem(onDocument),
      });
    }
    if (onEntity) {
      next.push({ id: 'entity', icon: 'link', label: 'שיתוף', run: () => launchSystem(onEntity) });
    }
    if (onMention) {
      next.push({ id: 'mention', icon: 'at', label: 'תיוג', run: () => launchSystem(onMention) });
    }
    if (onAudio) {
      next.push({ id: 'audio', icon: 'mic', label: 'אודיו', run: () => launchSystem(onAudio) });
    }
    if (onPoll) {
      next.push({
        id: 'poll',
        icon: 'poll-image',
        label: 'סקר',
        run: () => launchSystem(onPoll),
      });
    }
    return next;
  }, [launchSystem, onAudio, onDocument, onEntity, onMention, onPoll]);

  const ui = mediaAttachPresentation({
    permission,
    cachedCount: assets.length,
    loading,
    expanded,
  });
  const styles = useMemo(() => createStyles(tokens, sheetBottomPad), [sheetBottomPad, tokens]);

  const renderItem = useCallback(
    ({ item }: { item: MediaRecentAsset }) => {
      const selected = selectedSet.has(item.id);
      const order = selected ? selectedIds.indexOf(item.id) + 1 : 0;
      const duration = item.mediaType === 'video' ? formatMediaDuration(item.duration) : '';
      return (
        <TouchableOpacity
          onPress={() => onPressAsset(item)}
          activeOpacity={0.85}
          style={{ width: cellSize, height: cellSize }}
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
    [allowsMultiple, cellSize, onPressAsset, selectedIds, selectedSet, styles],
  );

  const peekActions = (
    <View style={styles.peekActions}>
      <View style={styles.primaryRow}>
        <TouchableOpacity
          style={styles.primaryTile}
          onPress={expandGallery}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="גלריה"
        >
          <View style={styles.primaryIconWrap}>
            <Ionicons name="images" size={26} color={tokens.colors.text.primary} />
          </View>
          <View style={styles.primaryTextCol}>
            <Text style={styles.primaryTitle} numberOfLines={1}>
              גלריה
            </Text>
          </View>
        </TouchableOpacity>
        {showCameraButton ? (
          <TouchableOpacity
            style={styles.primaryTile}
            onPress={openCamera}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="מצלמה"
          >
            <View style={styles.primaryIconWrap}>
              <Ionicons name="camera" size={26} color={tokens.colors.text.primary} />
            </View>
            <View style={styles.primaryTextCol}>
              <Text style={styles.primaryTitle} numberOfLines={1}>
                מצלמה
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      {secondaryActions.length > 0 ? (
        <View style={styles.secondaryBlock}>
          <View style={styles.secondaryRow}>
          {secondaryActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.secondaryItem}
              onPress={action.run}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <View style={styles.actionCircle}>
                {action.icon === 'poll-image' ? (
                  <Image
                    source={require('../../assets/icons/ico-40-poll-2.png')}
                    style={styles.pollIcon}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name={action.icon} size={22} color={tokens.colors.text.primary} />
                )}
              </View>
              <Text style={styles.actionLabel} numberOfLines={1}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  const galleryChrome = (
    <View style={styles.galleryChrome}>
      <DayNavBlurButton size={40} onPress={collapseGallery} accessibilityLabel="חזרה לתפריט">
        <Ionicons name="chevron-down" size={22} color={tokens.colors.text.primary} />
      </DayNavBlurButton>
      <Text style={styles.galleryTitle}>גלריה</Text>
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
      useGlassBackground
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
    >
      <View style={[styles.root, expanded && styles.rootExpanded]}>
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
                contentContainerStyle={assets.length === 0 ? styles.emptyWrap : undefined}
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
                <View style={styles.peekStrip}>
                  {peekThumbs.map((item) => (
                    <View key={item.id} style={styles.peekCell}>
                      {renderItem({ item })}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {peekActions}
          </View>
        )}

        {allowsMultiple && selectedIds.length > 0 ? (
          <TouchableOpacity
            onPress={confirmSelection}
            style={styles.confirmFab}
            accessibilityRole="button"
            accessibilityLabel={`הוסף ${selectedIds.length} קבצים`}
          >
            <Ionicons name="arrow-up" size={22} color="#111" />
            <Text style={styles.confirmCount}>{selectedIds.length}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ChatBottomSheet>
    <ChatAttachCameraSheet
      visible={cameraOpen}
      onClose={() => setCameraOpen(false)}
      onCapture={onBuiltinCapture}
    />
    </>
  );
}

const createStyles = (
  tokens: ReturnType<typeof useDesignTokens>,
  sheetBottomPad: number,
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
    peekStrip: {
      ...MEDIA_ATTACH_GRID_ROW,
      gap: MEDIA_ATTACH_GRID_GAP,
      marginBottom: 12,
    },
    peekCell: {
      flex: 1,
    },
    gridWrap: {
      flex: 1,
      minHeight: 0,
    },
    gridRow: {
      ...MEDIA_ATTACH_GRID_ROW,
      gap: MEDIA_ATTACH_GRID_GAP,
      marginBottom: MEDIA_ATTACH_GRID_GAP,
    },
    thumb: {
      width: '100%',
      height: '100%',
      backgroundColor: tokens.colors.background.primary,
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
      fontWeight: '800',
    },
    skeletonGrid: {
      ...MEDIA_ATTACH_GRID_ROW,
      flexWrap: 'wrap',
      gap: MEDIA_ATTACH_GRID_GAP,
    },
    skeletonCell: {
      backgroundColor: tokens.colors.background.primary,
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
      backgroundColor: tokens.colors.background.primary,
      borderWidth: 0,
    },
    permissionBtnLabel: {
      color: tokens.colors.text.primary,
      fontSize: APP_TYPE.body.fontSize,
      fontWeight: '700',
    },
    peekActions: {
      paddingHorizontal: tokens.spacing.md,
      paddingTop: 4,
      paddingBottom: sheetBottomPad,
      gap: 16,
    },
    peekRecentsBlock: {
      paddingHorizontal: tokens.spacing.md,
      marginBottom: 4,
    },
    peekRecentsHeader: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    peekRecentsTitle: {
      ...appPhysicalRightText,
      fontSize: APP_TYPE.sectionSubtitle.fontSize,
      fontWeight: '700',
      color: tokens.colors.text.secondary,
    },
    peekRecentsLink: {
      ...appPhysicalRightText,
      fontSize: APP_TYPE.body.fontSize,
      fontWeight: '600',
      color: tokens.colors.text.primary,
    },
    primaryRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    primaryTile: {
      flex: 1,
      minHeight: 76,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: tokens.colors.background.primary,
      borderWidth: 0,
    },
    primaryIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryTextCol: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
      gap: 2,
    },
    primaryTitle: {
      ...appPhysicalRightText,
      fontSize: APP_TYPE.body.fontSize,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      width: '100%',
      textAlign: 'right',
    },
    secondaryBlock: {
      gap: 10,
    },
    secondaryRow: {
      ...MEDIA_ATTACH_GRID_ROW,
      flexWrap: 'wrap',
      rowGap: 14,
    },
    galleryChrome: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: tokens.spacing.md,
      paddingBottom: 10,
    },
    galleryTitle: {
      ...appPhysicalRightText,
      fontSize: APP_TYPE.sectionTitle.fontSize,
      fontWeight: '700',
      color: tokens.colors.text.primary,
    },
    galleryChromeSpacer: {
      width: 40,
      height: 40,
    },
    secondaryItem: {
      width: `${100 / MEDIA_ATTACH_SECONDARY_COLS}%`,
      alignItems: 'center',
      gap: 6,
    },
    actionCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.background.primary,
      borderWidth: 0,
    },
    actionLabel: {
      ...appPhysicalRightText,
      color: tokens.colors.text.primary,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      width: '100%',
    },
    pollIcon: {
      width: 22,
      height: 22,
      tintColor: tokens.colors.text.primary,
    },
    confirmFab: {
      position: 'absolute',
      left: 16,
      bottom: sheetBottomPad + 8,
      minWidth: 56,
      height: 56,
      borderRadius: 28,
      paddingHorizontal: 14,
      backgroundColor: tokens.colors.primary.main,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    confirmCount: {
      color: '#111',
      fontSize: 16,
      fontWeight: '800',
    },
  });
