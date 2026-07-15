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
  runOnUI,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useDesignTokens } from '../DesignTokens';
import { BrandTransbackWatermark } from '../BrandTransbackWatermark';
import { ScreenGradientBackground } from '../../VideoBackground';
import { BottomSheetProps } from './BottomSheet.types';
import { createStyles } from './BottomSheet.styles';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import * as NavigationBar from 'expo-navigation-bar';
import {
  SHEET_OPEN_TIMING,
  SHEET_CLOSE_TIMING,
  FIT_CONTENT_OPEN_TIMING,
  FIT_CONTENT_HEIGHT_TIMING,
  SHEET_SNAP_SPRING,
} from './sheetMotion';

const SHEET_SURFACE_COLOR = '#0A0E0A';
const NAV_BAR_TRANSPARENT = '#00000000';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_SNAP_POINTS = [0.5];
const CLOSE_THRESHOLD = 88;
const VELOCITY_THRESHOLD = 650;
/** התעלמות משינויי גובה זעירים אחרי מדידה (מונע "קפיצה" בסוף פתיחה) */
const FIT_CONTENT_HEIGHT_EPS = 2;
/** handle + padding ב-edgeToEdge (paddingTop 14 + margins + handle 4 + paddingBottom 4) */
export const BOTTOM_SHEET_EDGE_HANDLE_HEIGHT = 42;

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
  showBrandWatermark,
  brandWatermarkScale = 1,
  topCornerRadius,
  fitContent = false,
  contentPaddingBottom: contentPaddingBottomOverride,
  useGlassBackground = false,
  glassIntensity = 95,
  glassOverlayColor = 'rgba(10,14,10,0.82)',
}) => {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const showWatermark = showBrandWatermark ?? showBrandBackground;
  const dragStripPaddingV = showHandle ? 22 : 8;
  const dragStripMinHeight = showHandle ? 88 : 36;
  /** באנדרואיד לפעמים insets.bottom=0 למרות סרגל ניווט/מחוות — מגנים על ריפוד תחתון */
  const contentPaddingBottom = useMemo(() => {
    if (contentPaddingBottomOverride != null) {
      return contentPaddingBottomOverride;
    }
    const minBottom = Platform.OS === 'android' ? 24 : 20;
    const safeBottom = Math.max(insets.bottom, minBottom);
    const extra = Platform.OS === 'android' ? 12 : 20;
    return safeBottom + extra;
  }, [insets.bottom, contentPaddingBottomOverride]);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const fitContentHeight = useSharedValue(0);
  const startY = useSharedValue(0);
  const currentSnapIndex = useSharedValue(0);
  const isClosing = useSharedValue(0);
  
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
  
  const wasOpenRef = useRef(false);
  const isClosingRef = useRef(false);
  const fitContentOpenDoneRef = useRef(true);
  const closedTranslateYRef = useRef(SCREEN_HEIGHT);

  const resetClosingState = useCallback(() => {
    isClosingRef.current = false;
    isClosing.value = 0;
  }, [isClosing]);

  const finishClose = useCallback(() => {
    resetClosingState();
    onClose?.();
  }, [onClose, resetClosingState]);

  const markClosing = useCallback(() => {
    isClosingRef.current = true;
  }, []);

  const visibleHeightPx = useMemo(() => {
    if (!snapPoints?.length) return Math.round(SCREEN_HEIGHT * 0.5);
    const clamped = Math.max(0.1, Math.min(0.9, snapPoints[0]));
    return Math.ceil(SCREEN_HEIGHT * clamped);
  }, [snapPoints]);

  const closedTranslateY = fitContent ? visibleHeightPx : SCREEN_HEIGHT;

  closedTranslateYRef.current = closedTranslateY;

  const visibleHeightPxRef = useRef(visibleHeightPx);
  useEffect(() => {
    visibleHeightPxRef.current = visibleHeightPx;
  }, [visibleHeightPx]);

  const settleFitContentHeight = useCallback((animate: boolean) => {
    const target = visibleHeightPxRef.current;
    // כתיבה/קריאה של shared value רק מ-UI thread — מונע WARN בזמן render/JS
    runOnUI((to: number, shouldAnimate: boolean) => {
      'worklet';
      const current = fitContentHeight.value;
      if (Math.abs(current - to) <= FIT_CONTENT_HEIGHT_EPS) {
        fitContentHeight.value = to;
        return;
      }
      fitContentHeight.value = shouldAnimate
        ? withTiming(to, FIT_CONTENT_HEIGHT_TIMING)
        : to;
    })(target, animate);
  }, [fitContentHeight]);

  const onFitContentOpenComplete = useCallback(() => {
    fitContentOpenDoneRef.current = true;
    // סנכרון שקט בסוף פתיחה — בלי אנימציית "התייצבות" נוספת אם כבר קרוב
    settleFitContentHeight(false);
  }, [settleFitContentHeight]);

  const animateClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    isClosing.value = 1;
    const targetY = closedTranslateYRef.current;
    translateY.value = withTiming(targetY, SHEET_CLOSE_TIMING, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(finishClose)();
      } else {
        runOnJS(resetClosingState)();
      }
    });
  }, [finishClose, resetClosingState, translateY, isClosing]);

  const animateCloseRef = useRef(animateClose);
  animateCloseRef.current = animateClose;

  const handleCloseWithAnimation = useCallback(() => {
    animateCloseRef.current();
  }, []);

  const snapValues = useMemo(() => {
    if (fitContent) {
      return [0];
    }
    if (!snapPoints || snapPoints.length === 0) {
      return [SCREEN_HEIGHT * 0.5];
    }
    return snapPoints.map(point => {
      const clampedPoint = Math.max(0.1, Math.min(0.9, point));
      const calculatedY = SCREEN_HEIGHT * (1 - clampedPoint);
      return Math.max(minAllowedY, Math.min(SCREEN_HEIGHT, calculatedY));
    }).sort((a, b) => a - b);
  }, [snapPoints, minAllowedY, fitContent]);

  // פתיחה/סגירה - זה הקוד הקריטי
  // משתמשים רק ב-isOpen כ-dependency כדי למנוע אנימציה מחדש בשינוי תוכן
  useEffect(() => {
    if (isOpen && snapValues.length > 0) {
      const isOpening = !wasOpenRef.current;
      wasOpenRef.current = true;
      if (isOpening) {
        isClosingRef.current = false;
        isClosing.value = 0;
        void HapticFeedback.selection();
        if (fitContent) {
          fitContentOpenDoneRef.current = false;
          fitContentHeight.value = visibleHeightPx;
        }
        translateY.value = closedTranslateY;
        currentSnapIndex.value = 0;
        if (fitContent) {
          translateY.value = withTiming(0, FIT_CONTENT_OPEN_TIMING, (finished) => {
            'worklet';
            if (finished) {
              runOnJS(onFitContentOpenComplete)();
            }
          });
        } else {
          translateY.value = withTiming(snapValues[0], SHEET_OPEN_TIMING);
        }
      } else if (!isClosingRef.current && !fitContent) {
        translateY.value = withTiming(snapValues[0], SHEET_OPEN_TIMING);
      }
    } else if (!isOpen) {
      wasOpenRef.current = false;
      isClosingRef.current = false;
      isClosing.value = 0;
      fitContentOpenDoneRef.current = true;
      translateY.value = closedTranslateY;
      if (fitContent) {
        fitContentHeight.value = visibleHeightPx;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, snapValues, closedTranslateY, fitContent, visibleHeightPx, onFitContentOpenComplete]);

  // fitContent: בזמן פתיחה מעדכנים גובה מיד (בלי אנימציה כפולה);
  // אחרי פתיחה — התאמה קצרה ושקטה רק אם המדידה השתנתה משמעותית
  useEffect(() => {
    if (!fitContent || !isOpen) return;
    if (!fitContentOpenDoneRef.current) {
      runOnUI((h: number) => {
        'worklet';
        fitContentHeight.value = h;
      })(visibleHeightPx);
      return;
    }
    settleFitContentHeight(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleHeightPx, fitContent, isOpen, settleFitContentHeight]);

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
    const maxDragY = fitContent ? visibleHeightPx : SCREEN_HEIGHT;
    const openY = currentSnapValues[0] ?? 0;
    
    return Gesture.Pan()
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
        
        const newY = startY.value + event.translationY;
        const minY = fitContent ? openY : Math.max(openY, currentMinAllowedY);
        const clampedY = Math.max(minY, Math.min(maxDragY, newY));
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
          translateY.value = withSpring(targetY, SHEET_SNAP_SPRING);
          
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
          (fitContent
            ? currentY > visibleHeightPx * 0.42 && velocity >= 0
            : currentY > SCREEN_HEIGHT * 0.7 && velocity >= 0);

        if (shouldClose) {
          if (isClosing.value === 0) {
            isClosing.value = 1;
            runOnJS(markClosing)();
            const targetY = fitContent ? visibleHeightPx : SCREEN_HEIGHT;
            translateY.value = withTiming(targetY, SHEET_CLOSE_TIMING, (finished) => {
              'worklet';
              if (finished) {
                runOnJS(finishClose)();
              } else {
                runOnJS(resetClosingState)();
              }
            });
          }
          return;
        }

        const nearestIndex = findNearestSnapPoint(currentY, currentSnapValues);
        const targetY = currentSnapValues[nearestIndex];

        translateY.value = withSpring(targetY, SHEET_SNAP_SPRING);
        
        const prevIndex = currentSnapIndex.value;
        currentSnapIndex.value = nearestIndex;
        
        if (onSnapPointChange && nearestIndex !== prevIndex) {
          runOnJS(onSnapPointChange)(nearestIndex);
        }
      });
  }, [snapValues, minAllowedY, enablePanDownToClose, onSnapPointChange, finishClose, resetClosingState, markClosing, findNearestSnapPoint, translateY, startY, currentSnapIndex, isClosing, fitContent, visibleHeightPx]);

  const fitContentSizeStyle = useAnimatedStyle(() => {
    if (!fitContent) return {};
    return { height: fitContentHeight.value };
  }, [fitContent]);

  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    if (!snapValues || snapValues.length === 0) {
      return { opacity: 0 };
    }
    
    const closedY = fitContent ? visibleHeightPx : SCREEN_HEIGHT;
    const openY = snapValues[0];
    const opacity = interpolate(
      translateY.value,
      [closedY, openY],
      [0, backdropOpacity],
      Extrapolate.CLAMP
    );
    return { opacity };
  }, [snapValues, backdropOpacity, fitContent, visibleHeightPx]);

  const sheetStyle = useAnimatedStyle(() => {
    'worklet';
    const openY = (snapValues && snapValues.length > 0) ? snapValues[0] : (fitContent ? 0 : minAllowedY);
    const maxY = fitContent ? visibleHeightPx : SCREEN_HEIGHT;
    const y = translateY.value;
    const clampedY =
      y >= openY
        ? Math.min(maxY, y)
        : Math.max(openY, y);
    return {
      transform: [{ translateY: clampedY }],
    };
  }, [snapValues, minAllowedY, fitContent, visibleHeightPx]);

  const systemBarFillHeight = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 28 : 12;
    return Math.max(insets.bottom, minBottom);
  }, [insets.bottom]);

  // Solid black — opacity alone is controlled by `backdropOpacity`
  // (ChatBottomSheet uses CHAT_SHEET_BACKDROP_OPACITY = 0.4 ≡ DesignTokens.colors.backdrop).
  // Do not use colors.overlay (already rgba alpha) or the values compound.
  const styles = createStyles('#000');

  // Modal שקוף + nav bar שקוף ב-Android → רקע חלון Modal לבן מתחת לכפתורי המערכת
  useEffect(() => {
    if (!useModal || Platform.OS !== 'android') return;

    const syncNavigationBar = async () => {
      try {
        if (isOpen) {
          await NavigationBar.setBackgroundColorAsync(SHEET_SURFACE_COLOR);
          await NavigationBar.setButtonStyleAsync('light');
        } else {
          await NavigationBar.setBackgroundColorAsync(NAV_BAR_TRANSPARENT);
          await NavigationBar.setButtonStyleAsync('light');
        }
      } catch {
        // non-critical
      }
    };

    void syncNavigationBar();
  }, [isOpen, useModal]);

  /**
   * רקע השיט כמו מסכי האפליקציה (TradingScreen וכו'):
   * #0A0E0A → ScreenGradientBackground → BrandTransbackWatermark — בלי שכבה כהה
   * שמכסה את הגרדיאנט והשור־דוב.
   */
  const content = (
    <BottomSheetCloseContext.Provider value={handleCloseWithAnimation}>
      <Fragment>
      <View
        pointerEvents="none"
        style={[
          styles.systemBarFill,
          { height: systemBarFillHeight, backgroundColor: SHEET_SURFACE_COLOR },
        ]}
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        android_ripple={{ color: 'transparent' }}
        onPress={handleCloseWithAnimation}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      <Animated.View 
        style={[
          fitContent ? styles.fitContentContainer : styles.container,
          fitContent ? fitContentSizeStyle : null,
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
        {useGlassBackground ? (
          /* Frosted-glass: BlurView + opaque-enough dark tint (chat should not bleed through). */
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
            <BlurView intensity={glassIntensity} tint="dark" style={StyleSheet.absoluteFill} />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: glassOverlayColor },
              ]}
            />
          </View>
        ) : showBrandBackground ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: SHEET_SURFACE_COLOR }]}
            />
            <ScreenGradientBackground style={StyleSheet.absoluteFillObject} />
            {showWatermark ? (
              <BrandTransbackWatermark
                layout="sheetBottom"
                scale={brandWatermarkScale}
                sheetVisibleHeightPx={
                  fitContent
                    ? visibleHeightPx
                    : snapValues.length > 0
                      ? SCREEN_HEIGHT - snapValues[0]
                      : visibleHeightPx
                }
              />
            ) : null}
          </View>
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
                fitContent ? styles.contentCompact : styles.content,
                {
                  paddingBottom: contentPaddingBottom,
                  zIndex: 2,
                },
              ]}
            >
              {edgeToEdge ? (
                <>
                  {showHandle && (
                    <View style={{ width: '100%', alignItems: 'center', paddingTop: 14, paddingBottom: 4 }}>
                      <View style={[styles.handle, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
                    </View>
                  )}
                  {fitContent ? children : <View style={{ flex: 1 }}>{children}</View>}
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
      navigationBarTranslucent={Platform.OS === 'android'}
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
export {
  FIT_CONTENT_CLOSE_TIMING,
  FIT_CONTENT_OPEN_TIMING,
  SHEET_CLOSE_TIMING,
  SHEET_OPEN_TIMING,
  SHEET_MOTION_MS,
  SHEET_OPEN_MS,
  SHEET_CLOSE_MS,
  SHEET_SNAP_SPRING,
  FIT_CONTENT_HEIGHT_TIMING,
  SHEET_EASE_OUT,
  SHEET_EASE_IN,
} from './sheetMotion';
