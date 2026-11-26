import React, { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import UIButton from './ui/UIButton';
import { useDesignTokens } from './ui/DesignTokens';
import { useTheme } from '../context/ThemeContext';
import { TEXT_DIR } from '../lib/i18n/language';
import { HapticFeedback } from '../utils/hapticFeedback';

/** אותו לוגו כמו במסך הפתיחה (קהילת הסוחרים של ישראל) */
const LOGO_DARK_URI = 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/app-media/image%20(3).png';
const LOGO_LIGHT = require('../assets/branding/welcome-logo-light.png');
const LOGO_RATIO = 596 / 1343;

/** 1.2.10 מול 1.10.0 — השוואה מספרית לכל חלק */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

type Required = { storeUrl: string; message: string | null; minVersion: string; current: string };

/**
 * עדכון כפוי: אם גרסת האפליקציה נמוכה מ-app_config.min_version_<platform> — מסך «התחדשנו!» חוסם
 * עם הלוגו, מה חדש (update_message, שורה לכל פריט) וכפתור לחנות.
 * תקלה ברשת / בטבלה לא חוסמת את האפליקציה.
 */
export default function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const [required, setRequired] = useState<Required | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    const current = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0.0.0';
    void supabase
      .from('app_config')
      .select('min_version_ios, min_version_android, ios_store_url, android_store_url, update_message')
      .eq('id', 1)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (!data) return;
          const min = Platform.OS === 'ios' ? data.min_version_ios : data.min_version_android;
          if (min && compareVersions(current, min) < 0) {
            setRequired({
              storeUrl: Platform.OS === 'ios' ? data.ios_store_url : data.android_store_url,
              message: data.update_message ?? null,
              minVersion: min,
              current,
            });
          }
        },
        () => {},
      );
  }, []);

  if (!required) return <>{children}</>;
  return <UpdateScreen {...required} />;
}

export function UpdateScreen({ storeUrl, message, minVersion, current }: Required) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const c = tokens.colors;
  const brand = c.success.main;

  // לוגו: נכנס בקפיצה קטנה, ואז «מרחף» לאט — מרגיש חי, לא מסך שגיאה
  const scale = useSharedValue(reduceMotion ? 1 : 0.82);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const float = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: 11, stiffness: 140 });
    float.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [reduceMotion, opacity, scale, float]);
  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: float.value }, { scale: scale.value }],
  }));

  const logoWidth = Math.min(width * 0.72, 320);
  const highlights = (message ?? '')
    .split('\n')
    .map((l) => l.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(250 + i * 90).duration(380));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background.primary }]} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Animated.View style={logoStyle}>
          <Image
            source={isDarkMode ? { uri: LOGO_DARK_URI } : LOGO_LIGHT}
            style={{ width: logoWidth, height: logoWidth * LOGO_RATIO }}
            contentFit="contain"
            accessibilityLabel="DarkPool — קהילת הסוחרים של ישראל"
          />
        </Animated.View>

        <Animated.View entering={enter(0)} style={[styles.badge, { backgroundColor: `${brand}22` }]}>
          <Ionicons name="sparkles" size={13} color={brand} />
          <Text style={[styles.badgeText, { color: brand }]}>גרסה {minVersion}</Text>
        </Animated.View>

        <Animated.Text entering={enter(1)} style={[styles.title, { color: c.text.primary }]}>
          התחדשנו!
        </Animated.Text>
        <Animated.Text entering={enter(2)} style={[styles.body, { color: c.text.secondary }]}>
          גרסה חדשה של DarkPool כבר מחכה לך ב-{storeName} — עם שיפורים, תיקונים ופיצ׳רים חדשים. העדכון לוקח פחות מדקה.
        </Animated.Text>

        {highlights.length > 0 ? (
          <Animated.View entering={enter(3)} style={[styles.card, { backgroundColor: c.background.cardSolid }]}>
            <Text style={[styles.cardTitle, { color: c.text.secondary }]}>מה חדש</Text>
            {highlights.map((h) => (
              <View key={h} style={styles.row}>
                <Ionicons name="checkmark-circle" size={18} color={brand} />
                <Text style={[styles.rowText, { color: c.text.primary }]}>{h}</Text>
              </View>
            ))}
          </Animated.View>
        ) : null}
      </View>

      <Animated.View entering={enter(4)} style={styles.footer}>
        <UIButton
          title={`לעדכון ב-${storeName}`}
          variant="primary"
          size="lg"
          fullWidth
          icon={Platform.OS === 'ios' ? 'logo-apple-appstore' : 'logo-google-playstore'}
          iconPosition="right"
          onPress={() => {
            void HapticFeedback.success();
            void Linking.openURL(storeUrl);
          }}
        />
        <Text style={[styles.version, { color: c.text.tertiary }]}>הגרסה שלך: {current}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 28, borderRadius: 14, marginTop: 18 },
  badgeText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800', textAlign: 'center', writingDirection: TEXT_DIR },
  body: { fontSize: 16, lineHeight: 24, textAlign: 'center', writingDirection: TEXT_DIR, maxWidth: 340 },
  card: { alignSelf: 'stretch', borderRadius: 20, padding: 16, gap: 10, marginTop: 6 },
  cardTitle: { fontSize: 13, fontWeight: '600', textAlign: 'right', writingDirection: TEXT_DIR },
  row: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  rowText: { flex: 1, fontSize: 15, lineHeight: 21, textAlign: 'right', writingDirection: TEXT_DIR },
  footer: { paddingBottom: 12, gap: 10 },
  version: { fontSize: 12, textAlign: 'center' },
});
