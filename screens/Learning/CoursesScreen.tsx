import i18n from '../../lib/i18n';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { RefreshControl } from '../../components/ui/AppRefreshControl';
import { useNavigation } from '@react-navigation/native';
import { useCourses, useEnrollInCourse } from '../../hooks/useLearning';
import { useSubscription } from '../../hooks/useSubscription';
import { useAllowAfterNavigationTransition } from '../../hooks/afterNavigationTransition';
import {
  AcademyScreenHeader,
  CourseCard,
} from '../../components/learning';
import { CourseCardSkeleton } from '../../components/learning/CourseCard';
import { ACADEMY_CARD_HP } from '../../components/learning/academyCardLayout';
import {
  getAcademyCourseSubtitle,
  getAcademyCourseTier,
  hasAcademyCourseAccess,
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
import { AUTO_SEED_CORE_COURSES, courseService } from '../../services/courseService';
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
import { RefreshRing, useRefreshRing, chainRing } from '../../components/ui/RefreshRing';
import { fetchCourseAccess, isPurchaseCourse } from '../../services/coursePurchaseService';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { RtlHorizontalScroll } from '../../components/ui/RtlHorizontalScroll';

type Nav = { navigate: (n: string, p?: object) => void };

export const CoursesScreen: React.FC = () => {
  const refreshRing = useRefreshRing();
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  const [refreshing, setRefreshing] = useState(false);
  const { isPremium } = useSubscription();

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
    if (!AUTO_SEED_CORE_COURSES) return;
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

  // גישה לקורס ברכישה בודדת — לפי השרת (has_course_access: רכישה מאושרת / אדמין)
  const { user: authUser } = useAuth();
  const { data: purchasedAccess } = useQuery({
    queryKey: appQueryKeys.courseAccess(authUser?.id ?? 'anon', 'whales-course-1'),
    queryFn: () => fetchCourseAccess('whales-course-1'),
    enabled: !!authUser?.id,
    staleTime: 60_000,
  });

  /** CTA של הכרטיס (בלי שיט): גישה → לקורס; הלוויתנים בלי רכישה → תשלום; בקרוב → מסך בקרוב; פרימיום → מנויים */
  const handleCardPress = useCallback(
    (course: CourseWithProgress) => {
      const nav = navigation as Nav;
      if (isPurchaseCourse(course.id)) {
        if (purchasedAccess === true) handleCoursePress(course);
        else nav.navigate('CourseCheckout', { courseId: course.id });
        return;
      }
      if (isComingSoonCourse(course) || hasAcademyCourseAccess(course, isPremium)) {
        handleCoursePress(course);
        return;
      }
      (navigation as unknown as { navigate: (n: string, p?: object) => void }).navigate('Profile', {
        screen: 'SubscriptionPlans',
      });
    },
    [handleCoursePress, isPremium, purchasedAccess, navigation],
  );

  const cardCtaLabel = (course: CourseWithProgress): string => {
    if (isPurchaseCourse(course.id)) {
      return purchasedAccess === true
        ? i18n.t('auto.screens__Learning__CoursesScreen.ctaContinue')
        : i18n.t('auto.screens__Learning__CoursesScreen.buyCourse', {
            v0: Number((course as { price?: number }).price ?? 0).toLocaleString('he-IL'),
          });
    }
    if (isComingSoonCourse(course)) return i18n.t('auto.screens__Learning__CoursesScreen.ctaSoon');
    if (hasAcademyCourseAccess(course, isPremium)) return i18n.t('auto.screens__Learning__CoursesScreen.ctaContinue');
    return i18n.t('auto.screens__Learning__CoursesScreen.ctaPremium');
  };


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
  const { width: screenW } = useWindowDimensions();
  // ~85% מהמסך — רואים שיש כרטיס נוסף בצד
  const courseCardWidth = Math.round(Math.min(screenW * 0.85, 420));
  const listBottomPadding = mainTabsHeight + 28;
  // רשימה אנכית: הלווייתנים ומתחתיהם האורקל (הסדר מ-selectAcademyCatalogCourses)
  // אקדמיה: שורה אופקית של כרטיסים מורחבים (כל המלל בכרטיס, CTA בתחתית) — בלי שיט
  const renderCourseList = (list: CourseWithProgress[]) => (
    <RtlHorizontalScroll
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={courseCardWidth + 12}
      snapToAlignment="start"
      contentContainerStyle={{ paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, gap: 12, alignItems: 'stretch' }}
    >
      {list.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          width={courseCardWidth}
          fillHeight
          expanded
          ctaLabel={cardCtaLabel(course)}
          hasAccess={isPurchaseCourse(course.id) ? purchasedAccess === true : hasAcademyCourseAccess(course, isPremium)}
          onPress={handleCardPress}
        />
      ))}
    </RtlHorizontalScroll>
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
        {/* כותרת + תפריט + הערות — קבועים; רק רשימת הקורסים נמשכת לרענון */}
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
                name="book-outline"
                size={22}
                color={DesignTokens.colors.text.primary}
              />
            </DayNavBlurButton>
          }
        />
        <ScrollView onScroll={refreshRing.onScroll} onLayout={refreshRing.onLayout} scrollEventThrottle={16}
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: listBottomPadding }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl hideNative
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={DesignTokens.colors.primary.main}
            />
          }
        >
          {showInitialLoader ? (
            // כרטיסי שלד באותה רשימה ומידות כמו CourseCard — במקום ספינר וטקסט «טוען»
            <View style={styles.courseList}>
              {[0, 1, 2].map((i) => (
                <CourseCardSkeleton key={i} variant={i} />
              ))}
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
            renderCourseList(orderedCourses)
          )}
        </ScrollView>
<RefreshRing ring={refreshRing} />
      </RNSafeAreaView>

    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    courseList: {
      paddingHorizontal: ACADEMY_CARD_HP,
      gap: APP_LAYOUT.cardStackGap,
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
