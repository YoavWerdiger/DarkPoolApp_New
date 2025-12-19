// ============================================
// Media Viewer Component
// ============================================
// מסך מלא להצגת תמונות וסרטונים
// ============================================

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { useDesignTokens } from '../ui/DesignTokens';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MediaViewerProps {
  visible: boolean;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  onClose: () => void;
}

export default function MediaViewer({
  visible,
  mediaUrl,
  mediaType,
  caption,
  onClose,
}: MediaViewerProps) {
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [imageLoading, setImageLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);

  // Animation values for zoom and pan
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset animation values when modal closes
  React.useEffect(() => {
    if (!visible) {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [visible]);

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Limit zoom between 1 and 5
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      } else if (scale.value > 5) {
        scale.value = withSpring(5);
        savedScale.value = 5;
      }
    });

  // Pan gesture for drag (only when zoomed)
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      
      // Spring back to center if not zoomed
      if (scale.value <= 1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Constrain pan when zoomed
        const maxTranslateX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
        const maxTranslateY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;
        
        if (Math.abs(translateX.value) > maxTranslateX) {
          translateX.value = withSpring(translateX.value > 0 ? maxTranslateX : -maxTranslateX);
          savedTranslateX.value = translateX.value;
        }
        if (Math.abs(translateY.value) > maxTranslateY) {
          translateY.value = withSpring(translateY.value > 0 ? maxTranslateY : -maxTranslateY);
          savedTranslateY.value = translateY.value;
        }
      }
    });

  // Combined gesture
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // Animated style for image
  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const styles = StyleSheet.create({
    modal: {
      flex: 1,
      backgroundColor: '#000000',
    },
    mediaContainer: {
      flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
    },
    headerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    header: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    captionOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    closeButton: {
      padding: 8,
    },
    captionContainer: {
      paddingHorizontal: 20,
          paddingVertical: 16,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 20,
      marginHorizontal: 20,
      marginBottom: 20,
      alignSelf: 'center',
      maxWidth: SCREEN_WIDTH - 80,
    },
    captionContainerFullWidth: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      marginHorizontal: 0,
      borderRadius: 0,
      maxWidth: '100%',
    },
    captionText: {
      color: '#FFFFFF',
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 22,
    },
    image: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    videoContainer: {
      flex: 1,
      width: '100%',
    },
    video: {
      width: '100%',
      height: '100%',
    },
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
    },
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.modal}>
        {/* Media - Full Screen with Safe Area */}
        <SafeAreaView style={styles.mediaContainer} edges={['top', 'bottom']}>
          {mediaType === 'image' ? (
            <>
              {imageLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              )}
              <GestureDetector gesture={composedGesture}>
                <Animated.Image
                  source={{ uri: mediaUrl }}
                  style={[styles.image, imageAnimatedStyle]}
                  resizeMode="contain"
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
              </GestureDetector>
            </>
          ) : (
            <>
              {videoLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              )}
              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: mediaUrl }}
                  style={styles.video}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={false}
                  onLoadStart={() => setVideoLoading(true)}
                  onLoad={() => setVideoLoading(false)}
                  onError={() => setVideoLoading(false)}
                />
              </View>
            </>
          )}
        </SafeAreaView>

        {/* Header Overlay */}
        <View 
          style={[
            styles.headerOverlay, 
            { 
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              top: insets.top,
            }
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Caption Overlay - במרכז או עד למטה */}
        {caption && typeof caption === 'string' && caption.trim().length > 0 && (
          <SafeAreaView 
            style={[styles.captionOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]} 
            edges={['bottom']}
          >
            <View style={[
              styles.captionContainer,
              caption.length > 50 ? styles.captionContainerFullWidth : undefined
            ]}>
              <Text style={styles.captionText}>{String(caption)}</Text>
            </View>
          </SafeAreaView>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}
