import React, { useEffect, useRef } from 'react';
import { 
  Modal, 
  View, 
  Animated, 
  Dimensions, 
  ViewStyle,
  Easing,
  PanResponder,
  TouchableWithoutFeedback
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from './DesignTokens';

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

const screenHeight = Dimensions.get('window').height;

const UIBottomSheet: React.FC<UIBottomSheetProps> = ({
  visible,
  onClose,
  children,
  showHandle = true,
  dragToClose = true,
  backdropOpacity = 0.7,
  contentStyle,
  closeOnBackdropPress = true,
  maxHeight = '80%',
}) => {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const [isMounted, setIsMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      fadeAnim.setValue(0);
      translateY.setValue(screenHeight);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsMounted(false);
      });
    }
  }, [visible, fadeAnim, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => dragToClose && gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          onClose();
        } else {
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const maxHeightValue = typeof maxHeight === 'string' && maxHeight.includes('%')
    ? (screenHeight * parseFloat(maxHeight) / 100)
    : typeof maxHeight === 'number' ? maxHeight : screenHeight * 0.8;

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={() => {
        console.log('📱 UIBottomSheet: onRequestClose called');
        onClose();
      }}
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={closeOnBackdropPress ? () => {
          console.log('👆 UIBottomSheet: Backdrop pressed');
          onClose();
        } : undefined}>
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: tokens.colors.backdrop,
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, backdropOpacity],
              }),
            }}
          />
        </TouchableWithoutFeedback>
        
        {/* Sheet Container */}
        <Animated.View 
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: tokens.colors.background.secondary,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            minHeight: 200,
            maxHeight: maxHeightValue,
            paddingBottom: insets.bottom,
            shadowColor: tokens.colors.overlay,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 8,
            transform: [{ translateY }],
          }}
        >
          {/* Handle */}
          {showHandle && (
            <View 
              style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}
              {...(dragToClose ? panResponder.panHandlers : {})}
            >
              <View style={{
                width: 40,
                height: 4,
                backgroundColor: tokens.colors.border.active,
                borderRadius: 2,
              }} />
            </View>
          )}
          
          {/* Content */}
          <View style={contentStyle}>
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default UIBottomSheet;
