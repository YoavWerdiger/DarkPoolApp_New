/**
 * Stories Service – סטטוסים כמו WhatsApp Status
 * העלאה, שליפה, צפיות, מחיקה אוטומטית אחרי 24 שעות
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/publicEnv';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { compressVideoForUpload, discardCompressedVideo } from '../lib/videoCompressSafe';
import {
  isCacheableMediaPath,
  getCachedLocalMediaUri,
  downloadMediaToCache,
} from '../lib/mediaFileCache';

const STORY_DURATION_HOURS = 24;
const STORIES_BUCKET = 'chat-media';
const STORIES_PATH_PREFIX = 'stories';
const SIGNED_URL_EXPIRY = 3600; // 1 hour
/** רוחב מקסימלי לתמונת סטורי בהעלאה */
const STORY_MAX_WIDTH = 1440;

export interface UserStory {
  id: string;
  user_id: string;
  media_type: 'image' | 'video' | 'text';
  media_url: string | null;
  content: string | null;
  background_color: string | null;
  created_at: string;
  expires_at: string;
  user?: {
    id: string;
    display_name: string | null;
    full_name: string | null;
    profile_picture: string | null;
  };
  view_count?: number;
  has_viewed?: boolean;
}

export interface StoryWithUser extends UserStory {
  user: {
    id: string;
    display_name: string | null;
    full_name: string | null;
    profile_picture: string | null;
  };
  story_count: number;
}

/**
 * Extracts the storage path from a stored media_url.
 * Handles both full public URLs and plain paths.
 */
function extractStoragePath(mediaUrl: string): string {
  if (!mediaUrl) return mediaUrl;

  // Already a plain path (e.g. "stories/userId/123.jpg")
  if (!mediaUrl.startsWith('http')) return mediaUrl;

  // Full Supabase public URL → extract path after bucket name
  const marker = `/object/public/${STORIES_BUCKET}/`;
  const idx = mediaUrl.indexOf(marker);
  if (idx !== -1) {
    return mediaUrl.substring(idx + marker.length);
  }

  // Signed URL → extract path between bucket name and ?token=
  const signMarker = `/object/sign/${STORIES_BUCKET}/`;
  const signIdx = mediaUrl.indexOf(signMarker);
  if (signIdx !== -1) {
    const pathStart = signIdx + signMarker.length;
    const queryIdx = mediaUrl.indexOf('?', pathStart);
    return queryIdx !== -1 ? mediaUrl.substring(pathStart, queryIdx) : mediaUrl.substring(pathStart);
  }

  return mediaUrl;
}

/**
 * Generate a signed URL for a storage path in the stories bucket.
 * Returns null if signing fails.
 */
/**
 * קאש URL חתום לפי נתיב: בלי זה כל פתיחה יצרה URL חדש (טוקן אחר) — גם תמונה שכבר ירדה
 * לא זוהתה בקאש של התמונות ונטענה שוב (מסך שחור כמה שניות). נשמר עד 5 דק' לפני התפוגה.
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_REUSE_MS = (SIGNED_URL_EXPIRY - 300) * 1000;

async function getSignedUrl(storagePath: string): Promise<string | null> {
  const hit = signedUrlCache.get(storagePath);
  if (hit && hit.expiresAt > Date.now()) return hit.url;
  try {
    const { data, error } = await supabase.storage
      .from(STORIES_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);
    if (error || !data?.signedUrl) return null;
    signedUrlCache.set(storagePath, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_REUSE_MS });
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Resolve a media_url to a working signed URL.
 * Handles legacy public URLs, plain paths, and already-signed URLs.
 */
async function resolveMediaUrl(mediaUrl: string | null): Promise<string | null> {
  if (!mediaUrl) return null;
  // סטוריז חיים בשרת 24 שעות — תמיד URL חתום, בלי שמירה לדיסק
  return getSignedUrl(extractStoragePath(mediaUrl));
}

