import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  Pressable,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Play } from 'lucide-react-native';
import { MediaGroupItem } from '../../types/chat.types';
import MediaGalleryViewer from './MediaGalleryViewer';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';

interface MediaGridBubbleProps {
  mediaItems: MediaGroupItem[];
  localMediaItems?: { id: string; uri: string; type: 'image' | 'video' }[];
  isUploading?: boolean;
  maxWidth?: number;
}

const GRID_GAP = 2;
const MAX_VISIBLE = 4;

function MediaGridBubble({ 
  mediaItems, 
  localMediaItems,
  isUploading = false,
  maxWidth = 260 
}: MediaGridBubbleProps) {
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);
  const [signedById, setSignedById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (localMediaItems && localMediaItems.length > 0) {
      setSignedById({});
      return;
    }
    if (!mediaItems.length) {
      setSignedById({});
      return;
    }
    let cancelled = false;
    (async () => {
      const m: Record<string, string> = {};
      for (const it of mediaItems) {
        m[it.id] = (await getChatMediaDisplayUri(it.url)) || it.url;
      }
      if (!cancelled) setSignedById(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [mediaItems, localMediaItems]);

  // Use local media for optimistic UI, or uploaded media
  const items = localMediaItems && localMediaItems.length > 0 
    ? localMediaItems.map((item, idx) => ({
        id: item.id,
        url: item.uri,
        type: item.type,
      }))
    : mediaItems.map((it) => ({
        ...it,
        url: signedById[it.id] ?? it.url,
      }));

  const totalCount = items.length;
  const visibleItems = items.slice(0, MAX_VISIBLE);
  const remainingCount = totalCount - MAX_VISIBLE;

  const openGallery = (index: number) => {
    setInitialIndex(index);
    setGalleryVisible(true);
  };

  // Calculate grid dimensions
  const getGridLayout = () => {
    switch (visibleItems.length) {
      case 1:
        return { columns: 1, rows: 1 };
      case 2:
        return { columns: 2, rows: 1 };
      case 3:
        return { columns: 2, rows: 2 }; // 1 on top spanning 2, 2 on bottom
      default:
        return { columns: 2, rows: 2 };
    }
  };

  const { columns, rows } = getGridLayout();
  const itemWidth = (maxWidth - GRID_GAP * (columns - 1)) / columns;
  const itemHeight = visibleItems.length === 1 ? maxWidth * 0.75 : itemWidth;

  const renderMediaItem = (item: typeof items[0], index: number, isLast: boolean) => {
    const showOverlay = isLast && remainingCount > 0;
    const isVideo = item.type === 'video';
    
    // Special sizing for 3 items - first one is full width
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
        style={[
          styles.mediaItem,
          { width, height },
          isUploading && styles.uploading,
        ]}
      >
        <Image
          source={{ uri: item.url }}
          style={styles.mediaImage}
          resizeMode="cover"
        />
        
        {/* Video play icon */}
        {isVideo && !showOverlay && (
          <View style={styles.videoOverlay}>
            <View style={styles.playButton}>
              <Play size={24} color="#fff" fill="#fff" />
            </View>
          </View>
        )}
        
        {/* +X overlay for remaining items */}
        {showOverlay && (
          <View style={styles.remainingOverlay}>
            <Text style={styles.remainingText}>+{remainingCount}</Text>
          </View>
        )}
        
        {/* Upload progress overlay */}
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
          <View style={styles.singleRow}>
            {renderMediaItem(visibleItems[0], 0, false)}
          </View>
        )}
        
        {visibleItems.length === 2 && (
          <View style={styles.row}>
            {visibleItems.map((item, idx) => 
              renderMediaItem(item, idx, false)
            )}
          </View>
        )}
        
        {visibleItems.length === 3 && (
          <>
            <View style={styles.singleRow}>
              {renderMediaItem(visibleItems[0], 0, false)}
            </View>
            <View style={[styles.row, { marginTop: GRID_GAP }]}>
              {visibleItems.slice(1).map((item, idx) => 
                renderMediaItem(item, idx + 1, false)
              )}
            </View>
          </>
        )}
        
        {visibleItems.length >= 4 && (
          <>
            <View style={styles.row}>
              {visibleItems.slice(0, 2).map((item, idx) => 
                renderMediaItem(item, idx, false)
              )}
            </View>
            <View style={[styles.row, { marginTop: GRID_GAP }]}>
              {visibleItems.slice(2, 4).map((item, idx) => 
                renderMediaItem(item, idx + 2, idx === 1) // Last item (index 3) shows +X
              )}
            </View>
          </>
        )}
      </View>

      {/* Gallery Viewer */}
      <MediaGalleryViewer
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        mediaItems={items.map(item => ({
          id: item.id,
          url: item.url,
          type: item.type as 'image' | 'video',
        }))}
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

