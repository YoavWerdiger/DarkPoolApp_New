// ============================================
// קישורים חתומים למדיה ב-chat-media (bucket פרטי)
// ============================================

import { Image as ExpoImage } from 'expo-image';
import { Image as RNImage } from 'react-native';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import type { ChatMessage } from '../../types/chat.types';
import { ChatMessageType } from '../../types/chat.types';
import {
  getCachedLocalMediaUri,
  downloadMediaToCache,
  isCacheableMediaPath,
} from '../../lib/mediaFileCache';

const BUCKET = 'chat-media';
const TAG = 'ChatSignedMedia';
const SIGN_TTL_SEC = 3600;
/** מטמון — חידוש ~10 דק׳ לפני פקיעת הטוקן */
const CACHE_MS = (SIGN_TTL_SEC - 600) * 1000;
/**
 * חתימה היא קריאת metadata מהירה. ל-fetch של supabase אין timeout מובנה, ולכן
 * חיבור שנתקע (למשל רשת חלשה / iOS cold start) היה משאיר את ה-Promise תלוי לנצח.
 * ה-timeout הופך תקיעה לכשל רגיל, ו-retry מוודא שכשל חולף לא ישאיר את המדיה
 * "לא נטענת" לצמיתות (הצרכן מציג ספינר עד שמתקבל URL תקין).
 */
const SIGN_TIMEOUT_MS = 10000;
const SIGN_BATCH_TIMEOUT_MS = 20000;
const SIGN_MAX_ATTEMPTS = 3;

/** עוטף Promise ב-timeout כדי שתקיעת רשת לא תשאיר את הזרימה תלויה לנצח */
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * חותם נתיב יחיד עם timeout + retry. מחזיר signed URL, או null רק אחרי שכל הניסיונות
 * נכשלו — כדי שכשל חולף (timeout/רשת) יתאושש ולא יקבע ספינר קבוע בצד המציג.
 */
async function createSignedUrlWithRetry(path: string): Promise<string | null> {
  for (let attempt = 1; attempt <= SIGN_MAX_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await withTimeout(
        supabase.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL_SEC),
        SIGN_TIMEOUT_MS,
        'createSignedUrl',
      );
      if (!error && data?.signedUrl) return data.signedUrl;
      logger.warn(TAG, 'createSignedUrl failed', { path, attempt, message: error?.message });
    } catch (e) {
      logger.warn(TAG, 'createSignedUrl exception', { path, attempt, error: String(e) });
    }
    if (attempt < SIGN_MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  return null;
}

type CacheEntry = { url: string; expiresAt: number };
const pathCache = new Map<string, CacheEntry>();

/**
 * מחלץ נתיב אחסון ממזהה שמור בהודעה:
 * - כבר נתיב: `uuid/קובץ.jpg`
 * - URL ציבורי ישן: .../object/public/chat-media/uuid/...
 * - URL חתום ישן: .../object/sign/chat-media/...
 */
export function chatMediaStoragePathFromRef(ref: string | null | undefined): string | null {
  if (!ref || typeof ref !== 'string') return null;
  const t = ref.trim();
  if (!t) return null;
  if (t.startsWith('file:') || t.startsWith('content:') || t.startsWith('blob:')) {
    return null;
  }
  if (!t.includes('://')) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i.test(t)) {
      return t;
    }
    return null;
  }
  try {
    const u = new URL(t);
    const pub = u.pathname.match(/\/object\/public\/chat-media\/(.+)$/i);
    if (pub) return decodeURIComponent(pub[1].split('?')[0]);
    const sig = u.pathname.match(/\/object\/sign\/chat-media\/(.+)$/i);
    if (sig) return decodeURIComponent(sig[1].split('?')[0]);
    const legacy = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/chat-media\/(.+)$/i);
    if (legacy) return decodeURIComponent(legacy[1].split('?')[0]);
  } catch {
    return null;
  }
  return null;
}

/**
 * מחזיר URI לתצוגה: חתימה לנתיב ב-bucket, או את המקור אם זה מקומי/חיצוני ללא נתיב.
 */
