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
import { SHEET_OPEN_MS, SHEET_CLOSE_MS } from './BottomSheet/sheetMotion';
import {
  SHEET_BACKDROP_OPACITY,
  SHEET_GLASS_FLOOR,
  SHEET_GLASS_INTENSITY,
  SHEET_GLASS_OVERLAY,
  sheetContentBottomPadding,
  sheetSystemBarFillHeight,
} from './BottomSheet/sheetGlass';
import { SheetGlassBackground } from './BottomSheet/SheetGlassBackground';
import { applyAppSystemUI } from '../../lib/androidSystemUI';

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
  /** ברירת מחדל true — אותו glass כמו BottomSheet / Action sheet */
  useGlassBackground?: boolean;
}

const screenHeight = Dimensions.get('window').height;
/** RN Animated — זהה ל־sheetMotion (open≈close, בלי bounce) */
const SHEET_EASE_OUT_RN = Easing.bezier(0.25, 0.1, 0.25, 1);
const SHEET_EASE_IN_RN = Easing.bezier(0.32, 0, 0.67, 0);

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  systemBarFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
});

const UIBottomSheet: React.FC<UIBottomSheetProps> = ({
  visible,
  onClose,
  children,
  showHandle = true,
  dragToClose = true,
  backdropOpacity = SHEET_BACKDROP_OPACITY,
  contentStyle,
  sheetStyle,
  closeOnBackdropPress = true,
  maxHeight = '80%',
  useGlassBackground = true,
}) => {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const [isMounted, setIsMounted] = React.useState(visible);
  const [glassActive, setGlassActive] = React.useState(false);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      fadeAnim.setValue(0);
      translateY.setValue(screenHeight);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: Math.round(SHEET_OPEN_MS * 0.7),
          useNativeDriver: true,
          easing: SHEET_EASE_OUT_RN,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: SHEET_OPEN_MS,
          useNativeDriver: true,
          easing: SHEET_EASE_OUT_RN,
        }),
      ]).start(() => setGlassActive(true));
    } else {
      setGlassActive(false);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: Math.round(SHEET_CLOSE_MS * 0.55),
          useNativeDriver: true,
          easing: SHEET_EASE_IN_RN,
        }),
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: SHEET_CLOSE_MS,
          useNativeDriver: true,
          easing: SHEET_EASE_IN_RN,
        }),
      ]).start(() => {
        setIsMounted(false);
      });
    }
  }, [visible, fadeAnim, translateY]);

  // Modal שקוף באנדרואיד — ב־edge-to-edge צבעי NavigationBar נדחים; משחזרים theme אחיד בסגירה
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!visible) {
      void applyAppSystemUI();
    }
  }, [visible]);

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
            duration: SHEET_OPEN_MS,
            useNativeDriver: true,
            easing: SHEET_EASE_OUT_RN,
          }).start();
        }
      },
    }),
  ).current;

  const maxHeightValue =
    typeof maxHeight === 'string' && maxHeight.includes('%')
      ? (screenHeight * parseFloat(maxHeight)) / 100
      : typeof maxHeight === 'number'
        ? maxHeight
        : screenHeight * 0.8;

  if (!isMounted) {
    return null;
  }

  const bottomPad = sheetContentBottomPadding(insets.bottom);
  const systemBarFillHeight = sheetSystemBarFillHeight(insets.bottom);
  const sheetSurface =
    tokens.colors.background.sheet ?? tokens.colors.background.secondary ?? SHEET_GLASS_FLOOR;

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      statusBarTranslucent={true}
      navigationBarTranslucent={Platform.OS === 'android'}
      presentationStyle="overFullScreen"
      onShow={() => setGlassActive(true)}
      onRequestClose={() => {
        onClose();
      }}
    >
      <View style={styles.modalRoot}>
        <View
          pointerEvents="none"
          style={[
            styles.systemBarFill,
            { height: systemBarFillHeight, backgroundColor: SHEET_GLASS_FLOOR },
          ]}
        />
        {/* Backdrop */}
        <TouchableWithoutFeedback
          onPress={
            closeOnBackdropPress
              ? () => {
                  onClose();
                }
              : undefined
          }
        >
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#000',
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
              backgroundColor: useGlassBackground ? 'transparent' : sheetSurface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.08)',
              borderTopColor: 'rgba(255,255,255,0.12)',
              borderBottomWidth: 0,
              minHeight: 200,
              maxHeight: maxHeightValue,
              paddingBottom: bottomPad,
              overflow: 'hidden',
              shadowColor: Platform.OS === 'ios' ? '#000' : 'transparent',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0,
              shadowRadius: 12,
              elevation: Platform.OS === 'android' ? 12 : 6,
              transform: [{ translateY }],
              zIndex: 2,
            },
            sheetStyle,
          ]}
        >
          {useGlassBackground ? (
            <SheetGlassBackground
              active={glassActive}
              intensity={SHEET_GLASS_INTENSITY}
              overlayColor={SHEET_GLASS_OVERLAY}
            />
          ) : null}

          {showHandle && (
            <View
              style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6, zIndex: 2 }}
              {...(dragToClose ? panResponder.panHandlers : {})}
            >
              <View style={styles.handle} />
            </View>
          )}

          {/* Content */}
          <View style={[{ zIndex: 2, backgroundColor: 'transparent' }, contentStyle]}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default UIBottomSheet;
