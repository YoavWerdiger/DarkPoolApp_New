import { createClient } from '@supabase/supabase-js';
import { MediaFile } from './mediaService';

const supabaseUrl = 'https://wpmrtczbfcijoocguime.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database types
export interface Message {
  id: string;
  chat_id?: string; // לתמיכה בפורמט הישן
  channel_id?: string; // לתמיכה בפורמט החדש
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'voice' | 'file' | 'media' | 'reply' | 'audio' | 'video' | 'document' | 'poll' | 'news';
  file_url?: string;
  media_files?: MediaFile[];
  reply_to_message_id?: string; // השם הנכון במסד הנתונים
  poll_id?: string; // עבור הודעות סקר
  news_data?: any; // עבור הודעות חדשות
  reactions?: Record<string, string[]>;
  created_at: string;
  updated_at?: string;
  sender?: { full_name?: string };
  status?: 'sent' | 'delivered' | 'read';
  read_by?: string[];
  mentions?: Array<{ user_id: string; start: number; end: number; display: string }>;
  // שדות נוספים שרואים במסד הנתונים
  recipient_id?: string;
  deleted_for_users?: string[];
  duration?: number;
  file_name?: string;
  file_size?: number;
  forwarded_from_message_id?: string;
  is_deleted?: boolean;
  media_type?: string;
  media_url?: string;
  // שדות חדשים לריאקציות
  message_reactions?: MessageReaction[];
  reaction_summary?: ReactionSummary[];
}

export interface Chat {
  id: string;
  name?: string;
  type: 'direct' | 'group';
  participants: string[];
  last_message?: Message;
  created_at: string;
  updated_at: string;
  is_pinned?: boolean;
  // תמיכה בפורמט החדש
  channel_id?: string;
  description?: string;
  created_by?: string;
  is_private?: boolean;
  is_public?: boolean;
  image_url?: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  last_seen: string;
  is_online: boolean;
}

// טיפוסים חדשים לריאקציות
export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    profile_picture?: string;
  };
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  user_ids: string[];
  user_names: string[];
}

// טיפוס חדש לפירוט ריאקציות
export interface ReactionDetail {
  emoji: string;
  count: number;
  user_ids: string[];
  user_names: string[];
} 