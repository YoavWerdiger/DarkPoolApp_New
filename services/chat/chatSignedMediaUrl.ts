// ============================================
// קישורים חתומים למדיה ב-chat-media (bucket פרטי)
// ============================================

import { Image as ExpoImage } from 'expo-image';
import { Image as RNImage } from 'react-native';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import type { ChatMessage } from '../../types/chat.types';
import { ChatMessageType } from '../../types/chat.types';

const BUCKET = 'chat-media';
const TAG = 'ChatSignedMedia';
const SIGN_TTL_SEC = 3600;
/** מטמון — חידוש ~10 דק׳ לפני פקיעת הטוקן */
const CACHE_MS = (SIGN_TTL_SEC - 600) * 1000;

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

  const now = Date.now();
  const hit = pathCache.get(path);
  if (hit && hit.expiresAt > now) {
    return hit.url;
  }

  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL_SEC);
    if (error || !data?.signedUrl) {
      logger.warn(TAG, 'createSignedUrl failed', { path, message: error?.message });
      if (t.startsWith('http')) return t;
      return null;
    }
    pathCache.set(path, { url: data.signedUrl, expiresAt: now + CACHE_MS });
    return data.signedUrl;
  } catch (e) {
    logger.warn(TAG, 'createSignedUrl exception', e);
    if (t.startsWith('http')) return t;
    return null;
  }
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
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(chunk, SIGN_TTL_SEC);

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
}
