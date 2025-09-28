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
        console.error('Error saving user progress:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in saveUserProgress:', error);
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
        console.error('Error getting user progress:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserProgress:', error);
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
        console.error('Error getting user course progress:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserCourseProgress:', error);
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
        console.error('Error saving user notes:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in saveUserNotes:', error);
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
        console.error('Error getting user notes:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserNotes:', error);
      return null;
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
        console.error('Error getting lesson media:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getLessonMedia:', error);
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
        console.error('Error getting lessons count:', error);
        return 0;
      }

      const totalLessons = lessons?.length || 0;
      return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    } catch (error) {
      console.error('Error in calculateUserCourseProgress:', error);
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
        console.error('Error marking lesson as completed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markLessonAsCompleted:', error);
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
        console.error('Error updating watching time:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateWatchingTime:', error);
      return false;
    }
  }
}

export const learningProgressService = new LearningProgressService();
