import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import UIButton from '../ui/UIButton';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import { useTheme } from '../../context/ThemeContext';

/**
 * קורסים שעדיין לא פתוחים — נכנסים לקורס, תמונת הקורס נשארת חדה, רשימת השיעורים מטושטשת,
 * ומלמטה פאנל בסגנון השיטים של האפליקציה עם טיזר «בקרוב».
 * לפתיחת קורס: להסיר אותו מ-LOCKED_COURSES.
 */
type Highlight = { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string };
type CourseTeaser = { title: string; pitch: string; highlights: Highlight[] };

const TRADING_BASICS: CourseTeaser = {
  title: 'יסודות המסחר',
  pitch: 'המסלול שבונה לכם בסיס מסחר מקצועי — מהגרף הראשון ועד תוכנית מסחר מסודרת.',
  highlights: [
    { icon: 'play-circle-outline', title: 'שיעורי וידאו ממוקדים', subtitle: 'קצרים, ברורים, בקצב שלכם' },
    { icon: 'trending-up-outline', title: 'מאפס ועד אסטרטגיה', subtitle: 'ניתוח טכני, כניסות, יציאות וניהול סיכונים' },
    { icon: 'bar-chart-outline', title: 'דוגמאות אמיתיות מהשוק', subtitle: 'כל פרק נשען על עסקאות מהשטח' },
  ],
};

const LOCKED_COURSES: Record<string, CourseTeaser> = {
  'david-training-course': TRADING_BASICS,
  'david-training-course-1': TRADING_BASICS,
  'whales-course-1': {
    title: 'הלווייתנים',
    pitch: 'איך עוקבים אחרי הכסף הגדול — לזהות מה הגופים המוסדיים עושים, לפני שזה מגיע לכותרות.',
    highlights: [
      { icon: 'eye-outline', title: 'קריאת פעילות מוסדיים', subtitle: 'Dark Pool, בלוקים וזרימת כסף' },
      { icon: 'pulse-outline', title: 'סימנים שמקדימים את המהלך', subtitle: 'מה באמת חשוב בנתונים — ומה רעש' },
      { icon: 'flash-outline', title: 'מהשיעור — ישר לאפליקציה', subtitle: 'כלים שתשתמשו בהם כבר מחר בבוקר' },
    ],
  },
};

export function isCourseTeaserLocked(courseId?: string | null): boolean {
  return !!courseId && courseId in LOCKED_COURSES;
}

export function CourseTeaserLock({ courseId, onBack }: { courseId: string; onBack: () => void }) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const dialogWidth = Math.min(360, windowWidth - APP_LAYOUT.screenPaddingHorizontal * 2);
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const teaser = LOCKED_COURSES[courseId];
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase.from('courses').select('cover_url').eq('id', courseId).maybeSingle();
      if (alive) setCoverUrl((data as { cover_url?: string | null } | null)?.cover_url ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);
  if (!teaser) return null;

  const canvas = tokens.colors.background.primary;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* חוסם נגיעה בתוכן — הקורס סגור */}
      <View style={StyleSheet.absoluteFill} pointerEvents="auto" />

      {/* בלר מלא מאחורי הדיאלוג — רואים שיש קורס, אבל לא את התוכן */}
      <BlurView
        intensity={isDarkMode ? 55 : 45}
        tint={isDarkMode ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[StyleSheet.absoluteFill, styles.dialogCenter]} pointerEvents="box-none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.18)' }]} pointerEvents="none" />
        <View
          style={[
            styles.dialog,
            {
              width: dialogWidth,
              backgroundColor: canvas,
              borderRadius: UI_CARD_RADIUS,
            },
          ]}
        >
          {/* באנר: תמונת הקורס בכל רוחב הדיאלוג, עם תג נעילה */}
          <View style={styles.banner}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.bannerFallback, { backgroundColor: tokens.colors.background.secondary }]}>
                <Ionicons name="school" size={40} color={tokens.colors.text.primary} />
              </View>
            )}
            <View style={[styles.lockBadge, { backgroundColor: tokens.colors.background.primary }]}>
              <Ionicons name="lock-closed" size={16} color={tokens.colors.text.primary} />
            </View>
          </View>

          <View style={styles.body}>
          <Text style={[styles.title, { color: tokens.colors.text.primary }]}>{teaser.title}</Text>
          <Text style={[styles.pitch, { color: tokens.colors.text.secondary }]}>{teaser.pitch}</Text>

          <Text style={[styles.groupLabel, { color: tokens.colors.text.secondary }]}>מה מחכה לכם בקורס</Text>
          <View style={[styles.card, { backgroundColor: tokens.colors.background.secondary }]}>
            {teaser.highlights.map((h, i) => (
              <View key={h.title}>
                <View style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: tokens.colors.background.navChrome }]}>
                    <Ionicons name={h.icon} size={17} color={tokens.colors.text.primary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: tokens.colors.text.primary }]}>{h.title}</Text>
                  </View>
                </View>
                {i < teaser.highlights.length - 1 ? (
                  <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
                ) : null}
              </View>
            ))}
          </View>

          <Text style={[styles.footnote, { color: tokens.colors.text.secondary }]}>
            הקורס בשלבי הפקה אחרונים — נעדכן אתכם ברגע שייפתח
          </Text>

          <View style={styles.cta}>
            <UIButton title="חזרה לאקדמיה" variant="primary" fullWidth onPress={onBack} />
          </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (_tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    dialogCenter: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    },
    // כמו InlineAppDialog / UIAlert
    dialog: {
      alignItems: 'center',
      overflow: 'hidden',
    },
    lockBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    banner: {
      alignSelf: 'stretch',
      height: 150,
    },
    bannerFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      alignSelf: 'stretch',
      alignItems: 'center',
      padding: APP_LAYOUT.cardPadding,
      paddingTop: 18,
    },
    title: {
      ...APP_TYPE.pageTitle,
      textAlign: 'center',
      writingDirection: 'rtl',
      marginBottom: APP_LAYOUT.cardTitleToBodyGap,
    },
    pitch: {
      ...APP_TYPE.body,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    groupLabel: {
      ...APP_TYPE.groupLabel,
      ...appPhysicalRightText,
      alignSelf: 'stretch',
      marginTop: 20,
      marginBottom: APP_LAYOUT.sectionHeaderToContent - 4,
    },
    card: {
      alignSelf: 'stretch',
      borderRadius: 18,
      overflow: 'hidden',
    },
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      ...APP_TYPE.cardTitle,
      ...appPhysicalRightText,
    },
    divider: {
      height: 1,
      marginHorizontal: 14,
    },
    footnote: {
      ...APP_TYPE.footnote,
      textAlign: 'center',
      writingDirection: 'rtl',
      marginTop: APP_LAYOUT.cardStackGap,
    },
    cta: {
      alignSelf: 'stretch',
      marginTop: 20,
    },
  });

export default CourseTeaserLock;
