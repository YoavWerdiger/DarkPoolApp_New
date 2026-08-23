// ============================================
// Chat System - TypeScript Types & Interfaces
// ============================================

// ============================================
// Enums
// ============================================

export enum ChatMessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  SYSTEM = 'system',
  POLL = 'poll',
  MEDIA_GROUP = 'media_group', // Multiple media items in one message
  /** יומן מסחר — תוכן JSON: { "trade": { ... } } */
  TRADE = 'trade',
}

/**
 * חייב להתאים ל־`valid_message_type` בבסיס הנתונים
 * (ראה `supabase/migrations/010_chat_message_type_trade_and_media_group.sql`).
 */
export const CHAT_MESSAGE_TYPES_ALLOWED_IN_DB: readonly ChatMessageType[] = [
  ChatMessageType.TEXT,
  ChatMessageType.IMAGE,
  ChatMessageType.VIDEO,
  ChatMessageType.AUDIO,
  ChatMessageType.DOCUMENT,
  ChatMessageType.SYSTEM,
  ChatMessageType.POLL,
  ChatMessageType.MEDIA_GROUP,
  ChatMessageType.TRADE,
] as const;

export function isChatMessageTypeAllowedInDb(t: string): t is ChatMessageType {
  return (CHAT_MESSAGE_TYPES_ALLOWED_IN_DB as readonly string[]).includes(t);
}

// Media item for MEDIA_GROUP messages
export interface MediaGroupItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration?: number; // for videos
}

export enum ChatMemberRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum SystemMessageType {
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  GROUP_CREATED = 'group_created',
  GROUP_NAME_CHANGED = 'group_name_changed',
  GROUP_AVATAR_CHANGED = 'group_avatar_changed',
  GROUP_DESCRIPTION_CHANGED = 'group_description_changed',
  MEMBER_PROMOTED = 'member_promoted',
  MEMBER_DEMOTED = 'member_demoted',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

// ============================================
// Group Interfaces
// ============================================

export interface ChatGroupSettings {
  muteNotifications?: boolean;
  onlyAdminsCanSend?: boolean;
  onlyAdminsCanEditInfo?: boolean;
  showJoinMessages?: boolean;
  allowMembersToAddOthers?: boolean;
  // Group visibility / posting model (stored on JSONB settings column).
  // is_announcement mirrors onlyAdminsCanSend semantics at the UI layer;
  // is_public controls whether the group is discoverable to non-members.
  is_announcement?: boolean;
  is_public?: boolean;
}

export interface ChatGroup {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  members_count: number;
  messages_count: number;
  last_message_at?: string;
  last_message_preview?: string;
  settings: ChatGroupSettings;

  // מטא-דאטה מחושבת (לא מהדאטאבייס)
  unread_count?: number;
  mentioned_count?: number;
  is_muted?: boolean;
  my_role?: ChatMemberRole;
  /** מגיע מ-chat_group_members.last_read_message_id (nullable ב-DB) */
  last_read_message_id?: string | null;
  /** שם שולח ההודעה האחרונה — לפרביו ברשימת קבוצות (client-only) */
  last_message_sender_name?: string;
  /** סוג ההודעה האחרונה — לאייקון/פריוויו ברשימה (client-only) */
  last_message_type?: string;
}

export interface ChatGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: ChatMemberRole;
  joined_at: string;
  muted: boolean;
  notifications_enabled: boolean;
  last_read_message_id?: string;
  last_read_at?: string;
  unread_count: number;
  mentioned_count: number;

  // מטא-דאטה מתוך users
  user?: {
    id: string;
    display_name: string;
    full_name?: string;
    profile_picture?: string;
    email?: string;
    is_online?: boolean;
    last_active?: string;
  };
}

// ============================================
// Message Interfaces
// ============================================

export interface ChatMessageMedia {
  url: string;
  thumbnail_url?: string;
  type: string; // MIME type
  size?: number; // bytes
  duration?: number; // seconds for video/audio
  width?: number;
  height?: number;
  file_name?: string;
}

export interface ChatMessageReply {
  message_id: string;
  content?: string;
  sender_id: string;
  sender_name: string;
  message_type: ChatMessageType;
  media_url?: string;
}

export interface ChatMessageForward {
  from_group_id: string;
  from_group_name?: string;
  from_message_id: string;
  original_sender_id: string;
  original_sender_name?: string;
}

export interface SystemMessageData {
  user_id?: string;
  user_name?: string;
  admin_id?: string;
  admin_name?: string;
  old_value?: string;
  new_value?: string;
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  group_id: string;
  sender_id: string;