export async function getUsersWithStories(currentUserId?: string): Promise<StoryWithUser[]> {
  const { data: stories, error: storiesErr } = await supabase
    .from('user_stories')
    .select('id, user_id, media_type, media_url, content, created_at, expires_at, background_color')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (storiesErr) throw storiesErr;
  if (!stories || stories.length === 0) return [];

  const userIds = [...new Set(stories.map((s) => s.user_id))];
  const { data: users, error: usersErr } = await supabase
    .from('v_public_profiles')
    .select('id, display_name, full_name, profile_picture')
    .in('id', userIds);

  if (usersErr) throw usersErr;
  const userMap = new Map((users || []).map((u) => [u.id, u]));

  let viewedStoryIds = new Set<string>();
  if (currentUserId) {
    const storyIds = stories.map(s => s.id);
    const { data: views } = await supabase
      .from('user_story_views')
      .select('story_id')
      .eq('viewer_id', currentUserId)
      .in('story_id', storyIds);

    if (views) {
      viewedStoryIds = new Set(views.map(v => v.story_id));
    }
  }

  const byUser = new Map<string, { story: typeof stories[0]; count: number; allViewed: boolean }>();
  for (const s of stories) {
    const existing = byUser.get(s.user_id);
    if (existing) {
      existing.count++;
      if (!viewedStoryIds.has(s.id)) existing.allViewed = false;
    } else {
      byUser.set(s.user_id, {
        story: s,
        count: 1,
        allViewed: viewedStoryIds.has(s.id),
      });
    }
  }

  const result: StoryWithUser[] = [];
  for (const [userId, { story, count, allViewed }] of byUser) {
    result.push({
      ...story,
      has_viewed: allViewed,
      story_count: count,
      user: userMap.get(userId) ?? {
        id: userId,
        display_name: null,
        full_name: null,
        profile_picture: null,
      },
    });
  }

  const storyTime = (s: StoryWithUser) => {
    const t = new Date(s.created_at).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  /**
   * UI בשורת הסטטוסים: `ScrollView` עם `flexDirection: 'row'` — ישן משמאל, חדש מימין (ליד «הוסף»).
   */
  result.sort((a, b) => {
    const ta = storyTime(a);
    const tb = storyTime(b);
    if (ta !== tb) return ta - tb;
    if (a.has_viewed !== b.has_viewed) return a.has_viewed ? -1 : 1;
    return a.user_id.localeCompare(b.user_id);
  });

  /** «שלי» צמוד ל־«הוסף» בצד ימין */
  if (currentUserId) {
    const i = result.findIndex((s) => s.user_id === currentUserId);
    if (i !== -1 && i !== result.length - 1) {
      const [me] = result.splice(i, 1);
      result.push(me);
    }
  }

  return result;
}

/**
 * Get stories for a specific user, with signed media URLs.
 */
/** סטוריז לפי משתמש — קאש בזיכרון כדי שהצופה ייפתח מיד (נטען מראש מרשימת הצ'אטים) */
const storiesByUserCache = new Map<string, { data: UserStory[]; at: number }>();
const STORIES_CACHE_MS = 60_000;

/** הרשימה כוללת URL חתום (תוקף שעה) — מעבר ל-50 דק׳ לא משתמשים בה (אחרת מדיה פגה → מסך שחור/שגיאה) */
const STORIES_PEEK_MAX_AGE_MS = 50 * 60 * 1000;

export function peekStoriesCache(userId: string): UserStory[] | undefined {
  const hit = storiesByUserCache.get(userId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > STORIES_PEEK_MAX_AGE_MS) {
    storiesByUserCache.delete(userId);
    return undefined;
  }
  // סטורי שפג תוקפו לא מוצג גם מהקאש
  const now = new Date().toISOString();
  return hit.data.filter((s) => !s.expires_at || s.expires_at > now);
}

/**
 * טעינה מראש מהשורה ברשימת הצ'אטים: רשימת הסטוריז + URL חתום + הורדת התמונה הראשונה,
 * לכמה המשתמשים הראשונים — כשנכנסים לצופה הכל כבר מוכן.
 */
export async function prefetchStoriesForUsers(
  userIds: string[],
  prefetchImage: (uri: string) => void
): Promise<void> {
  for (const id of userIds) {
    try {
      const hit = storiesByUserCache.get(id);
      const data = hit && Date.now() - hit.at < STORIES_CACHE_MS ? hit.data : await getStoriesByUserId(id);
      const first = data[0];
      if (first?.media_type === 'image' && first.media_url?.startsWith('http')) prefetchImage(first.media_url);
    } catch {
      /* best effort */
    }
  }
}

/**
 * כל הסטוריז הפעילים של רשימת משתמשים — שאילתה אחת + URL חתום לכל מדיה.
 * הצופה טוען הכל בכניסה (בלי טעינה לפי משתמש ובלי קאש).
 */
export async function getStoriesForUsers(userIds: string[]): Promise<Record<string, UserStory[]>> {
  const out: Record<string, UserStory[]> = {};
  if (userIds.length === 0) return out;
  const { data, error } = await supabase
    .from('user_stories')
    .select('*')
    .in('user_id', userIds)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });
  if (error) throw error;
  const resolved = await Promise.all(
    (data ?? []).map(async (story: UserStory) => {
      if (story.media_url && (story.media_type === 'image' || story.media_type === 'video')) {
        return { ...story, media_url: await resolveMediaUrl(story.media_url) };
      }
      return story;
    }),
  );
  for (const s of resolved) (out[s.user_id] ??= []).push(s);
  return out;
}

