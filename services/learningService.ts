import { supabase } from '../lib/supabase';
import {
  Course,
  CourseWithProgress,
  CourseWithModules,
  CourseListParams,
  CourseListResponse,
  CourseFilters,
  LessonWithProgress,
  ModuleWithLessons,
  Enrollment,
  LessonProgress,
  QuizAttempt,
  QuizAttemptRequest,
  QuizAttemptResponse,
  ProgressUpdateRequest,
  SignedUrlRequest,
  SignedUrlResponse,
  CourseProgress,
  LearningError
} from '../types/learning';

console.log('🎓 LearningService: Imports loaded successfully');
console.log('🎓 LearningService: LearningError class:', LearningError);
console.log('🎓 LearningService: supabase client:', supabase);

export class LearningService {
  // Course queries
  static async fetchCourses(params: CourseListParams = {}): Promise<CourseListResponse> {
    console.log('🎓 LearningService.fetchCourses: Called with params:', params);
    
    const {
      page = 1,
      limit = 20,
      filters = {},
      sort_by = 'created_at',
      sort_order = 'desc'
    } = params;

    console.log('🎓 LearningService.fetchCourses: Building query...');
    
    try {
      let query = supabase
        .from('learning.courses')
        .select('*')
        .eq('published', true);

      console.log('🎓 LearningService.fetchCourses: Query object created successfully');

    console.log('🎓 LearningService.fetchCourses: Query built, applying filters...');

    // Apply filters
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,subtitle.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }

    if (filters.access && filters.access.length > 0) {
      query = query.in('access', filters.access);
    }

    if (filters.language) {
      query = query.eq('language', filters.language);
    }

    if (filters.instructor_id) {
      query = query.eq('owner_id', filters.instructor_id);
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    console.log('🎓 LearningService.fetchCourses: Executing query...');
    
    const { data, error, count } = await query;

    console.log('🎓 LearningService.fetchCourses: Query result:', {
      data: data?.length || 0,
      error: error?.message,
      count
    });

    if (error) {
      console.error('🎓 LearningService.fetchCourses: Query error:', error);
      throw new LearningError({
        code: 'FETCH_COURSES_ERROR',
        message: error.message,
        details: error
      });
    }

    // Get user enrollments and progress for each course
    console.log('🎓 LearningService.fetchCourses: Getting user...');
    const { data: { user } } = await supabase.auth.getUser();
    console.log('🎓 LearningService.fetchCourses: User:', user?.id ? 'authenticated' : 'not authenticated');
    
    let coursesWithProgress: CourseWithProgress[] = [];

    if (user) {
      console.log('🎓 LearningService.fetchCourses: User authenticated, getting enrollments and progress...');
      const courseIds = data?.map(c => c.id) || [];
      
      // Get enrollments
      const { data: enrollments } = await supabase
        .from('learning.enrollments')
        .select('*')
        .eq('user_id', user.id)
        .in('course_id', courseIds);

      // Get modules and lessons for each course
      const modulesPromises = courseIds.map(async (courseId) => {
        const { data: modules } = await supabase
          .from('learning.modules')
          .select(`
            *,
            lessons:learning.lessons(id, title, duration_seconds, is_preview, sort_index)
          `)
          .eq('course_id', courseId)
          .order('sort_index');

        return { courseId, modules: modules || [] };
      });

      const modulesResults = await Promise.all(modulesPromises);
      const modulesMap = new Map(modulesResults.map(r => [r.courseId, r.modules]));

      // Get progress for each course
      const progressPromises = courseIds.map(async (courseId) => {
        const { data: progress } = await supabase
          .from('learning.lesson_progress')
          .select('*')
          .eq('user_id', user.id)
          .in('lesson_id', modulesMap.get(courseId)?.flatMap(m => m.lessons?.map(l => l.id) || []) || []);

        return { courseId, progress: progress || [] };
      });

      const progressResults = await Promise.all(progressPromises);
      const progressMap = new Map(progressResults.map(r => [r.courseId, r.progress]));

      coursesWithProgress = (data || []).map(course => {
        const enrollment = enrollments?.find(e => e.course_id === course.id);
        const modules = modulesMap.get(course.id) || [];
        const progress = progressMap.get(course.id) || [];
        
        const totalLessons = modules.reduce((sum, module) => 
          sum + (module.lessons?.length || 0), 0);
        
        const completedLessons = progress.filter(p => p.status === 'completed').length;
        
        const courseProgress: CourseProgress = {
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          progress_percentage: totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
          last_lesson_id: progress.find(p => p.status === 'in_progress')?.lesson_id,
          last_position_seconds: progress.find(p => p.status === 'in_progress')?.last_position_seconds
        };

        return {
          ...course,
          modules,
          progress: courseProgress,
          enrollment
        } as CourseWithProgress;
      });
    } else {
      coursesWithProgress = (data || []).map(course => ({
        ...course,
        modules: [],
        progress: {
          total_lessons: 0,
          completed_lessons: 0,
          progress_percentage: 0
        }
      } as CourseWithProgress));
    }

    const result = {
      courses: coursesWithProgress,
      total: count || 0,
      page,
      limit,
      has_more: (count || 0) > page * limit
    };

    console.log('🎓 LearningService.fetchCourses: Final result:', {
      coursesCount: result.courses.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.has_more
    });

    return result;
    } catch (error) {
      console.error('🎓 LearningService.fetchCourses: Unexpected error:', error);
      throw new LearningError({
        code: 'UNEXPECTED_ERROR',
        message: error?.message || 'Unexpected error in fetchCourses',
        details: error
      });
    }
  }

