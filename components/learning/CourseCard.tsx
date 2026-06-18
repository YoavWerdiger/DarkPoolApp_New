import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Crown } from 'lucide-react-native';
import { CourseWithProgress } from '../../types/learning';
import { ProgressRing } from './ProgressRing';
import UICard from '../ui/UICard';
import { useDesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  ACADEMY_CARD_RADIUS,
  ACADEMY_CARD_BORDER_WIDTH,
  academyCardWidth,
} from './academyCardLayout';
import {
  ACADEMY_BADGE_MIN_WIDTH,
  getAcademyCourseTier,
  getCourseDurationMinutes,
  isDavidTrainingCourse,
} from './academyCourses';

const BADGE_H = 32;
const PREMIUM_GOLD = '#F59E0B';
const PREMIUM_GOLD_DARK = '#D97706';

/** @deprecated השתמשו ב־academyCardWidth — נשמר לתאימות */
export const CARD_WIDTH = academyCardWidth(Dimensions.get('window').width);

interface CourseCardProps {
  course: CourseWithProgress;
  onPress: (course: CourseWithProgress) => void;
  onEnroll?: (course: CourseWithProgress) => void;
  hideBadges?: boolean;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onPress,
  onEnroll,
  hideBadges = false,
}) => {
  const T = useDesignTokens();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = academyCardWidth(screenWidth);
  const coverHeight = Math.round(cardWidth * 0.7);
  const styles = React.useMemo(
    () => createStyles(T, coverHeight),
    [T, coverHeight]
  );

  const isEnrolled = !!course.enrollment;
  const lessonsFromModules =
    course.modules?.reduce((s, m) => s + (m.lessons?.length ?? 0), 0) ?? 0;
  const totalLessons =
    [
      course.progress?.total_lessons,
      (course as any).total_lessons,
      Array.isArray((course as any).lessons) ? (course as any).lessons.length : 0,
      lessonsFromModules,
    ].find((n) => typeof n === 'number' && n > 0) ?? 0;

  const completedLessons = course.progress?.completed_lessons || 0;
  const progressPct =
    totalLessons > 0
      ? (completedLessons / totalLessons) * 100
      : course.progress?.progress_percentage || 0;

  const tier = getAcademyCourseTier(course as CourseWithProgress & { price?: number });
  const isPremium = tier === 'premium';
  const isFree = tier === 'free';
  const isPaid = isPremium;
  const accentColor = isPremium ? PREMIUM_GOLD : T.colors.primary.dark;
  const frameBorderColor = isPremium
    ? 'rgba(245, 158, 11, 0.35)'
    : 'rgba(0, 160, 4, 0.35)';
  const freeBadgeLabel = isDavidTrainingCourse(course) ? 'קורס בסיסי' : 'חינמי';
  const durationMinutes = getCourseDurationMinutes(course as CourseWithProgress & { duration_hours?: number });

  const descText = course.description || course.subtitle || null;

  return (
    <TouchableOpacity
      style={styles.wrapper}
      onPress={() => {
        void HapticFeedback.impactLight();
        onPress(course);
      }}
      activeOpacity={0.84}
    >
      <UICard
        variant="blur"
        padding="none"
        showGlassBorder={false}
        style={[
          styles.card,
          {
            borderWidth: ACADEMY_CARD_BORDER_WIDTH,
            borderColor: frameBorderColor,
          },
        ]}
      >
        {/* Cover image */}
        <View style={styles.cover}>
          {course.cover_url ? (
            <Image
              source={{ uri: course.cover_url }}
              style={styles.coverImg as any}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="school-outline" size={64} color={T.colors.text.tertiary} />
            </View>
          )}

          {/* Smooth fade from the cover image into the body. Uses real
             multi-stop linear gradient (transparent → glass color) instead
             of a hard dark band, so there's no visible seam between the
             image and the card body. */}
          <LinearGradient
            colors={[
              'rgba(12,18,14,0)',
              'rgba(12,18,14,0.35)',
              'rgba(12,18,14,0.7)',
            ]}
            locations={[0, 0.55, 1]}
            style={styles.coverGradient}
            pointerEvents="none"
          />

          {/* Progress ring — top-left when enrolled */}
          {isEnrolled && (
            <View style={styles.ringWrap}>
              <ProgressRing
                progress={Math.min(100, Math.max(0, progressPct))}
                size={46}
                strokeWidth={4}
                color={accentColor}
                centerLabel={`${Math.round(progressPct)}%`}
              />
            </View>
          )}
        </View>

        {/* Body */}
        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {course.title}
          </Text>

          {/* Description */}
          {descText ? (
            <Text style={styles.desc} numberOfLines={3}>
              {descText}
            </Text>
          ) : null}

          {/* Stats row */}
          <View style={styles.statsRow}>
            {totalLessons > 0 && (
              <View style={styles.stat}>
                <Ionicons name="play-circle-outline" size={14} color={accentColor} />
                <Text style={styles.statText}>{totalLessons} שיעורים</Text>
              </View>
            )}
            {course.instructor_name && (
              <View style={styles.stat}>
                <Ionicons name="person-outline" size={14} color={accentColor} />
                <Text style={styles.statText}>{course.instructor_name}</Text>
              </View>
            )}
            {durationMinutes > 0 && (
              <View style={styles.stat}>
                <Ionicons name="time-outline" size={14} color={accentColor} />
                <Text style={styles.statText}>
                  {durationMinutes >= 60
                    ? `${Math.round(durationMinutes / 60)} שע׳`
                    : `${durationMinutes} דק׳`}
                </Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Progress bar (enrolled) */}
          {isEnrolled && (
            <View style={styles.progressSection}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>
                  {completedLessons}/{totalLessons} הושלמו
                </Text>
                <Text style={[styles.progressPct, { color: accentColor }]}>
                  {Math.round(progressPct)}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(progressPct, 100)}%` as any, backgroundColor: accentColor },
                  ]}
                />
              </View>
            </View>
          )}

          {/* CTA */}
          {!isEnrolled && onEnroll ? (
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: accentColor }]}
              onPress={(e) => {
                e.stopPropagation();
                void HapticFeedback.impactLight();
                onEnroll(course);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaText}>
                {isFree ? 'הירשם בחינם' : isPaid ? 'קנה קורס' : 'הירשם'}
              </Text>
            </TouchableOpacity>
          ) : isEnrolled ? (
            <View style={styles.enrolledBadge}>
              <Ionicons name="checkmark-circle" size={17} color={accentColor} />
              <Text style={[styles.enrolledText, { color: accentColor }]}>
                נרשמת לקורס
              </Text>
            </View>
          ) : null}
        </View>
      </UICard>

      {!hideBadges && (
        <View style={styles.badgeAnchor} pointerEvents="none">
          {isPremium ? (
            <View style={[styles.badge, styles.badgePremium]}>
              <LinearGradient
                colors={[PREMIUM_GOLD, PREMIUM_GOLD_DARK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Crown size={16} color="#fff" strokeWidth={2.5} />
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: T.colors.primary.dark }]}>
              <Text style={styles.badgeText}>{freeBadgeLabel}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (T: ReturnType<typeof useDesignTokens>, coverHeight: number) =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
      paddingTop: BADGE_H / 2,
    },

    card: {
      width: '100%',
      borderRadius: ACADEMY_CARD_RADIUS,
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 20,
      elevation: 10,
    },

    /* Pill badge — half outside the top edge of the card. */
    badgeAnchor: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 20,
    },
    badge: {
      height: BADGE_H,
      minWidth: ACADEMY_BADGE_MIN_WIDTH,
      paddingHorizontal: 20,
      borderRadius: 999,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 6,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      overflow: 'hidden',
    },
    badgePremium: {
      paddingHorizontal: 0,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: 0.5,
    },

    cover: {
      width: '100%',
      height: coverHeight,
      position: 'relative',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    coverImg: { width: '100%', height: '100%' },
    coverPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    coverGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      // Tall, soft gradient — ~40% of cover height — eliminates the previous
      // hard dark line at the bottom of the image and blends image into body.
      height: Math.round(coverHeight * 0.4),
    },

    ringWrap: {
      position: 'absolute',
      top: 10,
      right: 12,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 28,
      padding: 3,
    },

    body: {
      padding: 24,
      paddingTop: 20,
      gap: 14,
    },

    title: {
      fontSize: 21,
      fontWeight: '800',
      color: T.colors.text.primary,
      textAlign: 'right',
      lineHeight: 28,
    },

    desc: {
      fontSize: 14,
      color: T.colors.text.secondary,
      textAlign: 'right',
      lineHeight: 21,
    },

    statsRow: {
      flexDirection: 'row-reverse',
      gap: 14,
      flexWrap: 'wrap',
    },
    stat: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
    statText: { fontSize: 12, color: T.colors.text.secondary },

    divider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },

    progressSection: { gap: 6 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontSize: 12, color: T.colors.text.secondary },
    progressPct: { fontSize: 12, fontWeight: '700' },
    progressTrack: {
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 2 },

    cta: {
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
    },
    ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    enrolledBadge: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
    },
    enrolledText: { fontSize: 14, fontWeight: '600' },
  });