  content?: string;
  message_type: ChatMessageType;
  type?: ChatMessageType;

  // מדיה
  media_url?: string;
  media_thumbnail_url?: string;
  media_type?: string;
  media_size?: number;
  media_duration?: number;
  media_width?: number;
  media_height?: number;
  media_file_name?: string;
  
  // מדיה מרובה (לסוג MEDIA_GROUP)
  media_urls?: MediaGroupItem[];
  local_media_urls?: { id: string; uri: string; type: 'image' | 'video' }[]; // For optimistic UI

  // השבה
  reply_to_message_id?: string;

  // העברה
  forwarded_from_group_id?: string;
  forwarded_from_message_id?: string;
  is_forwarded: boolean;

  // תיוג
  mentioned_users: string[];

  // סטטוס
  is_edited: boolean;
  edited_at?: string;
  is_deleted: boolean;
  deleted_at?: string;
  deleted_for_everyone: boolean;
  is_silent: boolean;

  // הודעת מערכת
  is_system_message: boolean;
  system_message_type?: SystemMessageType;
  system_message_data?: SystemMessageData;

  // זמנים
  created_at: string;

  // מטא-דאטה
  reactions_count: number;
  read_by_count: number;

  // מטא-דאטה מחושבת (לא מהדאטאבייס)
  sender?: {
    id: string;
    display_name: string;
    profile_picture?: string;
    is_online?: boolean;
  };
  reply_to?: ChatMessageReply;
  forward_info?: ChatMessageForward;
  reactions?: ChatReactionGroup[];
  is_starred_by_me?: boolean;
  is_read_by_me?: boolean;
  is_sending?: boolean; // לאופטימיסטי UI
  send_error?: string; // אם נכשל
  
  // Optimistic media upload
  local_media_uri?: string;
  upload_progress?: number;
  is_uploading?: boolean;

  metadata?: {
    waveformData?: number[];
    media_urls?: MediaGroupItem[];
    mentioned_users?: string[];
    [key: string]: any;
  };
}

// ============================================
// Reaction Interfaces
// ============================================

export interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;

  // מטא-דאטה
  user?: {
    id: string;
    display_name: string;
    profile_picture?: string;
  };
}

export interface ChatReactionGroup {
  emoji: string;
  count: number;
  users: Array<{
    id: string;
    name: string;
    profile_picture?: string | null;
  }>;
  reacted_by_me: boolean;
}

// ============================================
// Starred Message Interface
// ============================================

export interface ChatStarredMessage {
  id: string;
  message_id: string;
  user_id: string;
  group_id: string;
  starred_at: string;

  // מטא-דאטה
  message?: ChatMessage;
}

// ============================================
// Read Receipt Interface
// ============================================

export interface ChatMessageRead {
  id: string;
  message_id: string;
  user_id: string;
  group_id: string;
  read_at: string;

  // מטא-דאטה
  user?: {
    id: string;
    display_name: string;
    profile_picture?: string;
  };
}

// ============================================
// Typing Indicator Interface
// ============================================

export interface ChatTypingIndicator {
  id: string;
  group_id: string;
  user_id: string;
  userName?: string; // Aliased from user.display_name for compatibility
  started_typing_at: string;

  // מטא-דאטה
  user?: {
    id: string;
    display_name: string;
  };
}

// ============================================
// Report Interface
// ============================================

