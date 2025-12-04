// ============================================
// Chat Media Service
// ============================================
// העלאת וניהול מדיה - תמונות, סרטונים, אודיו, מסמכים
// ============================================

import { supabase } from '../../lib/supabase';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import {
  ChatMediaUploadProgress,
  ChatError,
  ChatMessageType,
} from '../../types/chat.types';

// ============================================
// קונפיגורציה
// ============================================

const CHAT_MEDIA_BUCKET = 'chat-media';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB

// גודלי thumbnails
const THUMBNAIL_SIZE = 200;
const PREVIEW_SIZE = 1200;

// ============================================
// העלאת תמונה
// ============================================

export async function uploadImage(
  uri: string,
  groupId: string,
  onProgress?: (progress: ChatMediaUploadProgress) => void
): Promise<{ 
  url: string | null; 
  thumbnail_url: string | null;
  width: number;
  height: number;
  size: number;
  error: ChatError | null;
}> {
  try {
    console.log('📤 Starting image upload:', uri);

    // בדיקת גודל קובץ
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'FILE_NOT_FOUND', message: 'הקובץ לא נמצא' } };
    }

    if (fileInfo.size && fileInfo.size > MAX_IMAGE_SIZE) {
      return { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'FILE_TOO_LARGE', message: 'התמונה גדולה מדי (מקסימום 10MB)' } };
    }

    // קריאת התמונה כ-base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // קבלת מידות התמונה המקורית
    const imageInfo = await ImageManipulator.manipulateAsync(uri, [], { base64: true });
    const originalWidth = imageInfo.width;
    const originalHeight = imageInfo.height;

    // יצירת thumbnail
    const thumbnail = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: THUMBNAIL_SIZE } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    // יצירת preview (גרסה מוקטנת לשליחה)
    let previewImage = imageInfo;
    if (originalWidth > PREVIEW_SIZE || originalHeight > PREVIEW_SIZE) {
      const scale = Math.min(PREVIEW_SIZE / originalWidth, PREVIEW_SIZE / originalHeight);
      previewImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: Math.round(originalWidth * scale) } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
    }

    // שמות קבצים ייחודיים
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `${groupId}/${timestamp}-${randomId}.jpg`;
    const thumbnailFileName = `${groupId}/${timestamp}-${randomId}-thumb.jpg`;

    // העלאת ה-preview
    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 25,
        uploaded_bytes: 0,
        total_bytes: fileInfo.size || 0,
      });
    }

    const { data: previewData, error: previewError } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .upload(fileName, decode(previewImage.base64!), {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (previewError) {
      console.error('❌ Error uploading preview:', previewError);
      return { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'UPLOAD_ERROR', message: previewError.message } };
    }

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 75,
        uploaded_bytes: fileInfo.size || 0,
        total_bytes: fileInfo.size || 0,
      });
    }

    // העלאת ה-thumbnail
    const { data: thumbnailData, error: thumbnailError } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .upload(thumbnailFileName, decode(thumbnail.base64!), {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (thumbnailError) {
      console.error('⚠️ Warning: Error uploading thumbnail:', thumbnailError);
      // לא נכשיל את כל התהליך בגלל thumbnail
    }

    // קבלת URLs ציבוריים
    const { data: urlData } = supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .getPublicUrl(fileName);

    const { data: thumbnailUrlData } = supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .getPublicUrl(thumbnailFileName);

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 100,
        uploaded_bytes: fileInfo.size || 0,
        total_bytes: fileInfo.size || 0,
        url: urlData.publicUrl,
      });
    }

    console.log('✅ Image uploaded successfully:', urlData.publicUrl);

    return {
      url: urlData.publicUrl,
      thumbnail_url: thumbnailData ? thumbnailUrlData.publicUrl : null,
      width: previewImage.width,
      height: previewImage.height,
      size: fileInfo.size || 0,
      error: null,
    };
  } catch (error: any) {
    console.error('❌ Unexpected error uploading image:', error);
    return { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// העלאת סרטון
// ============================================

export async function uploadVideo(
  uri: string,
  groupId: string,
  onProgress?: (progress: ChatMediaUploadProgress) => void
): Promise<{ 
  url: string | null; 
  thumbnail_url: string | null;
  duration: number;
  width: number;
  height: number;
  size: number;
  error: ChatError | null;
}> {
  try {
    console.log('📤 Starting video upload:', uri);

    // בדיקת גודל קובץ
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { url: null, thumbnail_url: null, duration: 0, width: 0, height: 0, size: 0, error: { code: 'FILE_NOT_FOUND', message: 'הקובץ לא נמצא' } };
    }

    if (fileInfo.size && fileInfo.size > MAX_VIDEO_SIZE) {
      return { url: null, thumbnail_url: null, duration: 0, width: 0, height: 0, size: 0, error: { code: 'FILE_TOO_LARGE', message: 'הסרטון גדול מדי (מקסימום 100MB)' } };
    }

    // קבלת מידות הסרטון ו-duration
    const width = 1920;
    const height = 1080;
    const duration = 0;

    // יצירת thumbnail מהסרטון
    let thumbnailUrl: string | null = null;
    try {
      const { VideoThumbnails } = require('expo-video-thumbnails');
      const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: 1000,
      });

      const thumbnailResult = await uploadImage(thumbnailUri, groupId);
      thumbnailUrl = thumbnailResult.thumbnail_url;
    } catch (error) {
      console.error('⚠️ Warning: Could not generate video thumbnail:', error);
    }

    // שם קובץ ייחודי
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = uri.split('.').pop() || 'mp4';
    const fileName = `${groupId}/${timestamp}-${randomId}.${extension}`;

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 10,
        uploaded_bytes: 0,
        total_bytes: fileInfo.size || 0,
      });
    }

    // קריאת הקובץ כ-base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // העלאה
    const { data, error } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .upload(fileName, decode(base64), {
        contentType: `video/${extension}`,
        upsert: false,
      });

    if (error) {
      console.error('❌ Error uploading video:', error);
      return { url: null, thumbnail_url: null, duration: 0, width: 0, height: 0, size: 0, error: { code: 'UPLOAD_ERROR', message: error.message } };
    }

    // קבלת URL ציבורי
    const { data: urlData } = supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .getPublicUrl(fileName);

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 100,
        uploaded_bytes: fileInfo.size || 0,
        total_bytes: fileInfo.size || 0,
        url: urlData.publicUrl,
      });
    }

    console.log('✅ Video uploaded successfully:', urlData.publicUrl);

    return {
      url: urlData.publicUrl,
      thumbnail_url: thumbnailUrl,
      duration,
      width,
      height,
      size: fileInfo.size || 0,
      error: null,
    };
  } catch (error: any) {
    console.error('❌ Unexpected error uploading video:', error);
    return { url: null, thumbnail_url: null, duration: 0, width: 0, height: 0, size: 0, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// העלאת הודעה קולית
// ============================================

export async function uploadAudio(
  uri: string,
  groupId: string,
  duration: number,
  onProgress?: (progress: ChatMediaUploadProgress) => void
): Promise<{ 
  url: string | null; 
  duration: number;
  size: number;
  error: ChatError | null;
}> {
  try {
    console.log('📤 Starting audio upload:', uri);

    // בדיקת גודל קובץ
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { url: null, duration: 0, size: 0, error: { code: 'FILE_NOT_FOUND', message: 'הקובץ לא נמצא' } };
    }

    if (fileInfo.size && fileInfo.size > MAX_AUDIO_SIZE) {
      return { url: null, duration: 0, size: 0, error: { code: 'FILE_TOO_LARGE', message: 'הקובץ גדול מדי (מקסימום 50MB)' } };
    }

    // שם קובץ ייחודי
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = uri.split('.').pop() || 'm4a';
    const fileName = `${groupId}/${timestamp}-${randomId}.${extension}`;

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 20,
        uploaded_bytes: 0,
        total_bytes: fileInfo.size || 0,
      });
    }

    // קריאת הקובץ כ-base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // העלאה
    const { data, error } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .upload(fileName, decode(base64), {
        contentType: `audio/${extension}`,
        upsert: false,
      });

    if (error) {
      console.error('❌ Error uploading audio:', error);
      return { url: null, duration: 0, size: 0, error: { code: 'UPLOAD_ERROR', message: error.message } };
    }

    // קבלת URL ציבורי
    const { data: urlData } = supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .getPublicUrl(fileName);

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 100,
        uploaded_bytes: fileInfo.size || 0,
        total_bytes: fileInfo.size || 0,
        url: urlData.publicUrl,
      });
    }

    console.log('✅ Audio uploaded successfully:', urlData.publicUrl);

    return {
      url: urlData.publicUrl,
      duration,
      size: fileInfo.size || 0,
      error: null,
    };
  } catch (error: any) {
    console.error('❌ Unexpected error uploading audio:', error);
    return { url: null, duration: 0, size: 0, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// העלאת מסמך
// ============================================

export async function uploadDocument(
  uri: string,
  fileName: string,
  groupId: string,
  onProgress?: (progress: ChatMediaUploadProgress) => void
): Promise<{ 
  url: string | null; 
  size: number;
  error: ChatError | null;
}> {
  try {
    console.log('📤 Starting document upload:', uri);

    // בדיקת גודל קובץ
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { url: null, size: 0, error: { code: 'FILE_NOT_FOUND', message: 'הקובץ לא נמצא' } };
    }

    if (fileInfo.size && fileInfo.size > MAX_DOCUMENT_SIZE) {
      return { url: null, size: 0, error: { code: 'FILE_TOO_LARGE', message: 'הקובץ גדול מדי (מקסימום 50MB)' } };
    }

    // שם קובץ ייחודי (שמירה על השם המקורי)
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = fileName.split('.').pop() || 'pdf';
    const uniqueFileName = `${groupId}/${timestamp}-${randomId}-${fileName}`;

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 20,
        uploaded_bytes: 0,
        total_bytes: fileInfo.size || 0,
      });
    }

    // קריאת הקובץ כ-base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    // קביעת content type לפי סוג הקובץ
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      zip: 'application/zip',
    };

    const contentType = mimeTypes[extension.toLowerCase()] || 'application/octet-stream';

    // העלאה
    const { data, error } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .upload(uniqueFileName, decode(base64), {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('❌ Error uploading document:', error);
      return { url: null, size: 0, error: { code: 'UPLOAD_ERROR', message: error.message } };
    }

    // קבלת URL ציבורי
    const { data: urlData } = supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .getPublicUrl(uniqueFileName);

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 100,
        uploaded_bytes: fileInfo.size || 0,
        total_bytes: fileInfo.size || 0,
        url: urlData.publicUrl,
      });
    }

    console.log('✅ Document uploaded successfully:', urlData.publicUrl);

    return {
      url: urlData.publicUrl,
      size: fileInfo.size || 0,
      error: null,
    };
  } catch (error: any) {
    console.error('❌ Unexpected error uploading document:', error);
    return { url: null, size: 0, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// מחיקת מדיה
// ============================================

export async function deleteMedia(
  mediaUrl: string
): Promise<{ error: ChatError | null }> {
  try {
    // חילוץ שם הקובץ מה-URL
    const fileName = mediaUrl.split('/').slice(-2).join('/');

    const { error } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .remove([fileName]);

    if (error) {
      console.error('❌ Error deleting media:', error);
      return { error: { code: 'DELETE_MEDIA_ERROR', message: error.message } };
    }

    console.log('✅ Media deleted successfully:', fileName);
    return { error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error deleting media:', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// קבלת כל המדיה של קבוצה
// ============================================

export async function getGroupMediaGallery(
  groupId: string,
  mediaType?: 'image' | 'video' | 'all'
): Promise<{ 
  images: any[];
  videos: any[];
  error: ChatError | null;
}> {
  try {
    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        media_url,
        media_thumbnail_url,
        media_type,
        media_width,
        media_height,
        message_type,
        created_at,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name
        )
      `)
      .eq('group_id', groupId)
      .not('media_url', 'is', null);

    if (mediaType === 'image') {
      query = query.eq('message_type', ChatMessageType.IMAGE);
    } else if (mediaType === 'video') {
      query = query.eq('message_type', ChatMessageType.VIDEO);
    } else {
      query = query.in('message_type', [ChatMessageType.IMAGE, ChatMessageType.VIDEO]);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching media gallery:', error);
      return { images: [], videos: [], error: { code: 'FETCH_MEDIA_ERROR', message: error.message } };
    }

    const images = data.filter(m => m.message_type === ChatMessageType.IMAGE);
    const videos = data.filter(m => m.message_type === ChatMessageType.VIDEO);

    console.log(`✅ Fetched ${images.length} images and ${videos.length} videos`);
    return { images, videos, error: null };
  } catch (error: any) {
    console.error('❌ Unexpected error fetching media gallery:', error);
    return { images: [], videos: [], error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// הורדת קובץ
// ============================================

export async function downloadMedia(
  mediaUrl: string,
  fileName: string
): Promise<{ localUri: string | null; error: ChatError | null }> {
  // TODO: להוסיף הורדת קבצים בהמשך
  console.log('⬇️ Download requested but not implemented yet');
  return { localUri: null, error: { code: 'NOT_IMPLEMENTED', message: 'הורדה לא מיושמת עדיין' } };
}

// ============================================
// פונקציות עזר
// ============================================

export function getMediaType(uri: string): ChatMessageType {
  const extension = uri.split('.').pop()?.toLowerCase() || '';
  
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
  const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
  const audioExtensions = ['m4a', 'mp3', 'wav', 'aac', 'ogg'];

  if (imageExtensions.includes(extension)) {
    return ChatMessageType.IMAGE;
  } else if (videoExtensions.includes(extension)) {
    return ChatMessageType.VIDEO;
  } else if (audioExtensions.includes(extension)) {
    return ChatMessageType.AUDIO;
  } else {
    return ChatMessageType.DOCUMENT;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// Export
// ============================================

export const chatMediaService = {
  uploadImage,
  uploadVideo,
  uploadAudio,
  uploadDocument,
  deleteMedia,
  getGroupMediaGallery,
  downloadMedia,
  getMediaType,
  formatFileSize,
  formatDuration,
};

