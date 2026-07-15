// ============================================
// Chat Media Service
// ============================================

import { supabase } from '../../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as Sharing from 'expo-sharing';
import { decode } from 'base64-arraybuffer';
import {
  ChatMediaUploadProgress,
  ChatError,
  ChatMessageType,
} from '../../types/chat.types';
import { logger } from '../../utils/logger';
import { chatMediaStoragePathFromRef, getChatMediaDisplayUri } from './chatSignedMediaUrl';

// ============================================
// קונפיגורציה
// ============================================

const CHAT_MEDIA_BUCKET = 'chat-media';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB
const GALLERY_PAGE_SIZE = 50;

// ============================================
// Helpers
// ============================================

/** Simple retry helper for transient upload failures (network errors, 5xx) */
async function withUploadRetry<T>(
  fn: () => Promise<T & { error: any }>,
  maxAttempts = 3
): Promise<T & { error: any }> {
  let lastResult: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await fn();
    if (!lastResult.error) return lastResult;
    const err = lastResult.error;
    // Retry on network errors, timeouts, and 5xx server errors from Supabase Storage
    const retryable =
      err?.statusCode >= 500 ||
      err?.message?.toLowerCase().includes('timeout') ||
      err?.message?.toLowerCase().includes('network') ||
      err?.message?.toLowerCase().includes('fetch') ||
      ['StorageApiError', 'UNEXPECTED_ERROR', 'UPLOAD_ERROR'].includes(err?.name ?? err?.code ?? '');
    if (!retryable || attempt === maxAttempts) return lastResult;
    await new Promise(res => setTimeout(res, 500 * attempt));
  }
  return lastResult;
}

function generateSecureId(): string {
  const array = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 200);
}

function validateGroupPath(groupId: string): boolean {
  if (!groupId || typeof groupId !== 'string') return false;
  if (groupId.includes('..') || groupId.includes('/') || groupId.includes('\\')) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(groupId);
}

const activeUploads = new Map<string, { cancelled: boolean }>();

export function cancelUpload(uploadId: string): void {
  const upload = activeUploads.get(uploadId);
  if (upload) {
    upload.cancelled = true;
    activeUploads.delete(uploadId);
  }
}

export function cancelAllUploads(): void {
  activeUploads.forEach(upload => { upload.cancelled = true; });
  activeUploads.clear();
}

function createUploadHandle(): { id: string; handle: { cancelled: boolean } } {
  const id = generateSecureId();
  const handle = { cancelled: false };
  activeUploads.set(id, handle);
  return { id, handle };
}

// ============================================
// Thumbnail מקומי לתמונה (כמו VideoThumbnails לווידאו)
// ============================================

/**
 * יוצר JPEG קטן (~480px) מה-URI המקומי — לפריוויו/בועה מיידיים בלי decode של הקובץ המלא.
 * fire-and-forget ידידותי: כשל מחזיר null ולא זורק.
 */
export async function createLocalImageThumbnail(
  uri: string,
  maxWidth = 480,
): Promise<string | null> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri || null;
  } catch (error) {
    logger.warn('ChatMedia', 'local image thumbnail failed', error);
    return null;
  }
}

/**
 * פריים מקומי מווידאו — לבועה / פריוויו (iOS לא אמין על URL מרוחק).
 */
export async function createLocalVideoThumbnail(uri: string): Promise<string | null> {
  for (const time of [1000, 0, 100, 2000]) {
    try {
      const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(uri, {
        time,
        quality: 0.65,
      });
      if (thumb) return thumb;
    } catch {
      /* נקודת זמן הבאה */
    }
  }
  logger.warn('ChatMedia', 'local video thumbnail failed', { uri: uri.slice(0, 80) });
  return null;
}

async function readLocalThumbBase64(localThumbnailUri: string): Promise<string | null> {
  try {
    return await FileSystem.readAsStringAsync(localThumbnailUri, { encoding: 'base64' });
  } catch {
    return null;
  }
}

// ============================================
// העלאת תמונה
// ============================================

