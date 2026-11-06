import { ROOT_DIR } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
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
  appCardSubtitleStyle,
  appCardTitleStyle,
} from '../ui/appType';
import {
  getAcademyCourseAccentColor,
  getAcademyCourseSubtitle,
  getCourseLessonStats,
} from './academyCourses';

/** @deprecated השתמשו ב־academyCardWidth — נשמר לתאימות */
export const CARD_WIDTH = academyCardWidth(Dimensions.get('window').width);

interface CourseCardProps {
  course: CourseWithProgress;
  onPress: (course: CourseWithProgress) => void;
  onEnroll?: (course: CourseWithProgress) => void;
  /** רוחב קבוע לכרטיס אופקי; אם לא מועבר — רוחב מלא */
  width?: number;
  /** בשורה אופקית: למתוח לגובה הכרטיס הגבוה בשורה (כל הכרטיסים באותו אורך, CTA בתחתית) */
  fillHeight?: boolean;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onPress,
  width,
  fillHeight = false,
}) => {
  const T = useDesignTokens();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = width ?? academyCardWidth(screenWidth);
  // באנרי הקורסים 16:9 — אותו יחס בדיוק, בלי חיתוך
  const coverHeight = Math.round((cardWidth * 9) / 16);
  const styles = React.useMemo(
    () => createStyles(T, coverHeight, cardWidth),
    [T, coverHeight, cardWidth]
  );

  const isEnrolled = !!course.enrollment;
  const { progressPct } = getCourseLessonStats(course);
  const subtitle = getAcademyCourseSubtitle(course);
  const accent = getAcademyCourseAccentColor(
    course as CourseWithProgress & { price?: number },
    T.colors.primary.main
  );

  // רשום → המשך למידה; לא רשום → פירוט הקורס בשיט (המלל המלא עבר לשם)
  const ctaLabel = isEnrolled
    ? i18n.t('auto.components__learning__CourseCard.s2')
    : i18n.t('auto.components__learning__CourseCard.s1');

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
        </View>

        {/* חלק תחתון קומפקטי — שם ותת-כותרת לצד כפתור קטן, ופס התקדמות מתחת */}
        <View style={[styles.body, fillHeight && styles.fillFlex]}>
          <View style={styles.headerRow}>
            <View pointerEvents="none" style={styles.ctaSlot}>
              <UIButton title={ctaLabel} variant="primary" size="sm" haptic={false} />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.title} numberOfLines={1}>
                {course.title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>

          {/* התקדמות בכל כרטיס — 0 למי שעוד לא התחיל */}
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
      direction: ROOT_DIR,
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
      direction: ROOT_DIR,
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
    body: {
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingTop: APP_LAYOUT.cardPadding,
      paddingBottom: APP_LAYOUT.cardPadding,
      gap: APP_LAYOUT.cardTitleToBodyGap,
      direction: ROOT_DIR,
      alignItems: 'stretch',
      width: '100%',
    },
    // בשורש ROOT_DIR: row = כפתור בצד הנגדי לטקסט (שמאל בעברית, ימין באנגלית)
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      width: '100%',
    },
    titleBlock: {
      flex: 1,
      minWidth: 0,
      alignItems: 'stretch',
    },
    title: {
      ...appCardTitleStyle,
      color: T.colors.text.primary,
    },
    subtitle: {
      ...appCardSubtitleStyle,
      // appCardSubtitleStyle נושא צבע קבוע של מצב כהה — לפי ה-theme
      color: T.colors.text.secondary,
    },
    progressTrack: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      backgroundColor: T.colors.border.divider,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      alignSelf: 'flex-end',
    },
    ctaSlot: {
      flexShrink: 0,
    },
  });