export async function getChatMediaDisplayUri(ref: string | null | undefined): Promise<string | null> {
  if (!ref || typeof ref !== 'string') return null;
  const t = ref.trim();
  if (!t) return null;
  if (t.startsWith('file:') || t.startsWith('content:') || t.startsWith('blob:')) {
    return t;
  }

  const path = chatMediaStoragePathFromRef(t);
  if (!path) {
    if (t.startsWith('http://') || t.startsWith('https://')) {
      return t;
    }
    return null;
  }

  // קובץ שמור מקומית (אודיו/וידאו/מסמך) — מוחזר מיד, עובד גם offline
  const localUri = getCachedLocalMediaUri(path);
  if (localUri) return localUri;

  const now = Date.now();
  const hit = pathCache.get(path);
  if (hit && hit.expiresAt > now) {
    if (isCacheableMediaPath(path)) {
      void downloadMediaToCache(path, hit.url);
    }
    return hit.url;
  }

  const signedUrl = await createSignedUrlWithRetry(path);
  if (!signedUrl) {
    if (t.startsWith('http')) return t;
    return null;
  }
  pathCache.set(path, { url: signedUrl, expiresAt: now + CACHE_MS });
  // הורדה ברקע לדיסק כדי שהפעם הבאה תהיה מיידית/offline
  if (isCacheableMediaPath(path)) {
    void downloadMediaToCache(path, signedUrl);
  }
  return signedUrl;
}

export function invalidateChatMediaPathCache(path: string): void {
  pathCache.delete(path);
}

export function clearChatMediaPathCache(): void {
  pathCache.clear();
}

const SIGN_BATCH_SIZE = 40;
const IMAGE_PREFETCH_CONCURRENCY = 10;

function mediaRefsFromMessage(msg: ChatMessage): string[] {
  const refs: string[] = [];
  const push = (r?: string | null) => {
    if (r && typeof r === 'string' && r.trim()) refs.push(r.trim());
  };
  push(msg.media_url);
  push(msg.media_thumbnail_url);
  if (msg.media_urls?.length) {
    for (const item of msg.media_urls) {
      push(item.url);
      push(item.thumbnail_url);
    }
  }
  return refs;
}

function pathsNeedingSignature(refs: string[]): string[] {
  const paths = new Set<string>();
  const now = Date.now();
  for (const ref of refs) {
    const path = chatMediaStoragePathFromRef(ref);
    if (!path) continue;
    const hit = pathCache.get(path);
    if (!hit || hit.expiresAt <= now) paths.add(path);
  }
  return [...paths];
}

async function signStoragePathsBatch(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  for (let i = 0; i < paths.length; i += SIGN_BATCH_SIZE) {
    const chunk = paths.slice(i, i + SIGN_BATCH_SIZE);
    try {
      const { data, error } = await withTimeout(
        supabase.storage.from(BUCKET).createSignedUrls(chunk, SIGN_TTL_SEC),
        SIGN_BATCH_TIMEOUT_MS,
        'createSignedUrls',
      );

      if (error || !data) {
        logger.warn(TAG, 'createSignedUrls failed', { message: error?.message });
        await Promise.all(chunk.map((path) => getChatMediaDisplayUri(path)));
        continue;
      }

      const now = Date.now();
      for (const row of data) {
        if (row?.path && row.signedUrl && !row.error) {
          pathCache.set(row.path, { url: row.signedUrl, expiresAt: now + CACHE_MS });
        }
      }
    } catch (e) {
      logger.warn(TAG, 'createSignedUrls exception', e);
      await Promise.all(chunk.map((path) => getChatMediaDisplayUri(path)));
    }
  }
}

/** URI מחוטם שכבר ב-cache — לשימוש סינכרוני ב-mount (לפני async createSignedUrl). */
export function getCachedChatMediaDisplayUri(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const path = chatMediaStoragePathFromRef(ref);
  if (path) {
    const localUri = getCachedLocalMediaUri(path);
    if (localUri) return localUri;
    const hit = pathCache.get(path);
    if (hit && hit.expiresAt > Date.now()) return hit.url;
    return null;
  }
  if (ref.startsWith('http://') || ref.startsWith('https://')) return ref;
  if (ref.startsWith('file:') || ref.startsWith('content:') || ref.startsWith('blob:')) return ref;
  return null;
}

