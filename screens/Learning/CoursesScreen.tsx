import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCourses, useEnrollInCourse } from '../../hooks/useLearning';
import { CourseCard } from '../../components/learning';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { CourseWithProgress } from '../../types/learning';
import { courseService } from '../../services/courseService';
import { useEffect } from 'react';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { ScreenGradientBackground } from '../../components/VideoBackground';
import UICard from '../../components/ui/UICard';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

export const CoursesScreen: React.FC = () => {
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const mainTabsHeight = useMainTabsHeight();
  const [refreshing, setRefreshing] = useState(false);

  const { data: coursesData, isLoading, error, refetch } = useCourses();

  // וידוא שהקורסים נוצרו כשהמסך נטען (רק פעם אחת)
  useEffect(() => {
    let isMounted = true;
    const initializeCourses = async () => {
      try {
        // בדיקה אם קורס הכשרה של דוד קיים
        const davidCourse = await courseService.getCourseById('david-training-course');
        
        if (!isMounted) return;
        
        if (!davidCourse) {
          // ננסה ליצור אותו דרך ה-API (אם יש הרשאות)
          try {
            const created = await courseService.createDavidTrainingCourse();
            if (created && isMounted) {
              setTimeout(() => {
                if (isMounted) refetch();
              }, 1000);
            }
          } catch (createError: any) {
          }
        }
      } catch (error) {
      }
    };

    initializeCourses();
    
    return () => {
      isMounted = false;
    };
  }, [refetch]); // רק פעם אחת, לא תלוי ב-refetch

  const enrollMutation = useEnrollInCourse();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCoursePress = useCallback((course: CourseWithProgress) => {
    // אם זה קורס הלוויתנים או קורס דוד איראל, נוביל ל-LearningScreen
    if (course.slug === 'whales-course' || course.id === 'whales-course-1' || course.title === 'קורס הלוויתנים' ||
        course.id === 'david-training-course' || course.title === 'הכשרה של דוד אריאל') {
      (navigation as any).navigate('LearningScreen', { courseId: course.id });
    } else {
      // אחרת, נוביל ל-CourseDetailScreen
      (navigation as any).navigate('CourseDetailScreen', { courseId: course.id });
    }
  }, [navigation]);

  const handleEnroll = useCallback(async (course: CourseWithProgress) => {
    if (course.access === 'paid') {
      Alert.alert(
        'קורס בתשלום',
        'קורס זה דורש תשלום. התכונה תהיה זמינה בקרוב.',
        [{ text: 'אישור' }]
      );
      return;
    }

    try {
      await enrollMutation.mutateAsync(course.id);
      Alert.alert(
        'הצלחה!',
        'נרשמת בהצלחה לקורס',
        [{ text: 'אישור' }]
      );
    } catch (error) {
      Alert.alert(
        'שגיאה',
        'לא ניתן להירשם לקורס כרגע. נסה שוב מאוחר יותר.',
        [{ text: 'אישור' }]
      );
    }
  }, [enrollMutation]);

  const renderCourse = useCallback(({ item }: { item: CourseWithProgress }) => (
    <CourseCard
      course={item}
      onPress={handleCoursePress}
      onEnroll={item.enrollment ? undefined : handleEnroll}
      hideBadges={true}
    />
  ), [handleCoursePress, handleEnroll]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📚</Text>
      <Text style={styles.emptyStateTitle}>לא נמצאו קורסים</Text>
      <Text style={styles.emptyStateSubtitle}>
        אין קורסים זמינים כרגע
      </Text>
    </View>
  );

  const renderHero = useCallback(() => (
    // ה-FlatList כבר נותן paddingHorizontal דרך listContainer,
    // לכן כאן נותנים רק paddingTop כדי שהכרטיס יהיה בדיוק ברוחב כרטיסי הקורסים
    <View style={{ paddingTop: DesignTokens.spacing.lg }}>
      <UICard
        variant="blur"
        padding="lg"
        style={{ marginBottom: DesignTokens.spacing.lg, width: '100%' }}
      >
        <View style={{ gap: DesignTokens.spacing.md }}>
          <Text style={styles.heroTitle}>האקדמיה של DarkPool</Text>
          <Text style={styles.heroSubtitle}>
            מקום אחד לכל מה שצריך לדעת על מסחר והשקעות
          </Text>
        </View>
      </UICard>
    </View>
  ), [DesignTokens, styles]);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>שגיאה בטעינת הקורסים</Text>
        <Text style={styles.errorMessage}>
          {error.message || 'אירעה שגיאה לא צפויה'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>נסה שוב</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenGradientBackground style={StyleSheet.absoluteFill} />
      <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
          <FlatList
            data={coursesData?.courses || []}
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
          ListHeaderComponent={renderHero}
          />
        </View>
      </RNSafeAreaView>
    </View>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  listContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing['3xl'],
  },
  heroTitle: {
    fontSize: tokens.typography.displaySmall.size,
    fontWeight: tokens.typography.displaySmall.weight as any,
    letterSpacing: tokens.typography.displaySmall.letterSpacing,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    marginBottom: 0,
  },
  heroSubtitle: {
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    lineHeight: tokens.typography.body.size * tokens.typography.body.lineHeight,
    marginBottom: tokens.spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: tokens.spacing['5xl'],
  },
  emptyStateIcon: {
    fontSize: tokens.typography.fontSize['4xl'],
    marginBottom: tokens.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.titleSmall.weight as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
  },
  errorIcon: {
    fontSize: tokens.typography.fontSize['4xl'],
    marginBottom: tokens.spacing.lg,
  },
  errorTitle: {
    fontSize: tokens.typography.titleSmall.size,
    fontWeight: tokens.typography.titleSmall.weight as any,
    letterSpacing: tokens.typography.titleSmall.letterSpacing,
    color: tokens.colors.text.primary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: tokens.typography.bodySmall.size,
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },
  retryButton: {
    backgroundColor: tokens.colors.primary.main,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius['3xl'],
  },
  retryButtonText: {
    fontSize: tokens.typography.titleXs.size,
    fontWeight: tokens.typography.titleXs.weight as any,
    color: tokens.colors.text.primary,
  },
});
