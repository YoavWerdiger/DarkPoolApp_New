/**
 * ציוצי קהילה — מיקרו-בלוג פנימי של חברי האפליקציה (לא חדשות חיצוניות).
 */

import type { ShareableAttachment } from './shareableEntity';

export interface CommunityPostAuthor {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

/** @mention של חבר קהילה */
export interface CommunityMention {
  userId: string;
  displayName: string;
}

export interface CommunityPost {
  id: string;
  userId: string;
  body: string;
  imageUrl: string | null;
  /** תאימות לאחור — הראשון מ־attachments */
  attachment: ShareableAttachment | null;
  /** כמה ישויות מצורפות (טרייד / אדם / חדשה…) */
  attachments: ShareableAttachment[];
  mentions: CommunityMention[];
  createdAt: string;
  updatedAt: string;
  author: CommunityPostAuthor;
  likeCount: number;
  likedByMe: boolean;
  replyCount: number;
}

export interface CommunityPostReply {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
  author: CommunityPostAuthor;
}

export interface CreateCommunityPostInput {
  body: string;
  imageUrl?: string | null;
  /** @deprecated העדיפו attachments */
  attachment?: ShareableAttachment | null;
  attachments?: ShareableAttachment[] | null;
  mentions?: CommunityMention[] | null;
}

export interface CreateCommunityPostReplyInput {
  postId: string;
  body: string;
}

export interface CommunityPostsPage {
  posts: CommunityPost[];
  hasMore: boolean;
}
