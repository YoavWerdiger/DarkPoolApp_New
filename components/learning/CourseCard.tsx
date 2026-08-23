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
import { useDesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  ACADEMY_CARD_RADIUS,
  academyCardWidth,
} from './academyCardLayout';
import {
  getAcademyCourseAudience,
  getAcademyCourseSubtitle,
  getAcademyCourseTier,
  isComingSoonCourse,
  isDavidTrainingCourse,
} from './academyCourses';

const PREMIUM_GOLD = '#F59E0B';

/** @deprecated השתמשו ב־academyCardWidth — נשמר לתאימות */
export const CARD_WIDTH = academyCardWidth(Dimensions.get('window').width);

interface CourseCardProps {
  course: CourseWithProgress;
  onPress: (course: CourseWithProgress) => void;
  onEnroll?: (course: CourseWithProgress) => void;
  hideBadges?: boolean;
  /** רוחב קבוע לכרטיס אופקי; אם לא מועבר — רוחב מלא */
  width?: number;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onPress,
  hideBadges = false,
  width,
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
  const freeBadgeLabel = isDavidTrainingCourse(course) ? 'בסיסי' : 'חינמי';
  const subtitle = getAcademyCourseSubtitle(course);
  const audience = getAcademyCourseAudience(course);
  const accent = isPremium ? PREMIUM_GOLD : T.colors.primary.main;

  const ctaLabel = comingSoon
    ? 'פרטים נוספים'
    : isEnrolled
      ? 'המשך למידה'
      : isPremium
        ? 'לצפייה בקורס'
        : 'התחל ללמוד';

  return (
    <TouchableOpacity
      style={styles.wrapper}
      onPress={() => {
        void HapticFeedback.impactLight();
        onPress(course);
      }}
      activeOpacity={0.88}
    >
      <UICard
        variant="blur"
        padding="none"
        showGlassBorder={false}
        style={styles.card}
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
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: isPremium ? PREMIUM_GOLD : T.colors.primary.main },
              ]}
            >
              <Text style={styles.tierBadgeText}>
                {isPremium ? 'פרמיום' : freeBadgeLabel}
              </Text>
            </View>
          ) : null}

          {isEnrolled && progressPct > 0 ? (
            <View style={styles.progressChip}>
              <Text style={styles.progressChipText}>{Math.round(progressPct)}%</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {course.title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}

          {audience ? (
            <View style={styles.audienceBlock}>
              <Text style={styles.audienceLabel}>למי הקורס מתאים</Text>
              <Text style={styles.audienceText} numberOfLines={3}>
                {audience}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="play-circle-outline" size={15} color={accent} />
              <Text style={styles.metaText}>
                {comingSoon
                  ? 'בקרוב'
                  : totalLessons > 0
                    ? `${totalLessons} שיעורים`
                    : 'בקרוב'}
              </Text>
            </View>
            {course.instructor_name ? (
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={15} color={accent} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {course.instructor_name}
                </Text>
              </View>
            ) : null}
          </View>

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

          <View style={[styles.cta, { backgroundColor: accent }]}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
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
      height: 28,
      borderRadius: 14,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#fff',
      lineHeight: 14,
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
      fontSize: 12,
      fontWeight: '700',
      color: '#fff',
    },
    body: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,
      gap: 8,
      direction: 'ltr',
      alignItems: 'stretch',
      width: '100%',
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: T.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
      width: '100%',
      lineHeight: 26,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '500',
      color: T.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
      width: '100%',
      lineHeight: 20,
    },
    audienceBlock: {
      marginTop: 4,
      gap: 4,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.1)',
      width: '100%',
    },
    audienceLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: T.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: 'rtl',
      width: '100%',
    },
    audienceText: {
      fontSize: 13,
      fontWeight: '500',
      color: T.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 19,
      minHeight: 57,
      width: '100%',
    },
    metaRow: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 2,
      width: '100%',
      justifyContent: 'flex-start',
    },
    metaItem: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 4,
      maxWidth: '100%',
    },
    metaText: {
      fontSize: 12,
      fontWeight: '600',
      color: T.colors.text.secondary,
      writingDirection: 'rtl',
      textAlign: 'right',
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
    cta: {
      marginTop: 6,
      minHeight: 44,
      borderRadius: 999,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    ctaText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
      writingDirection: 'rtl',
      textAlign: 'center',
    },
  });
