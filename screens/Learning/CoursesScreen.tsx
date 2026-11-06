import i18n from '../../lib/i18n';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCourses, useEnrollInCourse } from '../../hooks/useLearning';
import { useAllowAfterNavigationTransition } from '../../hooks/afterNavigationTransition';
import {
  AcademyScreenHeader,
  CourseCard,
} from '../../components/learning';
import { CourseInfoSheet } from '../../components/learning/CourseInfoSheet';
import { ACADEMY_CARD_HP } from '../../components/learning/academyCardLayout';
import {
  getAcademyCourseSubtitle,
  getAcademyCourseTier,
  isComingSoonCourse,
  isNativeLearningCourse,
  selectAcademyCatalogCourses,
  DAVID_TRAINING_COURSE_ID,
  ORACLE_COURSE_ID,
} from '../../components/learning/academyCourses';
import { MAIN_SCREEN_HEADER_HP, ScreenChrome } from '../../components/ui';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { CourseWithProgress } from '../../types/learning';
import { courseService } from '../../services/courseService';
import { prefetchAcademyCovers } from '../../services/appPrefetch';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { ACADEMY_TYPE } from '../../components/learning/academyLayout';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';

type Nav = { navigate: (n: string, p?: object) => void };

export const CoursesScreen: React.FC = () => {
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  const [refreshing, setRefreshing] = useState(false);
  const [infoCourse, setInfoCourse] = useState<CourseWithProgress | null>(null);

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const { data: coursesData, isPending, error, refetch } = useCourses();
  const courses = coursesData?.courses ?? [];
  const showInitialLoader = isPending && courses.length === 0;
  const allowHeavy = useAllowAfterNavigationTransition();

  // חימום באנרים ברגע שיש נתונים (גם מ-cache) — אחרי סיום מעבר
  useEffect(() => {
    if (!allowHeavy) return;
    if (courses.length === 0) return;
    void prefetchAcademyCovers(courses);
  }, [allowHeavy, courses]);

  // Seed רק אם חסרים קורסי ליבה ברשימה — בלי getCourseById כפול על כל mount
  useEffect(() => {
    if (!allowHeavy) return;
    if (isPending && courses.length === 0) return;
    let isMounted = true;
    const ids = new Set(courses.map((c) => c.id));
    const initializeCourses = async () => {
      try {
        let needsRefetch = false;
        if (!ids.has(DAVID_TRAINING_COURSE_ID)) {
          try {
            if (await courseService.createDavidTrainingCourse()) needsRefetch = true;
          } catch {
            /* noop */
          }
        }
        if (!ids.has('whales-course-1') && !ids.has('whales-course')) {
          try {
            if (await courseService.createWhalesCourse()) needsRefetch = true;
          } catch {
            /* noop */
          }
        }
        if (!ids.has(ORACLE_COURSE_ID)) {
          try {
            if (await courseService.createOracleCourse()) needsRefetch = true;
          } catch {
            /* noop */
          }
        }
        if (needsRefetch && isMounted) {
          void refetch();
        }
      } catch {
        /* noop */
      }
    };
    void initializeCourses();
    return () => {
      isMounted = false;
    };
  }, [allowHeavy, courses, isPending, refetch]);

  const enrollMutation = useEnrollInCourse();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
      void HapticFeedback.impactLight();
    }
  }, [refetch]);

  const handleCoursePress = useCallback(
    (course: CourseWithProgress) => {
      const nav = navigation as Nav;
      if (isComingSoonCourse(course)) {
        nav.navigate('CourseComingSoonScreen', {
          courseId: course.id,
          title: course.title,
          subtitle: getAcademyCourseSubtitle(course),
          coverUrl: course.cover_url ?? undefined,
        });
        return;
      }
      if (isNativeLearningCourse(course)) {
        nav.navigate('LearningScreen', { courseId: course.id });
      } else {
        nav.navigate('CourseDetailScreen', { courseId: course.id });
      }
    },
    [navigation]
  );

  // רשום לקורס → ישר לקורס; לא רשום (כולל האורקל) → שיט פירוט, וה-CTA בשיט נכנס לקורס
  const handleCardPress = useCallback(
    (course: CourseWithProgress) => {
      if (course.enrollment) {
        handleCoursePress(course);
        return;
      }
      setInfoCourse(course);
    },
    [handleCoursePress]
  );

  const closeInfoSheet = useCallback(() => setInfoCourse(null), []);

  const handleOpenNotes = useCallback(() => {
    void HapticFeedback.impactLight();
    (navigation as Nav).navigate('MyNotesScreen');
  }, [navigation]);

  const handleEnroll = useCallback(
    async (course: CourseWithProgress) => {
      if (getAcademyCourseTier(course as CourseWithProgress & { price?: number }) === 'premium') {
        legacyAlert(i18n.t('auto.screens__Learning__CoursesScreen.s1'), i18n.t('auto.screens__Learning__CoursesScreen.s2'), [{ text: i18n.t('auto.screens__Learning__CoursesScreen.s3') }]);
        return;
      }
      try {
        await enrollMutation.mutateAsync(course.id);
        void HapticFeedback.success();
        legacyAlert(i18n.t('auto.screens__Learning__CoursesScreen.s4'), i18n.t('auto.screens__Learning__CoursesScreen.s5'), [{ text: i18n.t('auto.screens__Learning__CoursesScreen.s3') }]);
      } catch {
        legacyAlert(i18n.t('auto.screens__Learning__CoursesScreen.s6'), i18n.t('auto.screens__Learning__CoursesScreen.s7'), [{ text: i18n.t('auto.screens__Learning__CoursesScreen.s3') }]);
      }
    },
    [enrollMutation]
  );

  const orderedCourses = useMemo(() => selectAcademyCatalogCourses(courses), [courses]);
  // רשימה אנכית: הלווייתנים ומתחתיהם האורקל (הסדר מ-selectAcademyCatalogCourses)
  const renderCourseList = (list: CourseWithProgress[]) => (
    <View style={styles.courseList}>
      {list.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          onPress={handleCardPress}
          onEnroll={course.enrollment ? undefined : handleEnroll}
        />
      ))}
    </View>
  );

  if (error) {
    return (
      <ScreenChrome>
        <RNSafeAreaView style={styles.flex} edges={['top']}>
          <View style={styles.errorInner}>
            <UICard variant="soft" padding="lg" style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={48} color={DesignTokens.colors.text.danger} />
              <Text style={[styles.errorTitle, { color: DesignTokens.colors.text.primary }]}>{i18n.t('auto.screens__Learning__CoursesScreen.s8')}</Text>
              <Text style={[styles.errorMessage, { color: DesignTokens.colors.text.secondary }]}>
                {error.message || i18n.t('auto.screens__Learning__CoursesScreen.s9')}
              </Text>
              <UIButton title={i18n.t('auto.screens__Learning__CoursesScreen.s10')} variant="primary" onPress={() => refetch()} />
            </UICard>
          </View>
        </RNSafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome>
      <RNSafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: mainTabsHeight + 28 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={DesignTokens.colors.primary.main}
            />
          }
        >
          <AcademyScreenHeader
            onMenuPress={openMainDrawer}
            title={i18n.t('auto.screens__Learning__CoursesScreen.s11')}
            // «ההערות שלי» בפינה שמול התפריט — כמו כפתורי + בשאר המסכים
            rightAccessory={
              <DayNavBlurButton
                onPress={handleOpenNotes}
                size={DRAWER_MENU_BUTTON_SIZE}
                glassIntensity="subtle"
                accessibilityLabel={i18n.t('auto.screens__Learning__CoursesScreen.s12')}
              >
                <Ionicons
                  name="journal-outline"
                  size={22}
                  color={DesignTokens.colors.text.primary}
                />
              </DayNavBlurButton>
            }
          />

          {showInitialLoader ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
              <Text style={styles.loadingHint}>{i18n.t('auto.screens__Learning__CoursesScreen.s16')}</Text>
            </View>
          ) : orderedCourses.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="library-outline"
                  size={40}
                  color={DesignTokens.colors.text.tertiary}
                />
              </View>
              <Text style={styles.emptyStateTitle}>
                {i18n.t('auto.screens__Learning__CoursesScreen.s18')}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {i18n.t('auto.screens__Learning__CoursesScreen.s20')}
              </Text>
            </View>
          ) : (
            <View style={styles.sections}>
              {renderCourseList(orderedCourses)}
            </View>
          )}
        </ScrollView>
      </RNSafeAreaView>
      <CourseInfoSheet
        course={infoCourse}
        onClose={closeInfoSheet}
        onOpenCourse={handleCoursePress}
      />
    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    sections: {
      width: '100%',
      gap: APP_LAYOUT.sectionGap,
    },
    courseList: {
      paddingHorizontal: ACADEMY_CARD_HP,
      gap: APP_LAYOUT.cardStackGap,
    },
    loadingWrap: {
      paddingTop: tokens.spacing['2xl'],
      alignItems: 'center',
      gap: tokens.spacing.md,
    },
    loadingHint: {
      ...ACADEMY_TYPE.body,
      color: tokens.colors.text.secondary,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: tokens.spacing['4xl'],
      paddingHorizontal: ACADEMY_CARD_HP,
    },
    emptyIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 1,
      borderColor: tokens.colors.border.divider,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: tokens.spacing.lg,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    emptyStateTitle: {
      ...ACADEMY_TYPE.cardTitle,
      color: tokens.colors.text.primary,
      marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      ...ACADEMY_TYPE.body,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
    },
    errorInner: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: ACADEMY_CARD_HP,
    },
    errorCard: {
      alignItems: 'center',
      gap: tokens.spacing.md,
      borderRadius: UI_CARD_RADIUS,
    },
    errorTitle: {
      ...ACADEMY_TYPE.cardTitle,
      textAlign: 'center',
    },
    errorMessage: {
      ...ACADEMY_TYPE.body,
      textAlign: 'center',
    },
  });
