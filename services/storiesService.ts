/**
 * Stories Service – סטטוסים כמו WhatsApp Status
 * העלאה, שליפה, צפיות, מחיקה אוטומטית אחרי 24 שעות
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const STORY_DURATION_HOURS = 24;
const STORIES_BUCKET = 'chat-media';
const STORIES_PATH_PREFIX = 'stories';
const SIGNED_URL_EXPIRY = 3600; // 1 hour

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
async function getSignedUrl(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(STORIES_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);
    if (error || !data?.signedUrl) return null;
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
  const path = extractStoragePath(mediaUrl);
  return getSignedUrl(path);
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
    .from('users')
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

  if (currentUserId) {
    result.sort((a, b) => {
      if (a.user_id === currentUserId) return -1;
      if (b.user_id === currentUserId) return 1;
      if (a.has_viewed === b.has_viewed) return 0;
      return a.has_viewed ? 1 : -1;
    });
  }

  return result;
}

/**
 * Get stories for a specific user, with signed media URLs.
 */
export async function getStoriesByUserId(userId: string): Promise<UserStory[]> {
  const { data, error } = await supabase
    .from('user_stories')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const resolved = await Promise.all(
    data.map(async (story) => {
      if (story.media_url && (story.media_type === 'image' || story.media_type === 'video')) {
        const signedUrl = await resolveMediaUrl(story.media_url);
        return { ...story, media_url: signedUrl };
      }
      return story;
    })
  );

  return resolved;
}

export async function getMyStories(userId: string): Promise<UserStory[]> {
  return getStoriesByUserId(userId);
}

export async function uploadStoryImage(uri: string, userId: string): Promise<{ url: string | null; error: string | null }> {
  try {
    logger.debug('StoriesService', `uploadStoryImage: ${uri.substring(0, 80)}`);

    let base64: string;
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        uri, [],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      base64 = compressed.base64!;
      logger.debug('StoriesService', 'ImageManipulator JPEG+base64 ready');
    } catch {
      base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      logger.debug('StoriesService', 'Fallback: read file as base64');
    }

    const storagePath = `${STORIES_PATH_PREFIX}/${userId}/${Date.now()}.jpg`;
    logger.debug('StoriesService', `SDK uploading to ${storagePath}...`);

    let uploadError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await supabase.storage
        .from(STORIES_BUCKET)
        .upload(storagePath, decode(base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });
      uploadError = result.error;
      if (!uploadError) break;
      if (attempt < 3) await new Promise(res => setTimeout(res, 600 * attempt));
      logger.debug('StoriesService', `Upload attempt ${attempt} failed: ${uploadError?.message}`);
    }

    if (uploadError) {
      logger.error('StoriesService', 'Image upload failed after retries', uploadError);
      return { url: null, error: uploadError?.message || 'שגיאה בהעלאה' };
    }

    logger.debug('StoriesService', 'Upload success!');
    return { url: storagePath, error: null };
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
    const maxBytes = 20 * 1024 * 1024;
    if ((fileInfo as any).size > maxBytes) {
      return { url: null, error: 'הוידאו גדול מדי (מקסימום 20MB)' };
    }

    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

    const ext = uri.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
    const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
    const storagePath = `${STORIES_PATH_PREFIX}/${userId}/${Date.now()}.${ext}`;

    logger.debug('StoriesService', `SDK uploading video to ${storagePath}...`);

    let uploadError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await supabase.storage
        .from(STORIES_BUCKET)
        .upload(storagePath, decode(base64), {
          contentType,
          upsert: false,
        });
      uploadError = result.error;
      if (!uploadError) break;
      if (attempt < 3) await new Promise(res => setTimeout(res, 600 * attempt));
      logger.debug('StoriesService', `Video upload attempt ${attempt} failed: ${uploadError?.message}`);
    }

    if (uploadError) {
      logger.error('StoriesService', 'Video upload failed after retries', uploadError);
      return { url: null, error: uploadError?.message || 'שגיאה בהעלאה' };
    }

    logger.debug('StoriesService', 'Video upload success!');
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
