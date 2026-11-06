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
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BOTTOM_SHEET_EDGE_HANDLE_HEIGHT,
  useBottomSheetClose,
} from '../ui/BottomSheet/BottomSheet';
import UIButton from '../ui/UIButton';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import {
  appBodyTextStyle,
  appCardMetricLabelStyle,
  appCardSubtitleStyle,
  appSheetTitleStyle,
} from '../ui/appType';
import { ACADEMY_TYPE } from './academyLayout';
import { CourseWithProgress } from '../../types/learning';
import {
  getAcademyCourseAudience,
  getAcademyCourseBadgeColor,
  getAcademyCourseBadgeLabel,
  getAcademyCourseBadgeTextColor,
  getAcademyCourseSubtitle,
  getAcademyCourseTier,
  getCourseDurationMinutes,
  getCourseLessonStats,
  isComingSoonCourse,
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
  const insets = useSafeAreaInsets();
  const animatedClose = useBottomSheetClose();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
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
  const { totalLessons } = getCourseLessonStats(course);
  const minutes = getCourseDurationMinutes(priced);

  const meta = [
    isComingSoonCourse(course)
      ? i18n.t('auto.screens__Learning__CourseComingSoonScreen.s3')
      : null,
    totalLessons > 0
      ? i18n.t('auto.components__learning__CourseInfoSheet.s1', { count: totalLessons })
      : null,
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
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={[styles.badgeText, { color: badgeTextColor }]}>{badgeLabel}</Text>
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
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}
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
      const totalPx = contentHeight + BOTTOM_SHEET_EDGE_HANDLE_HEIGHT + 4;
      return Math.min(MAX_SNAP, Math.max(0.3, totalPx / SCREEN_HEIGHT));
    }
    return 0.5;
  }, [contentHeight]);

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

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
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
      paddingTop: 6,
      paddingBottom: 8,
      alignItems: 'stretch',
    },
    badge: {
      alignSelf: 'flex-start',
      minHeight: 26,
      borderRadius: 13,
      paddingHorizontal: 12,
      paddingVertical: 3,
      justifyContent: 'center',
      marginBottom: 12,
    },
    badgeText: {
      ...ACADEMY_TYPE.caption,
      writingDirection: TEXT_DIR,
    },
    title: {
      ...appSheetTitleStyle,
      color: tokens.colors.text.primary,
      marginBottom: 4,
    },
    subtitle: {
      ...appCardSubtitleStyle,
      color: tokens.colors.text.secondary,
    },
    meta: {
      ...appCardMetricLabelStyle,
      color: tokens.colors.text.tertiary,
      marginTop: 8,
    },
    section: {
      marginTop: 20,
      gap: APP_LAYOUT.cardMetricLabelToValueGap,
    },
    sectionLabel: {
      ...appCardMetricLabelStyle,
      color: tokens.colors.text.tertiary,
    },
    body: {
      ...appBodyTextStyle,
      color: tokens.colors.text.primary,
    },
    footer: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: 12,
    },
  });
}
