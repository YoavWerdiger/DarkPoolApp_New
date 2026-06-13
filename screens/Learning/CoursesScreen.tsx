import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCourses, useEnrollInCourse } from '../../hooks/useLearning';
import {
  AcademyScreenHeader,
  CourseCard,
  AcademyYouTubeCTA,
} from '../../components/learning';
import { ACADEMY_CARD_HP } from '../../components/learning/academyCardLayout';
import {
  getAcademyCourseTier,
  isNativeLearningCourse,
  DAVID_TRAINING_COURSE_ID,
} from '../../components/learning/academyCourses';
import { ScreenChrome, MAIN_SCREEN_HEADER_HP } from '../../components/ui';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { MarketsEmbedSwitcher } from '../Markets/components/MarketsEmbedSwitcher';
import type { SegmentedOption } from '../Markets/components/MarketsSegmentedControl';
import { CourseWithProgress } from '../../types/learning';
import { courseService } from '../../services/courseService';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../components/ui/UICard';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';

type TabId = 'free' | 'premium';

export const CoursesScreen: React.FC = () => {
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('free');

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const { data: coursesData, isLoading, error, refetch } = useCourses();
  const courses = coursesData?.courses ?? [];

  useEffect(() => {
    let isMounted = true;
    const initializeCourses = async () => {
      try {
        const [davidCourse, whalesCourse] = await Promise.all([
          courseService.getCourseById(DAVID_TRAINING_COURSE_ID),
          courseService.getCourseById('whales-course-1'),
        ]);
        if (!isMounted) return;

        let needsRefetch = false;
        if (!davidCourse) {
          try {
            const created = await courseService.createDavidTrainingCourse();
            if (created) needsRefetch = true;
          } catch {
            /* noop */
          }
        }
        if (!whalesCourse) {
          try {
            const created = await courseService.createWhalesCourse();
            if (created) needsRefetch = true;
          } catch {
            /* noop */
          }
        }
        if (needsRefetch && isMounted) {
          setTimeout(() => {
            if (isMounted) refetch();
          }, 1000);
        }
      } catch {
        /* noop */
      }
    };
    void initializeCourses();
    return () => {
      isMounted = false;
    };
  }, [refetch]);

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
      if (isNativeLearningCourse(course)) {
        (navigation as { navigate: (n: string, p?: object) => void }).navigate('LearningScreen', {
          courseId: course.id,
        });
      } else {
        (navigation as { navigate: (n: string, p?: object) => void }).navigate('CourseDetailScreen', {
          courseId: course.id,
        });
      }
    },
    [navigation]
  );

  const handleEnroll = useCallback(
    async (course: CourseWithProgress) => {
      if (getAcademyCourseTier(course as CourseWithProgress & { price?: number }) === 'premium') {
        legacyAlert('קורס בתשלום', 'קורס זה דורש תשלום. התכונה תהיה זמינה בקרוב.', [{ text: 'אישור' }]);
        return;
      }
      try {
        await enrollMutation.mutateAsync(course.id);
        void HapticFeedback.success();
        legacyAlert('הצלחה!', 'נרשמת בהצלחה לקורס', [{ text: 'אישור' }]);
      } catch {
        legacyAlert('שגיאה', 'לא ניתן להירשם לקורס כרגע. נסה שוב מאוחר יותר.', [{ text: 'אישור' }]);
      }
    },
    [enrollMutation]
  );

  const freeCourses = useMemo(
    () =>
      courses.filter(
        (c) => getAcademyCourseTier(c as CourseWithProgress & { price?: number }) === 'free'
      ),
    [courses]
  );
  const premiumCourses = useMemo(
    () =>
      courses.filter(
        (c) => getAcademyCourseTier(c as CourseWithProgress & { price?: number }) === 'premium'
      ),
    [courses]
  );
  const filteredCourses = activeTab === 'free' ? freeCourses : premiumCourses;
  const featuredCourse = filteredCourses[0] ?? null;

  const academySegments: SegmentedOption<TabId>[] = useMemo(
    () => [
      { id: 'free', label: `חינמי · ${freeCourses.length}` },
      { id: 'premium', label: `פרמיום · ${premiumCourses.length}` },
    ],
    [freeCourses.length, premiumCourses.length]
  );

  // Section title + total count are intentionally omitted: the free/premium
  // tabs below already show per-category counts, so duplicating "קורסים N"
  // in the header would just be visual noise.
  const listHeader = useMemo(
    () => (
      <AcademyScreenHeader
        onMenuPress={openMainDrawer}
        title="אקדמיה"
      />
    ),
    [openMainDrawer]
  );

  if (error) {
    return (
      <ScreenChrome withBrandWatermark>
        <StatusBar style="light" />
        <RNSafeAreaView style={styles.flex} edges={['top']}>
          <View style={styles.errorInner}>
            <UICard variant="blur" padding="lg" style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={48} color={DesignTokens.colors.text.danger} />
              <Text style={[styles.errorTitle, { color: DesignTokens.colors.text.primary }]}>
                שגיאה בטעינת הקורסים
              </Text>
              <Text style={[styles.errorMessage, { color: DesignTokens.colors.text.secondary }]}>
                {error.message || 'אירעה שגיאה לא צפויה'}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: DesignTokens.colors.primary.main }]}
                onPress={() => refetch()}
              >
                <Text style={[styles.retryButtonText, { color: DesignTokens.colors.text.inverse }]}>נסה שוב</Text>
              </TouchableOpacity>
            </UICard>
          </View>
        </RNSafeAreaView>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: mainTabsHeight + 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={DesignTokens.colors.primary.main}
            />
          }
        >
          {listHeader}

          {isLoading && courses.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
              <Text style={[styles.loadingHint, { color: DesignTokens.colors.text.secondary }]}>טוען קורסים…</Text>
            </View>
          ) : (
            <>
              <View style={styles.tabBarWrap}>
                <MarketsEmbedSwitcher
                  options={academySegments}
                  value={activeTab}
                  onChange={setActiveTab}
                  accessibilityGroupLabel="אקדמיה"
                />
              </View>

              <View style={styles.academyCardsSection}>
                {!featuredCourse ? (
                  <View style={styles.emptyState}>
                    <View style={[styles.emptyIconWrap, { borderColor: DesignTokens.colors.border.primary }]}>
                      <Ionicons name="library-outline" size={40} color={DesignTokens.colors.text.tertiary} />
                    </View>
                    <Text style={styles.emptyStateTitle}>
                      {activeTab === 'free' ? 'אין קורסים חינמיים' : 'אין קורסי פרמיום'}
                    </Text>
                    <Text style={styles.emptyStateSubtitle}>נסה שוב מאוחר יותר</Text>
                  </View>
                ) : (
                  <CourseCard
                    course={featuredCourse}
                    onPress={handleCoursePress}
                    onEnroll={featuredCourse.enrollment ? undefined : handleEnroll}
                  />
                )}

                <AcademyYouTubeCTA />
              </View>
            </>
          )}
        </ScrollView>
      </RNSafeAreaView>
    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    academyCardsSection: {
      width: '100%',
      paddingHorizontal: ACADEMY_CARD_HP,
      gap: tokens.spacing.md,
    },
    tabBarWrap: {
      marginBottom: tokens.spacing.md,
      marginHorizontal: MAIN_SCREEN_HEADER_HP,
    },
    // legacy courseRow kept for TS
    courseRow: {
      paddingHorizontal: MAIN_SCREEN_HEADER_HP,
    },
    loadingWrap: {
      flex: 1,
      paddingTop: tokens.spacing.md,
      alignItems: 'center',
      gap: tokens.spacing.md,
    },
    loadingHint: {
      fontSize: tokens.typography.fontSize.sm,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: tokens.spacing['4xl'],
      paddingHorizontal: tokens.spacing.lg,
    },
    emptyIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: tokens.spacing.lg,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    emptyStateTitle: {
      fontSize: tokens.typography.titleSmall.size,
      fontWeight: '700' as any,
      color: tokens.colors.text.primary,
      marginBottom: tokens.spacing.sm,
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      fontSize: tokens.typography.bodySmall.size,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    errorInner: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: tokens.spacing.lg,
    },
    errorCard: {
      alignItems: 'center',
      gap: tokens.spacing.md,
      borderRadius: tokens.borderRadius['2xl'],
    },
    errorTitle: {
      fontSize: tokens.typography.titleSmall.size,
      fontWeight: '700' as any,
      textAlign: 'center',
    },
    errorMessage: {
      fontSize: tokens.typography.bodySmall.size,
      textAlign: 'center',
      lineHeight: 22,
    },
    retryButton: {
      marginTop: tokens.spacing.sm,
      paddingHorizontal: tokens.spacing.xl,
      paddingVertical: tokens.spacing.md,
      borderRadius: tokens.borderRadius['3xl'],
    },
    retryButtonText: {
      fontSize: tokens.typography.titleXs.size,
      fontWeight: '700' as any,
    },
  });