export async function getStoriesByUserId(userId: string): Promise<UserStory[]> {
  const { data, error } = await supabase
    .from('user_stories')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) {
    storiesByUserCache.set(userId, { data: [], at: Date.now() });
    return [];
  }

  const resolved = await Promise.all(
    data.map(async (story) => {
      if (story.media_url && (story.media_type === 'image' || story.media_type === 'video')) {
        const signedUrl = await resolveMediaUrl(story.media_url);
        return { ...story, media_url: signedUrl };
      }
      return story;
    })
  );

  storiesByUserCache.set(userId, { data: resolved, at: Date.now() });
  return resolved;
}

export async function getMyStories(userId: string): Promise<UserStory[]> {
  return getStoriesByUserId(userId);
}

/**
 * העלאה נייטיבית של קובץ מהדיסק ל-Storage (כמו וידאו בצ'אט) — בלי base64 ב-JS.
 * קודם הקובץ הומר ל-base64 ונפרש ב-JS (decode): וידאו של כמה MB (ב-Expo Go בלי דחיסה) הקפיא את המסך.
 */
async function uploadFileToStories(
  fileUri: string,
  storagePath: string,
  contentType: string,
): Promise<string | null> {
  let accessToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  } catch {
    /* handled below */
  }
  if (!accessToken) return 'נדרשת התחברות מחדש';

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORIES_BUCKET}/${encodeURI(storagePath)}`;
  let lastError = 'שגיאה בהעלאה';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await FileSystem.uploadAsync(uploadUrl, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': contentType,
          'x-upsert': 'false',
        },
      });
      if (res.status >= 200 && res.status < 300) return null;
      lastError = res.body?.slice(0, 200) || `HTTP ${res.status}`;
      logger.debug('StoriesService', `Upload attempt ${attempt} failed: ${lastError}`);
    } catch (e: any) {
      lastError = e?.message || String(e);
      logger.debug('StoriesService', `Upload attempt ${attempt} network error: ${lastError}`);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 600 * attempt));
  }
  return lastError;
}

export async function uploadStoryImage(
  uri: string,
  userId: string,
): Promise<{ url: string | null; error: string | null; displayUri?: string }> {
  try {
    logger.debug('StoriesService', `uploadStoryImage: ${uri.substring(0, 80)}`);

    // עותק מוקטן (1440, JPEG) — גם להעלאה וגם לתצוגה מיידית; המקור מהמצלמה (~24MP) כבד מדי
    let uploadUri = uri;
    let displayUri: string | undefined;
    try {
      const probe = await ImageManipulator.manipulateAsync(uri, []);
      const actions = probe.width > STORY_MAX_WIDTH ? [{ resize: { width: STORY_MAX_WIDTH } }] : [];
      const compressed = await ImageManipulator.manipulateAsync(probe.uri, actions, {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      uploadUri = compressed.uri;
      displayUri = compressed.uri;
    } catch {
      logger.debug('StoriesService', 'ImageManipulator failed — uploading original file');
    }

    const storagePath = `${STORIES_PATH_PREFIX}/${userId}/${Date.now()}.jpg`;
    const error = await uploadFileToStories(uploadUri, storagePath, 'image/jpeg');
    if (error) {
      logger.error('StoriesService', 'Image upload failed after retries', error);
      return { url: null, error };
    }
    return { url: storagePath, error: null, displayUri };
  } catch (e: any) {
    logger.error('StoriesService', 'uploadStoryImage exception', e);
    return { url: null, error: e?.message || 'שגיאה בהעלאה' };
  }
}

export async function uploadStoryVideo(uri: string, userId: string): Promise<{ url: string | null; error: string | null }> {
  try {
    logger.debug('StoriesService', `uploadStoryVideo: ${uri.substring(0, 80)}`);

    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) return { url: null, error: 'הקובץ לא נמצא' };

    // דחיסה קודם (1080p, ~5Mbps) — ואז בדיקת המגבלה על מה שעולה בפועל.
    // בלי המודול הנייטיב (Expo Go / בילד ישן) או בכישלון — הקובץ המקורי.
    const compressed = await compressVideoForUpload(uri);
    const uploadUri = compressed.uri;
    const maxBytes = 20 * 1024 * 1024;
    const size = compressed.size || (fileInfo as any).size || 0;
    if (size > maxBytes) {
      discardCompressedVideo(compressed);
      return { url: null, error: 'הוידאו גדול מדי (מקסימום 20MB)' };
    }

    const ext = uploadUri.split('?')[0].toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
    const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
    const storagePath = `${STORIES_PATH_PREFIX}/${userId}/${Date.now()}.${ext}`;

    let error: string | null;
    try {
      error = await uploadFileToStories(uploadUri, storagePath, contentType);
    } finally {
      discardCompressedVideo(compressed);
    }
    if (error) {
      logger.error('StoriesService', 'Video upload failed after retries', error);
      return { url: null, error };
    }
    return { url: storagePath, error: null };
  } catch (e: any) {
    logger.error('StoriesService', 'uploadStoryVideo exception', e);
    return { url: null, error: e?.message || 'שגיאה בהעלאה' };
  }
}

export async function markStoryViewed(storyId: string, viewerId: string): Promise<void> {
  const { error } = await supabase.from('user_story_views').upsert(
    { story_id: storyId, viewer_id: viewerId },
    { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }
  );
  if (error) {
    logger.error('StoriesService', 'markStoryViewed failed', error);
  }
}

export interface StoryViewer {
  story_id: string;
  viewer_id: string;
  viewed_at: string;
  user: {
    id: string;
    display_name: string | null;
    full_name: string | null;
    profile_picture: string | null;
  };
}

/**
 * Get all viewers of a story (for the story owner). Joined with users so
 * we can render avatar + display name in the viewers sheet.
 */
export async function getStoryViewers(storyId: string): Promise<StoryViewer[]> {
  const { data, error } = await supabase
    .from('user_story_views')
    .select('story_id, viewer_id, viewed_at')
    .eq('story_id', storyId)
    .order('viewed_at', { ascending: false });

  if (error) {
    logger.error('StoriesService', 'getStoryViewers failed', error);
    return [];
  }
  if (!data || data.length === 0) return [];

  const ids = [...new Set(data.map((v: any) => v.viewer_id))];
  const { data: users } = await supabase
    .from('v_public_profiles')
    .select('id, display_name, full_name, profile_picture')
    .in('id', ids);
  const userMap = new Map((users || []).map((u) => [u.id, u]));

  return (data as any[]).map((v) => ({
    story_id: v.story_id,
    viewer_id: v.viewer_id,
    viewed_at: v.viewed_at,
    user: userMap.get(v.viewer_id) ?? {
      id: v.viewer_id,
      display_name: null,
      full_name: null,
      profile_picture: null,
    },
  }));
}

export async function createStory(
  userId: string,
  input: {
    media_type: 'image' | 'video' | 'text';
    media_url?: string;
    content?: string;
    background_color?: string;
  }
): Promise<UserStory> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + STORY_DURATION_HOURS);

  const { data, error } = await supabase
    .from('user_stories')
    .insert({
      user_id: userId,
      media_type: input.media_type,
      media_url: input.media_url || null,
      content: input.content || null,
      background_color: input.background_color || null,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStory(storyId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_stories')
    .delete()
    .eq('id', storyId)
    .eq('user_id', userId);

  if (error) throw error;
}

/* ============================================
 *  Story Reactions
 * ============================================ */

export interface StoryReaction {
  id: string;
  story_id: string;
  reactor_id: string;
  emoji: string;
  created_at: string;
  updated_at: string;
}

/**
 * Send / update a reaction to a story.
 * If the user already reacted, the emoji is replaced (upsert).
 * Returns null on success or an error message.
 */
export async function reactToStory(
  storyId: string,
  reactorId: string,
  emoji: string,
): Promise<string | null> {
  try {
    const { error } = await supabase
      .from('user_story_reactions')
      .upsert(
        {
          story_id: storyId,
          reactor_id: reactorId,
          emoji,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'story_id,reactor_id' },
      );

    if (error) {
      // Table missing (migration 013 not yet applied) → quiet debug log.
      // Don't spam Sentry until the DB catches up.
      if ((error as any).code === '42P01') {
        logger.debug('StoriesService', 'reactToStory: table missing (migration not applied yet)');
        return 'טבלת הריאקציות עדיין לא נוצרה במסד';
      }
      logger.error('StoriesService', 'reactToStory failed', error);
      return error.message || 'שגיאה בשליחת ריאקציה';
    }
    return null;
  } catch (e: any) {
    logger.error('StoriesService', 'reactToStory exception', e);
    return e?.message || 'שגיאה בשליחת ריאקציה';
  }
}

/**
 * Remove the current user's reaction from a story.
 */
export async function removeStoryReaction(
  storyId: string,
  reactorId: string,
): Promise<void> {
  const { error } = await supabase
    .from('user_story_reactions')
    .delete()
    .eq('story_id', storyId)
    .eq('reactor_id', reactorId);

  if (error) {
    logger.error('StoriesService', 'removeStoryReaction failed', error);
    throw error;
  }
}

/**
 * Return the current user's own reaction to a specific story, if any.
 */
export async function getMyStoryReaction(
  storyId: string,
  reactorId: string,
): Promise<StoryReaction | null> {
  const { data, error } = await supabase
    .from('user_story_reactions')
    .select('*')
    .eq('story_id', storyId)
    .eq('reactor_id', reactorId)
    .maybeSingle();

  if (error) {
    // Table missing (migration 013 not yet applied) — silent, no Sentry noise.
    if ((error as any).code === '42P01') {
      logger.debug('StoriesService', 'getMyStoryReaction: table missing (migration not applied yet)');
      return null;
    }
    logger.error('StoriesService', 'getMyStoryReaction failed', error);
    return null;
  }
  return (data as StoryReaction) || null;
}

/**
 * Get all reactions on a story (for the story owner to see).
 * Joins with users so we can show avatars/names.
 */
export async function getStoryReactions(
  storyId: string,
): Promise<Array<StoryReaction & { user: { id: string; display_name: string | null; full_name: string | null; profile_picture: string | null } }>> {
  const { data, error } = await supabase
    .from('user_story_reactions')
    .select('*')
    .eq('story_id', storyId)
    .order('updated_at', { ascending: false });

  if (error) {
    if ((error as any).code === '42P01') {
      logger.debug('StoriesService', 'getStoryReactions: table missing (migration not applied yet)');
      return [];
    }
    logger.error('StoriesService', 'getStoryReactions failed', error);
    return [];
  }
  if (!data || data.length === 0) return [];

  const reactorIds = [...new Set(data.map((r: any) => r.reactor_id))];
  const { data: users } = await supabase
    .from('v_public_profiles')
    .select('id, display_name, full_name, profile_picture')
    .in('id', reactorIds);
  const userMap = new Map((users || []).map((u) => [u.id, u]));

  return (data as StoryReaction[]).map((r) => ({
    ...r,
    user: userMap.get(r.reactor_id) ?? {
      id: r.reactor_id,
      display_name: null,
      full_name: null,
      profile_picture: null,
    },
  }));
}
