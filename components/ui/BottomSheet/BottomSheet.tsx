import React, { useEffect, useCallback, useMemo, useRef, Fragment, createContext, useContext } from 'react';
import { View, Pressable, Dimensions, Modal, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../DesignTokens';
import { BrandTransbackWatermark } from '../BrandTransbackWatermark';
import { ScreenGradientBackground } from '../../VideoBackground';
import { BottomSheetProps } from './BottomSheet.types';
import { createStyles } from './BottomSheet.styles';
import { HapticFeedback } from '../../../utils/hapticFeedback';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_SNAP_POINTS = [0.5];
// ⚡ Snappier – פתיחה מהירה יותר (stiffness גבוה = תגובה מהירה)
const SPRING_CONFIG = {
  damping: 24,
  stiffness: 280,
  mass: 0.4,
};
const CLOSE_THRESHOLD = 88;
const VELOCITY_THRESHOLD = 650;

const BottomSheetCloseContext = createContext<(() => void) | null>(null);

export function useBottomSheetClose() {
  return useContext(BottomSheetCloseContext);
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  snapPoints = DEFAULT_SNAP_POINTS,
  children,
  showHandle = true,
  enablePanDownToClose = true,
  backdropOpacity = 0.4,
  onSnapPointChange,
  useModal = true,
  edgeToEdge = false,
  dragAreaHeight,
  showBrandBackground = true,
  topCornerRadius,
  fitContent = false,
}) => {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const dragStripPaddingV = showHandle ? 22 : 8;
  const dragStripMinHeight = showHandle ? 88 : 36;
  /** באנדרואיד לפעמים insets.bottom=0 למרות סרגל ניווט/מחוות — מגנים על ריפוד תחתון */
  const contentPaddingBottom = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 24 : 20;
    const safeBottom = Math.max(insets.bottom, minBottom);
    const extra = Platform.OS === 'android' ? 12 : 20;
    return safeBottom + extra;
  }, [insets.bottom]);
  const translateY = useSharedValue(SCREEN_HEIGHT); // מתחיל ב-SCREEN_HEIGHT (מחוץ למסך למטה)
  const startY = useSharedValue(0);
  const currentSnapIndex = useSharedValue(0);
  
  const insetsRef = useRef(insets);
  useEffect(() => {
    insetsRef.current = insets;
  }, [insets]);
  
  const minAllowedY = useMemo(() => {
    return insets.top + 20;
  }, [insets.top]);
  
  const minAllowedYRef = useRef(minAllowedY);
  useEffect(() => {
    minAllowedYRef.current = minAllowedY;
  }, [minAllowedY]);
  
  const handleCloseWithAnimation = useCallback(() => {
    // סגירה חלקה — אנימציית החלקה למטה לפני סגירת ה-Modal
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, (finished) => {
      'worklet';
      if (finished && onClose) {
        runOnJS(onClose)();
      }
    });
  }, [onClose, translateY]);

  const snapValues = useMemo(() => {
    if (!snapPoints || snapPoints.length === 0) {
      // אם snapPoints הוא 0.5, ה-container צריך להיות ב-50% מהמסך, אז translateY צריך להיות SCREEN_HEIGHT * 0.5
      return [SCREEN_HEIGHT * 0.5];
    }
    return snapPoints.map(point => {
      const clampedPoint = Math.max(0.1, Math.min(0.9, point));
      // translateY חיובי כדי לזוז למטה
      // אם point הוא 0.7, ה-container צריך להיות ב-70% מהמסך, אז translateY צריך להיות SCREEN_HEIGHT * (1 - 0.7) = SCREEN_HEIGHT * 0.3
      const calculatedY = SCREEN_HEIGHT * (1 - clampedPoint);
      // הגבלה - לא לעבור את ה-safe area העליון
      return Math.max(minAllowedY, Math.min(SCREEN_HEIGHT, calculatedY));
    }).sort((a, b) => a - b); // מיון מהקטן לגדול
  }, [snapPoints, minAllowedY]);

  // פתיחה/סגירה - זה הקוד הקריטי
  // משתמשים רק ב-isOpen כ-dependency כדי למנוע אנימציה מחדש בשינוי תוכן
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && snapValues.length > 0) {
      const isOpening = !wasOpenRef.current;
      wasOpenRef.current = true;
      const targetY = snapValues[currentSnapIndex.value] ?? snapValues[0];
      if (isOpening) {
        void HapticFeedback.impactLight();
        translateY.value = SCREEN_HEIGHT;
        currentSnapIndex.value = 0;
        translateY.value = withSpring(snapValues[0], SPRING_CONFIG);
      } else {
        // snapPoints התעדכנו בזמן שהשיט פתוח (לדוגמה אחרי מדידה של תוכן) -
        // נזיז לערך ה-snap הנוכחי החדש בצורה עדינה
        translateY.value = withSpring(targetY, SPRING_CONFIG);
      }
    } else if (!isOpen) {
      wasOpenRef.current = false;
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 100 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, snapValues]);

  const findNearestSnapPoint = useCallback((currentY: number, snapVals: number[]): number => {
    'worklet';
    if (!snapVals || snapVals.length === 0) return 0;
    
    let nearestIndex = 0;
    let minDistance = Math.abs(currentY - snapVals[0]);

    for (let index = 0; index < snapVals.length; index++) {
      const snapValue = snapVals[index];
      const distance = Math.abs(currentY - snapValue);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    }

    return nearestIndex;
  }, []);

  const panGesture = useMemo(() => {
    const currentSnapValues = [...snapValues];
    const currentMinAllowedY = minAllowedY;
    
    return Gesture.Pan()
      // סף גבוה — מונע הפעלה מטאפ רגיל על כפתור (5px היה רגיש מדי)
      .activeOffsetY([-18, 18])
      .failOffsetX([-20, 20])
      .onStart(() => {
        'worklet';
        if (!currentSnapValues || currentSnapValues.length === 0) return;
        startY.value = translateY.value;
      })
      .onUpdate((event) => {
        'worklet';
        if (!currentSnapValues || currentSnapValues.length === 0) return;
        
        // translationY חיובי = גרירה למטה, שלילי = גרירה למעלה
        // translateY קטן = פתוח, SCREEN_HEIGHT = סגור
        const newY = startY.value + event.translationY;
        const minY = currentSnapValues[0]; // זה הקטן ביותר (פתוח)
        const maxY = SCREEN_HEIGHT; // זה הסגור
        const absoluteMinY = Math.max(minY, currentMinAllowedY);
        const clampedY = Math.max(absoluteMinY, Math.min(maxY, newY));
        translateY.value = clampedY;
      })
      .onEnd((event) => {
        'worklet';
        if (!currentSnapValues || currentSnapValues.length === 0) return;
        
        const currentY = translateY.value;
        const translationY = event.translationY;
        const velocity = event.velocityY || 0;
        
        if (!enablePanDownToClose) {
          const nearestIndex = findNearestSnapPoint(currentY, currentSnapValues);
          const targetY = currentSnapValues[nearestIndex];
          translateY.value = withSpring(targetY, SPRING_CONFIG);
          
          const prevIndex = currentSnapIndex.value;
          currentSnapIndex.value = nearestIndex;
          
          if (onSnapPointChange && nearestIndex !== prevIndex) {
            runOnJS(onSnapPointChange)(nearestIndex);
          }
          return;
        }

        // translationY חיובי = גרירה למטה (לסגירה), שלילי = גרירה למעלה
        // velocity חיובי = למטה (לסגירה), שלילי = למעלה
        const shouldClose = 
          (translationY > CLOSE_THRESHOLD && velocity >= 0) || 
          (velocity > VELOCITY_THRESHOLD && velocity > 0) ||
          (currentY > SCREEN_HEIGHT * 0.7 && velocity >= 0); // קרוב לסגור

        if (shouldClose) {
          translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, (finished) => {
            'worklet';
            if (finished && onClose) {
              runOnJS(onClose)();
            }
          });
          return;
        }

        const nearestIndex = findNearestSnapPoint(currentY, currentSnapValues);
        const targetY = currentSnapValues[nearestIndex];

        translateY.value = withSpring(targetY, SPRING_CONFIG);
        
        const prevIndex = currentSnapIndex.value;
        currentSnapIndex.value = nearestIndex;
        
        if (onSnapPointChange && nearestIndex !== prevIndex) {
          runOnJS(onSnapPointChange)(nearestIndex);
        }
      });
  }, [snapValues, minAllowedY, enablePanDownToClose, onSnapPointChange, onClose, findNearestSnapPoint, translateY, startY, currentSnapIndex]);

  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    if (!snapValues || snapValues.length === 0) {
      return { opacity: 0 };
    }
    
    // translateY קטן = פתוח, SCREEN_HEIGHT = סגור
    const opacity = interpolate(
      translateY.value,
      [SCREEN_HEIGHT, snapValues[0]], // מ-SCREEN_HEIGHT (סגור) ל-snapValues[0] (פתוח)
      [0, backdropOpacity],
      Extrapolate.CLAMP
    );
    return { opacity };
  }, [snapValues, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => {
    'worklet';
    // translateY קטן = פתוח, SCREEN_HEIGHT = סגור
    const minY = (snapValues && snapValues.length > 0) ? snapValues[0] : minAllowedY;
    const clampedY = Math.max(minY, Math.min(SCREEN_HEIGHT, translateY.value));
    return {
      transform: [{ translateY: clampedY }],
    };
  }, [snapValues, minAllowedY]);

  const styles = createStyles(tokens.colors.overlay || 'rgba(0,0,0,0.6)');

  /**
   * רקע השיט כמו מסכי האפליקציה (TradingScreen וכו'):
   * #0A0E0A → ScreenGradientBackground → BrandTransbackWatermark — בלי שכבה כהה
   * שמכסה את הגרדיאנט והשור־דוב.
   */
  const content = (
    <BottomSheetCloseContext.Provider value={handleCloseWithAnimation}>
      <Fragment>
      <Pressable
        style={StyleSheet.absoluteFill}
        android_ripple={{ color: 'transparent' }}
        onPress={handleCloseWithAnimation}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      <Animated.View 
        style={[
          styles.container, 
          sheetStyle,
          topCornerRadius != null && topCornerRadius > 0
            ? {
                borderTopLeftRadius: topCornerRadius,
                borderTopRightRadius: topCornerRadius,
              }
            : null,
        ]}
        collapsable={false}
      >
        {showBrandBackground ? (
          <>
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0E0A' }]}
            />
            <ScreenGradientBackground style={StyleSheet.absoluteFillObject} />
            <BrandTransbackWatermark
              layout="sheetBottom"
              sheetVisibleHeightPx={
                snapValues.length > 0
                  ? SCREEN_HEIGHT - snapValues[0]
                  : SCREEN_HEIGHT * 0.5
              }
            />
          </>
        ) : (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: tokens.colors.background.secondary },
            ]}
          />
        )}

          {/* כל ה-sheet ניתן לגרירה — GestureDetector עוטף את כל התוכן */}
          <GestureDetector gesture={panGesture}>
            <View 
              style={[
                styles.content,
                { paddingBottom: contentPaddingBottom },
              ]}
            >
              {edgeToEdge ? (
                <>
                  {/* Handle indicator (visual only) */}
                  {showHandle && (
                    <View style={{ width: '100%', alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
                      <View style={[styles.handle, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
                    </View>
                  )}
                  <View style={fitContent ? undefined : { flex: 1 }}>{children}</View>
                </>
              ) : (
                <>
                  {/* Handle indicator */}
                  <View style={{ width: '100%', alignItems: 'center', paddingVertical: dragStripPaddingV, minHeight: dragStripMinHeight }}>
                    {showHandle && (
                      <View style={[styles.handle, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
                    )}
                  </View>
                  {children}
                </>
              )}
            </View>
          </GestureDetector>
        </Animated.View>
      </Fragment>
    </BottomSheetCloseContext.Provider>
  );

  if (!useModal) {
    return (
      <View 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 10000,
          pointerEvents: isOpen ? 'auto' : 'none'
        }}
      >
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleCloseWithAnimation}
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        {content}
      </GestureHandlerRootView>
    </Modal>
  );
};

export default BottomSheet;
