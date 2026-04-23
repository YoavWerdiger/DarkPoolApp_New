import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCourses, useEnrollInCourse } from '../../hooks/useLearning';
import { AcademyScreenHeader, CourseCard } from '../../components/learning';
import { ScreenChrome, MAIN_SCREEN_HEADER_HP } from '../../components/ui';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { CourseWithProgress } from '../../types/learning';
import { courseService } from '../../services/courseService';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../components/ui/UICard';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';

export const CoursesScreen: React.FC = () => {
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  const [refreshing, setRefreshing] = useState(false);

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
  const courseCount = courses.length;

  useEffect(() => {
    let isMounted = true;
    const initializeCourses = async () => {
      try {
        const davidCourse = await courseService.getCourseById('david-training-course');
        if (!isMounted) return;
        if (!davidCourse) {
          try {
            const created = await courseService.createDavidTrainingCourse();
            if (created && isMounted) {
              setTimeout(() => {
                if (isMounted) refetch();
              }, 1000);
            }
          } catch {
            /* noop */
          }
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
      if (
        course.slug === 'whales-course' ||
        course.id === 'whales-course-1' ||
        course.title === 'קורס הלוויתנים' ||
        course.id === 'david-training-course' ||
        course.title === 'הכשרה של דוד אריאל'
      ) {
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
      if (course.access === 'paid') {
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

  const renderCourse = useCallback(
    ({ item }: { item: CourseWithProgress }) => (
      <View style={styles.courseRow}>
        <CourseCard
          course={item}
          onPress={handleCoursePress}
          onEnroll={item.enrollment ? undefined : handleEnroll}
          hideBadges={true}
        />
      </View>
    ),
    [handleCoursePress, handleEnroll, styles]
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, { borderColor: DesignTokens.colors.border.primary }]}>
        <Ionicons name="library-outline" size={40} color={DesignTokens.colors.text.tertiary} />
      </View>
      <Text style={styles.emptyStateTitle}>לא נמצאו קורסים</Text>
      <Text style={styles.emptyStateSubtitle}>משוך לרענון או נסה שוב מאוחר יותר</Text>
    </View>
  );

  const listHeader = useMemo(
    () => (
      <AcademyScreenHeader
        onMenuPress={openMainDrawer}
        title="אקדמיה"
        sectionTitle="קורסים זמינים"
        sectionCount={courseCount}
        sectionCountPending={isLoading}
      />
    ),
    [openMainDrawer, isLoading, courseCount]
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
        <View style={[styles.flex, { marginBottom: mainTabsHeight - 12 }]}>
          {isLoading && courses.length === 0 ? (
            <View style={styles.loadingWrap}>
              {listHeader}
              <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
              <Text style={[styles.loadingHint, { color: DesignTokens.colors.text.secondary }]}>טוען קורסים…</Text>
            </View>
          ) : (
            <FlatList
              data={courses}
              renderItem={renderCourse}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={DesignTokens.colors.primary.main}
                />
              }
              ListEmptyComponent={!isLoading ? renderEmptyState : null}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={listHeader}
            />
          )}
        </View>
      </RNSafeAreaView>
    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    listContainer: {
      paddingBottom: tokens.spacing['3xl'],
    },
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
