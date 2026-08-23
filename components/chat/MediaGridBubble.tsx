import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Play } from 'lucide-react-native';
import { MediaGroupItem } from '../../types/chat.types';
import MediaGalleryViewer from './MediaGalleryViewer';
import {
  getCachedChatMediaDisplayUri,
  signMediaGroupItemsForDisplay,
} from '../../services/chat/chatSignedMediaUrl';

interface MediaGridBubbleProps {
  mediaItems: MediaGroupItem[];
  localMediaItems?: { id: string; uri: string; type: 'image' | 'video' }[];
  isUploading?: boolean;
  maxWidth?: number;
}

const GRID_GAP = 2;
const MAX_VISIBLE = 4;

function isLoadableUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('file:') ||
    uri.startsWith('content:')
  );
}

function MediaGridBubble({
  mediaItems,
  localMediaItems,
  isUploading = false,
  maxWidth = 220,
}: MediaGridBubbleProps) {
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);
  const [signedById, setSignedById] = useState<Record<string, string>>({});
  const [isSigning, setIsSigning] = useState(false);

  useEffect(() => {
    if (localMediaItems && localMediaItems.length > 0) {
      setSignedById({});
      setIsSigning(false);
      return;
    }
    if (!mediaItems.length) {
      setSignedById({});
      setIsSigning(false);
      return;
    }

    const syncCached: Record<string, string> = {};
    for (const it of mediaItems) {
      const hit =
        getCachedChatMediaDisplayUri(it.thumbnail_url) ||
        getCachedChatMediaDisplayUri(it.url);
      if (hit) syncCached[it.id] = hit;
    }
    if (Object.keys(syncCached).length > 0) {
      setSignedById((prev) => ({ ...prev, ...syncCached }));
    }

    let cancelled = false;
    setIsSigning(Object.keys(syncCached).length < mediaItems.length);
    (async () => {
      try {
        const signed = await signMediaGroupItemsForDisplay(mediaItems);
        if (!cancelled) setSignedById((prev) => ({ ...prev, ...signed }));
      } finally {
        if (!cancelled) setIsSigning(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaItems, localMediaItems]);

  const items = useMemo(() => {
    if (localMediaItems && localMediaItems.length > 0) {
      return localMediaItems.map((item) => ({
        id: item.id,
        url: item.uri,
        type: item.type,
      }));
    }
    return mediaItems.map((it) => ({
      ...it,
      url: signedById[it.id] ?? getCachedChatMediaDisplayUri(it.thumbnail_url) ?? getCachedChatMediaDisplayUri(it.url) ?? '',
    }));
  }, [localMediaItems, mediaItems, signedById]);

  const galleryItems = useMemo(
    () =>
      items
        .filter((item) => isLoadableUri(item.url))
        .map((item) => ({
          id: item.id,
          url: item.url,
          type: item.type as 'image' | 'video',
        })),
    [items],
  );

  const totalCount = items.length;
  const visibleItems = items.slice(0, MAX_VISIBLE);
  const remainingCount = totalCount - MAX_VISIBLE;

  const openGallery = (index: number) => {
    if (isUploading) return;
    setInitialIndex(index);
    setGalleryVisible(true);
  };

  const getGridLayout = () => {
    switch (visibleItems.length) {
      case 1:
        return { columns: 1, rows: 1 };
      case 2:
        return { columns: 2, rows: 1 };
      case 3:
        return { columns: 2, rows: 2 };
      default:
        return { columns: 2, rows: 2 };
    }
  };

  const { columns } = getGridLayout();
  const itemWidth = (maxWidth - GRID_GAP * (columns - 1)) / columns;
  // Single item: mild portrait (between square and 3:4), multi: square cells
  const itemHeight = visibleItems.length === 1 ? maxWidth * 1.25 : itemWidth;

  const renderMediaItem = (item: (typeof items)[0], index: number, isLast: boolean) => {
    const showOverlay = isLast && remainingCount > 0;
    const isVideo = item.type === 'video';
    const loadable = isLoadableUri(item.url);

    let width = itemWidth;
    let height = itemHeight;
    if (visibleItems.length === 3 && index === 0) {
      width = maxWidth;
      height = maxWidth * 0.5;
    }

    return (
      <Pressable
        key={item.id}
        onPress={() => openGallery(index)}
        style={[styles.mediaItem, { width, height }, isUploading && styles.uploading]}
      >
        {loadable ? (
          <ExpoImage
            source={{ uri: item.url }}
            style={styles.mediaImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={`grid-${item.id}-${item.url}`}
            transition={150}
          />
        ) : (
          <View style={[styles.mediaImage, styles.mediaPlaceholder]}>
            {isSigning ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
            ) : (
              <Ionicons name="image-outline" size={28} color="rgba(255,255,255,0.45)" />
            )}
          </View>
        )}

        {isVideo && !showOverlay && loadable && (
          <View style={styles.videoOverlay}>
            <View style={styles.playButton}>
              <Play size={24} color="#fff" fill="#fff" />
            </View>
          </View>
        )}

        {showOverlay && (
          <View style={styles.remainingOverlay}>
            <Text style={styles.remainingText}>+{remainingCount}</Text>
          </View>
        )}

        {isUploading && (
          <View style={styles.uploadingOverlay}>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <>
      <View style={[styles.container, { width: maxWidth }]}>
        {visibleItems.length === 1 && (
          <View style={styles.singleRow}>{renderMediaItem(visibleItems[0], 0, false)}</View>
        )}

        {visibleItems.length === 2 && (
          <View style={styles.row}>
            {visibleItems.map((item, idx) => renderMediaItem(item, idx, false))}
          </View>
        )}

        {visibleItems.length === 3 && (
          <>
            <View style={styles.singleRow}>{renderMediaItem(visibleItems[0], 0, false)}</View>
            <View style={[styles.row, { marginTop: GRID_GAP }]}>
              {visibleItems.slice(1).map((item, idx) => renderMediaItem(item, idx + 1, false))}
            </View>
          </>
        )}

        {visibleItems.length >= 4 && (
          <>
            <View style={styles.row}>
              {visibleItems.slice(0, 2).map((item, idx) => renderMediaItem(item, idx, false))}
            </View>
            <View style={[styles.row, { marginTop: GRID_GAP }]}>
              {visibleItems.slice(2, 4).map((item, idx) => renderMediaItem(item, idx + 2, idx === 1))}
            </View>
          </>
        )}
      </View>

      <MediaGalleryViewer
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        mediaItems={galleryItems}
        initialIndex={initialIndex}
      />
    </>
  );
}

export default React.memo(MediaGridBubble);

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  singleRow: {
    flexDirection: 'row',
  },
  mediaItem: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  uploading: {
    opacity: 0.7,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
