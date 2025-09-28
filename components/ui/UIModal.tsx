import React, { useEffect, useRef } from 'react';
import { 
  Modal, 
  View, 
  Pressable, 
  Animated, 
  Dimensions, 
  ViewStyle,
  StatusBar 
} from 'react-native';
import DesignTokens from './DesignTokens';

export interface UIModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  animationType?: 'fade' | 'slide' | 'none';
  showBackdrop?: boolean;
  backdropOpacity?: number;
  contentStyle?: ViewStyle;
  closeOnBackdropPress?: boolean;
  statusBarTranslucent?: boolean;
}

const { height: screenHeight } = Dimensions.get('window');

const UIModal: React.FC<UIModalProps> = ({
  visible,
  onClose,
  children,
  animationType = 'fade',
  showBackdrop = true,
  backdropOpacity = 0.6,
  contentStyle,
  closeOnBackdropPress = true,
  statusBarTranslucent = true,
}) => {
  const { colors, shadows, animation } = DesignTokens;
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  useEffect(() => {
    if (visible) {
      // Animation In
      if (animationType === 'fade') {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animation.duration.normal,
          useNativeDriver: true,
        }).start();
      } else if (animationType === 'slide') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: animation.duration.fast,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: animation.spring.tension,
            friction: animation.spring.friction,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      // Animation Out
      if (animationType === 'fade') {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: animation.duration.fast,
          useNativeDriver: true,
        }).start();
      } else if (animationType === 'slide') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: animation.duration.fast,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: screenHeight,
            duration: animation.duration.normal,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [visible]);

  const backdropStyle: ViewStyle = {
    flex: 1,
    backgroundColor: showBackdrop ? colors.overlay : 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  };

  const defaultContentStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    maxWidth: '90%',
    maxHeight: '80%',
    ...shadows.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
  };

  const combinedContentStyle: ViewStyle = {
    ...defaultContentStyle,
    ...contentStyle,
  };

  const getAnimatedStyle = () => {
    if (animationType === 'slide') {
      return {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      };
    }
    return {
      opacity: fadeAnim,
    };
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent={statusBarTranslucent}
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.6)" barStyle="light-content" />
      
      <Animated.View style={[backdropStyle, { opacity: fadeAnim }]}>
        {/* Backdrop Pressable */}
        <Pressable 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={closeOnBackdropPress ? onClose : undefined}
        />
        
        {/* Content */}
        <Animated.View style={[combinedContentStyle, getAnimatedStyle()]}>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default UIModal;

