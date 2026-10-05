export interface MessageSnapshot {
  id: string;
  content: string;
  mediaUrl?: string | null;
  /** תמונה ממוזערת לתצוגה בשיט (תמונה/פוסטר וידאו) */
  mediaThumbUrl?: string | null;
  mediaWidth?: number;
  mediaHeight?: number;
  /** אלבום — ממוזערות של כל הפריטים */
  albumThumbs?: string[];
  senderName?: string;
  senderAvatar?: string;
  timestamp?: string;
  reactions?: any[];
  type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'poll' | 'trade';
  createdAt?: string;
  isMe?: boolean;
  channelId?: string;
}
