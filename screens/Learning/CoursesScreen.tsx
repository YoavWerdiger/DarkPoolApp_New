import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCourses, useEnrollInCourse } from '../../hooks/useLearning';
import { CourseCard } from '../../components/learning';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { AccessLevel, CourseWithProgress } from '../../types/learning';

export const CoursesScreen: React.FC = () => {
  console.log('🎓 CoursesScreen: Component rendering...');
  
  const navigation = useNavigation();
  const DesignTokens = useDesignTokens();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const [searchText, setSearchText] = useState('');
  const [selectedAccess, setSelectedAccess] = useState<AccessLevel | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  console.log('🎓 CoursesScreen: About to call useCourses hook...');
  
  const { data: coursesData, isLoading, error, refetch } = useCourses({
    filters: {
      search: searchText || undefined,
      access: selectedAccess ? [selectedAccess] : undefined,
    },
  });

  console.log('🎓 CoursesScreen: useCourses result:', {
    coursesData,
    isLoading,
    error: error?.message,
    hasData: !!coursesData
  });

  const enrollMutation = useEnrollInCourse();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCoursePress = useCallback((course: CourseWithProgress) => {
    navigation.navigate('CourseDetailScreen' as never, { courseId: course.id } as never);
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
    />
  ), [handleCoursePress, handleEnroll]);

  const renderAccessFilter = (access: AccessLevel, label: string) => (
    <TouchableOpacity
      key={access}
      style={[
        styles.filterChip,
        selectedAccess === access && styles.filterChipActive
      ]}
      onPress={() => setSelectedAccess(selectedAccess === access ? null : access)}
    >
      <Text style={[
        styles.filterChipText,
        selectedAccess === access && styles.filterChipTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📚</Text>
      <Text style={styles.emptyStateTitle}>לא נמצאו קורסים</Text>
      <Text style={styles.emptyStateSubtitle}>
        {searchText ? 'נסה לשנות את החיפוש' : 'אין קורסים זמינים כרגע'}
      </Text>
    </View>
  );

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>קורסים</Text>
          <TouchableOpacity
            style={styles.myLearningButton}
            onPress={() => navigation.navigate('MyLearningScreen' as never)}
          >
            <Text style={styles.myLearningButtonText}>הלמידה שלי</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="חיפוש קורסים..."
          placeholderTextColor={DesignTokens.colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          textAlign="right"
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filtersTitle}>סינון:</Text>
        <View style={styles.filtersRow}>
          {renderAccessFilter('free', 'חינם')}
          {renderAccessFilter('registration', 'הרשמה')}
          {renderAccessFilter('paid', 'בתשלום')}
        </View>
      </View>

      {/* Courses List with Gradient Background */}
      <View style={styles.listWrapper}>
        <LinearGradient
          colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBackground}
          pointerEvents="none"
        />
        <FlatList
          data={coursesData?.courses || []}
          renderItem={renderCourse}
          keyExtractor={(item) => item.id}
          style={{ backgroundColor: 'transparent' }}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={DesignTokens.colors.primary}
            />
          }
          ListEmptyComponent={!isLoading ? renderEmptyState : null}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DesignTokens.colors.background,
  },
  header: {
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingTop: DesignTokens.spacing.lg,
    paddingBottom: DesignTokens.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: DesignTokens.typography.fontSize['2xl'],
    fontWeight: DesignTokens.typography.fontWeight.bold,
    color: DesignTokens.colors.textPrimary,
    textAlign: 'right',
  },
  myLearningButton: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.lg,
  },
  myLearningButtonText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
  },
  searchContainer: {
    paddingHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
  },
  searchInput: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.borderRadius.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.textPrimary,
    borderWidth: tokens.layout.borderWidth.normal,
    borderColor: tokens.colors.border,
  },
  filtersContainer: {
    paddingHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
  },
  filtersTitle: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'right',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.lg,
    backgroundColor: tokens.colors.surface,
    borderWidth: tokens.layout.borderWidth.normal,
    borderColor: tokens.colors.border,
  },
  filterChipActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  filterChipText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
    fontWeight: tokens.typography.fontWeight.medium,
  },
  filterChipTextActive: {
    color: tokens.colors.text.primary,
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  listContainer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing['4xl'],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: tokens.spacing['5xl'],
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: tokens.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: tokens.spacing.lg,
  },
  errorTitle: {
    fontSize: tokens.typography.fontSize.lg,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.textPrimary,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },
  retryButton: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
  },
  retryButtonText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
  },
});
