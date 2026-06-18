import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Modal,
  FlatList,
  Pressable,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { logger } from '../../utils/logger';
import { chatPalette } from './chatDesignTokens';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
}

interface MediaGalleryViewerProps {
  visible: boolean;
  onClose: () => void;
  mediaItems: MediaItem[];
  initialIndex?: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Isolated image item with its own zoom state so zoom doesn't leak between pages
function GalleryImageItem({ url, isActive }: { url: string; isActive: boolean }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // Reset zoom when this item becomes inactive (user swiped away)
  React.useEffect(() => {
    if (!isActive) {
      scale.value = withSpring(1);
      savedScale.value = 1;
    }
  }, [isActive]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => { scale.value = savedScale.value * e.scale; })
    .onEnd(() => {
      if (scale.value < 1) { scale.value = withSpring(1); savedScale.value = 1; }
      else if (scale.value > 4) { scale.value = withSpring(4); savedScale.value = 4; }
      else { savedScale.value = scale.value; }
    });

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <GestureDetector gesture={pinchGesture}>
      <Animated.View style={[{ width: screenWidth, height: screenHeight }, animatedStyle]}>
        <ExpoImage
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={url}
          transition={200}
        />
      </Animated.View>
    </GestureDetector>
  );
}

export default function MediaGalleryViewer({
  visible,
  onClose,
  mediaItems,
  initialIndex = 0,
}: MediaGalleryViewerProps) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isVideoPlaying, setIsVideoPlaying] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, Video>>({});

  const resetZoom = useCallback(() => {
    // Zoom is now managed per-item inside GalleryImageItem
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentIndex) {
        const prevItem = mediaItems[currentIndex];
        if (prevItem?.type === 'video' && videoRefs.current[prevItem.id]) {
          videoRefs.current[prevItem.id].pauseAsync().catch(e =>
            logger.error('MediaGalleryViewer', 'Failed to pause previous video', e)
          );
          setIsVideoPlaying(prev => ({ ...prev, [prevItem.id]: false }));
        }
        setCurrentIndex(newIndex);
        resetZoom();
      }
    }
  }, [currentIndex, mediaItems]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const goToPrev = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
    }
  };

  const goToNext = () => {
    if (currentIndex < mediaItems.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const toggleVideoPlay = async (itemId: string) => {
    const videoRef = videoRefs.current[itemId];
    if (!videoRef) return;

    try {
      if (isVideoPlaying[itemId]) {
        await videoRef.pauseAsync();
        setIsVideoPlaying(prev => ({ ...prev, [itemId]: false }));
      } else {
        await videoRef.playAsync();
        setIsVideoPlaying(prev => ({ ...prev, [itemId]: true }));
      }
    } catch (error) {
      logger.error('MediaGalleryViewer', 'toggleVideoPlay failed', error);
    }
  };


  const renderItem = ({ item, index }: { item: MediaItem; index: number }) => {
    if (item.type === 'video') {
      return (
        <View style={styles.mediaContainer}>
          <Video
            ref={(ref) => { if (ref) videoRefs.current[item.id] = ref; }}
            source={{ uri: item.url }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            isLooping
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded) {
                setIsVideoPlaying(prev => ({ 
                  ...prev, 
                  [item.id]: status.isPlaying 
                }));
              }
            }}
          />
          {!isVideoPlaying[item.id] && (
            <Pressable 
              style={styles.videoPlayOverlay}
              onPress={() => toggleVideoPlay(item.id)}
            >
              <View style={styles.playButton}>
                <Play size={48} color="#fff" fill="#fff" />
              </View>
            </Pressable>
          )}
        </View>
      );
    }

    return (
      <View style={styles.mediaContainer}>
        <GalleryImageItem url={item.url} isActive={index === currentIndex} />
      </View>
    );
  };

  if (!visible || !mediaItems || mediaItems.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        {/* Media List */}
        <FlatList
          ref={flatListRef}
          data={mediaItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />

        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#fff" strokeWidth={2} />
          </Pressable>
          
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {mediaItems.length}
            </Text>
          </View>
          
          <View style={{ width: 44 }} />
        </View>

        {/* Navigation Arrows – RTL aware: right side = go back (prev), left side = go forward (next) */}
        {mediaItems.length > 1 && (
          <>
            {currentIndex > 0 && (
              <Pressable onPress={goToPrev} style={[styles.navArrow, styles.navRight]}>
                <ChevronLeft size={32} color="#fff" strokeWidth={2} />
              </Pressable>
            )}
            {currentIndex < mediaItems.length - 1 && (
              <Pressable onPress={goToNext} style={[styles.navArrow, styles.navLeft]}>
                <ChevronRight size={32} color="#fff" strokeWidth={2} />
              </Pressable>
            )}
          </>
        )}

        {/* Thumbnail Strip */}
        {mediaItems.length > 1 && (
          <View style={[styles.thumbnailStrip, { paddingBottom: insets.bottom + 16 }]}>
            {mediaItems.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  flatListRef.current?.scrollToIndex({ index, animated: true });
                }}
                style={[
                  styles.thumbnail,
                  index === currentIndex && styles.thumbnailActive,
                ]}
              >
                <ExpoImage
                  source={{ uri: item.url }}
                  style={styles.thumbnailImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {item.type === 'video' && (
                  <View style={styles.thumbnailVideoIcon}>
                    <Play size={12} color="#fff" fill="#fff" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  video: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLeft: {
    left: 16,
  },
  navRight: {
    right: 16,
  },
  thumbnailStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: chatPalette.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailVideoIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

