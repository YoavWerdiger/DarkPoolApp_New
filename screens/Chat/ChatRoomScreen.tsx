import { useRef, useState, useEffect, useMemo, useCallback, memo } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform, Text, Image, TouchableOpacity, Animated, ImageBackground, Alert, Pressable, TextInput, TouchableWithoutFeedback, Keyboard, ActivityIndicator, LayoutAnimation, UIManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { IconButton } from 'react-native-paper';
import ChatBubble from '../../components/chat/ChatBubble';
import MessageInputBar from '../../components/chat/MessageInputBar';
import DayDivider from '../../components/chat/DayDivider';
import UnreadDivider from '../../components/chat/UnreadDivider';
import PinnedMessagesHeader from '../../components/chat/PinnedMessagesHeader';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Message } from '../../services/supabase';
import { ChatService } from '../../services/chatService';
// import { MessageCircle, AlertTriangle, Bitcoin, Users, Newspaper, Trophy, Bell, Briefcase } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { ArrowRight, X, ChevronDown, AtSign, ImageIcon, Video, Music, FileText, MessageCircle, XCircle } from 'lucide-react-native';
import { mediaService } from '../../services/mediaService';
import { supabase } from '../../lib/supabase';
import { DesignTokens } from '../../components/ui/DesignTokens';

// פונקציה לזיהוי שפה
const detectLanguage = (text: string): 'rtl' | 'ltr' => {
  if (!text || text.trim().length === 0) {
    return 'rtl'; // ברירת מחדל - עברית
  }
  
  // בדיקה אם הטקסט מכיל תווים עבריים
  const hebrewRegex = /[\u0590-\u05FF]/;
  const arabicRegex = /[\u0600-\u06FF]/;
  
  // בדיקה אם הטקסט מכיל תווים לטיניים (אנגלית)
  const latinRegex = /[a-zA-Z]/;
  
  const hasHebrew = hebrewRegex.test(text);
  const hasArabic = arabicRegex.test(text);
  const hasLatin = latinRegex.test(text);
  
  // אם יש עברית או ערבית - RTL
  if (hasHebrew || hasArabic) {
    return 'rtl';
  }
  
  // אם יש רק לטינית - LTR
  if (hasLatin && !hasHebrew && !hasArabic) {
    return 'ltr';
  }
  
  // ברירת מחדל - עברית
  return 'rtl';
};

