import { UI_DIR } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
/**
 * פירוט קורס בשיט — נפתח מכרטיס באקדמיה כשהמשתמש עוד לא רשום לקורס.
 * כל המלל שהוסר מהכרטיס (תג, למי מתאים, תיאור, היקף) מוצג כאן, ו-CTA לכניסה לקורס.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BOTTOM_SHEET_EDGE_HANDLE_HEIGHT,
  useBottomSheetClose,
} from '../ui/BottomSheet/BottomSheet';
import { sheetContentBottomPadding } from '../ui/BottomSheet/sheetGlass';
import UIButton from '../ui/UIButton';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import {
  appBodyTextStyle,
  appCaptionStyle,
  appGroupLabelStyle,
  appSheetSubtitleStyle,
  appSheetTitleStyle,
} from '../ui/appType';
import { ACADEMY_TYPE } from './academyLayout';
import { ACADEMY_CARD_RADIUS } from './academyCardLayout';
import { CourseWithProgress } from '../../types/learning';
import {
  getAcademyCourseAudience,
  getAcademyCourseBadgeColor,
  getAcademyCourseBadgeLabel,
  getAcademyCourseBadgeTextColor,
  getAcademyCourseSubtitle,
  getAcademyCourseTier,
  getCourseDurationMinutes,
} from './academyCourses';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MAX_SNAP = 0.85;

type PricedCourse = CourseWithProgress & {
  price?: number;
  duration_minutes?: number | null;
  duration_hours?: number | null;
};

export type CourseInfoSheetProps = {
  course: CourseWithProgress | null;
  onClose: () => void;
  /** כניסה לקורס (אותו ניווט כמו לחיצה על כרטיס של קורס רשום) */
  onOpenCourse: (course: CourseWithProgress) => void;
};

