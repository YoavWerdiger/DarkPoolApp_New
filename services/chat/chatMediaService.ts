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
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config/publicEnv';
import { compressVideoForUpload, discardCompressedVideo } from '../../lib/videoCompressSafe';

// ============================================
// קונפיגורציה
// ============================================

const CHAT_MEDIA_BUCKET = 'chat-media';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB — גודל הקובץ שעולה בפועל (אחרי דחיסה)
/** מקור גדול מזה לא נפענח בכלל (זיכרון). אחרי הקטנה ל-2048px גם 48MP יוצא ~0.5–1MB */
const MAX_IMAGE_SOURCE_SIZE = 30 * 1024 * 1024; // 30MB
/** צלע ארוכה מקסימלית לתמונת צ'אט — "HD" כמו WhatsApp; מסך טלפון לא מציג יותר */
const IMAGE_MAX_EDGE = 2048;
/** איכות JPEG לתמונות/צילומים — ללא הבדל נראה לעין, ~פי 2 קטן מ-0.92+ */
const IMAGE_JPEG_QUALITY = 0.82;
/** מקור PNG (צילומי מסך/טקסט) — איכות גבוהה יותר כדי שטקסט יישאר חד */
const IMAGE_JPEG_QUALITY_GRAPHICS = 0.9;
/** JPEG קטן מזה ובתוך IMAGE_MAX_EDGE עולה כמו שהוא (בלי דחיסה חוזרת) */
const IMAGE_PASSTHROUGH_MAX_BYTES = 500 * 1024;
/** thumbnail של וידאו (poster) — פריים מלא ב-4K שוקל 1–2MB; בועה לא צריכה יותר מזה */
const VIDEO_THUMB_MAX_EDGE = 720;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB — הקובץ שעולה בפועל (אחרי דחיסה)
/** מקור גדול מזה לא נדחס ולא עולה (דחיסה של קובץ ענק אורכת דקות) */
const MAX_VIDEO_SOURCE_SIZE = 1024 * 1024 * 1024; // 1GB
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

