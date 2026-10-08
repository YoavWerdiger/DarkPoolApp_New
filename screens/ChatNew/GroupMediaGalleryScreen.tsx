// ============================================
// Group Media Gallery — WhatsApp-style grid + swipe preview
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import { useAfterNavigationTransition } from '../../hooks/afterNavigationTransition';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import MediaGalleryViewer from '../../components/chat/MediaGalleryViewer';
import { getGroupMediaGallery } from '../../services/chat/chatMediaService';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';
import { chatRtlRoot, chatRtlRow, chatRtlText } from '../../components/chat/chatDesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  settingsRowType,
  settingsMetaType,
  settingsCaptionType,
} from '../../components/profile/settingsType';
import { isolateNumericRuns } from '../DarkPool/utils/bidi';
import { logger } from '../../utils/logger';

type MediaFilter = 'all' | 'image' | 'video';

interface GalleryMediaItem {
  id: string;
  url: string;
  thumbnail: string;
  type: 'image' | 'video';
  createdAt: string;
  caption?: string;
}

const PAGE_SIZE = 60;
const NUM_COLUMNS = 3;
const GRID_GAP = 3;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GroupMediaGalleryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const DesignTokens = useDesignTokens();
  useLockParentDrawerWhileFocused();

  const { groupId, initialMediaId } = route.params as {
    groupId: string;
    initialMediaId?: string;
  };

  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  // רשת על הקנבס (בלי כרטיס עוטף) — רוחב המסך פחות שולי המסך
  const cellSize = useMemo(() => {
    const contentWidth = SCREEN_WIDTH - APP_LAYOUT.screenPaddingHorizontal * 2;
    return Math.floor((contentWidth - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS);
  }, []);

  const videoBadgeCorner = useMemo(
    () => ({
      top: DesignTokens.spacing.xs,
      right: DesignTokens.spacing.xs,
    }),
    [DesignTokens.spacing.xs],
  );

  const [filter, setFilter] = useState<MediaFilter>('all');
  const [items, setItems] = useState<GalleryMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [signedThumbs, setSignedThumbs] = useState<Record<string, string>>({});
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [openedInitial, setOpenedInitial] = useState(false);

  const mapRows = useCallback((images: any[], videos: any[]): GalleryMediaItem[] => {
    const merged = [...images, ...videos].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return merged.map((msg) => ({
      id: msg.id,
      url: msg.media_url,
      thumbnail: msg.media_thumbnail_url || msg.media_url,
      type: (msg.message_type === 'video' ? 'video' : 'image') as 'image' | 'video',
      createdAt: msg.created_at,
      caption: typeof msg.content === 'string' && msg.content.trim() ? msg.content.trim() : undefined,
    }));
  }, []);

  const loadPage = useCallback(
    async (pageIndex: number, append: boolean) => {
      if (!groupId) return;

      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const mediaType = filter === 'all' ? 'all' : filter;
        const { images, videos, hasMore: more, error } = await getGroupMediaGallery(
          groupId,
          mediaType,
          pageIndex,
          PAGE_SIZE
        );

        if (error) {
          logger.error('GroupMediaGallery', 'Fetch failed', error);
          if (!append) setItems([]);
          setHasMore(false);
          return;
        }

        const mapped = mapRows(images, videos);
        setItems((prev) => {
          if (!append) return mapped;
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...mapped.filter((m) => !seen.has(m.id))];
        });
        setHasMore(more);
        setPage(pageIndex);
      } catch (error) {
        logger.error('GroupMediaGallery', 'Unexpected load error', error);
        if (!append) setItems([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [groupId, filter, mapRows]
  );

  useAfterNavigationTransition(() => {
    setOpenedInitial(false);
    void loadPage(0, false);
  }, [loadPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        items.map(async (item) => {
          const t = await getChatMediaDisplayUri(item.thumbnail);
          next[item.id] = t || item.thumbnail;
        })
      );
      if (!cancelled) setSignedThumbs((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  // Open preview immediately when navigated with a specific media id
  useEffect(() => {
    if (openedInitial || loading || !initialMediaId || items.length === 0) return;
    const idx = items.findIndex((i) => i.id === initialMediaId);
    if (idx >= 0) {
      setViewerIndex(idx);
      setViewerVisible(true);
      setOpenedInitial(true);
    }
  }, [openedInitial, loading, initialMediaId, items]);

  const viewerItems = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        url: item.url,
        type: item.type,
        caption: item.caption,
      })),
    [items]
  );

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  const openViewer = (index: number) => {
    void HapticFeedback.selection();
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    void loadPage(page + 1, true);
  };

  const renderFilterChip = (key: MediaFilter, label: string) => {
    const active = filter === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.filterPill, active && styles.filterPillActive]}
        onPress={() => {
          if (filter === key) return;
          void HapticFeedback.selection();
          setFilter(key);
        }}
        activeOpacity={0.75}
      >
        <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item, index }: { item: GalleryMediaItem; index: number }) => (
    <TouchableOpacity
      style={[styles.gridItem, { width: cellSize, height: cellSize }]}
      onPress={() => openViewer(index)}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: signedThumbs[item.id] || item.thumbnail }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      {item.type === 'video' && (
        <View style={[styles.videoBadge, videoBadgeCorner]}>
          <Ionicons name="play" size={12} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderGalleryBody = () => {
    if (loading) {
      // שלד רשת במקום ספינר
      return (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={[styles.gridItem, { width: cellSize, height: cellSize }]} />
          ))}
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <View style={styles.centerContent}>
          <View style={styles.emptyIcon}>
            <Ionicons name="images-outline" size={28} color={DesignTokens.colors.text.secondary} />
          </View>
          <Text style={styles.emptyTitle}>אין מדיה בקבוצה</Text>
          <Text style={styles.emptyText}>
            {filter === 'video'
              ? 'עדיין לא נשלחו סרטונים בקבוצה זו'
              : filter === 'image'
                ? 'עדיין לא נשלחו תמונות בקבוצה זו'
                : 'תמונות וסרטונים שנשלחו בקבוצה יופיעו כאן'}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        style={styles.gridList}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContainer}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={DesignTokens.colors.primary.main} />
            </View>
          ) : null
        }
      />
    );
  };

  return (
    <ChatScreenShell>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title="מדיה" onBack={handleBack} />

        <View style={styles.rtlRoot}>
          <View style={styles.filterRow}>
            {renderFilterChip('all', 'הכל')}
            {renderFilterChip('image', 'תמונות')}
            {renderFilterChip('video', 'סרטונים')}
          </View>
          <View style={styles.body}>{renderGalleryBody()}</View>
        </View>

        <MediaGalleryViewer
          visible={viewerVisible}
          onClose={() => setViewerVisible(false)}
          mediaItems={viewerItems}
          initialIndex={viewerIndex}
        />
      </SafeAreaView>
    </ChatScreenShell>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    rtlRoot: {
      ...chatRtlRoot,
    },
    filterRow: {
      ...chatRtlRow,
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: APP_LAYOUT.stackGapSmall,
      paddingBottom: APP_LAYOUT.cardTitleToBodyGap,
    },
    // כמו פילטרי רשימת הצ׳אטים
    filterPill: {
      backgroundColor: tokens.colors.background.tertiary,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 7,
    },
    filterPillActive: {
      backgroundColor: 'rgba(0, 200, 5, 0.12)',
    },
    filterPillText: {
      ...chatRtlText,
      ...APP_TYPE.caption,
      color: tokens.colors.text.secondary,
    },
    filterPillTextActive: {
      color: tokens.colors.primary.main,
    },
    body: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    },
    skeletonGrid: {
      ...chatRtlRow,
      flexWrap: 'wrap',
      gap: GRID_GAP,
      opacity: 0.6,
    },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: 80,
      gap: 8,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.background.tertiary,
      marginBottom: 4,
    },
    emptyTitle: {
      ...chatRtlText,
      ...APP_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      textAlign: 'center',
    },
    emptyText: {
      ...chatRtlText,
      ...APP_TYPE.cardSubtitle,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    gridList: {
      flex: 1,
    },
    gridContainer: {
      paddingBottom: tokens.spacing.sm,
      flexGrow: 1,
    },
    gridRow: {
      ...chatRtlRow,
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    gridItem: {
      borderRadius: 10,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: tokens.colors.background.tertiary,
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    videoBadge: {
      position: 'absolute',
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    footerLoader: {
      paddingVertical: tokens.spacing.md,
      alignItems: 'center',
    },
  });
