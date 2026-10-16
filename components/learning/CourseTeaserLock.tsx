import React, { useEffect, useMemo, useState, type RefObject } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { useNavigation } from '@react-navigation/native';
import { HapticFeedback } from '../../utils/hapticFeedback';
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
import { getAcademyCourseAudience } from './academyCourses';

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
  'oracle-course': {
    title: 'האורקל',
    pitch: 'קורס מסחר מתקדם באופציות — לסוחרים שכבר מכירים את השוק ורוצים להתמקצע באסטרטגיות מתקדמות.',
    highlights: [
      { icon: 'layers-outline', title: 'אסטרטגיות אופציות מתקדמות', subtitle: '' },
      { icon: 'shield-checkmark-outline', title: 'בניית פוזיציות וניהול סיכונים', subtitle: '' },
      { icon: 'analytics-outline', title: 'קריאת השוק דרך זרימת האופציות', subtitle: '' },
    ],
  },
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

export function CourseTeaserLock({
  courseId,
  onBack,
  blurTarget,
}: {
  courseId: string;
  onBack: () => void;
  /** Android: התוכן לטשטוש (BlurTargetView) — בלי זה BlurView ב-Android הוא רק שכבה שקופה */
  blurTarget?: RefObject<View | null>;
}) {
  const navigation = useNavigation<any>();
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

  // אותו הסבר כמו בכרטיס הקורס באקדמיה (בלי הכותרת «למי הקורס מתאים»)
  const explanation =
    getAcademyCourseAudience({ id: courseId, slug: courseId, title: teaser.title, description: '' }) ||
    teaser.pitch;
  const canvas = tokens.colors.background.primary;
  // Android לפני SDK 31 / בלי יעד לטשטוש — אין בלר אמיתי, לכן עמעום חזק שמסתיר את התוכן
  const androidNoRealBlur = Platform.OS === 'android' && (!blurTarget || Number(Platform.Version) < 31);
  const dimColor = androidNoRealBlur
    ? isDarkMode
      ? 'rgba(0,0,0,0.82)'
      : 'rgba(0,0,0,0.6)'
    : isDarkMode
      ? 'rgba(0,0,0,0.30)'
      : 'rgba(0,0,0,0.18)';
  const goPurchase = () => {
    void HapticFeedback.impactLight();
    // SubscriptionPlans יושב ב-ProfileStack (route «Profile» ב-root)
    navigation.navigate('Profile', { screen: 'SubscriptionPlans' });
  };

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
        {...(Platform.OS === 'android' && blurTarget
          ? { blurTarget, blurMethod: 'dimezisBlurViewSdk31Plus' as const, blurReductionFactor: 2 }
          : {})}
      />

      <View style={[StyleSheet.absoluteFill, styles.dialogCenter]} pointerEvents="box-none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: dimColor }]} pointerEvents="none" />
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
          <Text style={[styles.pitch, { color: tokens.colors.text.secondary }]}>{explanation}</Text>

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


          <View style={styles.cta}>
            <UIButton
              title="לרכישת הקורס"
              variant="primary"
              fullWidth
              onPress={goPurchase}
              style={{ backgroundColor: tokens.colors.primary.main }}
              textStyle={{ color: '#000000' }}
            />
          </View>
          </View>
        </View>

        {/* יציאה — מחוץ לדיאלוג */}
        {/* אותו כפתור יציאה כמו בכותרות האפליקציה (ChatSubScreenHeader) */}
        <View style={styles.closeWrap}>
          <DayNavBlurButton
            onPress={onBack}
            size={DRAWER_MENU_BUTTON_SIZE}
            glassIntensity="subtle"
            accessibilityLabel="סגירה וחזרה לאקדמיה"
          >
            <Ionicons name="close" size={24} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
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
    // כמו כרטיסי ההגדרות: רדיוס כרטיס, שורות 15/16, מפרידים מקצה לקצה (בתוך ריפוד הכרטיס)
    card: {
      alignSelf: 'stretch',
      borderRadius: UI_CARD_RADIUS,
      overflow: 'hidden',
    },
    row: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 15,
      paddingHorizontal: APP_LAYOUT.cardPadding,
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
      marginHorizontal: APP_LAYOUT.cardPadding,
    },
    closeWrap: {
      marginTop: 20,
    },
    cta: {
      alignSelf: 'stretch',
      marginTop: 20,
    },
  });

export default CourseTeaserLock;