export default function ChatRoomScreen() {
  const { messages, sendMessage, chats, currentChatId, markMessageAsRead, markMessageAsDelivered, updateMessage, deleteMessage, loadMessages, typingUsers, startTyping, stopTyping } = useChat();

  // State for reply
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
  // State for editing
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);

  // Handle reply - memoized
  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  // Function to refresh pinned messages - memoized
  const refreshPinnedMessages = useCallback(() => {
    setPinnedMessagesKey(prev => prev + 1);
  }, []);

  // Cancel reply - memoized
  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // Handle edit message - memoized
  const handleEditMessage = useCallback((message: Message) => {
    setEditingMessage({ id: message.id, content: message.content });
  }, []);

  // Cancel edit - memoized
  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  // Edit message function - memoized
  const editMessage = useCallback(async (messageId: string, newContent: string, mentions?: any[]) => {
    try {
      console.log('✏️ ChatRoomScreen: Editing message:', { messageId, newContent, mentions });
      
      // השתמש בפונקציה החדשה של ChatContext שמעדכנת גם את הרשימה המקומית
      await updateMessage(messageId, newContent, mentions);
      
      console.log('✅ ChatRoomScreen: Message edited successfully');
      setEditingMessage(null);
    } catch (error) {
      console.error('❌ ChatRoomScreen: Error editing message:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בעריכת ההודעה');
    }
  }, [updateMessage]);

  // Delete message function - memoized
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      console.log('🗑️ ChatRoomScreen: Deleting message:', messageId);
      
      // הצג הודעת אישור
      Alert.alert(
        'מחיקת הודעה',
        'האם אתה בטוח שברצונך למחוק את ההודעה?',
        [
          {
            text: 'ביטול',
            style: 'cancel'
          },
          {
            text: 'מחק',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteMessage(messageId);
                console.log('✅ ChatRoomScreen: Message deleted successfully');
              } catch (error) {
                console.error('❌ ChatRoomScreen: Error deleting message:', error);
                Alert.alert('שגיאה', 'לא ניתן למחוק את ההודעה');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('❌ ChatRoomScreen: Error in delete confirmation:', error);
    }
  }, [deleteMessage]);

  // Send message with reply - memoized
  const sendMessageWithReply = useCallback((text: string) => {
    if (replyingTo) {
      // שליחת הודעה עם reply
      console.log('Sending reply to message:', replyingTo.id);
      // כאן נשלח למסד הנתונים עם reply_to_message_id
    }
    
    // שליחת ההודעה הרגילה
    sendMessage(text);
    
    // איפוס ה-reply
    setReplyingTo(null);
  }, [replyingTo, sendMessage]);


  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuth();
  const { backgroundImage } = useTheme();
  const navigation = useNavigation() as any;
  const [membersCount, setMembersCount] = useState<number>(0);
  const [channelImageUrl, setChannelImageUrl] = useState<string | null>(null);
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const [hasScrolledToUnread, setHasScrolledToUnread] = useState<boolean>(false);
  const [pinnedMessagesKey, setPinnedMessagesKey] = useState<number>(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const scrollButtonOpacity = useRef(new Animated.Value(0)).current;
  const [showScrollToMention, setShowScrollToMention] = useState<boolean>(false);
  const [latestMentionMessageId, setLatestMentionMessageId] = useState<string | null>(null);
  const mentionButtonOpacity = useRef(new Animated.Value(0)).current;
  
  // מרווחים דינמיים מול ה-MessageInputBar והטאב התחתון
  const INPUT_BAR_HEIGHT = 60; // גובה משוער - עודכן לגובה החדש
  const EXTRA_BOTTOM_PADDING = 240; // עוד ריווח לבועה האחרונה
  const LIST_BOTTOM_PADDING = INPUT_BAR_HEIGHT + EXTRA_BOTTOM_PADDING; // ריווח תחתון לרשימה
  const SCROLL_BTN_BOTTOM = 100; // מיקום נוח מעל הטאב
  const MENTION_BTN_BOTTOM = 130; // מעט מעל כפתור הגלילה - עודכן לגובה החדש
  
  // State לחיפוש
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);

  // Check if two dates are the same day
  const isSameDay = (date1: Date, date2: Date) => {
    // בדיקה שהתאריכים תקינים
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      console.error('❌ isSameDay: Invalid dates:', { date1, date2 });
      return false;
    }
    
    // השוואה פשוטה של יום, חודש ושנה לפי זמן מקומי
    const sameYear = date1.getFullYear() === date2.getFullYear();
    const sameMonth = date1.getMonth() === date2.getMonth();
    const sameDate = date1.getDate() === date2.getDate();
    
    console.log('🔍 isSameDay: Comparing dates:', {
      date1: date1.toISOString(),
      date2: date2.toISOString(),
      date1Local: `${date1.getDate()}/${date1.getMonth() + 1}/${date1.getFullYear()}`,
      date2Local: `${date2.getDate()}/${date2.getMonth() + 1}/${date2.getFullYear()}`,
      result: sameYear && sameMonth && sameDate
    });
    
    return sameYear && sameMonth && sameDate;
  };

  // מצא את הצ'אט הנוכחי
  const currentChat: any = chats.find(c => c.id === currentChatId);

  // פונקציה לסינון הודעות לפי חיפוש
  const filterMessages = (query: string) => {
    if (!query.trim()) {
      setFilteredMessages([]);
      return;
    }
    
    const filtered = messages.filter(message => 
      message.content?.toLowerCase().includes(query.toLowerCase())
    );
    
    setFilteredMessages(filtered);
  };

  // הפעל LayoutAnimation עבור Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // אנימציה חלקה וקלה כשהודעות חדשות נוספות
  useEffect(() => {
    if (messages.length > 0) {
      LayoutAnimation.configureNext({
        duration: 200,
        create: {
          type: LayoutAnimation.Types.easeOut,
          property: LayoutAnimation.Properties.opacity,
          springDamping: 0.9,
        },
        update: {
          type: LayoutAnimation.Types.spring,
          springDamping: 0.9,
        },
      });
    }
  }, [messages.length]);

  // סמן הודעות כנקראו רק אחרי שהמשתמש רואה את ה-divider
  useEffect(() => {
    if (!messages.length || !user?.id || !currentChatId) return;

    console.log('🔄 ChatRoomScreen: Checking if should mark messages as read:', {
      unreadCount,
      hasScrolledToUnread,
      messagesLength: messages.length
    });

    // רק אם יש הודעות שלא נקראו והמשתמש כבר גלל ל-divider
    if (unreadCount > 0 && hasScrolledToUnread) {
      console.log('🔄 ChatRoomScreen: Marking messages as read after user saw divider');

      // סמן הודעות של אחרים כנקראו
      const unreadMessages = messages.filter(msg => 
        msg.sender_id !== user.id && 
        (!msg.read_by || !msg.read_by.includes(user.id))
      );

      console.log('🔄 ChatRoomScreen: Found unread messages to mark as read:', unreadMessages.length);

      unreadMessages.forEach(async (msg) => {
        markMessageAsRead(msg.id);
        
        // Also mark as viewed in the new viewed_by system
        if (user?.id) {
          try {
            await ChatService.markMessageAsViewed(msg.id, user.id);
          } catch (error) {
            console.error('❌ ChatRoomScreen: Error marking message as viewed:', error);
          }
        }
      });

      // אפס את unreadCount אחרי סימון ההודעות
      setUnreadCount(0);
      console.log('✅ ChatRoomScreen: Messages marked as read, unreadCount reset to 0');
    }
  }, [messages, user, markMessageAsRead, currentChatId, unreadCount, hasScrolledToUnread]);

  // לוגים לדיבוג שינויים ב-messages
  useEffect(() => {
    console.log('📊 ChatRoomScreen: messages changed:', {
      count: messages.length,
      firstMessage: messages[0] ? { id: messages[0].id, content: messages[0].content } : null,
      lastMessage: messages[messages.length - 1] ? { id: messages[messages.length - 1].id, content: messages[messages.length - 1].content } : null
    });
    
    // סגור את הטעינה אחרי שההודעות נטענו
    if (messages.length > 0 && isLoading) {
      console.log('✅ ChatRoomScreen: Messages loaded, closing loading screen');
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  // התחל עם isLoading = false אם יש הודעות כבר (מטעינה מקדימה)
  useEffect(() => {
    if (messages.length > 0) {
      console.log('✅ ChatRoomScreen: Messages already available, skipping loading screen');
      setIsLoading(false);
    }
  }, [messages.length]);

  // טעינה מקבילה של מידע נוסף כשנכנסים לצ'אט (רק אם לא נטען מראש)
  useEffect(() => {
    if (!currentChatId) return;
    
    // בדוק אם המידע כבר נטען (מטעינה מקדימה)
    if (membersCount > 0 && channelImageUrl && channelMembers.length > 0) {
      console.log('✅ ChatRoomScreen: Additional data already loaded from preload');
      return;
    }
    
    console.log('🚀 ChatRoomScreen: Starting parallel data loading for chat:', currentChatId);
    const startTime = Date.now();
    
    // טען הכל במקביל
    Promise.all([
      // טען מידע על הערוץ
      ChatService.getChannelMembersCount(currentChatId).then(({ count, error }) => {
        if (!error && typeof count === 'number') {
          setMembersCount(count);
          console.log('✅ Members count loaded:', count);
        }
      }),
      
      // טען תמונה של הערוץ
      ChatService.getChannelImageUrl(currentChatId).then(url => {
        setChannelImageUrl(url);
        console.log('✅ Channel image loaded:', url ? 'Yes' : 'No');
      }),
      
      // טען חברי הערוץ
      supabase
        .from('channel_members')
        .select('user_id, user_data')
        .eq('channel_id', currentChatId)
        .then(({ data, error }) => {
          if (!error && data) {
            const memberIds = data.map(member => member.user_id);
            setChannelMembers(memberIds);
            console.log('✅ Channel members loaded:', memberIds.length);
          }
        })
    ]).then(() => {
      const endTime = Date.now();
      console.log(`⏱️ ChatRoomScreen: Parallel loading completed in ${endTime - startTime}ms`);
    }).catch(error => {
      console.error('❌ ChatRoomScreen: Error in parallel loading:', error);
    });
  }, [currentChatId, membersCount, channelImageUrl, channelMembers.length]);


  // Load unread count when entering chat
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!currentChatId || !user?.id) return;
      
      console.log('🔄 ChatRoomScreen: Loading unread count for:', { currentChatId, userId: user.id });
      
      try {
        const count = await ChatService.getUnreadCount(currentChatId, user.id);
        setUnreadCount(count);
        setHasScrolledToUnread(false); // אפס דגל גלילה לצ'אט חדש
        console.log('🔢 ChatRoomScreen: Unread count loaded:', count);
        
        // אם אין הודעות שלא נקראו, סמן שגללנו
        if (count === 0) {
          setHasScrolledToUnread(true);
          console.log('✅ ChatRoomScreen: No unread messages, marking as scrolled');
        }
        
        // טען גם את last_read_message_id
        const lastReadId = await ChatService.getLastReadMessageId(currentChatId, user.id);
        setLastReadMessageId(lastReadId);
        console.log('📖 ChatRoomScreen: Last read message ID loaded:', lastReadId);
        
        // טען מידע על mentions
        const hasUnreadMentions = await ChatService.hasUnreadMentions(currentChatId, user.id);
        const latestMentionId = await ChatService.getLatestMentionMessageId(currentChatId, user.id);
        setLatestMentionMessageId(latestMentionId);
        setShowScrollToMention(hasUnreadMentions && !!latestMentionId);
        
        console.log('🔍 ChatRoomScreen: Mentions info loaded:', { hasUnreadMentions, latestMentionId });
        
        // לוג נוסף לדיבוג
        if (count > 0) {
          console.log('🎯 ChatRoomScreen: Found unread messages, should show UnreadDivider');
        } else {
          console.log('✅ ChatRoomScreen: No unread messages');
        }
      } catch (error) {
        console.error('❌ ChatRoomScreen: Error loading unread count:', error);
      }
    };
    
    loadUnreadCount();
  }, [currentChatId, user?.id]);

  // עדכן מידע על mentions כשמגיעות הודעות חדשות
  useEffect(() => {
    const updateMentionInfo = async () => {
      if (!currentChatId || !user?.id || !messages.length) return;
      
      try {
        // בדוק אם יש mentions חדשים
        const hasUnreadMentions = await ChatService.hasUnreadMentions(currentChatId, user.id);
        const latestMentionId = await ChatService.getLatestMentionMessageId(currentChatId, user.id);
        
        console.log('🔍 ChatRoomScreen: Updating mention info:', { hasUnreadMentions, latestMentionId });
        
        setLatestMentionMessageId(latestMentionId);
        setShowScrollToMention(hasUnreadMentions && !!latestMentionId);
      } catch (error) {
        console.error('❌ ChatRoomScreen: Error updating mention info:', error);
      }
    };
    
    updateMentionInfo();
  }, [messages, currentChatId, user?.id]);

  // עדכן last_read_message_id כשיוצאים מהצ'אט
  useEffect(() => {
    return () => {
      // Cleanup - עדכן שההודעות נקראו כשיוצאים מהצ'אט
      if (messages.length > 0 && currentChatId && user?.id) {
        const lastMessage = messages[0];
        console.log('🚪 ChatRoomScreen: Exiting chat - marking last message as read:', lastMessage.id);
        ChatService.markMessagesAsRead(currentChatId, user.id, lastMessage.id);
      }
    };
  }, [messages, currentChatId, user?.id]);



  const handleSendMessage = async (content: string, mentions?: any[]) => {
    console.log('📱 ChatRoomScreen handleSendMessage:', { content, mentions, replyMessage: replyingTo?.id, user: user?.id, currentChatId });
    console.log('🔍 ChatRoomScreen: Mentions details:', mentions?.map(m => ({ user_id: m.user_id, display: m.display, start: m.start, end: m.end })));
    
    if (!currentChatId) {
      console.error('❌ ChatRoomScreen: No currentChatId');
      return;
    }
    
    try {
      // שליחת הודעה דרך ChatContext (שמעדכן את הרשימה המקומית)
      if (replyingTo) {
        console.log('📤 Sending reply to message:', replyingTo.id);
        await sendMessage(content, replyingTo.id, mentions);
      } else {
        console.log('📤 Sending regular message');
        await sendMessage(content, undefined, mentions);
      }
      
      // איפוס ה-reply
      setReplyingTo(null);
      
      // גלילה אוטומטית לתחתית אחרי שליחת הודעה
      scrollToBottom();
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('שגיאה', 'לא ניתן לשלוח הודעה');
    }
  };

  // Create data with day dividers
  const messagesWithDividers = useMemo(() => {
    console.log('🔍 messagesWithDividers: useMemo triggered with messages:', messages.length);
    console.log('🔍 messagesWithDividers: unreadCount:', unreadCount);
    console.log('🔍 messagesWithDividers: lastReadMessageId:', lastReadMessageId);
    console.log('🔍 messagesWithDividers: user:', user?.id);
    
    if (!messages || messages.length === 0) {
      console.log('🔍 messagesWithDividers: No messages, returning empty array');
      return [];
    }
    
    console.log('🔍 messagesWithDividers: Processing messages:', messages.length);
    
    const data: Array<Message | { type: 'divider'; date: Date; id: string } | { type: 'unread'; count: number; id: string }> = [];
    
    messages.forEach((message, index) => {
      // יצירת תאריך בצורה בטוחה יותר
      let messageDate: Date;
      try {
        messageDate = new Date(message.created_at);
        // בדיקה שהתאריך תקין
        if (isNaN(messageDate.getTime())) {
          console.error('❌ Invalid date:', message.created_at);
          messageDate = new Date(); // fallback
        }
      } catch (error) {
        console.error('❌ Error parsing date:', error);
        messageDate = new Date(); // fallback
      }
      
      console.log(`🔍 messagesWithDividers: Message ${index}:`, {
        id: message.id,
        content: message.content,
        created_at: message.created_at,
        created_at_type: typeof message.created_at,
        messageDate: messageDate.toISOString(),
        messageDateLocal: messageDate.toLocaleDateString('he-IL'),
        messageDateYear: messageDate.getFullYear(),
        messageDateMonth: messageDate.getMonth(),
        messageDateDay: messageDate.getDate(),
        now: new Date().toISOString(),
        nowLocal: new Date().toLocaleDateString('he-IL')
      });
      
      // Add day divider if it's the first message or if the day changed
      if (index === 0) {
        console.log('🔍 messagesWithDividers: First message, adding divider');
        data.push({
          type: 'divider',
          date: messageDate,
          id: `divider-${messageDate.toISOString().split('T')[0]}`,
        });
      } else {
        const prevMessageDate = new Date(messages[index - 1].created_at);
        const sameDay = isSameDay(messageDate, prevMessageDate);
        console.log(`🔍 messagesWithDividers: Comparing with previous:`, {
          current: messageDate.toLocaleDateString('he-IL'),
          previous: prevMessageDate.toLocaleDateString('he-IL'),
          sameDay
        });
        
        if (!sameDay) {
          console.log('🔍 messagesWithDividers: Day changed, adding divider');
          data.push({
            type: 'divider',
            date: messageDate,
            id: `divider-${messageDate.toISOString().split('T')[0]}`,
          });
        }
      }
      
      data.push(message);
    });
    
    // Add unread divider at the correct position based on last_read_message_id
    if (unreadCount > 0 && user) {
      console.log('🔍 messagesWithDividers: Need to add unread divider with count:', unreadCount);
      console.log('🔍 messagesWithDividers: lastReadMessageId:', lastReadMessageId);
      
      if (lastReadMessageId) {
        // Find the position of the last read message
        // Note: messages are in reverse chronological order (newest first)
        // With inverted FlatList, index 0 displays at bottom
        let lastReadIndex = -1;
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if ('id' in item && item.id === lastReadMessageId) {
            lastReadIndex = i;
            console.log('🔍 messagesWithDividers: Found last read message at index:', i);
            break;
          }
        }
        
        if (lastReadIndex !== -1) {
          // Since FlatList is inverted, we need to insert BEFORE the last read message
          // to show the divider above the unread messages (which are at lower indices)
          const insertIndex = lastReadIndex; // Insert at the same index (pushes lastRead down)
          console.log('🔍 messagesWithDividers: Inserting unread divider at index:', insertIndex, '(before last read message)');
          data.splice(insertIndex, 0, {
            type: 'unread',
            count: unreadCount,
            id: 'unread-divider'
          });
        } else {
          // If last read message not found, find where to put divider based on timestamps
          console.log('🔍 messagesWithDividers: Last read message not in current data, finding position by timestamp');
          
          // Get the timestamp of the last read message from the original messages array
          const lastReadMessage = messages.find(msg => msg.id === lastReadMessageId);
          if (lastReadMessage) {
            const lastReadTime = new Date(lastReadMessage.created_at).getTime();
            
            // Find the first message that is newer than lastReadMessage
            let insertIndex = data.length; // Default to end if all messages are older
            for (let i = 0; i < data.length; i++) {
              const item = data[i];
              if ('created_at' in item) {
                const itemTime = new Date(item.created_at).getTime();
                if (itemTime > lastReadTime) {
                  insertIndex = i + 1; // Insert after this newer message
                } else {
                  break; // Found the boundary
                }
              }
            }
            
            console.log('🔍 messagesWithDividers: Inserting divider at timestamp-based position:', insertIndex);
            data.splice(insertIndex, 0, {
              type: 'unread',
              count: unreadCount,
              id: 'unread-divider'
            });
          } else {
            // Fallback: add at end (oldest position)
            console.log('🔍 messagesWithDividers: Could not find last read message, adding at end');
            data.push({
              type: 'unread',
              count: unreadCount,
              id: 'unread-divider'
            });
          }
        }
      } else {
        // No lastReadMessageId - all messages are unread, add at the end (oldest position)
        console.log('🔍 messagesWithDividers: No lastReadMessageId - all messages unread, adding divider at end');
        data.push({
          type: 'unread',
          count: unreadCount,
          id: 'unread-divider'
        });
      }
    }
    
    console.log('🔍 messagesWithDividers: Final data length:', data.length);
    console.log('🔍 messagesWithDividers: First few items:', data.slice(0, 5).map(item => ({
      type: 'type' in item ? item.type : 'message',
      id: item.id,
      content: 'content' in item ? item.content?.substring(0, 30) + '...' : undefined
    })));
    
    // חיפוש ספציפי אחרי unread divider
    const unreadItem = data.find(item => 'type' in item && item.type === 'unread');
    if (unreadItem) {
      console.log('✅ messagesWithDividers: UnreadDivider found in data:', unreadItem);
    } else {
      console.log('❌ messagesWithDividers: UnreadDivider NOT found in data');
    }
    
    return data;
  }, [messages, unreadCount, user, lastReadMessageId]);

  // גלילה אוטומטית למיקום UnreadDivider כשנכנסים לצ'אט
  useEffect(() => {
    console.log('🎯 ChatRoomScreen: Auto-scroll useEffect triggered:', {
      hasRef: !!flatListRef.current,
      unreadCount,
      messagesLength: messagesWithDividers.length,
      hasScrolledToUnread
    });
    
    if (!flatListRef.current || unreadCount === 0 || !messagesWithDividers.length || hasScrolledToUnread) {
      console.log('❌ ChatRoomScreen: Auto-scroll conditions not met:', {
        hasRef: !!flatListRef.current,
        unreadCount,
        messagesLength: messagesWithDividers.length,
        hasScrolledToUnread
      });
      return;
    }

    // מצא את מיקום ה-UnreadDivider
    const unreadDividerIndex = messagesWithDividers.findIndex(
      item => 'type' in item && item.type === 'unread'
    );

    console.log('🎯 ChatRoomScreen: UnreadDivider search result:', {
      unreadDividerIndex,
      foundDivider: unreadDividerIndex !== -1,
      firstFewItems: messagesWithDividers.slice(0, 5).map(item => ({
        type: 'type' in item ? item.type : 'message',
        id: item.id
      }))
    });

    if (unreadDividerIndex !== -1) {
      console.log('🎯 ChatRoomScreen: Found UnreadDivider at index:', unreadDividerIndex);
      
      // גלילה מיידית ללא עיכוב
      try {
        console.log('🎯 ChatRoomScreen: Executing immediate scrollToIndex to:', unreadDividerIndex);
        flatListRef.current?.scrollToIndex({
          index: unreadDividerIndex,
          animated: false, // ללא אנימציה לכניסה ישירה
          viewPosition: 0.5, // מציב את הדיווידר במרכז המסך בדיוק
        });
        
        // סמן שגללנו מיד
        setHasScrolledToUnread(true);
        console.log('✅ ChatRoomScreen: Scrolled to UnreadDivider immediately');
        
      } catch (error) {
        console.log('⚠️ ChatRoomScreen: Error scrolling to UnreadDivider, trying scrollToOffset instead:', error);
        // אם scrollToIndex נכשל, נסה גלילה כללית
        flatListRef.current?.scrollToOffset({
          offset: unreadDividerIndex * 100, // הערכה גסה של גובה איטם
          animated: false,
        });
        
        // סמן שגללנו
        setHasScrolledToUnread(true);
        console.log('✅ ChatRoomScreen: Scrolled to UnreadDivider via offset');
      }
    } else {
      console.log('❌ ChatRoomScreen: UnreadDivider not found in messagesWithDividers');
      // אם לא נמצא divider, סמן שגללנו כדי לא לנסות שוב
      setHasScrolledToUnread(true);
    }
  }, [messagesWithDividers, unreadCount]);

  // פונקציה לטיפול בלחיצה על UnreadDivider
  const handleUnreadDividerPress = useCallback(() => {
    console.log('🎯 ChatRoomScreen: UnreadDivider pressed, scrolling to bottom');
    
    // גלול לתחתית
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
    
    // סמן שגללנו
    setHasScrolledToUnread(true);
  }, []);

  // פונקציה לטיפול בגלילה - מאפסת unread count רק אחרי גלילה משמעותית
  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    
    // בדיקה אם המשתמש בתחתית (עם טולרנס קטן)
    const isAtBottomNow = contentOffset.y <= 50;
    setIsAtBottom(isAtBottomNow);
    
    // הצג/הסתר כפתור גלילה לתחתית
    // אם המשתמש גולל למעלה (y > 100) ולא בתחתית
    const shouldShowScrollButton = contentOffset.y > 100 && !isAtBottomNow;
    setShowScrollToBottom(shouldShowScrollButton);
    
    // אנימציה לכפתור הגלילה
    Animated.timing(scrollButtonOpacity, {
      toValue: shouldShowScrollButton ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    // אנימציה לכפתור ה-mention
    Animated.timing(mentionButtonOpacity, {
      toValue: showScrollToMention ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    // בינתיים, לא נאפס אוטומטית - רק אם המשתמש גולל הרבה
    if (unreadCount > 0 && contentOffset.y > 200) { // רק אחרי גלילה של 200px
      console.log('📜 ChatRoomScreen: User scrolled significantly (y:', contentOffset.y, '), considering reset');
      // לא נאפס מיד - נחכה שהמשתמש יגמור לגלול
    }
  };

  const handleGroupInfoPress = () => {
    navigation.navigate('GroupInfo', { chatId: currentChatId });
  };

  // פונקציה לגלילה לתחתית
  const scrollToBottom = () => {
    if (flatListRef.current && messagesWithDividers.length > 0) {
      flatListRef.current.scrollToIndex({
        index: 0, // בתצוגה הפוכה, index 0 הוא התחתית
        animated: true,
        viewPosition: 0
      });
      
      // אפס את unreadCount כשגוללים לתחתית
      if (unreadCount > 0 && currentChatId && user?.id) {
        console.log('📜 ChatRoomScreen: Scrolling to bottom - resetting unread count');
        setUnreadCount(0);
        // עדכן גם במסד הנתונים
        if (messages.length > 0) {
          const lastMessage = messages[0]; // ההודעה החדשה ביותר
          ChatService.markMessagesAsRead(currentChatId, user.id, lastMessage.id);
        }
      }
    }
  };

  // פונקציה לגלילה להודעה עם mention
  const scrollToMention = () => {
    console.log('🔍 ChatRoomScreen: scrollToMention called:', {
      hasRef: !!flatListRef.current,
      latestMentionMessageId,
      messagesLength: messagesWithDividers.length
    });
    
    if (flatListRef.current && latestMentionMessageId && messagesWithDividers.length > 0) {
      // מצא את האינדקס של ההודעה עם ה-mention
      const mentionIndex = messagesWithDividers.findIndex(item => 
        'id' in item && item.id === latestMentionMessageId
      );
      
      console.log('🔍 ChatRoomScreen: Found mention index:', mentionIndex);
      console.log('🔍 ChatRoomScreen: Looking for message ID:', latestMentionMessageId);
      
      if (mentionIndex !== -1) {
        console.log('🔍 ChatRoomScreen: Scrolling to mention message at index:', mentionIndex);
        try {
          flatListRef.current.scrollToIndex({
            index: mentionIndex,
            animated: true,
            viewPosition: 0.3
          });
          
          // סמן שה-mention נקרא
          setShowScrollToMention(false);
          setLatestMentionMessageId(null);
        } catch (error) {
          console.error('❌ ChatRoomScreen: Error scrolling to mention:', error);
        }
      } else {
        console.log('❌ ChatRoomScreen: Could not find mention message in list');
      }
    } else {
      console.log('❌ ChatRoomScreen: Cannot scroll to mention - missing data');
    }
  };

  // פונקציה לקפיצה להודעה המקורית
  const handleJumpToMessage = (id: string) => {
    // גלילה לפי מבנה הנתונים שמוצג בפועל ב-FlatList (messagesWithDividers)
    // מאחר והרשימה כוללת גם dividers ועל הדרך היא inverted, נמצא את האינדקס הישיר של ההודעה ברשימה הזו
    const indexInList = messagesWithDividers.findIndex((item: any) => 'id' in item && item.id === id);
    if (indexInList !== -1 && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({ index: indexInList, animated: true, viewPosition: 0.4 });
      } catch (e) {
        // fallback
        flatListRef.current.scrollToOffset({ offset: Math.max(0, indexInList * 80), animated: true });
      }
    }
  };

  // פונקציות חדשות לתמיכה במדיה
  const handleMediaSelected = async (mediaType: string, uri: string, metadata?: MediaMetadata) => {
    try {
      if (!currentChatId || !user?.id) return;

      console.log('📱 ChatRoomScreen: Media selected:', { mediaType, uri, metadata });

      console.log('📤 Uploading media to Supabase Storage:', { type: mediaType, uri });
      
      // העלה את הקובץ ל-Supabase Storage
      const uploadResult = await mediaService.uploadMedia(uri, mediaType as 'image' | 'video' | 'audio' | 'document');
      
      if (!uploadResult.success || !uploadResult.url) {
        console.error('❌ Failed to upload media:', uploadResult.error);
        Alert.alert('שגיאה', `שגיאה בהעלאת ${mediaType}: ${uploadResult.error}`);
        return;
      }

      console.log('✅ Media uploaded successfully:', { type: mediaType, url: uploadResult.url });

      // שלח הודעת מדיה אמיתית באמצעות ChatService
      const newMessage = await ChatService.sendMediaMessage({
        channelId: currentChatId,
        senderId: user.id,
        mediaUrl: uploadResult.url,
        mediaType: mediaType as 'image' | 'video' | 'audio' | 'document',
        caption: '',
        metadata: uploadResult.metadata || metadata,
        replyTo: replyingTo?.id || null
      });

      if (newMessage) {
        console.log('✅ Media message sent successfully');
        // נקה את ההודעה שאתה עונה עליה אם יש
        if (replyingTo) {
          setReplyingTo(null);
        }
        // גלילה אוטומטית לתחתית אחרי שליחת הודעת מדיה
        scrollToBottom();
      } else {
        Alert.alert('שגיאה', 'שגיאה בשליחת הודעת המדיה');
      }

    } catch (error) {
      console.error('❌ Error handling media:', error);
      Alert.alert('שגיאה', 'שגיאה בשליחת המדיה');
    }
  };

  // פונקציה חדשה לשליחת מדיה דרך Preview Modal
  const handleMediaPreviewSend = async (mediaFiles: any[], captions: Record<string, string>) => {
    try {
      if (!currentChatId || !user?.id) return;

      console.log('📤 ChatRoomScreen: Sending media files from preview:', { mediaFiles, captions });

      // שלח כל קובץ מדיה בנפרד
      for (const mediaFile of mediaFiles) {
        try {
          const caption = captions[mediaFile.id] || '';
          
          // העלה את הקובץ ל-Supabase Storage
          let mediaUrl = '';
          let mediaMetadata: any | undefined;

          console.log('📤 Uploading media to Supabase Storage:', { type: mediaFile.type, uri: mediaFile.uri });
          
          // העלה את הקובץ ל-Supabase Storage
          const uploadResult = await mediaService.uploadMedia(mediaFile.uri, mediaFile.type);
          
          if (uploadResult.success && uploadResult.url) {
            mediaUrl = uploadResult.url;
            mediaMetadata = uploadResult.metadata || {
              file_name: mediaFile.fileName || undefined,
              file_size: mediaFile.fileSize || undefined,
              duration: mediaFile.duration || undefined,
              width: mediaFile.width || undefined,
              height: mediaFile.height || undefined
            };
            console.log('✅ Media uploaded successfully:', { type: mediaFile.type, url: mediaUrl });
          } else {
            console.error('❌ Failed to upload media:', uploadResult.error);
            Alert.alert('שגיאה', `שגיאה בהעלאת ${mediaFile.type}: ${uploadResult.error}`);
            continue; // דלג על הקובץ הזה
          }

          console.log('Media uploaded successfully:', { type: mediaFile.type, url: mediaUrl, metadata: mediaMetadata });

          // שלח הודעת מדיה אמיתית באמצעות ChatService
          const newMessage = await ChatService.sendMediaMessage({
            channelId: currentChatId,
            senderId: user.id,
            mediaUrl,
            mediaType: mediaFile.type,
            caption,
            metadata: mediaMetadata,
            replyTo: replyingTo?.id || null
          });

          console.log('✅ Media message sent successfully');

        } catch (error) {
          console.error('Error sending media file:', mediaFile, error);
          // אם ההעלאה נכשלה, שלח הודעת טקסט רגילה
          const caption = captions[mediaFile.id] || '';
          let messageContent = '';
          if (caption) {
            messageContent = `${caption} [${mediaFile.type}]`;
          } else {
            switch (mediaFile.type) {
              case 'image':
                messageContent = '📷 תמונה';
                break;
              case 'video':
                messageContent = '🎥 וידאו';
                break;
              case 'audio':
                messageContent = '🎵 הקלטה';
                break;
              case 'document':
                messageContent = '📄 מסמך';
                break;
              default:
                messageContent = '📎 קובץ';
            }
          }
          await sendMessage(messageContent);
        }
      }

      // עדכן את רשימת ההודעות אחרי שליחת כל המדיה
      console.log('🔄 ChatRoomScreen: Refreshing messages after media send');
      await loadMessages(currentChatId);
      
      // גלילה אוטומטית לתחתית אחרי שליחת הודעות מדיה
      scrollToBottom();

    } catch (error) {
      console.error('Error handling media preview send:', error);
      Alert.alert('שגיאה', 'שגיאה בשליחת המדיה');
    }
  };



  // Header של הצ'אט
  const renderHeader = () => {
    // מיפוי שם לאייקון Ionicons
    const iconMap: Record<string, string> = {
      'MessageCircle': 'chatbubble-ellipses',
      'AlertTriangle': 'warning',
      'Bitcoin': 'logo-bitcoin',
      'Users': 'people',
      'Newspaper': 'newspaper',
      'Trophy': 'trophy',
      'Bell': 'notifications',
      'Briefcase': 'briefcase',
    };
    const iconName = currentChat?.icon_name && iconMap[currentChat.icon_name] ? iconMap[currentChat.icon_name] : 'chatbubble-ellipses';
    
    return (
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'ios' ? 40 : 20,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#666666',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 8,
          minHeight: Platform.OS === 'ios' ? 100 : 80,
          overflow: 'hidden'
        }}
      >
        {/* חזרה לרקע המקורי */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#181818'
        }} />
        {/* חץ חזרה - ימין */}
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={{
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ArrowRight size={24} color="#00E654" strokeWidth={2} />
        </TouchableOpacity>

        {/* תמונה/אייקון הקבוצה */}
        <TouchableOpacity 
          onPress={handleGroupInfoPress} 
          activeOpacity={0.8} 
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            flex: 1,
            marginHorizontal: 12
          }}
        >
          {/* תמונה/אייקון - שמאל */}
          {channelImageUrl ? (
            <Image 
              source={{ uri: channelImageUrl }} 
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                marginLeft: 12,
                borderWidth: 2,
                borderColor: '#00E654',
                shadowColor: '#00E654',
                shadowOpacity: 0.3,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 }
              }}
            />
          ) : (
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#00E654',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 12,
              borderWidth: 2,
              borderColor: '#00E654',
              shadowColor: '#00E654',
              shadowOpacity: 0.3,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 }
            }}>
              <Ionicons name={iconName as any} size={18} color="#000000" />
            </View>
          )}
          
          {/* פרטי הקבוצה - ימין */}
          <View style={{ flex: 1, alignItems: 'flex-end', marginBottom: 2 }}>
            <Text style={{
              fontSize: 18,
              color: 'white',
              fontWeight: 'bold'
            }} numberOfLines={1}>
              {currentChat?.name || 'קבוצה'}
            </Text>
            <Text style={{
              fontSize: 12,
              color: typingUsers.length > 0 ? '#00E654' : '#ccc',
              marginTop: 2
            }} numberOfLines={1}>
              {typingUsers.length > 0 
                ? typingUsers.length === 1
                  ? `${typingUsers[0].userName} מקליד...`
                  : typingUsers.length === 2
                    ? `${typingUsers[0].userName} ו-${typingUsers[1].userName} מקלידים...`
                    : `${typingUsers.length} משתמשים מקלידים...`
                : (currentChat?.description || `${membersCount ?? 0} משתתפים`)
              }
            </Text>
          </View>
        </TouchableOpacity>

        {/* זכוכית מגדלת לחיפוש */}
        <TouchableOpacity 
          onPress={() => setIsSearchVisible(!isSearchVisible)}
          style={{
            width: 32,
            height: 32,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Ionicons 
            name={isSearchVisible ? "close" : "search"} 
            size={24} 
            color="#00E654" 
          />
        </TouchableOpacity>
      </View>
    );
  };

  // מסך טעינה
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0b0b' }}>
        <LinearGradient 
          colors={['rgba(0,230,84,0.08)', 'rgba(0,230,84,0.03)', 'rgba(0,230,84,0.05)']} 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} 
        />
        <ImageBackground
          source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1
          }}
          resizeMode="cover"
        />
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['left','right']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              paddingHorizontal: 32,
              paddingVertical: 24,
              borderRadius: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(0,230,84,0.2)'
            }}>
              <ActivityIndicator size="large" color="#00E654" />
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 16, 
                fontWeight: '500',
                marginTop: 16,
                textAlign: 'center'
              }}>
                טוען צ'אט...
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: '#121212' }}
      >
      <ImageBackground 
        source={{ uri: backgroundImage }}
        style={{ 
          flex: 1
        }}
        resizeMode="cover"
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['left','right']}>
      {renderHeader()}
      
      {/* Pinned Messages Header */}
      {currentChatId && (
        <PinnedMessagesHeader 
          key={pinnedMessagesKey}
          channelId={currentChatId}
          onMessagePress={(messageId) => {
            if (messageId === 'refresh_pinned') {
              // This is a refresh request, not a message ID
              // Force re-render of PinnedMessagesHeader
              refreshPinnedMessages();
              return;
            }
            
            // Scroll to the pinned message
            const messageIndex = messages.findIndex(m => m.id === messageId);
            if (messageIndex !== -1) {
              flatListRef.current?.scrollToIndex({
                index: messageIndex,
                animated: true,
                viewPosition: 0.5
              });
            }
          }}
        />
      )}
      
      {/* שדה חיפוש */}
      {isSearchVisible && (
        <View 
          style={{ 
            backgroundColor: 'rgba(0,0,0,0.85)',
            borderBottomColor: '#333',
            borderBottomWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 12
          }}
        >
          <View 
            style={{ 
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: '#333',
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Ionicons 
              name="search" 
              size={20} 
              color="#00E654" 
              style={{ marginLeft: 8 }} 
            />
            <TextInput
              placeholder="חיפוש בהודעות..."
              placeholderTextColor="#9AA0A6"
              value={searchQuery}
              onChangeText={(text: string) => {
                setSearchQuery(text);
                filterMessages(text);
              }}
              style={{ 
                flex: 1,
                textAlign: 'right',
                fontSize: 16,
                color: '#FFFFFF'
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setFilteredMessages([]);
                }}
                style={{ marginLeft: 8 }}
              >
                  <XCircle size={20} color="#6E7681" strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      
        <FlatList
          ref={flatListRef}
          data={searchQuery.trim() ? (filteredMessages || []) : (messagesWithDividers || [])}
          keyExtractor={(item, index) => {
            if ('id' in item) {
              return item.id;
            }
            return `item-${index}`;
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          initialNumToRender={15}
          maxToRenderPerBatch={8}
          windowSize={10}
          removeClippedSubviews={false}
          updateCellsBatchingPeriod={100}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          renderItem={({ item, index }) => {
            // Check if item is a day divider
            if ('type' in item && item.type === 'divider') {
              return <DayDivider date={item.date} />;
            }
            
            // Check if item is an unread divider
            if ('type' in item && item.type === 'unread') {
              return <UnreadDivider unreadCount={item.count} onPress={handleUnreadDividerPress} />;
            }
            
            // חישוב grouping (הודעות רצופות מאותו משתמש)
            const currentMessage = item as Message;
            let isGrouped = false;
            let isGroupStart = false;
            let isGroupEnd = false;
            
            // פונקציה להשוואת שעה ודקה
            const isSameMinute = (date1: Date, date2: Date) => {
              return date1.getHours() === date2.getHours() && 
                     date1.getMinutes() === date2.getMinutes();
            };
            
            // מצא את האינדקס של ההודעה הנוכחית במערך messages הרגיל
            const messageIndex = messages.findIndex(m => m.id === currentMessage.id);
            
            if (messageIndex !== -1) {
              const currentDate = new Date(currentMessage.created_at);
              
              // בדוק אם יש הודעה קודמת (לפני בזמן) מאותו משתמש באותה דקה
              const hasPrevFromSameSender = messageIndex < messages.length - 1 && (() => {
                const prevMessage = messages[messageIndex + 1];
                const prevDate = new Date(prevMessage.created_at);
                return prevMessage.sender_id === currentMessage.sender_id && 
                       isSameMinute(currentDate, prevDate);
              })();
              
              // בדוק אם יש הודעה הבאה (אחרי בזמן) מאותו משתמש באותה דקה
              const hasNextFromSameSender = messageIndex > 0 && (() => {
                const nextMessage = messages[messageIndex - 1];
                const nextDate = new Date(nextMessage.created_at);
                return nextMessage.sender_id === currentMessage.sender_id && 
                       isSameMinute(currentDate, nextDate);
              })();
              
              // קביעת מצב הקיבוץ
              if (hasPrevFromSameSender || hasNextFromSameSender) {
                isGrouped = true;
                isGroupStart = !hasPrevFromSameSender && hasNextFromSameSender; // ראשון בקבוצה
                isGroupEnd = hasPrevFromSameSender && !hasNextFromSameSender; // אחרון בקבוצה
              }
            }
            
            // Regular message
            return (
              <ChatBubble
                message={currentMessage}
                isMe={currentMessage.sender_id === user?.id}
                onReply={handleReply}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                allMessages={messages}
                onJumpToMessage={handleJumpToMessage}
                channelMembers={channelMembers}
                currentUserId={user?.id}
                shouldHighlight={latestMentionMessageId === currentMessage.id}
                isGrouped={isGrouped}
                isGroupStart={isGroupStart}
                isGroupEnd={isGroupEnd}
                hasPrevFromSameSender={hasPrevFromSameSender}
              />
            );
          }}
          ListEmptyComponent={
            searchQuery.trim() ? (
              <Text className="text-center text-gray-500 mt-8">לא נמצאו הודעות עבור "{searchQuery}"</Text>
            ) : (
              <Text className="text-center text-gray-500 mt-8">אין הודעות</Text>
            )
          }
          inverted
          contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 8, paddingBottom: LIST_BOTTOM_PADDING }}
          showsVerticalScrollIndicator={false}
        />
        {/* כפתור גלילה לתחתית */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: SCROLL_BTN_BOTTOM,
            right: 16,
            opacity: scrollButtonOpacity,
            transform: [
              {
                scale: scrollButtonOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          }}
          pointerEvents={showScrollToBottom ? 'auto' : 'none'}
        >
          <TouchableOpacity
            onPress={scrollToBottom}
            className="w-12 h-12 bg-gray-900 rounded-full items-center justify-center shadow-lg"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <ChevronDown size={24} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </Animated.View>

        {/* כפתור גלילה להודעה עם mention */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: MENTION_BTN_BOTTOM,
            right: 16,
            opacity: mentionButtonOpacity,
            transform: [
              {
                scale: mentionButtonOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          }}
          pointerEvents={showScrollToMention ? 'auto' : 'none'}
        >
          <TouchableOpacity
            onPress={scrollToMention}
            className="w-12 h-12 bg-[#00E654] rounded-full items-center justify-center shadow-lg"
            style={{
              shadowColor: '#00E654',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <AtSign size={24} color="#000" strokeWidth={2} />
          </TouchableOpacity>
        </Animated.View>

          {/* Reply Preview - עיצוב חדש ועדין מעל שורת הקלט */}
          {replyingTo && (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: INPUT_BAR_HEIGHT + 1,
                zIndex: 1001,
                marginHorizontal: 0,
                backgroundColor: 'rgba(19, 19, 19, 0.8)',
                borderRadius: 0,
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderLeftWidth: 3,
                borderLeftColor: '#00E654',
                borderWidth: 0,
                borderBottomWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)'
              }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
                {/* אייקון לפי סוג */}
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: 'rgba(0,230,84,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                  marginLeft: 10, marginTop: 2,
                  borderWidth: 1, borderColor: 'rgba(0,230,84,0.25)'
                }}>
                  {replyingTo.type === 'image' && <ImageIcon size={16} color="#00E654" strokeWidth={2} />}
                  {replyingTo.type === 'video' && <Video size={16} color="#00E654" strokeWidth={2} />}
                  {replyingTo.type === 'audio' && <Music size={16} color="#00E654" strokeWidth={2} />}
                  {replyingTo.type === 'document' && <FileText size={16} color="#00E654" strokeWidth={2} />}
                  {!replyingTo.type && <MessageCircle size={16} color="#00E654" strokeWidth={2} />}
                </View>

                {/* תוכן */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
                      {replyingTo.sender?.full_name || 'משתמש'}
                    </Text>
                    <Pressable onPress={cancelReply} hitSlop={10}>
                      <X size={20} color="#888" strokeWidth={2} />
                    </Pressable>
                  </View>
                  <Text 
                    style={{ 
                      color: '#B0B0B0', 
                      fontSize: 12, 
                      textAlign: replyingTo.content && replyingTo.content.trim().length > 0 
                        ? (detectLanguage(replyingTo.content) === 'rtl' ? 'right' : 'left')
                        : 'right', // ברירת מחדל עברית לטקסטי מדיה
                      writingDirection: replyingTo.content && replyingTo.content.trim().length > 0 
                        ? detectLanguage(replyingTo.content) 
                        : 'rtl'
                    }} 
                    numberOfLines={2} 
                    ellipsizeMode="tail"
                  >
                    {replyingTo.content && replyingTo.content.trim().length > 0 
                      ? replyingTo.content 
                      : (replyingTo.type === 'image' 
                          ? 'תמונה' 
                          : replyingTo.type === 'video' 
                            ? 'וידאו' 
                            : replyingTo.type === 'audio' 
                              ? 'הקלטת קול' 
                              : replyingTo.type === 'document' 
                                ? 'מסמך' 
                                : '')}
                  </Text>
                </View>
              </View>
            </View>
          )}
          <MessageInputBar 
            onSend={handleSendMessage}
            onSendMedia={handleMediaPreviewSend}
            onAttachmentPress={() => {
              // הוספת רטט קצר מאוד לכפתור המדיה
              import('../../utils/hapticFeedback').then(({ HapticFeedback }) => {
                HapticFeedback.selection();
              });
            }}
            onEditMessage={editMessage}
            chatId={currentChatId || ''}
            editingMessage={editingMessage}
            onCancelEdit={cancelEdit}
            startTyping={startTyping}
            stopTyping={stopTyping}
          />
        </SafeAreaView>
      </ImageBackground>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

// הסרת הכפילות - ChatProvider נשאר רק ב-ChatStack.tsx 