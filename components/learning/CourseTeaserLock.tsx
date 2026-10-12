import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UICard from '../ui/UICard';
import UIButton from '../ui/UIButton';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { APP_LAYOUT } from '../ui/appLayout';
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
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const teaser = LOCKED_COURSES[courseId];
  if (!teaser) return null;

  // תמונת הקורס (42% מהמסך ב-LearningScreen) נשארת חדה — הטשטוש מתחיל קצת לפני סופה, במעבר הדרגתי
  const blurTop = Math.round(windowHeight * 0.42) - 56;
  const canvas = tokens.colors.background.primary;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* חוסם נגיעה בתוכן (גם בתמונה) — הקורס סגור */}
      <View style={StyleSheet.absoluteFill} pointerEvents="auto" />

      <View style={[styles.blurZone, { top: blurTop }]} pointerEvents="none">
        <BlurView intensity={isDarkMode ? 45 : 35} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[`${canvas}00`, `${canvas}B3`, canvas]}
          locations={[0, 0.35, 0.75]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: canvas,
            borderTopLeftRadius: tokens.borderRadius.xl,
            borderTopRightRadius: tokens.borderRadius.xl,
            paddingBottom: Math.max(insets.bottom, 12) + APP_LAYOUT.cardStackGap,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: tokens.colors.border.divider }]} />

        <View style={styles.headerRow}>
          <View style={[styles.lockCircle, { backgroundColor: tokens.colors.background.navChrome }]}>
            <Ionicons name="lock-closed" size={20} color={tokens.colors.text.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: tokens.colors.primary.main }]}>בקרוב באקדמיה</Text>
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>{teaser.title}</Text>
          </View>
        </View>

        <Text style={[styles.pitch, { color: tokens.colors.text.secondary }]}>{teaser.pitch}</Text>

        <Text style={[styles.groupLabel, { color: tokens.colors.text.secondary }]}>מה מחכה לכם בקורס</Text>
        <UICard variant="soft" padding="none" style={styles.card}>
          {teaser.highlights.map((h, i) => (
            <View key={h.title}>
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: tokens.colors.background.navChrome }]}>
                  <Ionicons name={h.icon} size={18} color={tokens.colors.text.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: tokens.colors.text.primary }]}>{h.title}</Text>
                  <Text style={[styles.rowSubtitle, { color: tokens.colors.text.secondary }]}>{h.subtitle}</Text>
                </View>
              </View>
              {i < teaser.highlights.length - 1 ? (
                <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
              ) : null}
            </View>
          ))}
        </UICard>

        <Text style={[styles.footnote, { color: tokens.colors.text.secondary }]}>
          הקורס בשלבי הפקה אחרונים — נעדכן אתכם ברגע שייפתח
        </Text>

        <UIButton title="חזרה לאקדמיה" variant="primary" fullWidth onPress={onBack} style={styles.cta} />
      </View>
    </View>
  );
}

const createStyles = (_tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    blurZone: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: 10,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: 3,
      marginBottom: 18,
    },
    headerRow: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    lockCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
    },
    eyebrow: {
      ...APP_TYPE.caption,
      fontWeight: '700',
      ...appPhysicalRightText,
    },
    title: {
      ...APP_TYPE.sectionTitle,
      ...appPhysicalRightText,
      marginTop: 2,
    },
    pitch: {
      ...APP_TYPE.body,
      ...appPhysicalRightText,
      marginTop: 12,
    },
    groupLabel: {
      ...APP_TYPE.groupLabel,
      ...appPhysicalRightText,
      marginTop: 22,
      marginBottom: 8,
    },
    card: {
      borderWidth: 0,
    },
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: APP_LAYOUT.cardPadding,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
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
    rowSubtitle: {
      ...APP_TYPE.cardSubtitle,
      ...appPhysicalRightText,
      marginTop: 2,
    },
    divider: {
      height: 1,
      marginHorizontal: APP_LAYOUT.cardPadding,
    },
    footnote: {
      ...APP_TYPE.footnote,
      textAlign: 'center',
      writingDirection: 'rtl',
      marginTop: 16,
    },
    cta: {
      marginTop: 14,
    },
  });

export default CourseTeaserLock;
