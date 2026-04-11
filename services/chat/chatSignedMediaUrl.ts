// ============================================
// קישורים חתומים למדיה ב-chat-media (bucket פרטי)
// ============================================

import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

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
