import { supabase } from './supabase';

export interface UserProgress {
  id?: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  progress_percentage: number;
  current_time_seconds: number;
  total_duration_seconds: number;
  is_completed: boolean;
  completed_at?: string;
  last_watched_at?: string;
}

export interface UserNotes {
  id?: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  notes_content: string;
  created_at?: string;
  updated_at?: string;
}

export interface LessonMedia {
  id?: string;
  course_id: string;
  lesson_id: string;
  vimeo_id: string;
  vimeo_url: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  is_active: boolean;
}

class LearningProgressService {
  // שמירת התקדמות משתמש
  async saveUserProgress(progress: Omit<UserProgress, 'id' | 'created_at' | 'updated_at'>): Promise<UserProgress | null> {
    try {
      const { data, error } = await supabase
        .from('user_course_progress')
        .upsert({
          user_id: progress.user_id,
          course_id: progress.course_id,
          lesson_id: progress.lesson_id,
          progress_percentage: progress.progress_percentage,
          current_time_seconds: progress.current_time_seconds,
          total_duration_seconds: progress.total_duration_seconds,
          is_completed: progress.is_completed,
          completed_at: progress.completed_at,
          last_watched_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,course_id,lesson_id'
        })
        .select()
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // קבלת התקדמות משתמש לשיעור ספציפי
  async getUserProgress(userId: string, courseId: string, lessonId: string): Promise<UserProgress | null> {
    try {
      const { data, error } = await supabase
        .from('user_course_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('lesson_id', lessonId)
        .single();

      if (error) {
        // אם אין נתונים, מחזירים null במקום להדפיס שגיאה
        if (error.code === 'PGRST116') {
          return null;
        }
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // קבלת כל ההתקדמות של משתמש בקורס
  async getUserCourseProgress(userId: string, courseId: string): Promise<UserProgress[]> {
    try {
      const { data, error } = await supabase
        .from('user_course_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .order('lesson_id');

      if (error) {
        return [];
      }

      return data || [];
    } catch (error) {
      return [];
    }
  }

  // שמירת הערות משתמש
  async saveUserNotes(notes: Omit<UserNotes, 'id' | 'created_at' | 'updated_at'>): Promise<UserNotes | null> {
    try {
      const { data, error } = await supabase
        .from('user_lesson_notes')
        .upsert({
          user_id: notes.user_id,
          course_id: notes.course_id,
          lesson_id: notes.lesson_id,
          notes_content: notes.notes_content,
        }, {
          onConflict: 'user_id,course_id,lesson_id'
        })
        .select()
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // קבלת הערות משתמש לשיעור ספציפי
  async getUserNotes(userId: string, courseId: string, lessonId: string): Promise<UserNotes | null> {
    try {
      const { data, error } = await supabase
        .from('user_lesson_notes')
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .eq('lesson_id', lessonId)
        .single();

      if (error) {
        // אם אין נתונים, מחזירים null במקום להדפיס שגיאה
        if (error.code === 'PGRST116') {
          return null;
        }
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // קבלת כל ההערות של משתמש
  async getAllUserNotes(userId: string): Promise<(UserNotes & { course_title?: string; lesson_title?: string; thumbnail_url?: string })[]> {
    try {
      const { data: notes, error } = await supabase
        .from('user_lesson_notes')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        return [];
      }

      if (!notes || notes.length === 0) {
        return [];
      }

      // שליפת שמות הקורסים והשיעורים
      const courseIds = [...new Set(notes.map(n => n.course_id))];
      const lessonIds = [...new Set(notes.map(n => n.lesson_id))];

      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, cover_url')
        .in('id', courseIds);

      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, title')
        .in('id', lessonIds);

      // שליפת thumbnails מה-lesson_media_links
      const { data: mediaLinks } = await supabase
        .from('lesson_media_links')
        .select('course_id, lesson_id, thumbnail_url, vimeo_id, youtube_id')
        .in('course_id', courseIds)
        .in('lesson_id', lessonIds)
        .eq('is_active', true);

      const coursesMap = new Map(courses?.map(c => [c.id, { title: c.title, cover_url: c.cover_url }]) || []);
      const lessonsMap = new Map(lessons?.map(l => [l.id, l.title]) || []);
      
      // יצירת מפה של thumbnails
      const thumbnailsMap = new Map<string, string>();
      mediaLinks?.forEach((media) => {
        const key = `${media.course_id}-${media.lesson_id}`;
        if (media.thumbnail_url) {
          thumbnailsMap.set(key, media.thumbnail_url);
        } else if (media.vimeo_id) {
          thumbnailsMap.set(key, `https://vumbnail.com/${media.vimeo_id}.jpg`);
        } else if (media.youtube_id) {
          thumbnailsMap.set(key, `https://img.youtube.com/vi/${media.youtube_id}/maxresdefault.jpg`);
        }
      });

      return notes.map((note) => {
        const thumbnailKey = `${note.course_id}-${note.lesson_id}`;
        const courseData = coursesMap.get(note.course_id);
        // עדיפות: thumbnail של השיעור > cover_url של הקורס
        const thumbnailUrl = thumbnailsMap.get(thumbnailKey) || courseData?.cover_url;
        return {
          ...note,
          course_title: courseData?.title,
          lesson_title: lessonsMap.get(note.lesson_id),
          thumbnail_url: thumbnailUrl,
        };
      });
    } catch (error) {
      return [];
    }
  }

  // קבלת סטטיסטיקות למידה של משתמש
  async getUserLearningStats(userId: string): Promise<{
    totalCourses: number;
    enrolledCourses: number;
    completedLessons: number;
    totalLessons: number;
    totalNotes: number;
    totalWatchTime: number; // בדקות
  }> {
    try {
      // מספר קורסים שהמשתמש נרשם אליהם
      const { count: enrolledCount } = await supabase
        .from('user_course_progress')
        .select('DISTINCT course_id', { count: 'exact', head: true })
        .eq('user_id', userId);

      // מספר שיעורים שהושלמו
      const { count: completedCount } = await supabase
        .from('user_course_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_completed', true);

      // מספר הערות
      const { count: notesCount } = await supabase
        .from('user_lesson_notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // זמן צפייה כולל
      const { data: progressData } = await supabase
        .from('user_course_progress')
        .select('current_time_seconds')
        .eq('user_id', userId);

      const totalWatchTime = progressData?.reduce((sum, p) => sum + (p.current_time_seconds || 0), 0) || 0;

      // מספר שיעורים כולל בקורסים שהמשתמש נרשם אליהם
      const { data: enrolledCourses } = await supabase
        .from('user_course_progress')
        .select('DISTINCT course_id')
        .eq('user_id', userId);

      const courseIds = enrolledCourses?.map(c => c.course_id) || [];
      let totalLessons = 0;
      
      if (courseIds.length > 0) {
        const { count } = await supabase
          .from('lessons')
          .select('*', { count: 'exact', head: true })
          .in('course_id', courseIds)
          .eq('is_active', true);
        
        totalLessons = count || 0;
      }

      // מספר קורסים זמינים כולל
      const { count: totalCoursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      return {
        totalCourses: totalCoursesCount || 0,
        enrolledCourses: enrolledCount || 0,
        completedLessons: completedCount || 0,
        totalLessons,
        totalNotes: notesCount || 0,
        totalWatchTime: Math.round(totalWatchTime / 60), // המרה לדקות
      };
    } catch (error) {
      return {
        totalCourses: 0,
        enrolledCourses: 0,
        completedLessons: 0,
        totalLessons: 0,
        totalNotes: 0,
        totalWatchTime: 0,
      };
    }
  }

  // קבלת קישורי מדיה לשיעור
  async getLessonMedia(courseId: string, lessonId: string): Promise<LessonMedia | null> {
    try {
      const { data, error } = await supabase
        .from('lesson_media_links')
        .select('*')
        .eq('course_id', courseId)
        .eq('lesson_id', lessonId)
        .eq('is_active', true)
        .single();

      if (error) {
        // אם אין נתונים, מחזירים null במקום להדפיס שגיאה
        if (error.code === 'PGRST116') {
          return null;
        }
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  // חישוב התקדמות כללית של משתמש בקורס
  async calculateUserCourseProgress(userId: string, courseId: string): Promise<number> {
    try {
      const progress = await this.getUserCourseProgress(userId, courseId);
      const completedLessons = progress.filter(p => p.is_completed).length;
      
      // נצטרך לקבל את מספר השיעורים הכולל מהטבלת lessons
      const { data: lessons, error } = await supabase
        .from('lessons')
        .select('id')
        .eq('course_id', courseId)
        .eq('is_active', true);

      if (error) {
        return 0;
      }

      const totalLessons = lessons?.length || 0;
      return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    } catch (error) {
      return 0;
    }
  }

  // סימון שיעור כהושלם
  async markLessonAsCompleted(userId: string, courseId: string, lessonId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_course_progress')
        .upsert({
          user_id: userId,
          course_id: courseId,
          lesson_id: lessonId,
          progress_percentage: 100,
          is_completed: true,
          completed_at: new Date().toISOString(),
          last_watched_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,course_id,lesson_id'
        });

      if (error) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // עדכון זמן צפייה נוכחי
  async updateWatchingTime(userId: string, courseId: string, lessonId: string, currentTime: number, totalTime: number): Promise<boolean> {
    try {
      const progressPercentage = totalTime > 0 ? Math.round((currentTime / totalTime) * 100) : 0;
      
      const { error } = await supabase
        .from('user_course_progress')
        .upsert({
          user_id: userId,
          course_id: courseId,
          lesson_id: lessonId,
          progress_percentage: progressPercentage,
          current_time_seconds: Math.round(currentTime),
          total_duration_seconds: Math.round(totalTime),
          is_completed: progressPercentage >= 95, // נחשב הושלם אם צפו ב-95% או יותר
          completed_at: progressPercentage >= 95 ? new Date().toISOString() : null,
          last_watched_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,course_id,lesson_id'
        });

      if (error) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}

export const learningProgressService = new LearningProgressService();