/** התיאור בלי פסקת «למי הקורס מתאים» — היא מוצגת בנפרד */
function courseAboutText(description?: string): string {
  return (description || '')
    .replace(/למי הקורס מתאים\?\s*\n[^\n]+/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function CourseInfoBody({
  course,
  onOpenCourse,
  onClose,
  onHeightChange,
}: {
  course: CourseWithProgress;
  onOpenCourse: (course: CourseWithProgress) => void;
  onClose: () => void;
  onHeightChange: (h: number) => void;
}) {
  const tokens = useDesignTokens();
  const animatedClose = useBottomSheetClose();
  const { width: screenWidth } = useWindowDimensions();
  // תמונת הקורס ברוחב השיט (בתוך הריפוד), 16:9 כמו בכרטיס
  const coverHeight = Math.round(((screenWidth - APP_LAYOUT.screenPaddingHorizontal * 2) * 9) / 16);
  const styles = useMemo(() => createStyles(tokens, coverHeight), [tokens, coverHeight]);
  const [scrollH, setScrollH] = useState(0);
  const [footerH, setFooterH] = useState(0);

  useEffect(() => {
    if (scrollH > 0 && footerH > 0) onHeightChange(scrollH + footerH);
  }, [scrollH, footerH, onHeightChange]);

  const priced = course as PricedCourse;
  const isPremium = getAcademyCourseTier(priced) === 'premium';
  const badgeLabel = getAcademyCourseBadgeLabel(priced);
  const badgeColor = getAcademyCourseBadgeColor(priced, tokens.colors.primary.main);
  const badgeTextColor = getAcademyCourseBadgeTextColor(course);
  const subtitle = getAcademyCourseSubtitle(course);
  const audience = getAcademyCourseAudience(course);
  const about = courseAboutText(course.description);
  const minutes = getCourseDurationMinutes(priced);

  const meta = [
    minutes > 0
      ? i18n.t('auto.components__learning__CourseInfoSheet.s2', { count: minutes })
      : null,
  ].filter(Boolean) as string[];

  const ctaLabel = isPremium
    ? i18n.t('auto.components__learning__CourseInfoSheet.s5')
    : i18n.t('auto.components__learning__CourseInfoSheet.s6');

  const handleCta = useCallback(() => {
    if (animatedClose) animatedClose();
    else onClose();
    onOpenCourse(course);
  }, [animatedClose, onClose, onOpenCourse, course]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, h) => setScrollH((prev) => (prev === h ? prev : h))}
      >
        <View style={styles.cover}>
          {course.cover_url ? (
            <Image
              source={{ uri: course.cover_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={course.id}
              transition={120}
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="school-outline" size={48} color={tokens.colors.text.tertiary} />
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={[styles.badgeText, { color: badgeTextColor }]}>{badgeLabel}</Text>
          </View>
        </View>

        <Text style={styles.title}>{course.title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {meta.length > 0 ? <Text style={styles.meta}>{meta.join(' · ')}</Text> : null}

        {audience ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {i18n.t('auto.components__learning__CourseInfoSheet.s3')}
            </Text>
            <Text style={styles.body}>{audience}</Text>
          </View>
        ) : null}

        {about ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {i18n.t('auto.components__learning__CourseInfoSheet.s4')}
            </Text>
            <Text style={styles.body}>{about}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={styles.footer}
        onLayout={(e: LayoutChangeEvent) => {
          const h = e.nativeEvent.layout.height;
          setFooterH((prev) => (prev === h ? prev : h));
        }}
      >
        <UIButton title={ctaLabel} variant="primary" size="lg" fullWidth onPress={handleCta} />
      </View>
    </View>
  );
}

export function CourseInfoSheet({ course, onClose, onOpenCourse }: CourseInfoSheetProps) {
  const insets = useSafeAreaInsets();
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  // שומר את הקורס האחרון כדי שהתוכן לא ייעלם בזמן אנימציית הסגירה
  const [shown, setShown] = useState<CourseWithProgress | null>(course);

  useEffect(() => {
    if (course) {
      setShown(course);
      setContentHeight(null);
    }
  }, [course]);

  const snapPoint = useMemo(() => {
    if (contentHeight != null && contentHeight > 0) {
      // BottomSheet מוסיף בעצמו ריפוד safe area מתחת לתוכן — הכפתור לא מוסיף עוד אחד
      const totalPx =
        contentHeight + BOTTOM_SHEET_EDGE_HANDLE_HEIGHT + 4 + sheetContentBottomPadding(insets.bottom);
      return Math.min(MAX_SNAP, Math.max(0.3, totalPx / SCREEN_HEIGHT));
    }
    return 0.5;
  }, [contentHeight, insets.bottom]);

  return (
    <BottomSheet
      isOpen={!!course}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
    >
      {shown ? (
        <CourseInfoBody
          course={shown}
          onClose={onClose}
          onOpenCourse={onOpenCourse}
          onHeightChange={setContentHeight}
        />
      ) : null}
    </BottomSheet>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>, coverHeight: number) {
  // כל הטקסט מהסקאלה של appType (appPhysicalRightText) — מיושר לצד תחילת הקריאה לפי השפה, לא ממורכז
  return StyleSheet.create({
    root: {
      flex: 1,
      width: '100%',
      direction: UI_DIR,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      // מתחת לידית הגרירה הצפה (edgeToEdge)
      paddingTop: 22,
      paddingBottom: 8,
      alignItems: 'stretch',
    },
    cover: {
      width: '100%',
      height: coverHeight,
      borderRadius: ACADEMY_CARD_RADIUS,
      overflow: 'hidden',
      backgroundColor: tokens.colors.background.secondary,
      marginBottom: 16,
    },
    coverPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // תג בפינה של צד תחילת הקריאה (start = ימין בעברית, שמאל באנגלית)
    badge: {
      position: 'absolute',
      top: 12,
      start: 12,
      minHeight: 26,
      borderRadius: 13,
      paddingHorizontal: 12,
      paddingVertical: 3,
      justifyContent: 'center',
    },
    badgeText: {
      ...ACADEMY_TYPE.caption,
      writingDirection: TEXT_DIR,
    },
    title: {
      ...appSheetTitleStyle,
      color: tokens.colors.text.primary,
    },
    subtitle: {
      ...appSheetSubtitleStyle,
      alignSelf: 'stretch',
      marginTop: APP_LAYOUT.titleSubtitleGap,
      color: tokens.colors.text.secondary,
    },
    meta: {
      ...appCaptionStyle,
      alignSelf: 'stretch',
      marginTop: 8,
      color: tokens.colors.text.tertiary,
    },
    section: {
      marginTop: 20,
      alignItems: 'stretch',
    },
    sectionLabel: {
      ...appGroupLabelStyle,
      color: tokens.colors.text.secondary,
    },
    body: {
      ...appBodyTextStyle,
      alignSelf: 'stretch',
      color: tokens.colors.text.primary,
    },
    footer: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: 12,
    },
  });
}