  static async fetchCourse(courseId: string): Promise<CourseWithModules> {
    const { data, error } = await supabase
      .from('learning.courses')
      .select(`
        *,
        owner:learning.instructors(*),
        modules:learning.modules(
          *,
          lessons:learning.lessons(
            *,
            blocks:learning.lesson_blocks(
              *,
              quiz_questions(*)
            )
          )
        )
      `)
      .eq('id', courseId)
      .single();

    if (error) {
      throw new LearningError({
        code: 'FETCH_COURSE_ERROR',
        message: error.message,
        details: error
      });
    }

    // Get user enrollment and progress
    const { data: { user } } = await supabase.auth.getUser();
    let enrollment: Enrollment | undefined;
    let modulesWithProgress: ModuleWithLessons[] = [];

    if (user) {
      // Get enrollment
      const { data: enrollmentData } = await supabase
        .from('learning.enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single();

      enrollment = enrollmentData;

      // Get progress for all lessons
      const lessonIds = data.modules?.flatMap(m => m.lessons?.map(l => l.id) || []) || [];
      
      const { data: progress } = await supabase
        .from('learning.lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('lesson_id', lessonIds);

      const progressMap = new Map(progress?.map(p => [p.lesson_id, p]) || []);

      modulesWithProgress = data.modules?.map(module => ({
        ...module,
        lessons: module.lessons?.map(lesson => ({
          ...lesson,
          progress: progressMap.get(lesson.id)
        })) || []
      })) || [];
    } else {
      modulesWithProgress = data.modules || [];
    }

    return {
      ...data,
      modules: modulesWithProgress,
      enrollment
    };
  }

  static async fetchLesson(lessonId: string): Promise<LessonWithProgress> {
    const { data, error } = await supabase
      .from('learning.lessons')
      .select(`
        *,
        blocks:learning.lesson_blocks(
          *,
          quiz_questions(*)
        )
      `)
      .eq('id', lessonId)
      .single();

    if (error) {
      throw new LearningError({
        code: 'FETCH_LESSON_ERROR',
        message: error.message,
        details: error
      });
    }

    // Get user progress
    const { data: { user } } = await supabase.auth.getUser();
    let progress: LessonProgress | undefined;

    if (user) {
      const { data: progressData } = await supabase
        .from('learning.lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .single();

      progress = progressData;
    }

    return {
      ...data,
      progress
    };
  }

  // Enrollment mutations
  static async enrollInCourse(courseId: string): Promise<Enrollment> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new LearningError({
        code: 'UNAUTHORIZED',
        message: 'User must be authenticated to enroll'
      });
    }

    const { data, error } = await supabase
      .from('learning.enrollments')
      .insert({
        user_id: user.id,
        course_id: courseId
      })
      .select()
      .single();

    if (error) {
      throw new LearningError({
        code: 'ENROLLMENT_ERROR',
        message: error.message,
        details: error
      });
    }

    return data;
  }

  // Progress mutations
  static async saveProgress(request: ProgressUpdateRequest): Promise<LessonProgress> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new LearningError({
        code: 'UNAUTHORIZED',
        message: 'User must be authenticated to save progress'
      });
    }

