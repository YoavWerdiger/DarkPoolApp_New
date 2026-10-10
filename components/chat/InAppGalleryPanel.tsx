import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_TYPE } from '../ui/appType';
import {
  getMediaLibraryReadStatus,
  loadMediaRecentsPage,
  peekMediaRecents,
  requestMediaLibraryRead,
  resolveMediaRecentLocalUri,
  type MediaRecentAsset,
} from '../../lib/mediaRecentsCache';
import { HapticFeedback } from '../../utils/hapticFeedback';
import * as MediaLibrary from 'expo-media-library';
import { openAppSettings } from '../../lib/cameraSession';

const COLS = 4;
const GAP = 2;

export type InAppGalleryPick = {
  uri: string;
  width?: number;
  height?: number;
  mediaType: 'image' | 'video';
  durationMs?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (pick: InAppGalleryPick) => void;
};

/**
 * גלריית המכשיר בתוך מסך המצלמה (צ'אט / סטורי) — במקום בוחר התמונות של המערכת,
 * כך שלא יוצאים מהמסך. עולה מלמטה מעל המצלמה; בחירה אחת סוגרת וממשיכה לפריוויו.
 */
export function InAppGalleryPanel({ visible, onClose, onPick }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cell = Math.floor((screenW - GAP * (COLS - 1)) / COLS);
  const cached = peekMediaRecents('all');
  const [assets, setAssets] = useState<MediaRecentAsset[]>(cached?.assets ?? []);
  const [cursor, setCursor] = useState<string | null>(cached?.endCursor ?? null);
  const [hasMore, setHasMore] = useState(cached?.hasNextPage ?? true);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(!cached);
  const loadingMoreRef = useRef(false);
  const [mounted, setMounted] = useState(visible);
  const [resolving, setResolving] = useState(false);

  const y = useSharedValue(screenH);
  useEffect(() => {
    if (visible) setMounted(true);
    y.value = withTiming(visible ? 0 : screenH, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
    if (!visible) {
      const t = setTimeout(() => setMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [visible, screenH, y]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const status = await getMediaLibraryReadStatus();
      const readable = status.readable || (status.canAskAgain && (await requestMediaLibraryRead()));
      if (cancelled) return;
      if (!readable) {
        setDenied(true);
        setLoading(false);
        return;
      }
      setDenied(false);
      try {
        const page = await loadMediaRecentsPage('all');
        if (cancelled) return;
        setAssets(page.assets);
        setCursor(page.endCursor);
        setHasMore(page.hasNextPage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || !cursor) return;
    loadingMoreRef.current = true;
    try {
      const page = await loadMediaRecentsPage('all', cursor);
      setAssets((prev) => [...prev, ...page.assets]);
      setCursor(page.endCursor);
      setHasMore(page.hasNextPage);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [cursor, hasMore]);

  const pick = useCallback(
    async (asset: MediaRecentAsset) => {
      void HapticFeedback.selection();
      const isVideo = asset.mediaType === 'video';
      let uri = await resolveMediaRecentLocalUri(asset.id, asset.uri);
      // וידאו ב-iCloud: אין קובץ מקומי (ph://) — הנגן מציג שחור. מבקשים מהמערכת להוריד
      if (uri.startsWith('ph://')) {
        setResolving(true);
        try {
          const info = await MediaLibrary.getAssetInfoAsync(asset.id, { shouldDownloadFromNetwork: true });
          const local = info.localUri || info.uri;
          if (local && !local.startsWith('ph://')) uri = local;
        } catch {
          /* נשאר ph:// */
        } finally {
          setResolving(false);
        }
      }
      onPick({
        uri,
        width: asset.width || undefined,
        height: asset.height || undefined,
        mediaType: isVideo ? 'video' : 'image',
        durationMs: isVideo && asset.duration > 0 ? Math.round(asset.duration * 1000) : undefined,
      });
    },
    [onPick],
  );

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.root, { paddingTop: insets.top }, slide]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.circleBtn} accessibilityRole="button" accessibilityLabel="חזרה למצלמה">
          <Ionicons name="chevron-down" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>גלריה</Text>
        <View style={styles.circleSpacer} />
      </View>

      {denied ? (
        <View style={styles.center}>
          <Text style={styles.message}>אין גישה לגלריה. אפשר גישה בהגדרות המכשיר.</Text>
          <Pressable onPress={openAppSettings} style={styles.settingsBtn} accessibilityRole="button">
            <Text style={styles.settingsBtnText}>פתח הגדרות</Text>
          </Pressable>
        </View>
      ) : loading && assets.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(a) => a.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 12 }}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.6}
          initialNumToRender={24}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => void pick(item)}
              activeOpacity={0.85}
              style={{ width: cell, height: cell }}
              accessibilityRole="button"
              accessibilityLabel={item.mediaType === 'video' ? 'סרטון' : 'תמונה'}
            >
              <ExpoImage
                source={{ uri: item.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item.id}
                transition={0}
              />
              {item.mediaType === 'video' ? (
                <View style={styles.videoBadge} pointerEvents="none">
                  <Ionicons name="videocam" size={12} color="#fff" />
                  <Text style={styles.videoText}>{formatDuration(item.duration)}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
      {resolving ? (
        <View style={styles.resolving} pointerEvents="auto">
          <ActivityIndicator color="#fff" />
          <Text style={styles.message}>מוריד מ-iCloud…</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    zIndex: 50,
    // מעל שכבות הכרום של המצלמה (באנדרואיד הסדר לפי elevation)
    elevation: 60,
  },
  header: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  circleSpacer: {
    width: 44,
    height: 44,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: APP_TYPE.sectionTitle.fontSize,
    lineHeight: APP_TYPE.sectionTitle.lineHeight,
    fontWeight: APP_TYPE.sectionTitle.fontWeight,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  resolving: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  settingsBtn: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  settingsBtnText: {
    color: '#fff',
    fontSize: APP_TYPE.cardTitle.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  videoBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  videoText: {
    color: '#fff',
    fontSize: APP_TYPE.caption.fontSize,
    fontVariant: ['tabular-nums'],
  },
});

export default InAppGalleryPanel;