export async function uploadImage(
  uri: string,
  groupId: string,
  onProgress?: (progress: ChatMediaUploadProgress) => void,
  options?: { localThumbnailUri?: string | null },
): Promise<{ 
  url: string | null; 
  thumbnail_url: string | null;
  width: number;
  height: number;
  size: number;
  error: ChatError | null;
  uploadId?: string;
}> {
  const { id: uploadId, handle } = createUploadHandle();
  const CANCELLED_RESULT = { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'UPLOAD_CANCELLED' as const, message: 'ההעלאה בוטלה' }, uploadId };

  try {
    if (!validateGroupPath(groupId)) {
      activeUploads.delete(uploadId);
      return { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'INVALID_GROUP', message: 'Invalid group ID' } };
    }

    const fileInfo = await FileSystem.getInfoAsync(uri);
    
    if (!fileInfo.exists) {
      activeUploads.delete(uploadId);
      return { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'FILE_NOT_FOUND', message: 'הקובץ לא נמצא' } };
    }

    if (fileInfo.size && fileInfo.size > MAX_IMAGE_SIZE) {
      activeUploads.delete(uploadId);
      return { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'FILE_TOO_LARGE', message: 'התמונה גדולה מדי (מקסימום 10MB)' } };
    }

    if (handle.cancelled) return CANCELLED_RESULT;

    if (onProgress) {
      onProgress({ file_name: '', progress: 10, uploaded_bytes: 0, total_bytes: fileInfo.size || 0 });
    }

    // ⚡ compress מלא + הכנת thumb במקביל (reuse thumb מקומי אם כבר נוצר בבחירה)
    const localThumb = options?.localThumbnailUri || null;
    const [compressedResult, thumbBase64Result] = await Promise.all([
      (async (): Promise<{ base64: string; width: number; height: number }> => {
        try {
          const compressed = await ImageManipulator.manipulateAsync(
            uri,
            [],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
          );
          return { base64: compressed.base64!, width: compressed.width, height: compressed.height };
        } catch {
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
          return { base64, width: 0, height: 0 };
        }
      })(),
      (async (): Promise<string | null> => {
        if (localThumb) {
          const fromLocal = await readLocalThumbBase64(localThumb);
          if (fromLocal) return fromLocal;
        }
        try {
          const thumb = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 600 } }],
            { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
          );
          return thumb.base64 || null;
        } catch {
          return null;
        }
      })(),
    ]);

    const imageToUpload = compressedResult;
    const thumbBase64 = thumbBase64Result;

    if (handle.cancelled) return CANCELLED_RESULT;

    if (onProgress) {
      onProgress({ file_name: '', progress: 40, uploaded_bytes: 0, total_bytes: fileInfo.size || 0 });
    }

    const timestamp = Date.now();
    const randomId = generateSecureId();
    const fileName = `${groupId}/${timestamp}-${randomId}.jpg`;
    const thumbFileName = `${groupId}/${timestamp}-${randomId}-thumb.jpg`;

    // העלאת מלא + thumb במקביל (thumb best-effort)
    let uploadError: any = null;
    let thumbnailUrl: string | null = null;

    const uploadMain = async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await supabase.storage
          .from(CHAT_MEDIA_BUCKET)
          .upload(fileName, decode(imageToUpload.base64), {
            contentType: 'image/jpeg',
            upsert: false,
          });
        uploadError = result.error;
        if (!uploadError) return;
        if (attempt < 3) await new Promise(res => setTimeout(res, 600 * attempt));
      }
    };

    const uploadThumb = async () => {
      if (!thumbBase64) return;
      try {
        const { error: thumbError } = await supabase.storage
          .from(CHAT_MEDIA_BUCKET)
          .upload(thumbFileName, decode(thumbBase64), {
            contentType: 'image/jpeg',
            upsert: false,
          });
        if (!thumbError) thumbnailUrl = thumbFileName;
      } catch {
        logger.warn('ChatMedia', 'Could not upload image thumbnail');
      }
    };

    await Promise.all([uploadMain(), uploadThumb()]);

    if (uploadError) {
      logger.error('ChatMedia', 'Image upload failed after retries', uploadError);
      return { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'UPLOAD_ERROR', message: 'שגיאה בהעלאת תמונה' } };
    }

    if (onProgress) {
      onProgress({ file_name: fileName, progress: 100, uploaded_bytes: fileInfo.size || 0, total_bytes: fileInfo.size || 0, url: fileName });
    }

    activeUploads.delete(uploadId);
    return {
      url: fileName,
      thumbnail_url: thumbnailUrl,
      width: imageToUpload.width,
      height: imageToUpload.height,
      size: fileInfo.size || 0,
      error: null,
      uploadId,
    };
  } catch (error: any) {
    activeUploads.delete(uploadId);
    logger.error('ChatMedia', 'Unexpected image upload error', error);
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
    if (!validateGroupPath(groupId)) {
      return { url: null, thumbnail_url: null, duration: 0, width: 0, height: 0, size: 0, error: { code: 'INVALID_GROUP', message: 'Invalid group ID' } };
    }

    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { url: null, thumbnail_url: null, duration: 0, width: 0, height: 0, size: 0, error: { code: 'FILE_NOT_FOUND', message: 'הקובץ לא נמצא' } };
    }

    if (fileInfo.size && fileInfo.size > MAX_VIDEO_SIZE) {
      return { url: null, thumbnail_url: null, duration: 0, width: 0, height: 0, size: 0, error: { code: 'FILE_TOO_LARGE', message: 'הסרטון גדול מדי (מקסימום 100MB)' } };
    }

    if (onProgress) {
      onProgress({ file_name: '', progress: 10, uploaded_bytes: 0, total_bytes: fileInfo.size || 0 });
    }

    const timestamp = Date.now();
    const randomId = generateSecureId();
    const rawExt = uri.split('.').pop() || 'mp4';
    const extension = rawExt.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    const fileName = `${groupId}/${timestamp}-${randomId}.${extension}`;

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

    if (onProgress) {
      onProgress({ file_name: fileName, progress: 50, uploaded_bytes: 0, total_bytes: fileInfo.size || 0 });
    }

    const mimeType = extension === 'mov' ? 'video/quicktime' : `video/${extension}`;
    let videoUploadError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .upload(fileName, decode(base64), { contentType: mimeType, upsert: false });
      videoUploadError = result.error;
      if (!videoUploadError) break;
      if (attempt < 3) await new Promise(res => setTimeout(res, 600 * attempt));
    }

    if (videoUploadError) {
      logger.error('ChatMedia', 'Video upload failed after retries', videoUploadError);
      return { url: null, thumbnail_url: null, duration: 0, width: 0, height: 0, size: 0, error: { code: 'UPLOAD_ERROR', message: 'שגיאה בהעלאת סרטון' } };
    }

    if (onProgress) {
      onProgress({ file_name: fileName, progress: 70, uploaded_bytes: 0, total_bytes: fileInfo.size || 0 });
    }

    let thumbnailUrl: string | null = null;
    try {
      const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: 1000,
        quality: 0.7,
      });
      
      if (thumbnailUri) {
        const thumbnailBase64 = await FileSystem.readAsStringAsync(thumbnailUri, { encoding: 'base64' });
        const thumbnailFileName = `${groupId}/${timestamp}-${randomId}-thumb.jpg`;
        
        const { error: thumbError } = await supabase.storage
          .from(CHAT_MEDIA_BUCKET)
          .upload(thumbnailFileName, decode(thumbnailBase64), {
            contentType: 'image/jpeg',
            upsert: false,
          });
        
        if (!thumbError) {
          thumbnailUrl = thumbnailFileName;
        }
      }
    } catch (thumbError) {
      logger.warn('ChatMedia', 'Could not generate video thumbnail');
    }

    if (onProgress) {
      onProgress({ file_name: fileName, progress: 100, uploaded_bytes: fileInfo.size || 0, total_bytes: fileInfo.size || 0, url: fileName });
    }

    return {
      url: fileName,
      thumbnail_url: thumbnailUrl,
      duration: 0,
      width: 0,
      height: 0,
      size: fileInfo.size || 0,
      error: null,
    };
  } catch (error: any) {
    logger.error('ChatMedia', 'Unexpected video upload error', error);
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
    if (!validateGroupPath(groupId)) {
      return { url: null, duration: 0, size: 0, error: { code: 'INVALID_GROUP', message: 'Invalid group ID' } };
    }

    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { url: null, duration: 0, size: 0, error: { code: 'FILE_NOT_FOUND', message: 'הקובץ לא נמצא' } };
    }

    if (fileInfo.size && fileInfo.size > MAX_AUDIO_SIZE) {
      return { url: null, duration: 0, size: 0, error: { code: 'FILE_TOO_LARGE', message: 'הקובץ גדול מדי (מקסימום 50MB)' } };
    }

    const timestamp = Date.now();
    const randomId = generateSecureId();
    const rawExt = uri.split('.').pop() || 'm4a';
    const extension = rawExt.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    const fileName = `${groupId}/${timestamp}-${randomId}.${extension}`;

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 20,
        uploaded_bytes: 0,
        total_bytes: fileInfo.size || 0,
      });
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const uploadResult = await withUploadRetry(() =>
      supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .upload(fileName, decode(base64), {
          contentType: `audio/${extension}`,
          upsert: false,
        })
    );

    if (uploadResult.error) {
      logger.error('ChatMedia', 'Audio upload failed', uploadResult.error);
      return { url: null, duration: 0, size: 0, error: { code: 'UPLOAD_ERROR', message: 'שגיאה בהעלאת אודיו' } };
    }

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 100,
        uploaded_bytes: fileInfo.size || 0,
        total_bytes: fileInfo.size || 0,
        url: fileName,
      });
    }

    return {
      url: fileName,
      duration,
      size: fileInfo.size || 0,
      error: null,
    };
  } catch (error: any) {
    logger.error('ChatMedia', 'Unexpected audio upload error', error);
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
    if (!validateGroupPath(groupId)) {
      return { url: null, size: 0, error: { code: 'INVALID_GROUP', message: 'Invalid group ID' } };
    }

    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { url: null, size: 0, error: { code: 'FILE_NOT_FOUND', message: 'הקובץ לא נמצא' } };
    }

    if (fileInfo.size && fileInfo.size > MAX_DOCUMENT_SIZE) {
      return { url: null, size: 0, error: { code: 'FILE_TOO_LARGE', message: 'הקובץ גדול מדי (מקסימום 50MB)' } };
    }

    const timestamp = Date.now();
    const randomId = generateSecureId();
    const sanitized = sanitizeFileName(fileName);
    const extension = sanitized.split('.').pop()?.toLowerCase() || 'pdf';
    const uniqueFileName = `${groupId}/${timestamp}-${randomId}-${sanitized}`;

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 20,
        uploaded_bytes: 0,
        total_bytes: fileInfo.size || 0,
      });
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

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

    const contentType = mimeTypes[extension] || 'application/octet-stream';

    const uploadResult = await withUploadRetry(() =>
      supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .upload(uniqueFileName, decode(base64), {
          contentType,
          upsert: false,
        })
    );

    if (uploadResult.error) {
      logger.error('ChatMedia', 'Document upload failed', uploadResult.error);
      return { url: null, size: 0, error: { code: 'UPLOAD_ERROR', message: 'שגיאה בהעלאת מסמך' } };
    }

    if (onProgress) {
      onProgress({
        file_name: fileName,
        progress: 100,
        uploaded_bytes: fileInfo.size || 0,
        total_bytes: fileInfo.size || 0,
        url: uniqueFileName,
      });
    }

    return {
      url: uniqueFileName,
      size: fileInfo.size || 0,
      error: null,
    };
  } catch (error: any) {
    logger.error('ChatMedia', 'Unexpected document upload error', error);
    return { url: null, size: 0, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// מחיקת מדיה
// ============================================

export async function deleteMedia(
  mediaUrl: string,
  groupId?: string
): Promise<{ error: ChatError | null }> {
  try {
    let storagePath = chatMediaStoragePathFromRef(mediaUrl);
    if (!storagePath) {
      try {
        const urlObj = new URL(mediaUrl);
        const pathParts = urlObj.pathname.split('/');
        const bucketIdx = pathParts.indexOf(CHAT_MEDIA_BUCKET);
        if (bucketIdx === -1 || bucketIdx >= pathParts.length - 1) {
          return { error: { code: 'INVALID_URL', message: 'Invalid media URL' } };
        }
        storagePath = pathParts.slice(bucketIdx + 1).join('/');
      } catch {
        return { error: { code: 'INVALID_URL', message: 'Invalid media URL' } };
      }
    }

    if (storagePath.includes('..')) {
      return { error: { code: 'INVALID_PATH', message: 'Invalid file path' } };
    }

    if (groupId && !storagePath.startsWith(`${groupId}/`)) {
      return { error: { code: 'ACCESS_DENIED', message: 'Cannot delete media from another group' } };
    }

    const { error } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .remove([storagePath]);

    if (error) {
      logger.error('ChatMedia', 'Delete failed', error);
      return { error: { code: 'DELETE_MEDIA_ERROR', message: 'שגיאה במחיקת מדיה' } };
    }

    return { error: null };
  } catch (error: any) {
    logger.error('ChatMedia', 'Unexpected delete error', error);
    return { error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// קבלת כל המדיה של קבוצה (עם pagination)
// ============================================

export async function getGroupMediaGallery(
  groupId: string,
  mediaType?: 'image' | 'video' | 'all',
  page: number = 0,
  pageSize: number = GALLERY_PAGE_SIZE
): Promise<{ 
  images: any[];
  videos: any[];
  hasMore: boolean;
  error: ChatError | null;
}> {
  try {
    if (!validateGroupPath(groupId)) {
      return { images: [], videos: [], hasMore: false, error: { code: 'INVALID_GROUP', message: 'Invalid group ID' } };
    }

    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        content,
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

    const from = page * pageSize;
    const to = from + pageSize;

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('ChatMedia', 'Gallery fetch failed', error);
      return { images: [], videos: [], hasMore: false, error: { code: 'FETCH_MEDIA_ERROR', message: 'שגיאה בטעינת גלריה' } };
    }

    const hasMore = (data?.length ?? 0) > pageSize;
    const items = hasMore ? data!.slice(0, pageSize) : (data || []);

    const images = items.filter(m => m.message_type === ChatMessageType.IMAGE);
    const videos = items.filter(m => m.message_type === ChatMessageType.VIDEO);

    return { images, videos, hasMore, error: null };
  } catch (error: any) {
    logger.error('ChatMedia', 'Unexpected gallery error', error);
    return { images: [], videos: [], hasMore: false, error: { code: 'UNEXPECTED_ERROR', message: error.message } };
  }
}

// ============================================
// הורדת קובץ
// ============================================

export async function downloadMedia(
  mediaUrl: string,
  fileName: string
): Promise<{ localUri: string | null; error: ChatError | null }> {
  try {
    const sanitized = sanitizeFileName(fileName);
    const dir = FileSystem.documentDirectory + 'chat-downloads/';
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    const localUri = dir + sanitized;
    const signed = await getChatMediaDisplayUri(mediaUrl);
    const download = await FileSystem.downloadAsync(signed || mediaUrl, localUri);

    if (download.status !== 200) {
      // Clean up failed download
      try { await FileSystem.deleteAsync(localUri, { idempotent: true }); } catch { /* best effort */ }
      return { localUri: null, error: { code: 'DOWNLOAD_FAILED', message: `HTTP ${download.status}` } };
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(download.uri);
    }

    return { localUri: download.uri, error: null };
  } catch (error: any) {
    logger.error('ChatMedia', 'Download failed', error);
    return { localUri: null, error: { code: 'DOWNLOAD_ERROR', message: error.message } };
  }
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
  createLocalImageThumbnail,
  createLocalVideoThumbnail,
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