    const { data, error } = await supabase
      .from('learning.lesson_progress')
      .upsert({
        user_id: user.id,
        lesson_id: request.lesson_id,
        status: request.status,
        last_position_seconds: request.last_position_seconds || 0,
        completed_at: request.status === 'completed' ? new Date().toISOString() : null
      })
      .select()
      .single();

    if (error) {
      throw new LearningError({
        code: 'SAVE_PROGRESS_ERROR',
        message: error.message,
        details: error
      });
    }

    return data;
  }

  // Quiz mutations
  static async recordQuizAttempt(request: QuizAttemptRequest): Promise<QuizAttempt> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new LearningError({
        code: 'UNAUTHORIZED',
        message: 'User must be authenticated to record quiz attempt'
      });
    }

    const { data, error } = await supabase
      .from('learning.quiz_attempts')
      .insert({
        user_id: user.id,
        block_id: request.block_id,
        answers: request.answers
      })
      .select()
      .single();

    if (error) {
      throw new LearningError({
        code: 'QUIZ_ATTEMPT_ERROR',
        message: error.message,
        details: error
      });
    }

    return data;
  }

  static async finalizeQuiz(attemptId: string): Promise<QuizAttemptResponse> {
    const { data, error } = await supabase.functions.invoke('finalize-quiz', {
      body: { attemptId }
    });

    if (error) {
      throw new LearningError({
        code: 'FINALIZE_QUIZ_ERROR',
        message: error.message,
        details: error
      });
    }

    return data;
  }

  // Media access
  static async getSignedUrl(request: SignedUrlRequest): Promise<SignedUrlResponse> {
    const { data, error } = await supabase.functions.invoke('get-signed-media-url', {
      body: request
    });

    if (error) {
      throw new LearningError({
        code: 'SIGNED_URL_ERROR',
        message: error.message,
        details: error
      });
    }

    return data;
  }

  // User data queries
  static async getMyEnrollments(): Promise<CourseWithProgress[]> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('learning.enrollments')
      .select(`
        *,
        course:learning.courses(
          *,
          owner:learning.instructors(*),
          modules:learning.modules(
            id,
            lessons:learning.lessons(id)
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (error) {
      throw new LearningError({
        code: 'FETCH_ENROLLMENTS_ERROR',
        message: error.message,
        details: error
      });
    }

    // Get progress for each enrolled course
    const courseIds = data?.map(e => e.course_id) || [];
    const progressPromises = courseIds.map(async (courseId) => {
      const { data: progress } = await supabase
        .from('learning.lesson_progress')
        .select(`
          lesson_id,
          status,
          completed_at,
          lesson:learning.lessons!inner(
            id,
            module:learning.modules!inner(
              course_id
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('lesson.module.course_id', courseId);

      return { courseId, progress: progress || [] };
    });

    const progressResults = await Promise.all(progressPromises);
    const progressMap = new Map(progressResults.map(r => [r.courseId, r.progress]));

    return (data || []).map(enrollment => {
      const course = enrollment.course;
      const progress = progressMap.get(course.id) || [];
      
      const totalLessons = course.modules?.reduce((sum, module) => 
        sum + (module.lessons?.length || 0), 0) || 0;
      
      const completedLessons = progress.filter(p => p.status === 'completed').length;
      
      const courseProgress: CourseProgress = {
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        progress_percentage: totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
        last_lesson_id: progress.find(p => p.status === 'in_progress')?.lesson_id,
        last_position_seconds: progress.find(p => p.status === 'in_progress')?.last_position_seconds
      };

      return {
        ...course,
        progress: courseProgress,
        enrollment
      } as CourseWithProgress;
    });
  }
}