export interface ChatMessageReport {
  id: string;
  message_id: string;
  reported_by: string;
  reason: string;
  description?: string;
  status: ReportStatus;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

// ============================================
// API Response Types
// ============================================

export interface ChatGroupWithDetails extends Omit<ChatGroup, 'last_read_message_id'> {
  members: ChatGroupMember[];
  my_membership?: ChatGroupMember;
  is_admin: boolean;
  last_read_message_id?: string | null;
}

export interface ChatMessagesResponse {
  messages: ChatMessage[];
  has_more: boolean;
  next_offset: number;
  total_count?: number;
}

export interface ChatSearchResult {
  message: ChatMessage;
  group: ChatGroup;
  highlights: string[];
}

// ============================================
// Input/Action Types
// ============================================

export interface CreateChatGroupInput {
  name: string;
  description?: string;
  avatar_url?: string;
  /** IDs של משתמשים להוסיף בעת יצירה. עשוי להיות ריק / לא קיים — היוצר יתווסף כאדמין בכל מקרה. */
  member_ids?: string[];
  settings?: Partial<ChatGroupSettings>;
}

export interface UpdateChatGroupInput {
  name?: string;
  description?: string;
  avatar_url?: string;
  settings?: Partial<ChatGroupSettings>;
}

export interface SendChatMessageInput {
  group_id: string;
  content?: string;
  sender_id?: string; // L4: נשמר בתור offline כדי לדעת מי שלח
  /**
   * Stable client-generated identifier for the message. When set, the server
   * may use it to deduplicate retries (idempotent send). Required column on
   * `chat_messages.client_message_id` is added by an upcoming migration; the
   * field is safe to pass today, the server simply ignores unknown columns
   * if the migration has not run yet.
   */
  client_message_id?: string;
  message_type: ChatMessageType;
  media_url?: string;
  media_thumbnail_url?: string;
  media_type?: string;
  media_size?: number;
  media_duration?: number;
  media_width?: number;
  media_height?: number;
  media_file_name?: string;
  media_urls?: MediaGroupItem[]; // For MEDIA_GROUP messages
  reply_to_message_id?: string;
  mentioned_users?: string[];
  is_silent?: boolean;
  /** לעדכון הודעה אופטימיסטית קיימת (מדיה) – מונע flicker בעת מעבר upload→send */
  existing_optimistic_id?: string;
  metadata?: {
    waveformData?: number[];
    [key: string]: any;
  };
}

export interface EditChatMessageInput {
  message_id: string;
  content: string;
  mentioned_users?: string[];
}

export interface DeleteChatMessageInput {
  message_id: string;
  delete_for_everyone: boolean;
}

export interface ForwardChatMessageInput {
  message_id: string;
  to_group_ids: string[];
}

export interface AddReactionInput {
  message_id: string;
  emoji: string;
}

export interface RemoveReactionInput {
  message_id: string;
  emoji: string;
}

export interface MarkMessagesAsReadInput {
  group_id: string;
  message_ids: string[];
}

export interface SetTypingStatusInput {
  group_id: string;
  is_typing: boolean;
}

export interface UpdateGroupMemberInput {
  group_id: string;
  user_id: string;
  role?: ChatMemberRole;
  muted?: boolean;
  notifications_enabled?: boolean;
}

export interface ReportMessageInput {
  message_id: string;
  reason: string;
  description?: string;
}

// ============================================
// Realtime Event Types
// ============================================

export type ChatRealtimeEventType =
  | 'message_new'
  | 'message_updated'
  | 'message_deleted'
  | 'reaction_added'
  | 'reaction_removed'
  | 'typing_start'
  | 'typing_stop'
  | 'message_read'
  | 'member_joined'
  | 'member_left'
  | 'member_updated'
  | 'group_updated'
  | 'user_online'
  | 'user_offline';

export interface ChatRealtimeEvent {
  type: ChatRealtimeEventType;
  group_id?: string;
  user_id?: string;
  data: any;
  timestamp: string;
}

// ============================================
// Pagination & Filtering
// ============================================

export interface ChatPaginationParams {
  limit?: number;
  offset?: number;
  before?: string; // created_at cursor (ISO timestamp) for loading older messages
  after?: string;  // created_at cursor (ISO timestamp) for loading newer messages
  /**
   * כש-true עם `after`: מביא בסדר עולה (הישנות ביותר אחרי הקורסור) —
   * חובה ל-catch-up בטוח בלי פערים. התשובה עדיין מוחזרת newest-first.
   */
  ascending?: boolean;
}

export interface ChatMessageFilters {
  message_type?: ChatMessageType[];
  sender_id?: string;
  has_media?: boolean;
  is_starred?: boolean;
  date_from?: string;
  date_to?: string;
}

// ============================================
// Upload Progress
// ============================================

export interface ChatMediaUploadProgress {
  file_name: string;
  progress: number; // 0-100
  uploaded_bytes: number;
  total_bytes: number;
  url?: string;
}

// ============================================
// Error Types
// ============================================

export interface ChatError {
  code: string;
  message: string;
  details?: any;
}

// ============================================
// Statistics
// ============================================

export interface ChatGroupStatistics {
  total_messages: number;
  total_members: number;
  active_members_today: number;
  active_members_week: number;
  messages_today: number;
  messages_week: number;
  most_active_member: {
    user_id: string;
    user_name: string;
    message_count: number;
  };
  media_breakdown: {
    images: number;
    videos: number;
    audio: number;
    documents: number;
  };
}

// ============================================
// Notification Payload
// ============================================

export interface ChatNotificationPayload {
  type: 'new_message' | 'mention' | 'reply' | 'reaction';
  group_id: string;
  group_name: string;
  message_id?: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content_preview: string;
  timestamp: string;
}

// ============================================
// Export all - ייצוא מסודר
// ============================================

