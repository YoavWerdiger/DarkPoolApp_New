/**
 * משיכה-לרענון אחידה — תחליף drop-in ל-RefreshControl של react-native.
 *
 * - אנדרואיד: העיגול הנייטיבי (Material) בצבע ה-CTA של ערכת הנושא.
 * - iOS: הספינר הנייטיבי (ה"פסים") מוסתר; במקומו הטבעת של האפליקציה (AppSpinner) —
 *   ממוקמת מעל תחילת התוכן ומסתובבת תמיד — נחשפת כשמושכים, בלי דילאי.
 *   ב-iOS ה-RefreshControl מרונדר בתוך ה-ScrollView, ולכן הטבעת (absolute, top שלילי)
 *   יושבת בדיוק ברווח שנפתח במשיכה.
 */
import React from 'react';
import {
  Platform,
  RefreshControl as RNRefreshControl,
  StyleSheet,
  View,
  type RefreshControlProps,
} from 'react-native';
import { useDesignTokens } from './DesignTokens';
import AppSpinner from './AppSpinner';

const RING_SIZE = 30;
/** מרכז הטבעת בתוך הרווח שנפתח במשיכה (~60pt ב-iOS) */
const RING_OFFSET = 42;

export function RefreshControl(props: RefreshControlProps) {
  const tokens = useDesignTokens();
  const cta = tokens.colors.primary.lightCta;

  if (Platform.OS !== 'ios') {
    return (
      <RNRefreshControl
        {...props}
        tintColor={cta}
        colors={[cta]}
        progressBackgroundColor={tokens.colors.background.cardSolid}
      />
    );
  }

  // הטבעת מסתובבת תמיד (native driver, זול) — היא מוסתרת מעל הרשימה, כך שכבר בתחילת
  // המשיכה רואים אותה מסתובבת, וממשיכה עד שהיא נעלמת חזרה (בלי דילאי של state)
  return (
    <>
      <View pointerEvents="none" style={styles.ringHost}>
        <AppSpinner size={RING_SIZE} animating hidesWhenStopped={false} />
      </View>
      <RNRefreshControl {...props} tintColor="transparent" title="" />
    </>
  );
}

const styles = StyleSheet.create({
  ringHost: {
    position: 'absolute',
    top: -RING_OFFSET - RING_SIZE / 2,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});

export default RefreshControl;