function cachedDisplayUri(ref: string | null | undefined): string | null {
  return getCachedChatMediaDisplayUri(ref);
}

function imageUrisToWarmFromMessages(messages: ChatMessage[]): { thumbs: string[]; full: string[] } {
  const thumbs: string[] = [];
  const full: string[] = [];
  const seen = new Set<string>();

  const add = (uri: string | null, bucket: string[]) => {
    if (!uri || seen.has(uri)) return;
    seen.add(uri);
    bucket.push(uri);
  };

  for (const msg of messages) {
    if (
      msg.message_type === ChatMessageType.IMAGE ||
      msg.message_type === ChatMessageType.VIDEO
    ) {
      add(cachedDisplayUri(msg.media_thumbnail_url), thumbs);
      add(cachedDisplayUri(msg.media_url), full);
    } else if (msg.message_type === ChatMessageType.MEDIA_GROUP && msg.media_urls?.length) {
      for (const item of msg.media_urls) {
        add(cachedDisplayUri(item.thumbnail_url), thumbs);
        add(cachedDisplayUri(item.url), full);
      }
    }
  }

  return { thumbs, full };
}

async function prefetchImageUris(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  for (let i = 0; i < urls.length; i += IMAGE_PREFETCH_CONCURRENCY) {
    const batch = urls.slice(i, i + IMAGE_PREFETCH_CONCURRENCY);
    await Promise.all(
      batch.map((uri) =>
        Promise.all([
          ExpoImage.prefetch(uri).catch(() => {}),
          RNImage.prefetch(uri).catch(() => {}),
        ]),
      ),
    );
  }
}

/**
 * חתימה מרוכזת לפריטי MEDIA_GROUP — מחזיר map id→URI לתצוגה (thumb קודם).
 */
export async function signMediaGroupItemsForDisplay(
  items: { id: string; url: string; thumbnail_url?: string | null }[],
): Promise<Record<string, string>> {
  if (!items.length) return {};

  const refs: string[] = [];
  for (const it of items) {
    if (it.url?.trim()) refs.push(it.url.trim());
    if (it.thumbnail_url?.trim()) refs.push(it.thumbnail_url.trim());
  }
  await signStoragePathsBatch(pathsNeedingSignature(refs));

  const out: Record<string, string> = {};
  for (const it of items) {
    const uri =
      getCachedChatMediaDisplayUri(it.thumbnail_url) ||
      getCachedChatMediaDisplayUri(it.url);
    if (uri) out[it.id] = uri;
  }
  return out;
}

/**
 * חתימה מרוכזת + prefetch לדיסק — כדי שמדיה בהודעות ישנות תהיה מוכנה לפני שהן נכנסות ל-FlatList.
 */
export async function prefetchChatMediaForMessages(messages: ChatMessage[]): Promise<void> {
  if (!messages.length) return;

  const refs = messages.flatMap(mediaRefsFromMessage);
  const paths = pathsNeedingSignature(refs);
  await signStoragePathsBatch(paths);

  const { thumbs, full } = imageUrisToWarmFromMessages(messages);
  await prefetchImageUris(thumbs);
  await prefetchImageUris(full);

  await prefetchCacheableMediaFiles(refs);
}

const MEDIA_FILE_PREFETCH_CONCURRENCY = 4;

/** מוריד לדיסק אודיו/וידאו/מסמכים מההודעות (תמונות מטופלות ע"י expo-image) */
async function prefetchCacheableMediaFiles(refs: string[]): Promise<void> {
  const targets: string[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const path = chatMediaStoragePathFromRef(ref);
    if (!path || seen.has(path) || !isCacheableMediaPath(path)) continue;
    if (getCachedLocalMediaUri(path)) continue;
    seen.add(path);
    targets.push(path);
  }
  if (targets.length === 0) return;

  for (let i = 0; i < targets.length; i += MEDIA_FILE_PREFETCH_CONCURRENCY) {
    const batch = targets.slice(i, i + MEDIA_FILE_PREFETCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (path) => {
        const signed = await getChatMediaDisplayUri(path);
        if (signed && signed.startsWith('http')) {
          await downloadMediaToCache(path, signed);
        }
      }),
    );
  }
}
