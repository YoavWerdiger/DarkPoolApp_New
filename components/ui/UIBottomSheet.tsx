import React, { useEffect, useRef } from 'react';
import { 
  Modal, 
  View, 
  Animated, 
  Dimensions, 
  ViewStyle,
  Easing,
  PanResponder,
  TouchableWithoutFeedback,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from './DesignTokens';
import { SHEET_MOTION_MS } from './BottomSheet/sheetMotion';

export interface UIBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showHandle?: boolean;
  dragToClose?: boolean;
  backdropOpacity?: number;
  contentStyle?: ViewStyle;
  /** מיזוג ל־Animated.View של הגיליון (למשל backgroundColor: 'transparent' + רקע מותאם בתוך children) */
  sheetStyle?: ViewStyle;
  closeOnBackdropPress?: boolean;
  maxHeight?: string | number;
}

const screenHeight = Dimensions.get('window').height;

/** RN Animated — bezier קרוב ל־sheetMotion (WhatsApp-like) */
const SHEET_EASE_OUT_RN = Easing.bezier(0.32, 0.72, 0, 1);
const SHEET_EASE_IN_RN = Easing.bezier(0.32, 0, 0.67, 0);

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

const UIBottomSheet: React.FC<UIBottomSheetProps> = ({
  visible,
  onClose,
  children,
  showHandle = true,
  dragToClose = true,
  backdropOpacity = 0.7,
  contentStyle,
  sheetStyle,
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
          duration: Math.round(SHEET_MOTION_MS * 0.7),
          useNativeDriver: true,
          easing: SHEET_EASE_OUT_RN,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: SHEET_MOTION_MS,
          useNativeDriver: true,
          easing: SHEET_EASE_OUT_RN,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: Math.round(SHEET_MOTION_MS * 0.55),
          useNativeDriver: true,
          easing: SHEET_EASE_IN_RN,
        }),
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: SHEET_MOTION_MS,
          useNativeDriver: true,
          easing: SHEET_EASE_IN_RN,
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
            duration: SHEET_MOTION_MS,
            useNativeDriver: true,
            easing: SHEET_EASE_OUT_RN,
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

  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 12) + (Platform.OS === 'android' ? 10 : 8);

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
      onRequestClose={() => {
        onClose();
      }}
    >
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={closeOnBackdropPress ? () => {
          onClose();
        } : undefined}>
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, backdropOpacity],
              }),
            }}
          />
        </TouchableWithoutFeedback>
        
        {/* Sheet Container */}
        <Animated.View 
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: tokens.colors.background.sheet,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              minHeight: 200,
              maxHeight: maxHeightValue,
              paddingBottom: bottomPad,
              overflow: 'hidden',
              shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
              shadowOffset: { width: 0, height: -6 },
              shadowOpacity: Platform.OS === 'ios' ? 0.22 : 0,
              shadowRadius: 16,
              elevation: Platform.OS === 'android' ? 22 : 10,
              transform: [{ translateY }],
            },
            sheetStyle,
          ]}
        >
          {showHandle && (
            <View 
              style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}
              {...(dragToClose ? panResponder.panHandlers : {})}
            >
              <View style={{
                width: 40,
                height: 5,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: 2.5,
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
