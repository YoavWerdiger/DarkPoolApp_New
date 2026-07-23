import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface TypingUser {
  userId: string;
  userName: string;
  timestamp: number;
}

/**
 * שירות לניהול אינדיקטור "מקליד..."
 * משתמש ב-Supabase Presence API לסנכרון בזמן אמת
 */
export class TypingService {
  private static channels: Map<string, RealtimeChannel> = new Map();
  private static typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * התחל להאזין למשתמשים שמקליד בערוץ
   */
  static subscribeToTyping(
    channelId: string,
    currentUserId: string,
    onTypingChanged: (typingUsers: TypingUser[]) => void
  ): () => void {
    
    // צור channel ייחודי לערוץ הזה
    const channelName = `typing:${channelId}`;
    
    // אם יש כבר channel פעיל, נתק אותו
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
      this.channels.delete(channelName);
    }
    
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });
    
    // האזן לשינויים ב-presence
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typingUsers = this.parsePresenceState(state, currentUserId);
        onTypingChanged(typingUsers);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const state = channel.presenceState();
        const typingUsers = this.parsePresenceState(state, currentUserId);
        onTypingChanged(typingUsers);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const state = channel.presenceState();
        const typingUsers = this.parsePresenceState(state, currentUserId);
        onTypingChanged(typingUsers);
      })
      .subscribe(async (status) => {
        
        if (status === 'SUBSCRIBED') {
        }
      });
    
    // שמור את ה-channel
    this.channels.set(channelName, channel);
    
    // פונקציה לניקוי
    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }
  
  /**
   * שלח אירוע "מתחיל להקליד"
   */
  static async startTyping(
    channelId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    
    const channelName = `typing:${channelId}`;
    const channel = this.channels.get(channelName);
    
    if (!channel) {
      return;
    }
    
    try {
      // שלח presence update
      await channel.track({
        userId,
        userName,
        typing: true,
        timestamp: Date.now(),
      });
      
      
      // בטל timeout קודם אם קיים
      const existingTimeout = this.typingTimeouts.get(`${channelId}:${userId}`);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      // הגדר timeout אוטומטי להסרת סטטוס "מקליד" אחרי 3 שניות
      const timeout = setTimeout(() => {
        this.stopTyping(channelId, userId);
      }, 3000);
      
      this.typingTimeouts.set(`${channelId}:${userId}`, timeout);
    } catch (error) {
    }
  }
  
  /**
   * שלח אירוע "הפסיק להקליד"
   */
  static async stopTyping(channelId: string, userId: string): Promise<void> {
    
    const channelName = `typing:${channelId}`;
    const channel = this.channels.get(channelName);
    
    if (!channel) {
      return;
    }
    
    try {
      // הסר presence
      await channel.untrack();
      
      // נקה timeout
      const timeoutKey = `${channelId}:${userId}`;
      const existingTimeout = this.typingTimeouts.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.typingTimeouts.delete(timeoutKey);
      }
    } catch (error) {
    }
  }
  
  /**
   * המר presence state לרשימת משתמשים שמקלידים
   */
  private static parsePresenceState(
    state: Record<string, any[]>,
    currentUserId: string
  ): TypingUser[] {
    const typingUsers: TypingUser[] = [];
    
    // עבור על כל ה-presence entries
    Object.values(state).forEach((presences) => {
      presences.forEach((presence: any) => {
        // דלג על המשתמש הנוכחי
        if (presence.userId === currentUserId) {
          return;
        }
        
        // בדוק אם הוא באמת מקליד
        if (presence.typing) {
          typingUsers.push({
            userId: presence.userId,
            userName: presence.userName,
            timestamp: presence.timestamp,
          });
        }
      });
    });
    
    return typingUsers;
  }
  
  /**
   * נקה את כל ה-channels והtimeouts
   */
  static cleanup(): void {
    
    // נתק את כל ה-channels
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();
    
    // נקה את כל ה-timeouts
    this.typingTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.typingTimeouts.clear();
  }
}

