/**
 * טבעת משיכה-לרענון (iOS) — הספינר של האפליקציה במקום ה"פסים" של UIRefreshControl.
 *
 * חשוב: הטבעת היא אח של הרשימה (מחוץ ל-ScrollView), לא ילד שלה. ילד נוסף בתוך ה-ScrollView
 * נכנס ל-contentBounds ב-Fabric ודוחף את כל המסך למעלה.
 *
 * שימוש:
 *   const ring = useRefreshRing();
 *   <FlatList onScroll={ring.onScroll} onLayout={ring.onLayout} scrollEventThrottle={16}
 *     refreshControl={<RefreshControl hideNative refreshing={..} onRefresh={..} />} />
 *   <RefreshRing ring={ring} />   ← אח מיד אחרי הרשימה (מתמקם לפי onLayout)
 * אנדרואיד: העיגול הנייטיבי (Material) כבר טבעת — הרכיב לא מרנדר כלום.
 */
import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import AppSpinner from './AppSpinner';

const RING = 30;

export function useRefreshRing() {
  const pull = useRef(new Animated.Value(0)).current;
  /** מיקום הרשימה בתוך ההורה — הטבעת (אח של הרשימה) מתמקמת בראש הרשימה */
  const top = useRef(new Animated.Value(0)).current;
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      top.setValue(e.nativeEvent.layout.y);
    },
    [top],
  );
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentInset } = e.nativeEvent;
      const y = contentOffset.y + (contentInset?.top ?? 0);
      pull.setValue(y < 0 ? -y : 0);
    },
    [pull],
  );
  /** לרשימות reanimated (useAnimatedScrollHandler → runOnJS) */
  const setPull = useCallback((y: number) => pull.setValue(y < 0 ? -y : 0), [pull]);
  return { pull, top, onScroll, onLayout, setPull };
}

/** משלב handler של הטבעת עם handler קיים של המסך (onScroll / onLayout) */
export function chainRing<E>(ringHandler: (e: E) => void, own?: ((e: E) => void) | null) {
  return (e: E) => {
    ringHandler(e);
    own?.(e);
  };
}

export function RefreshRing({ ring }: { ring: ReturnType<typeof useRefreshRing> }) {
  if (Platform.OS !== 'ios') return null;
  const { pull, top } = ring;
  // נראית רק כשהרווח שנפתח גדול מהטבעת (pull ≥ 30) — אחרת היא גולשת על תוכן הרשימה
  // בזמן שהרשימה חוזרת למקום (פייד מהיר, בלי לכסות שורות)
  const opacity = pull.interpolate({ inputRange: [RING + 2, RING + 18], outputRange: [0, 1], extrapolate: 'clamp' });
  // מרכז הרווח שנפתח במשיכה = חצי מעומק המשיכה (מתחת לראש הרשימה)
  const half = pull.interpolate({ inputRange: [0, 400], outputRange: [0, 200], extrapolate: 'clamp' });
  const translateY = Animated.add(Animated.add(top, half), -RING / 2);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.host, { opacity, transform: [{ translateY }] }]}
    >
      <AppSpinner size={RING} animating hidesWhenStopped={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 20 },
});
