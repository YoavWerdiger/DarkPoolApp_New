export interface MessageSnapshot {
  id: string;
  content: string;
  mediaUrl?: string | null;
  senderName?: string;
  senderAvatar?: string;
  timestamp?: string;
  reactions?: any[];
  type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'poll' | 'trade';
  createdAt?: string;
  isMe?: boolean;
  channelId?: string;
}