/** גודל בבתים של base64 (בלי לפענח) */
function base64ByteLength(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

type PreparedImage = { base64: string; width: number; height: number; size: number };

/**
 * מכין תמונת צ'אט להעלאה: HEIC/PNG/JPEG → JPEG, צלע ארוכה ≤ 2048px, איכות 0.82
 * (0.9 למקור PNG — צילומי מסך עם טקסט). פענוח אחד בלבד; ההקטנה רצה על ה-bitmap המפוענח.
 * כיוון EXIF מוחל בפענוח (כמו manipulateAsync הקודם), ולכן width/height תואמים לקובץ שעולה.
 * JPEG שכבר קטן (< 500KB) ובתוך המידות עולה כמו שהוא — אין דחיסה חוזרת שפוגעת באיכות.
 */
export async function prepareImageForUpload(
  uri: string,
  sourceBytes: number,
): Promise<PreparedImage> {
  const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  const isJpeg = ext === 'jpg' || ext === 'jpeg';
  const isGraphics = ext === 'png' || ext === 'gif' || ext === 'webp';

  const decodeCtx = ImageManipulator.ImageManipulator.manipulate(uri);
  const decoded = await decodeCtx.renderAsync();
  let resizeCtx: ImageManipulator.ImageManipulatorContext | null = null;
  let resized: ImageManipulator.ImageRef | null = null;
  try {
    const srcW = decoded.width;
    const srcH = decoded.height;
    const longEdge = Math.max(srcW, srcH);
    const needsResize = longEdge > IMAGE_MAX_EDGE;

    if (!needsResize && isJpeg && sourceBytes > 0 && sourceBytes <= IMAGE_PASSTHROUGH_MAX_BYTES) {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      return { base64, width: srcW, height: srcH, size: sourceBytes };
    }

    let target = decoded;
    if (needsResize) {
      resizeCtx = ImageManipulator.ImageManipulator.manipulate(decoded);
      resizeCtx.resize(srcW >= srcH ? { width: IMAGE_MAX_EDGE } : { height: IMAGE_MAX_EDGE });
      resized = await resizeCtx.renderAsync();
      target = resized;
    }

    const saved = await target.saveAsync({
      compress: isGraphics ? IMAGE_JPEG_QUALITY_GRAPHICS : IMAGE_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    const base64 = saved.base64!;
    const size = base64ByteLength(base64);

    // JPEG בלי הקטנה שיצא גדול יותר מהמקור — עדיף המקור (בלי אובדן דור נוסף)
    if (!needsResize && isJpeg && sourceBytes > 0 && size >= sourceBytes) {
      const original = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      return { base64: original, width: srcW, height: srcH, size: sourceBytes };
    }

    return { base64, width: saved.width, height: saved.height, size };
  } finally {
    resized?.release();
    resizeCtx?.release();
    decoded.release();
    decodeCtx.release();
  }
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

    if (fileInfo.size && fileInfo.size > MAX_IMAGE_SOURCE_SIZE) {
      activeUploads.delete(uploadId);
      return { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'FILE_TOO_LARGE', message: 'התמונה גדולה מדי (מקסימום 30MB)' } };
    }

    if (handle.cancelled) return CANCELLED_RESULT;

    if (onProgress) {
      onProgress({ file_name: '', progress: 10, uploaded_bytes: 0, total_bytes: fileInfo.size || 0 });
    }

    // ⚡ compress מלא + הכנת thumb במקביל (reuse thumb מקומי אם כבר נוצר בבחירה)
    const localThumb = options?.localThumbnailUri || null;
    const [compressedResult, thumbBase64Result] = await Promise.all([
      (async (): Promise<PreparedImage> => {
        try {
          return await prepareImageForUpload(uri, fileInfo.size || 0);
        } catch (prepError) {
          logger.warn('ChatMedia', 'image compression failed, uploading original', prepError);
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
          return { base64, width: 0, height: 0, size: fileInfo.size || base64ByteLength(base64) };
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

    if (imageToUpload.size > MAX_IMAGE_SIZE) {
      activeUploads.delete(uploadId);
      return { url: null, thumbnail_url: null, width: 0, height: 0, size: 0, error: { code: 'FILE_TOO_LARGE', message: 'התמונה גדולה מדי (מקסימום 10MB)' } };
    }
    logger.debug(
      'ChatMedia',
      `uploadImage: ${fileInfo.size || 0}B → ${imageToUpload.size}B (${imageToUpload.width}x${imageToUpload.height})`,
    );

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
      onProgress({ file_name: fileName, progress: 100, uploaded_bytes: imageToUpload.size, total_bytes: imageToUpload.size, url: fileName });
    }

    activeUploads.delete(uploadId);
    return {
      url: fileName,
      thumbnail_url: thumbnailUrl,
      width: imageToUpload.width,
      height: imageToUpload.height,
      size: imageToUpload.size,
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

/**
 * העלאת סרטון ל-chat-media bucket.
 *
 * חשוב: לא ממירים את הקובץ ל-base64 (כמו ב-image/audio). וידאו לעיתים
 * קרובות שוקל 20–100MB, וקריאה של קובץ כזה ל-base64 (`readAsStringAsync`
 * ואז `decode` ל-ArrayBuffer) מנפחת את הזיכרון פי ~2.5 ומפילה את ה-JS
 * heap (bridge OOM שקט) — זו הסיבה שהעלאת סרטונים לא הצליחה בפועל.
 *
 * במקום זאת מעלים ישירות binary דרך `FileSystem.createUploadTask` שמזרים
 * את הקובץ ב-native side ל-Supabase Storage REST API. אין ניפוח זיכרון,
 * ובנוסף מקבלים progress אמיתי מ-native.
 */
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
  const failResult = (error: ChatError) => ({
    url: null,
    thumbnail_url: null,
    duration: 0,
    width: 0,
    height: 0,
    size: 0,
    error,
  });

  try {
    if (!validateGroupPath(groupId)) {
      return failResult({ code: 'INVALID_GROUP', message: 'Invalid group ID' });
    }

    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      logger.warn('ChatMedia', `uploadVideo: file not found uri=${uri.slice(0, 80)}`);
      return failResult({ code: 'FILE_NOT_FOUND', message: 'הקובץ לא נמצא' });
    }

    const sourceSize = typeof fileInfo.size === 'number' ? fileInfo.size : 0;
    if (sourceSize > MAX_VIDEO_SOURCE_SIZE) {
      logger.warn('ChatMedia', `uploadVideo: source too large size=${sourceSize}`);
      return failResult({ code: 'FILE_TOO_LARGE', message: 'הסרטון גדול מדי (מקסימום 100MB)' });
    }

    // דחיסה (1080p, ~5Mbps) לפני העלאה. בלי המודול הנייטיב / בכישלון — הקובץ המקורי.
    // progress: 0–40% דחיסה, 40–95% העלאה (בלי דחיסה: 5–95%).
    let compressionStarted = false;
    const compressed = await compressVideoForUpload(uri, (fraction) => {
      compressionStarted = true;
      onProgress?.({
        file_name: '',
        progress: Math.max(1, Math.min(40, Math.round(fraction * 40))),
        uploaded_bytes: 0,
        total_bytes: sourceSize,
      });
    });
    const uploadUri = compressed.uri;
    const fileSize = compressed.size || sourceSize;
    const progressBase = compressed.compressed || compressionStarted ? 40 : 5;

    if (fileSize > MAX_VIDEO_SIZE) {
      logger.warn('ChatMedia', `uploadVideo: file too large size=${fileSize}`);
      discardCompressedVideo(compressed);
      return failResult({ code: 'FILE_TOO_LARGE', message: 'הסרטון גדול מדי (מקסימום 100MB)' });
    }

    const timestamp = Date.now();
    const randomId = generateSecureId();
    const rawExt = uploadUri.split('?')[0].split('.').pop() || 'mp4';
    const extension = (rawExt.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) || 'mp4').toLowerCase();
    const fileName = `${groupId}/${timestamp}-${randomId}.${extension}`;

    const videoMimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      m4v: 'video/x-m4v',
      mov: 'video/quicktime',
      qt: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
      '3gp': 'video/3gpp',
    };
    const mimeType = videoMimeTypes[extension] || 'video/mp4';

    logger.info(
      'ChatMedia',
      `uploadVideo:start uri=${uploadUri.slice(0, 80)} size=${fileSize} source=${sourceSize} compressed=${compressed.compressed} mime=${mimeType} path=${fileName}`,
    );

    if (onProgress) {
      onProgress({ file_name: fileName, progress: progressBase, uploaded_bytes: 0, total_bytes: fileSize });
    }

    // ה-token של המשתמש נדרש עבור Storage RLS. אם אין session פעיל —
    // אין טעם לנסות (יתקבל 401 מ-storage).
    let accessToken: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token;
    } catch (sessionError) {
      logger.warn('ChatMedia', 'uploadVideo: getSession failed', sessionError);
    }
    if (!accessToken) {
      logger.error('ChatMedia', 'uploadVideo: no auth session, aborting');
      discardCompressedVideo(compressed);
      return failResult({ code: 'AUTH_REQUIRED', message: 'נדרשת התחברות מחדש' });
    }

    // Storage REST endpoint (POST על אובייקט חדש = insert). ה-path מכיל
    // רק [uuid]/[timestamp-hex].ext ולכן encodeURI מספיק (אין תווים מיוחדים).
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${CHAT_MEDIA_BUCKET}/${encodeURI(fileName)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': mimeType,
      'x-upsert': 'false',
      'cache-control': 'max-age=3600',
    };

    let lastError: { status?: number; body?: string; message?: string } | null = null;
    let uploadedOk = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const task = FileSystem.createUploadTask(
          uploadUrl,
          uploadUri,
          {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers,
          },
          (progress) => {
            if (!onProgress) return;
            const expected = progress.totalBytesExpectedToSend || fileSize || 0;
            const sent = progress.totalBytesSent || 0;
            const span = 95 - progressBase;
            const pct = expected > 0
              ? Math.max(progressBase, Math.min(95, Math.round((sent / expected) * span) + progressBase))
              : Math.round((progressBase + 95) / 2);
            onProgress({
              file_name: fileName,
              progress: pct,
              uploaded_bytes: sent,
              total_bytes: expected,
            });
          },
        );
        const response = await task.uploadAsync();
        if (!response) {
          lastError = { message: 'upload cancelled' };
        } else if (response.status >= 200 && response.status < 300) {
          logger.info(
            'ChatMedia',
            `uploadVideo:success attempt=${attempt} status=${response.status} path=${fileName}`,
          );
          uploadedOk = true;
          lastError = null;
          break;
        } else {
          lastError = {
            status: response.status,
            body: response.body,
            message: response.body || `HTTP ${response.status}`,
          };
          logger.warn(
            'ChatMedia',
            `uploadVideo:attempt=${attempt} failed status=${response.status} body=${(response.body || '').slice(0, 200)}`,
          );
        }
      } catch (netError: any) {
        lastError = { message: netError?.message || String(netError) };
        logger.warn('ChatMedia', `uploadVideo:attempt=${attempt} network error`, netError?.message);
      }
      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, 600 * attempt));
      }
    }

    if (!uploadedOk) {
      logger.error('ChatMedia', 'uploadVideo: failed after retries', lastError);
      discardCompressedVideo(compressed);
      const status = lastError?.status;
      const bodyStr = String(lastError?.body || lastError?.message || '').toLowerCase();
      const isTooLarge =
        Number(status) === 413 ||
        bodyStr.includes('payload too large') ||
        bodyStr.includes('exceeded') ||
        bodyStr.includes('maximum allowed size');
      const isAuth = Number(status) === 401 || Number(status) === 403;
      return failResult({
        code: isTooLarge ? 'FILE_TOO_LARGE' : isAuth ? 'AUTH_REQUIRED' : 'UPLOAD_ERROR',
        message: isTooLarge
          ? 'הסרטון גדול מדי (מקסימום 100MB)'
          : isAuth
            ? 'אין הרשאה להעלות לקבוצה זו'
            : 'שגיאה בהעלאת סרטון',
      });
    }

    if (onProgress) {
      onProgress({ file_name: fileName, progress: 95, uploaded_bytes: fileSize, total_bytes: fileSize });
    }

    // Thumbnail — best-effort. הת'אמב עצמו הוא JPEG של ~50KB, אז base64 בסדר.
    let thumbnailUrl: string | null = null;
    try {
      const frame = await VideoThumbnails.getThumbnailAsync(uploadUri, {
        time: 1000,
        quality: 0.7,
      });
      let thumbnailUri = frame.uri;
      // פריים מלא (4K/1080p) שוקל עד ~2MB — מקטינים ל-720px; ה-poster מוצג רק בבועה
      if (thumbnailUri && Math.max(frame.width || 0, frame.height || 0) > VIDEO_THUMB_MAX_EDGE) {
        try {
          const small = await ImageManipulator.manipulateAsync(
            thumbnailUri,
            [{ resize: (frame.width || 0) >= (frame.height || 0)
              ? { width: VIDEO_THUMB_MAX_EDGE }
              : { height: VIDEO_THUMB_MAX_EDGE } }],
            { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
          );
          if (small.uri) thumbnailUri = small.uri;
        } catch {
          /* נשאר עם הפריים המלא */
        }
      }

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
        } else {
          logger.warn('ChatMedia', 'uploadVideo: thumbnail upload failed', thumbError);
        }
      }
    } catch (thumbError) {
      logger.warn('ChatMedia', 'uploadVideo: could not generate video thumbnail', thumbError);
    }
    // הקובץ הדחוס הזמני כבר לא נחוץ (הבועה מנגנת מהמקור המקומי / מה-URL)
    discardCompressedVideo(compressed);

    if (onProgress) {
      onProgress({ file_name: fileName, progress: 100, uploaded_bytes: fileSize, total_bytes: fileSize, url: fileName });
    }

    logger.info(
      'ChatMedia',
      `uploadVideo:done path=${fileName} size=${fileSize} thumb=${thumbnailUrl ?? 'none'}`,
    );

    return {
      url: fileName,
      thumbnail_url: thumbnailUrl,
      duration: 0,
      width: 0,
      height: 0,
      size: fileSize,
      error: null,
    };
  } catch (error: any) {
    logger.error('ChatMedia', 'Unexpected video upload error', error);
    return failResult({ code: 'UNEXPECTED_ERROR', message: error?.message ?? 'שגיאה לא צפויה' });
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
    const rawExt = uri.split('?')[0].split('.').pop() || 'm4a';
    const extension = (rawExt.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) || 'm4a').toLowerCase();
    // m4a = קונטיינר MP4 (AAC) — audio/mp4 הוא ה-MIME התקני (AVPlayer/ExoPlayer)
    const audioMimeTypes: Record<string, string> = {
      m4a: 'audio/mp4',
      mp4: 'audio/mp4',
      aac: 'audio/aac',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      caf: 'audio/x-caf',
      ogg: 'audio/ogg',
      webm: 'audio/webm',
    };
    const audioContentType = audioMimeTypes[extension] || `audio/${extension}`;
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
          contentType: audioContentType,
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
