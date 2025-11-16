import React, { useEffect } from "react";
import {
  StyleSheet,
  Dimensions,
  View,
  TouchableWithoutFeedback,
  ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
  runOnJS,
} from "react-native-reanimated";
import {
  GestureHandlerRootView,
  PanGestureHandler,
  GestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// כמה צריך לגרור כדי לסגור
const CLOSE_DISTANCE = SCREEN_HEIGHT / 5;

export interface BottomSheetProps {
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

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  children,
  showHandle = true,
  dragToClose = true,
  backdropOpacity = 0.6,
  contentStyle,
  closeOnBackdropPress = true,
  maxHeight = "80%",
}) => {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const isOpen = useSharedValue(false);

  // Calculate max height
  const getMaxHeight = () => {
    if (typeof maxHeight === "string" && maxHeight.includes("%")) {
      const percentage = parseFloat(maxHeight) / 100;
      return SCREEN_HEIGHT * percentage;
    }
    return typeof maxHeight === "number" ? maxHeight : SCREEN_HEIGHT * 0.8;
  };

  const maxHeightValue = getMaxHeight();

  useEffect(() => {
    if (visible) {
      openSheet();
    } else {
      closeSheet();
    }
  }, [visible]);

  const openSheet = () => {
    isOpen.value = true;
    translateY.value = withTiming(0, { duration: 350 });
  };

  const closeSheet = () => {
    isOpen.value = false;
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => {
      runOnJS(onClose)();
    });
  };

  // Drag gesture handler
  const onGestureEvent = (event: any) => {
    if (!dragToClose) return;

    const { translationY } = event.nativeEvent;

    // אם גוררים למטה — תזיז בפועל
    if (translationY > 0) {
      translateY.value = translationY;
    }
  };

  const onHandlerStateChange = (event: GestureHandlerStateChangeEvent) => {
    if (!dragToClose) return;

    const { translationY, velocityY, state } = event.nativeEvent;

    // State 5 = END
    if (state === 5) {
      // אם גרירה חזקה למטה — סגור
      if (translationY > CLOSE_DISTANCE || velocityY > 700) {
        runOnJS(closeSheet)();
      } else {
        // החזרה למקום
        translateY.value = withTiming(0, { duration: 250 });
      }
    }
  };

  // אנימציה של ה־sheet
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    borderTopLeftRadius: interpolate(
      translateY.value,
      [0, SCREEN_HEIGHT],
      [24, 0],
      Extrapolate.CLAMP
    ),
    borderTopRightRadius: interpolate(
      translateY.value,
      [0, SCREEN_HEIGHT],
      [24, 0],
      Extrapolate.CLAMP
    ),
  }));

  // אנימציית ה-backdrop (צל)
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, SCREEN_HEIGHT],
      [backdropOpacity, 0],
      Extrapolate.CLAMP
    ),
  }));

  if (!visible) return null;

  const sheetContent = (
    <Animated.View
      style={[
        styles.sheetContainer,
        { maxHeight: maxHeightValue },
        sheetStyle,
        contentStyle,
      ]}
    >
      {showHandle && <View style={styles.dragLine} />}
      {children}
    </Animated.View>
  );

  return (
    <GestureHandlerRootView style={styles.overlay} pointerEvents="box-none">
      {/* BACKDROP */}
      {closeOnBackdropPress && (
        <TouchableWithoutFeedback onPress={closeSheet}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </TouchableWithoutFeedback>
      )}

      {/* SHEET */}
      {dragToClose ? (
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View style={{ flex: 1 }} pointerEvents="box-none">
            {sheetContent}
          </Animated.View>
        </PanGestureHandler>
      ) : (
        sheetContent
      )}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black",
  },
  sheetContainer: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    paddingBottom: 30,
    paddingTop: 15,
    minHeight: SCREEN_HEIGHT * 0.3,
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  dragLine: {
    width: 45,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignSelf: "center",
    borderRadius: 3,
    marginBottom: 12,
  },
});

