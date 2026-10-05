import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CourseWithProgress } from '../../types/learning';
import UICard from '../ui/UICard';
import UIButton from '../ui/UIButton';
import { useDesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  ACADEMY_CARD_RADIUS,
  academyCardWidth,
} from './academyCardLayout';
import { APP_LAYOUT } from '../ui/appLayout';
import {
  appCardBodyStyle,
  appCardSubtitleStyle,
  appCardTitleStyle,
  appGroupLabelStyle,
} from '../ui/appType';
import { ACADEMY_TYPE } from './academyLayout';
import {
  getAcademyCourseAccentColor,
  getAcademyCourseAudience,
  getAcademyCourseBadgeColor,
  getAcademyCourseBadgeLabel,
  getAcademyCourseBadgeTextColor,
  getAcademyCourseSubtitle,
  getAcademyCourseTier,
  isComingSoonCourse,
} from './academyCourses';

/** @deprecated השתמשו ב־academyCardWidth — נשמר לתאימות */
export const CARD_WIDTH = academyCardWidth(Dimensions.get('window').width);

interface CourseCardProps {
  course: CourseWithProgress;
  onPress: (course: CourseWithProgress) => void;
  onEnroll?: (course: CourseWithProgress) => void;
  hideBadges?: boolean;
  /** רוחב קבוע לכרטיס אופקי; אם לא מועבר — רוחב מלא */
  width?: number;
  /** בשורה אופקית: למתוח לגובה הכרטיס הגבוה בשורה (כל הכרטיסים באותו אורך, CTA בתחתית) */
  fillHeight?: boolean;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onPress,
  hideBadges = false,
  width,
  fillHeight = false,
}) => {
  const T = useDesignTokens();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = width ?? academyCardWidth(screenWidth);
  const coverHeight = Math.round(cardWidth * 0.58);
  const styles = React.useMemo(
    () => createStyles(T, coverHeight, cardWidth),
    [T, coverHeight, cardWidth]
  );

  const isEnrolled = !!course.enrollment;
  const comingSoon = isComingSoonCourse(course);
  const lessonsFromModules =
    course.modules?.reduce((s, m) => s + (m.lessons?.length ?? 0), 0) ?? 0;
  // חלק מהמקורות מחזירים קורס שטוח עם lessons/total_lessons ולא רק modules
  const flatCourse = course as CourseWithProgress & {
    total_lessons?: number;
    lessons?: unknown[];
  };
  const totalLessons =
    [
      course.progress?.total_lessons,
      flatCourse.total_lessons,
      Array.isArray(flatCourse.lessons) ? flatCourse.lessons.length : 0,
      lessonsFromModules,
    ].find((n) => typeof n === 'number' && n > 0) ?? 0;

  const completedLessons = course.progress?.completed_lessons || 0;
  const progressPct =
    totalLessons > 0
      ? (completedLessons / totalLessons) * 100
      : course.progress?.progress_percentage || 0;

  const tier = getAcademyCourseTier(course as CourseWithProgress & { price?: number });
  const isPremium = tier === 'premium';
  const badgeLabel = getAcademyCourseBadgeLabel(course as CourseWithProgress & { price?: number });
  const badgeTextColor = getAcademyCourseBadgeTextColor(course);
  const badgeColor = getAcademyCourseBadgeColor(
    course as CourseWithProgress & { price?: number },
    T.colors.primary.main
  );
  const subtitle = getAcademyCourseSubtitle(course);
  const audience = getAcademyCourseAudience(course);
  const accent = getAcademyCourseAccentColor(
    course as CourseWithProgress & { price?: number },
    T.colors.primary.main
  );

  const ctaLabel = comingSoon
    ? 'פרטים נוספים'
    : isEnrolled
      ? 'המשך למידה'
      : isPremium
        ? 'לצפייה בקורס'
        : 'התחל ללמוד';

  return (
    <TouchableOpacity
      style={[styles.wrapper, fillHeight && styles.fill]}
      onPress={() => {
        void HapticFeedback.impactLight();
        onPress(course);
      }}
      activeOpacity={0.88}
    >
      <UICard
        variant="soft"
        padding="none"
        style={[styles.card, fillHeight && styles.fillFlex]}
        contentContainerStyle={fillHeight ? styles.fillFlex : undefined}
      >
        <View style={styles.cover}>
          {course.cover_url ? (
            <Image
              source={{ uri: course.cover_url }}
              style={styles.coverImg}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={course.id}
              transition={120}
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="school-outline" size={56} color={T.colors.text.tertiary} />
            </View>
          )}

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            locations={[0, 1]}
            style={styles.coverGradient}
            pointerEvents="none"
          />

          {!hideBadges ? (
            <View style={[styles.tierBadge, { backgroundColor: badgeColor }]}>
              <Text style={[styles.tierBadgeText, { color: badgeTextColor }]}>{badgeLabel}</Text>
            </View>
          ) : null}

          {isEnrolled && progressPct > 0 ? (
            <View style={styles.progressChip}>
              <Text style={styles.progressChipText}>{Math.round(progressPct)}%</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.body, fillHeight && styles.fillFlex]}>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2}>
              {course.title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {audience ? (
            <View style={styles.audienceBlock}>
              <Text style={styles.audienceLabel}>למי הקורס מתאים</Text>
              <Text style={styles.audienceText}>{audience}</Text>
            </View>
          ) : null}

          {isEnrolled && totalLessons > 0 ? (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, Math.max(0, progressPct))}%`,
                    backgroundColor: accent,
                  },
                ]}
              />
            </View>
          ) : null}

          <View pointerEvents="none" style={[styles.ctaSlot, fillHeight && { marginTop: 'auto' }]}>
            <UIButton title={ctaLabel} variant="primary" fullWidth haptic={false} />
          </View>
        </View>
      </UICard>
    </TouchableOpacity>
  );
};

const createStyles = (
  T: ReturnType<typeof useDesignTokens>,
  coverHeight: number,
  cardWidth: number
) =>
  StyleSheet.create({
    wrapper: {
      width: cardWidth,
      direction: 'ltr',
    },
    fill: {
      alignSelf: 'stretch',
    },
    fillFlex: {
      flex: 1,
    },
    card: {
      width: '100%',
      borderRadius: ACADEMY_CARD_RADIUS,
      overflow: 'hidden',
      borderWidth: 0,
      direction: 'ltr',
    },
    cover: {
      width: '100%',
      height: coverHeight,
      position: 'relative',
      backgroundColor: 'rgba(255,255,255,0.04)',
      overflow: 'hidden',
    },
    coverImg: {
      width: '100%',
      height: '100%',
    },
    coverPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    coverGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '40%',
    },
    tierBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      minHeight: 28,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierBadgeText: {
      ...ACADEMY_TYPE.caption,
      color: '#fff',
      writingDirection: 'rtl',
    },
    progressChip: {
      position: 'absolute',
      top: 12,
      left: 12,
      height: 28,
      borderRadius: 14,
      paddingHorizontal: 10,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressChipText: {
      ...ACADEMY_TYPE.caption,
      color: '#fff',
    },
    body: {
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingTop: APP_LAYOUT.cardPadding,
      paddingBottom: APP_LAYOUT.cardPadding,
      gap: APP_LAYOUT.cardTitleToBodyGap,
      direction: 'ltr',
      alignItems: 'stretch',
      width: '100%',
    },
    titleBlock: {
      width: '100%',
      alignItems: 'stretch',
    },
    title: {
      ...appCardTitleStyle,
      color: T.colors.text.primary,
    },
    subtitle: {
      ...appCardSubtitleStyle,
    },
    audienceBlock: {
      width: '100%',
      alignItems: 'stretch',
      gap: APP_LAYOUT.groupLabelToContent,
    },
    audienceLabel: {
      ...appGroupLabelStyle,
      marginBottom: 0,
      color: T.colors.text.secondary,
    },
    audienceText: {
      ...appCardBodyStyle,
      color: T.colors.text.secondary,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.1)',
      overflow: 'hidden',
      marginTop: 2,
      width: '100%',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      alignSelf: 'flex-end',
    },
    ctaSlot: {
      marginTop: APP_LAYOUT.stackGapSmall,
      width: '100%',
    },
  });
