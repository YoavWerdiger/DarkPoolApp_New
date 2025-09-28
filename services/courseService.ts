import { supabase } from './supabase';

export interface Course {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  cover_url?: string;
  instructor_name: string;
  instructor_avatar?: string;
  duration_hours: number;
  level: string;
  rating: number;
  students_count: number;
  price: number;
  original_price?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  order_index: number;
  is_completed: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

class CourseService {
  // קבלת כל הקורסים
  async getAllCourses(): Promise<Course[]> {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting courses:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllCourses:', error);
      return [];
    }
  }

  // קבלת קורס ספציפי
  async getCourseById(courseId: string): Promise<Course | null> {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .eq('is_active', true)
        .single();

      if (error) {
        // אם אין נתונים, מחזירים null במקום להדפיס שגיאה
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error getting course:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getCourseById:', error);
      return null;
    }
  }

  // קבלת שיעורים של קורס
  async getCourseLessons(courseId: string): Promise<Lesson[]> {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .order('order_index');

      if (error) {
        console.error('Error getting course lessons:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getCourseLessons:', error);
      return [];
    }
  }

  // יצירת קורס חדש
  async createCourse(course: Omit<Course, 'id' | 'created_at' | 'updated_at'>): Promise<Course | null> {
    try {
      const { data, error } = await supabase
        .from('courses')
        .insert(course)
        .select()
        .single();

      if (error) {
        console.error('Error creating course:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createCourse:', error);
      return null;
    }
  }

  // יצירת שיעור חדש
  async createLesson(lesson: Omit<Lesson, 'id' | 'created_at' | 'updated_at'>): Promise<Lesson | null> {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .insert(lesson)
        .select()
        .single();

      if (error) {
        console.error('Error creating lesson:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createLesson:', error);
      return null;
    }
  }

  // עדכון קורס
  async updateCourse(courseId: string, updates: Partial<Course>): Promise<Course | null> {
    try {
      const { data, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', courseId)
        .select()
        .single();

      if (error) {
        console.error('Error updating course:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateCourse:', error);
      return null;
    }
  }

  // עדכון שיעור
  async updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<Lesson | null> {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .update(updates)
        .eq('id', lessonId)
        .select()
        .single();

      if (error) {
        console.error('Error updating lesson:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateLesson:', error);
      return null;
    }
  }

  // מחיקת קורס (soft delete)
  async deleteCourse(courseId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_active: false })
        .eq('id', courseId);

      if (error) {
        console.error('Error deleting course:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteCourse:', error);
      return false;
    }
  }

  // מחיקת שיעור (soft delete)
  async deleteLesson(lessonId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('lessons')
        .update({ is_active: false })
        .eq('id', lessonId);

      if (error) {
        console.error('Error deleting lesson:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteLesson:', error);
      return false;
    }
  }

  // יצירת קורס הלוויתנים עם כל השיעורים
  async createWhalesCourse(): Promise<boolean> {
    try {
      // יצירת הקורס
      const course = await this.createCourse({
        title: 'קורס הלוויתנים',
        subtitle: 'הפריצה לשוק - דוד אריא',
        description: 'קהילת הסוחרים של ישראל - קורס מקיף למסחר מתקדם עם מודל PO3 ואסטרטגיות מתקדמות.',
        cover_url: 'https://via.placeholder.com/400x250/1a1a1a/FFFFFF?text=קורס+הלוויתנים',
        instructor_name: 'דוד אריא',
        instructor_avatar: 'https://via.placeholder.com/60x60/10B981/FFFFFF?text=ד.א',
        duration_hours: 8,
        level: 'מתקדם',
        rating: 4.8,
        students_count: 1250,
        price: 299,
        original_price: 599,
        is_active: true,
      });

      if (!course) {
        console.error('Failed to create course');
        return false;
      }

      // יצירת השיעורים
      const lessons = [
        {
          id: 'lesson-1',
          course_id: course.id,
          title: 'הכירות עם הקורס',
          description: 'הכרות עם הקורס והנושאים שילמדו בו',
          duration_minutes: 45,
          order_index: 1,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-2',
          course_id: course.id,
          title: 'מה זה - Price Action',
          description: 'הבנת מושגי ה-Price Action והשימוש בהם',
          duration_minutes: 60,
          order_index: 2,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-3',
          course_id: course.id,
          title: 'מה זה - Liquidity',
          description: 'הבנת מושג הנזילות והשפעתו על השוק',
          duration_minutes: 40,
          order_index: 3,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-4',
          course_id: course.id,
          title: 'מה זה - FVG',
          description: 'הבנת Fair Value Gaps וזיהוי הזדמנויות',
          duration_minutes: 35,
          order_index: 4,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-5',
          course_id: course.id,
          title: 'מה זה - IFVG',
          description: 'הבנת Imbalanced Fair Value Gaps',
          duration_minutes: 30,
          order_index: 5,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-6',
          course_id: course.id,
          title: 'אסטרטגיית - מודל PO3',
          description: 'לימוד מודל PO3 ואסטרטגיות מסחר',
          duration_minutes: 50,
          order_index: 6,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-7',
          course_id: course.id,
          title: 'אסטרטגיית - Golden Zone + FVG',
          description: 'שילוב Golden Zone עם Fair Value Gaps',
          duration_minutes: 55,
          order_index: 7,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-8',
          course_id: course.id,
          title: 'סמינר PO3 (חזרה על מושגים והבנת המודל לעומק)',
          description: 'סמינר מקיף לחזרה על מושגי PO3 והבנה מעמיקה',
          duration_minutes: 90,
          order_index: 8,
          is_completed: false,
          is_active: true,
        },
        {
          id: 'lesson-9',
          course_id: course.id,
          title: 'הלוויתנים מקנאים בכם!',
          description: 'הבנת התנהגות הלוויתנים והשפעתם על השוק',
          duration_minutes: 25,
          order_index: 9,
          is_completed: false,
          is_active: true,
        },
      ];

      for (const lesson of lessons) {
        await this.createLesson(lesson);
      }

      return true;
    } catch (error) {
      console.error('Error in createWhalesCourse:', error);
      return false;
    }
  }
}

export const courseService = new CourseService();
