import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../context/ThemeContext';

/**
 * מסך פתיחה מינימלי — Lottie (assets/launch, נבנה ע"י scripts/build-launch-lottie.py).
 * הקומפוזיציה 300×600 ממורכזת במסך: הפריים הראשון זהה ל-splash הנייטיב (אמבלם 200×200 על שחור),
 * האמבלם עולה בעדינות, DARKPOOL והסלוגן נכנסים, ופס התקדמות דק מתמלא עד שהאפליקציה מוכנה.
 */

/**
 * = רקע ה-splash הנייטיב (app.json) — תמיד לייט (ברירת המחדל של האפליקציה).
 * ה-splash של המערכת לא יודע איזו ערכה נבחרה; משתמשי דארק מקבלים דעיכה רכה לכהה.
 */
const SPLASH_BG = '#F4F2F1';
const COMP_W = 300;
const COMP_H = 600;
/** מרכז פס ההתקדמות ביחס למרכז המסך (תחתית הסלוגן בקומפוזיציה 387 → +40) */
const BAR_DY = 127;
const BAR_W = 132;
const BAR_H = 3;
/** עד שהאפליקציה מוכנה הפס «זוחל» עד כאן; ההשלמה ל-100% רק ב-ready */
const BAR_WAIT_TARGET = 0.85;
/** אורך האינטרו (72 פריימים @60) + מרווח קטן — לא חותכים אותו באמצע */
const MIN_INTRO_MS = 1300;

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

const LOGO_DARK = require('../assets/launch/launch-logo-dark.json');
const LOGO_LIGHT = require('../assets/launch/launch-logo-light.json');

void SplashScreen.preventAutoHideAsync().catch(() => {});
// רשת ביטחון: אם מסך הפתיחה לא עלה (קריסה לפני mount) — לא להשאיר splash תקוע
setTimeout(() => void SplashScreen.hideAsync().catch(() => {}), 8000);

type Props = {
  /** Auth + בדיקת ביומטריה הסתיימו */
  ready: boolean;
  /** לטעון את עץ האפליקציה מתחת למסך (כשהמסך עומד) */
  onRevealApp: () => void;
  /** היציאה הסתיימה — אפשר להסיר את המסך */
  onFinish: () => void;
};

export function AppLaunchScreen({ ready, onRevealApp, onFinish }: Props) {
  const { isDarkMode, theme } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const started = useRef(false);
  const exiting = useRef(false);

  const themeIn = useSharedValue(0);
  const dots = useSharedValue(0);
  const progress = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const onLayout = () => {
    if (started.current) return;
    started.current = true;
    // הפריים הראשון זהה ל-splash — רק עכשיו מסירים אותו
    void SplashScreen.hideAsync().catch(() => {});

    themeIn.value = withDelay(120, withTiming(1, { duration: 480, easing: EASE }));
    dots.value = withDelay(700, withTiming(1, { duration: 260, easing: EASE }));
    progress.value = withDelay(
      700,
      withTiming(BAR_WAIT_TARGET, { duration: 2200, easing: Easing.out(Easing.cubic) }),
    );
    setTimeout(() => setIntroDone(true), MIN_INTRO_MS);
  };

  useEffect(() => {
    if (!ready || !introDone || exiting.current) return;
    exiting.current = true;
    // עץ האפליקציה נטען כשהמסך עומד; שני פריימים — ואז fade
    onRevealApp();
    // הפס נסגר ל-100% ורק אז דעיכה
    progress.value = withTiming(1, { duration: 240, easing: EASE });
    const t = setTimeout(() => {
      requestAnimationFrame(() => {
        exit.value = withTiming(1, { duration: 380, easing: EASE }, (fin) => {
          if (fin) scheduleOnRN(onFinish);
        });
      });
    }, 260);
    return () => clearTimeout(t);
  }, [ready, introDone, onRevealApp, onFinish, exit, progress]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: 1 - themeIn.value }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + exit.value * (reduceMotion ? 0 : 0.03) }],
  }));
  const dotsStyle = useAnimatedStyle(() => ({ opacity: dots.value * (1 - exit.value * 2) }));
  const barFillStyle = useAnimatedStyle(() => ({ width: progress.value * BAR_W }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.background }, rootStyle]}
      onLayout={onLayout}
      pointerEvents={ready ? 'none' : 'auto'}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="DarkPool נטען"
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: SPLASH_BG }, veilStyle]}
        pointerEvents="none"
      />

      <Animated.View style={[styles.center, contentStyle]}>
        <LottieView
          source={isDarkMode ? LOGO_DARK : LOGO_LIGHT}
          style={styles.logo}
          autoPlay
          loop={false}
          resizeMode="contain"
          // reduce-motion: קופצים ישר לפריים הסופי
          {...(reduceMotion ? { progress: 1 } : null)}
        />
        <Animated.View
          style={[
            styles.bar,
            { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)' },
            dotsStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.barFill,
              // כמו בלייט: מילוי בצבע הטקסט של הערכה (בלי ירוק/אורורה בדארק)
              { backgroundColor: theme.textPrimary },
              barFillStyle,
            ]}
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 10000,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: COMP_W,
    height: COMP_H,
  },
  bar: {
    position: 'absolute',
    width: BAR_W,
    height: BAR_H,
    borderRadius: BAR_H / 2,
    overflow: 'hidden',
    top: '50%',
    marginTop: BAR_DY - BAR_H / 2,
    // מתמלא מימין לשמאל (RTL)
    alignItems: 'flex-end',
  },
  barFill: {
    height: '100%',
    borderRadius: BAR_H / 2,
  },
});

