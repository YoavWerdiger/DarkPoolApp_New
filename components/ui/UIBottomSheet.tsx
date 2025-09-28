import React, { useEffect, useRef } from 'react';
import { 
  Modal, 
  View, 
  Pressable, 
  Animated, 
  Dimensions, 
  ViewStyle,
  PanResponder,
  StatusBar 
} from 'react-native';
import DesignTokens from './DesignTokens';

export interface UIBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showHandle?: boolean;
  dragToClose?: boolean;
  backdropOpacity?: number;
  contentStyle?: ViewStyle;
  closeOnBackdropPress?: boolean;
  maxHeight?: string | number;
}

const { height: screenHeight } = Dimensions.get('window');

const UIBottomSheet: React.FC<UIBottomSheetProps> = ({
  visible,
  onClose,
  children,
  showHandle = true,
  dragToClose = true,
  backdropOpacity = 0.6,
  contentStyle,
  closeOnBackdropPress = true,
  maxHeight = '80%',
}) => {
  const { colors, spacing, borderRadius, shadows } = DesignTokens;
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🎬 UIBottomSheet useEffect:', { visible, screenHeight });
    if (visible) {
      // Show Animation
      panY.setValue(0);
      slideAnim.setValue(screenHeight);
      console.log('🎬 Starting show animation');
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide Animation
      console.log('🎬 Starting hide animation');
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // PanResponder for drag-to-close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => dragToClose,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return dragToClose && Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        panY.setOffset(panY._value);
        panY.setValue(0);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow dragging down
        if (gestureState.dy >= 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        panY.flattenOffset();
        
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          // Close if dragged down enough or fast enough
          onClose();
        } else {
          // Spring back to position
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const backdropStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  };

  const containerStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    ...shadows.lg,
    borderTopWidth: 0.5,
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: colors.border,
    maxHeight: typeof maxHeight === 'string' ? maxHeight : maxHeight,
    minHeight: 200,
    overflow: 'hidden',
  };

  const handleStyle: ViewStyle = {
    width: 50,
    height: 5,
    backgroundColor: '#777',
    borderRadius: 3,
    alignSelf: 'center',
    marginVertical: spacing.lg,
  };

  const contentContainerStyle: ViewStyle = {
    flex: 1,
    ...contentStyle,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.6)" barStyle="light-content" />
      
      {/* Backdrop */}
      <Animated.View style={[backdropStyle, { opacity: fadeAnim }]}>
        {/* Backdrop Pressable */}
        <Pressable 
          style={{ flex: 1 }}
          onPress={closeOnBackdropPress ? onClose : undefined}
        />
        
        {/* Bottom Sheet Container */}
        <Animated.View 
          style={[
            containerStyle,
            {
              transform: [
                { translateY: slideAnim },
                { translateY: panY }
              ]
            }
          ]}
          {...(dragToClose ? panResponder.panHandlers : {})}
        >
          {/* Handle */}
          {showHandle && (
            <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
              <View style={handleStyle} />
            </View>
          )}
          
          {/* Content */}
          <View style={contentContainerStyle}>
            {children}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default UIBottomSheet;

