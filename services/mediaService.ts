import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as base64js from 'base64-js';
import { logger } from '../utils/logger';

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

export interface MediaFile {
  id: string;
  uri: string;
  type: 'image' | 'video' | 'audio' | 'document';
  name?: string;
  size?: number;
  duration?: number;
  thumbnail_url?: string;
  waveformData?: number[];
}

export interface MediaMetadata {
  file_name?: string;
  file_size?: number;
  content_type?: string;
  duration?: number;
  width?: number;
  height?: number;
  [key: string]: any;
}

export interface LessonMedia {
  id?: string;
  course_id: string;
  lesson_id: string;
  vimeo_id?: string;
  vimeo_url?: string;
  youtube_id?: string;
  youtube_url?: string;
  thumbnail_url?: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  is_active: boolean;
}

class MediaService {
  // שמירת קישור מדיה לשיעור
  async saveLessonMedia(media: Omit<LessonMedia, 'id'>): Promise<LessonMedia | null> {
    try {
      const { data, error } = await supabase
        .from('lesson_media_links')
        .upsert(media, {
          onConflict: 'course_id,lesson_id'
        })
        .select()
        .single();

      if (error) {
        logger.error('MediaService', 'Error saving lesson media', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('MediaService', 'Error in saveLessonMedia', error);
      return null;
    }
  }

  // קבלת קישור מדיה לשיעור
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
        logger.error('MediaService', 'Error getting lesson media', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('MediaService', 'Error in getLessonMedia', error);
      return null;
    }
  }

  // קבלת כל קישורי המדיה של קורס
  async getCourseMedia(courseId: string): Promise<LessonMedia[]> {
    try {
      const { data, error } = await supabase
        .from('lesson_media_links')
        .select('*')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .order('lesson_id');

      if (error) {
        logger.error('MediaService', 'Error getting course media', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('MediaService', 'Error in getCourseMedia', error);
      return [];
    }
  }

  // עדכון קישור מדיה
  async updateLessonMedia(mediaId: string, updates: Partial<LessonMedia>): Promise<LessonMedia | null> {
    try {
      const { data, error } = await supabase
        .from('lesson_media_links')
        .update(updates)
        .eq('id', mediaId)
        .select()
        .single();

      if (error) {
        logger.error('MediaService', 'Error updating lesson media', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('MediaService', 'Error in updateLessonMedia', error);
      return null;
    }
  }

  // עדכון duration של שיעור לפי course_id ו-lesson_id
  async updateLessonDuration(courseId: string, lessonId: string, durationSeconds: number): Promise<boolean> {
    try {
      const durationMinutes = Math.round(durationSeconds / 60);

      const { error } = await supabase
        .from('lesson_media_links')
        .update({
          duration_minutes: durationMinutes,
          updated_at: new Date().toISOString()
        })
        .eq('course_id', courseId)
        .eq('lesson_id', lessonId);

      if (error) {
        logger.error('MediaService', 'Error updating lesson duration', error);
        return false;
      }

      
      return true;
    } catch (error) {
      logger.error('MediaService', 'Error in updateLessonDuration', error);
      return false;
    }
  }

  // מחיקת קישור מדיה (soft delete)
  async deleteLessonMedia(mediaId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('lesson_media_links')
        .update({ is_active: false })
        .eq('id', mediaId);

      if (error) {
        logger.error('MediaService', 'Error deleting lesson media', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('MediaService', 'Error in deleteLessonMedia', error);
      return false;
    }
  }

  // יצירת כל קישורי המדיה לקורס הלוויתנים
  async createWhalesCourseMedia(courseId: string): Promise<boolean> {
    try {
      const mediaLinks = [
        {
          course_id: courseId,
          lesson_id: 'lesson-1',
          vimeo_id: '1095579213',
          vimeo_url: 'https://vimeo.com/1095579213?share=copy',
          thumbnail_url: 'https://vumbnail.com/1095579213.jpg',
          title: 'הכירות עם הקורס',
          description: 'הכרות עם הקורס והנושאים שילמדו בו',
          duration_minutes: 45,
          is_active: true,
        },
        {
          course_id: courseId,
          lesson_id: 'lesson-2',
          vimeo_id: '1095573038',
          vimeo_url: 'https://vimeo.com/1095573038?share=copy',
          thumbnail_url: 'https://vumbnail.com/1095573038.jpg',
          title: 'מה זה - Price Action',
          description: 'הבנת מושגי ה-Price Action והשימוש בהם',
          duration_minutes: 60,
          is_active: true,
        },
        {
          course_id: courseId,
          lesson_id: 'lesson-3',
          vimeo_id: '1095570862',
          vimeo_url: 'https://vimeo.com/1095570862?share=copy',
          thumbnail_url: 'https://vumbnail.com/1095570862.jpg',
          title: 'מה זה - Liquidity',
          description: 'הבנת מושג הנזילות והשפעתו על השוק',
          duration_minutes: 40,
          is_active: true,
        },
        {
          course_id: courseId,
          lesson_id: 'lesson-4',
          vimeo_id: '1095761556',
          vimeo_url: 'https://vimeo.com/1095761556?share=copy',
          thumbnail_url: 'https://vumbnail.com/1095761556.jpg',
          title: 'מה זה - FVG',
          description: 'הבנת Fair Value Gaps וזיהוי הזדמנויות',
          duration_minutes: 35,
          is_active: true,
        },
        {
          course_id: courseId,
          lesson_id: 'lesson-5',
          vimeo_id: '1095760652',
          vimeo_url: 'https://vimeo.com/1095760652?share=copy',
          thumbnail_url: 'https://vumbnail.com/1095760652.jpg',
          title: 'מה זה - IFVG',
          description: 'הבנת Imbalanced Fair Value Gaps',
          duration_minutes: 30,
          is_active: true,
        },
        {
          course_id: courseId,
          lesson_id: 'lesson-6',
          vimeo_id: '1095776680',
          vimeo_url: 'https://vimeo.com/1095776680?share=copy',
          thumbnail_url: 'https://vumbnail.com/1095776680.jpg',
          title: 'אסטרטגיית - מודל PO3',
          description: 'לימוד מודל PO3 ואסטרטגיות מסחר',
          duration_minutes: 50,
          is_active: true,
        },
        {
          course_id: courseId,
          lesson_id: 'lesson-7',
          vimeo_id: '1099364716',
          vimeo_url: 'https://vimeo.com/1099364716?share=copy',
          thumbnail_url: 'https://vumbnail.com/1099364716.jpg',
          title: 'אסטרטגיית - Golden Zone + FVG',
          description: 'שילוב Golden Zone עם Fair Value Gaps',
          duration_minutes: 55,
          is_active: true,
        },
        {
          course_id: courseId,
          lesson_id: 'lesson-8',
          vimeo_id: '1108814085',
          vimeo_url: 'https://vimeo.com/1108814085?share=copy',
          thumbnail_url: 'https://vumbnail.com/1108814085.jpg',
          title: 'סמינר PO3 (חזרה על מושגים והבנת המודל לעומק)',
          description: 'סמינר מקיף לחזרה על מושגי PO3 והבנה מעמיקה',
          duration_minutes: 90,
          is_active: true,
        },
        {
          course_id: courseId,
          lesson_id: 'lesson-9',
          vimeo_id: '1095763209',
          vimeo_url: 'https://vimeo.com/1095763209?share=copy',
          thumbnail_url: 'https://vumbnail.com/1095763209.jpg',
          title: 'הלוויתנים מקנאים בכם!',
          description: 'הבנת התנהגות הלוויתנים והשפעתם על השוק',
          duration_minutes: 25,
          is_active: true,
        },
      ];

      for (const media of mediaLinks) {
        await this.saveLessonMedia(media);
      }

      return true;
    } catch (error) {
      logger.error('MediaService', 'Error in createWhalesCourseMedia', error);
      return false;
    }
  }

  // יצירת שיעור עם קישור יוטיוב לקורס הכשרה של דוד
  async createDavidTrainingLessonMedia(
    courseId: string,
    lessonId: string,
    title: string,
    youtubeUrl: string,
    description?: string,
    durationMinutes?: number
  ): Promise<LessonMedia | null> {
    try {
      // חילוץ YouTube ID מהקישור
      const youtubeIdMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
      const youtubeId = youtubeIdMatch ? youtubeIdMatch[1] : null;

      if (!youtubeId) {
        logger.error('MediaService', 'Invalid YouTube URL');
        return null;
      }

      const media: Omit<LessonMedia, 'id'> = {
        course_id: courseId,
        lesson_id: lessonId,
        youtube_id: youtubeId,
        youtube_url: youtubeUrl,
        thumbnail_url: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
        title: title,
        description: description,
        duration_minutes: durationMinutes,
        is_active: true,
      };

      return await this.saveLessonMedia(media);
    } catch (error) {
      logger.error('MediaService', 'Error in createDavidTrainingLessonMedia', error);
      return null;
    }
  }

  // העלאת מדיה ל-Supabase Storage
  async uploadMedia(uri: string, type: 'image' | 'video' | 'audio' | 'document'): Promise<{
    success: boolean;
    url?: string;
    metadata?: any;
    error?: string;
  }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);

      if (!fileInfo.exists) {
        return { success: false, error: 'File does not exist' };
      }

      if (fileInfo.size && fileInfo.size > MAX_UPLOAD_SIZE) {
        return { success: false, error: `File too large (max ${MAX_UPLOAD_SIZE / 1024 / 1024}MB)` };
      }

      const timestamp = Date.now();
      const fileExtension = uri.split('.').pop() || 'bin';
      const fileName = `${type}_${timestamp}.${fileExtension}`;
      const filePath = `chat-media/${fileName}`;

      const fileData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const bytes = base64js.toByteArray(fileData);

      const { error } = await supabase.storage
        .from('app-media')
        .upload(filePath, bytes, {
          contentType: this.getMimeType(type, fileExtension),
          upsert: false
        });

      if (error) {
        logger.error('MediaService', 'Upload error', error);
        return { success: false, error: error.message };
      }

      const { data: urlData } = supabase.storage
        .from('app-media')
        .getPublicUrl(filePath);

      return {
        success: true,
        url: urlData.publicUrl,
        metadata: {
          file_name: fileName,
          file_size: bytes.length,
          content_type: this.getMimeType(type, fileExtension)
        }
      };
    } catch (error) {
      logger.error('MediaService', 'Upload error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private getMimeType(type: string, extension: string): string {
    const mimeTypes: Record<string, Record<string, string>> = {
      image: {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp'
      },
      video: {
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        avi: 'video/x-msvideo',
        webm: 'video/webm'
      },
      audio: {
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        m4a: 'audio/mp4',
        aac: 'audio/aac'
      },
      document: {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain'
      }
    };

    return mimeTypes[type]?.[extension.toLowerCase()] || 'application/octet-stream';
  }
}

export const mediaService = new MediaService();