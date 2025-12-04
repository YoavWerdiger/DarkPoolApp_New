import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LearningService } from '../services/learningService';
import { CourseListParams, CourseWithProgress, CourseWithModules, LessonWithProgress, Enrollment, LessonProgress, ProgressUpdateRequest, SignedUrlRequest } from '../types/learning';

// Query keys
export const learningKeys = {
  all: ['learning'] as const,
  courses: (params?: CourseListParams) => [...learningKeys.all, 'courses', params] as const,
  course: (id: string) => [...learningKeys.all, 'course', id] as const,
  lesson: (id: string) => [...learningKeys.all, 'lesson', id] as const,
  enrollments: () => [...learningKeys.all, 'enrollments'] as const,
  progress: (courseId: string) => [...learningKeys.all, 'progress', courseId] as const,
};

// Hook לקבלת רשימת קורסים
export function useCourses(params?: CourseListParams) {
  return useQuery({
    queryKey: learningKeys.courses(params),
    queryFn: () => LearningService.fetchCourses(params || {}),
    staleTime: 5 * 60 * 1000, // 5 דקות
  });
}

// Hook לקבלת קורס ספציפי
export function useCourse(courseId: string) {
  return useQuery({
    queryKey: learningKeys.course(courseId),
    queryFn: () => LearningService.fetchCourse(courseId),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook לקבלת שיעור ספציפי
export function useLesson(lessonId: string) {
  return useQuery({
    queryKey: learningKeys.lesson(lessonId),
    queryFn: () => LearningService.fetchLesson(lessonId),
    enabled: !!lessonId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook להרשמה לקורס
export function useEnrollInCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseId: string) => LearningService.enrollInCourse(courseId),
    onSuccess: () => {
      // עדכון cache לאחר הרשמה מוצלחת
      queryClient.invalidateQueries({ queryKey: learningKeys.enrollments() });
      queryClient.invalidateQueries({ queryKey: learningKeys.courses() });
    },
  });
}

// Hook לקבלת התקדמות קורס
export function useCourseProgress(courseId: string) {
  return useQuery({
    queryKey: learningKeys.progress(courseId),
    queryFn: async () => {
      const course = await LearningService.fetchCourse(courseId);
      if (!course.modules) {
        return { progressPercentage: 0, lastLessonId: null };
      }
      
      const totalLessons = course.modules.reduce((sum, module) => 
        sum + (module.lessons?.length || 0), 0);
      
      const completedLessons = course.modules.reduce((sum, module) => 
        sum + (module.lessons?.filter(l => l.progress?.status === 'completed').length || 0), 0);
      
      const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
      
      const lastLesson = course.modules
        .flatMap(m => m.lessons || [])
        .find(l => l.progress?.status === 'in_progress');

  return {
        progressPercentage,
        lastLessonId: lastLesson?.id || null
      };
    },
    enabled: !!courseId,
    staleTime: 1 * 60 * 1000, // 1 דקה
  });
}

// Hook לקבלת הקורסים שלי
export function useMyEnrollments() {
  return useQuery({
    queryKey: learningKeys.enrollments(),
    queryFn: () => LearningService.getMyEnrollments(),
    staleTime: 5 * 60 * 1000,
  });
}

// Hook לשמירת התקדמות
export function useSaveProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ProgressUpdateRequest) => LearningService.saveProgress(request),
    onSuccess: (data, variables) => {
      // עדכון cache לאחר שמירת התקדמות
      if (variables.lesson_id) {
        queryClient.invalidateQueries({ queryKey: learningKeys.lesson(variables.lesson_id) });
      }
      if (variables.course_id) {
        queryClient.invalidateQueries({ queryKey: learningKeys.progress(variables.course_id) });
      }
    },
  });
}

// Hook לקבלת URL חתום
export function useGetSignedUrl() {
  return useMutation({
    mutationFn: (request: SignedUrlRequest) => LearningService.getSignedUrl(request),
  });
}