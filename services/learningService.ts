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
        .from('courses')
        .select('*')
        .eq('is_active', true);

      console.log('🎓 LearningService.fetchCourses: Query object created successfully');

    console.log('🎓 LearningService.fetchCourses: Query built, applying filters...');

    // Apply filters
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,subtitle.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }

    // Note: access filter is not available in current schema
    // if (filters.access && filters.access.length > 0) {
    //   query = query.in('access', filters.access);
    // }

    // Note: language and instructor_id filters are not available in current schema
    // if (filters.language) {
    //   query = query.eq('language', filters.language);
    // }

    // if (filters.instructor_id) {
    //   query = query.eq('owner_id', filters.instructor_id);
    // }

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
      
      // Get enrollments (using user_course_progress as enrollment indicator)
      const { data: enrollments } = await supabase
        .from('user_course_progress')
        .select('DISTINCT course_id')
        .eq('user_id', user.id)
        .in('course_id', courseIds);

      // Get lessons for each course
      const lessonsPromises = courseIds.map(async (courseId) => {
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id, title, duration_minutes, order_index')
          .eq('course_id', courseId)
          .eq('is_active', true)
          .order('order_index');

        return { courseId, lessons: lessons || [] };
      });

      const lessonsResults = await Promise.all(lessonsPromises);
      const lessonsMap = new Map(lessonsResults.map(r => [r.courseId, r.lessons]));

      // Get progress for each course
      const progressPromises = courseIds.map(async (courseId) => {
        const lessonIds = lessonsMap.get(courseId)?.map(l => l.id) || [];
        if (lessonIds.length === 0) return { courseId, progress: [] };
        
        const { data: progress } = await supabase
          .from('user_course_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('course_id', courseId)
          .in('lesson_id', lessonIds);

        return { courseId, progress: progress || [] };
      });

      const progressResults = await Promise.all(progressPromises);
      const progressMap = new Map(progressResults.map(r => [r.courseId, r.progress]));

      coursesWithProgress = (data || []).map(course => {
        const enrollment = enrollments?.find(e => e.course_id === course.id);
        const lessons = lessonsMap.get(course.id) || [];
        const progress = progressMap.get(course.id) || [];
        
        const totalLessons = lessons.length;
        const completedLessons = progress.filter(p => p.is_completed).length;
        
        const courseProgress: CourseProgress = {
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          progress_percentage: totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
          last_lesson_id: progress.find(p => !p.is_completed)?.lesson_id || null,
          last_position_seconds: progress.find(p => !p.is_completed)?.current_time_seconds || 0
        };

        // יצירת owner object אם יש instructor_name
        const owner = (course as any).instructor_name ? {
          id: '',
          user_id: '',
          display_name: (course as any).instructor_name,
          bio: undefined,
          avatar_url: (course as any).instructor_avatar,
          created_at: '',
          updated_at: ''
        } : undefined;

        return {
          ...course,
          slug: course.slug || course.id, // אם אין slug, נשתמש ב-id
          access: (course as any).access || 'free', // ברירת מחדל: חינם
          language: (course as any).language || 'he',
          published: (course as any).published !== undefined ? (course as any).published : true,
          owner_id: (course as any).owner_id || '',
          preview_enabled: (course as any).preview_enabled !== undefined ? (course as any).preview_enabled : true,
          preview_lesson_count: (course as any).preview_lesson_count || 1,
          tags: (course as any).tags || [],
          owner: owner,
          modules: [],
          progress: courseProgress,
          enrollment: enrollment ? { id: '', user_id: user.id, course_id: course.id, status: 'active', created_at: '' } : undefined
        } as CourseWithProgress;
      });
    } else {
      coursesWithProgress = (data || []).map(course => {
        // יצירת owner object אם יש instructor_name
        const owner = (course as any).instructor_name ? {
          id: '',
          user_id: '',
          display_name: (course as any).instructor_name,
          bio: undefined,
          avatar_url: (course as any).instructor_avatar,
          created_at: '',
          updated_at: ''
        } : undefined;

        return {
        ...course,
          slug: course.slug || course.id, // אם אין slug, נשתמש ב-id
          access: (course as any).access || 'free', // ברירת מחדל: חינם
          language: (course as any).language || 'he',
          published: (course as any).published !== undefined ? (course as any).published : true,
          owner_id: (course as any).owner_id || '',
          preview_enabled: (course as any).preview_enabled !== undefined ? (course as any).preview_enabled : true,
          preview_lesson_count: (course as any).preview_lesson_count || 1,
          tags: (course as any).tags || [],
          owner: owner,
        modules: [],
        progress: {
          total_lessons: 0,
          completed_lessons: 0,
            progress_percentage: 0,
            last_lesson_id: null,
            last_position_seconds: 0
          },
          enrollment: undefined
        } as CourseWithProgress;
      });
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
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError) {
      throw new LearningError({
        code: 'FETCH_COURSE_ERROR',
        message: courseError.message,
        details: courseError
      });
    }

    // Get lessons for this course
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_active', true)
      .order('order_index');

    if (lessonsError) {
      throw new LearningError({
        code: 'FETCH_LESSONS_ERROR',
        message: lessonsError.message,
        details: lessonsError
      });
    }

    // Get media links for all lessons to get duration
    const lessonIds = lessonsData?.map(l => l.id) || [];
    let mediaMap = new Map();
    if (lessonIds.length > 0) {
      const { data: mediaLinks, error: mediaError } = await supabase
        .from('lesson_media_links')
        .select('*')
        .eq('course_id', courseId)
        .in('lesson_id', lessonIds)
        .eq('is_active', true);
      
      if (mediaError) {
        console.error('❌ Error fetching media links:', mediaError);
      }
      
      if (mediaLinks) {
        console.log(`📊 Fetched ${mediaLinks.length} media links for course ${courseId}`);
        mediaLinks.forEach(m => {
          console.log(`📊 Media for lesson ${m.lesson_id}: duration_minutes = ${m.duration_minutes}`);
        });
        mediaMap = new Map(mediaLinks.map(m => [m.lesson_id, m]));
      } else {
        console.log(`⚠️ No media links found for course ${courseId}`);
      }
    }

    // Get user enrollment and progress
    const { data: { user } } = await supabase.auth.getUser();
    let enrollment: Enrollment | undefined;
    let lessonsWithProgress: any[] = [];

    if (user) {
      // Check if user has progress (enrollment indicator)
      const { data: enrollmentData } = await supabase
        .from('user_course_progress')
        .select('DISTINCT course_id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .limit(1)
        .single();

      if (enrollmentData) {
        enrollment = {
          id: '',
          user_id: user.id,
          course_id: courseId,
          status: 'active',
          created_at: new Date().toISOString()
        };
      }

      // Get progress for all lessons
      if (lessonIds.length > 0) {
      const { data: progress } = await supabase
          .from('user_course_progress')
        .select('*')
        .eq('user_id', user.id)
          .eq('course_id', courseId)
        .in('lesson_id', lessonIds);

      const progressMap = new Map(progress?.map(p => [p.lesson_id, p]) || []);

        lessonsWithProgress = lessonsData?.map(lesson => {
          const media = mediaMap.get(lesson.id);
          const progressData = progressMap.get(lesson.id);
          
          // נסה לקבל duration מ-media, אם אין - נסה מהפרוגרס
          let durationMinutes = media?.duration_minutes;
          if ((!durationMinutes || durationMinutes === 0) && progressData?.total_duration_seconds) {
            durationMinutes = Math.round(progressData.total_duration_seconds / 60);
            console.log(`📊 Lesson ${lesson.id}: Using duration from progress: ${durationMinutes} minutes`);
          }
          
          console.log(`📊 Lesson ${lesson.id}: duration_minutes from media = ${media?.duration_minutes}, from progress = ${progressData?.total_duration_seconds ? Math.round(progressData.total_duration_seconds / 60) : 'N/A'}, final = ${durationMinutes}`);
          
          const formatDuration = (minutes?: number) => {
            if (!minutes || minutes === 0) return '00:00';
            const totalSeconds = minutes * 60;
            const hours = Math.floor(totalSeconds / 3600);
            const remainingSeconds = totalSeconds % 3600;
            const mins = Math.floor(remainingSeconds / 60);
            const secs = remainingSeconds % 60;
            
            if (hours > 0) {
              return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            } else {
              return `${mins}:${secs.toString().padStart(2, '0')}`;
            }
          };
          
          const formattedDuration = formatDuration(durationMinutes);
          console.log(`📊 Lesson ${lesson.id}: formatted duration = ${formattedDuration}`);
          
          return {
            ...lesson,
            duration: formattedDuration,
            duration_seconds: durationMinutes ? durationMinutes * 60 : undefined,
            progress: progressData ? {
              lesson_id: lesson.id,
              status: progressData.is_completed ? 'completed' : 'in_progress',
              last_position_seconds: progressData.current_time_seconds || 0,
              completed_at: progressData.completed_at || null
            } : undefined
          };
      }) || [];
      }
    } else {
      lessonsWithProgress = lessonsData?.map(lesson => {
        const media = mediaMap.get(lesson.id);
        const durationMinutes = media?.duration_minutes;
        
        console.log(`📊 Lesson ${lesson.id}: duration_minutes from media = ${durationMinutes}`);
        
        const formatDuration = (minutes?: number) => {
          if (!minutes || minutes === 0) return '00:00';
          const totalSeconds = minutes * 60;
          const hours = Math.floor(totalSeconds / 3600);
          const remainingSeconds = totalSeconds % 3600;
          const mins = Math.floor(remainingSeconds / 60);
          const secs = remainingSeconds % 60;
          
          if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          } else {
            return `${mins}:${secs.toString().padStart(2, '0')}`;
          }
        };
        
        const formattedDuration = formatDuration(durationMinutes);
        console.log(`📊 Lesson ${lesson.id}: formatted duration = ${formattedDuration}`);
        
        return {
          ...lesson,
          duration: formattedDuration,
          duration_seconds: durationMinutes ? durationMinutes * 60 : undefined
        };
      }) || [];
    }

    // בקורס ההכשרה לא מציגים modules - רק שיעורים ישירים
    const isDavidTrainingCourse = courseId === 'david-training-course';
    
    if (isDavidTrainingCourse) {
      // החזרת הקורס ללא modules - השיעורים ישירים
      // מחזירים modules: [] במקום undefined כדי למנוע בעיות
      return {
        ...courseData,
        modules: [],
        lessons: lessonsWithProgress,
        enrollment
      };
    }

    // Create a single module with all lessons (לקורסים אחרים)
    const module: ModuleWithLessons = {
      id: 'main',
      course_id: courseId,
      title: 'שיעורים',
      description: '',
      sort_index: 0,
      created_at: courseData.created_at,
      updated_at: courseData.updated_at,
      lessons: lessonsWithProgress
    };

    return {
      ...courseData,
      modules: [module],
      enrollment
    };
  }

  static async fetchLesson(lessonId: string): Promise<LessonWithProgress> {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
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
        .from('user_course_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .single();

      if (progressData) {
        progress = {
          lesson_id: lessonId,
          status: progressData.is_completed ? 'completed' : 'in_progress',
          last_position_seconds: progressData.current_time_seconds || 0,
          completed_at: progressData.completed_at || null
        };
      }
    }

    return {
      ...data,
      blocks: [],
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

    // Enrollment is tracked via user_course_progress
    // Create a progress entry for the first lesson if exists
    const { data: firstLesson } = await supabase
      .from('lessons')
      .select('id')
      .eq('course_id', courseId)
      .eq('is_active', true)
      .order('order_index')
      .limit(1)
      .single();

    if (firstLesson) {
    const { data, error } = await supabase
        .from('user_course_progress')
      .insert({
        user_id: user.id,
          course_id: courseId,
          lesson_id: firstLesson.id,
          progress_percentage: 0,
          is_completed: false
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

      return {
        id: '',
        user_id: user.id,
        course_id: courseId,
        status: 'active',
        created_at: new Date().toISOString()
      };
    }

    // If no lessons, just return enrollment object
    return {
      id: '',
      user_id: user.id,
      course_id: courseId,
      status: 'active',
      created_at: new Date().toISOString()
    };
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

    // Get course_id from lesson
    const { data: lesson } = await supabase
      .from('lessons')
      .select('course_id')
      .eq('id', request.lesson_id)
      .single();

    if (!lesson) {
      throw new LearningError({
        code: 'LESSON_NOT_FOUND',
        message: 'Lesson not found'
      });
    }

    const { data, error } = await supabase
      .from('user_course_progress')
      .upsert({
        user_id: user.id,
        course_id: lesson.course_id,
        lesson_id: request.lesson_id,
        progress_percentage: request.status === 'completed' ? 100 : (request.last_position_seconds || 0),
        current_time_seconds: request.last_position_seconds || 0,
        is_completed: request.status === 'completed',
        completed_at: request.status === 'completed' ? new Date().toISOString() : null,
        last_watched_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,course_id,lesson_id'
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

    return {
      lesson_id: request.lesson_id,
      status: data.is_completed ? 'completed' : 'in_progress',
      last_position_seconds: data.current_time_seconds || 0,
      completed_at: data.completed_at || null
    };
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

    // Get courses where user has progress
    const { data: progressData, error: progressError } = await supabase
      .from('user_course_progress')
      .select('DISTINCT course_id')
      .eq('user_id', user.id);

    if (progressError) {
      throw new LearningError({
        code: 'FETCH_ENROLLMENTS_ERROR',
        message: progressError.message,
        details: progressError
      });
    }

    const courseIds = progressData?.map(p => p.course_id) || [];
    
    if (courseIds.length === 0) {
      return [];
    }

    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .in('id', courseIds)
      .eq('is_active', true);

    if (coursesError) {
      throw new LearningError({
        code: 'FETCH_ENROLLMENTS_ERROR',
        message: coursesError.message,
        details: coursesError
      });
    }

    // Get progress for each enrolled course
    const progressPromises = courseIds.map(async (courseId) => {
      const { data: progress } = await supabase
        .from('user_course_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId);

      return { courseId, progress: progress || [] };
    });

    const progressResults = await Promise.all(progressPromises);
    const progressMap = new Map(progressResults.map(r => [r.courseId, r.progress]));

    // Get lessons count for each course
    const lessonsPromises = courseIds.map(async (courseId) => {
      const { count } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .eq('is_active', true);

      return { courseId, totalLessons: count || 0 };
    });

    const lessonsResults = await Promise.all(lessonsPromises);
    const lessonsMap = new Map(lessonsResults.map(r => [r.courseId, r.totalLessons]));

    return (coursesData || []).map(course => {
      const progress = progressMap.get(course.id) || [];
      const totalLessons = lessonsMap.get(course.id) || 0;
      
      const completedLessons = progress.filter(p => p.is_completed).length;
      
      const courseProgress: CourseProgress = {
        total_lessons: totalLessons,
        completed_lessons: completedLessons,
        progress_percentage: totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
        last_lesson_id: progress.find(p => !p.is_completed)?.lesson_id || null,
        last_position_seconds: progress.find(p => !p.is_completed)?.current_time_seconds || 0
      };

      return {
        ...course,
        modules: [],
        progress: courseProgress,
        enrollment: {
          id: '',
          user_id: user.id,
          course_id: course.id,
          status: 'active',
          created_at: new Date().toISOString()
        }
      } as CourseWithProgress;
    });
  }
}

