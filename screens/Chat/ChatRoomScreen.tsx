import { useRef, useState, useEffect, useMemo, useCallback, memo } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform, Text, Image, TouchableOpacity, Animated, ImageBackground, Alert, Pressable, TextInput, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import { useDesignTokens } from '../../components/ui/DesignTokens';

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
  const DesignTokens = useDesignTokens();
  const { messages, sendMessage, chats, currentChatId, markMessageAsRead, markMessageAsDelivered, updateMessage, deleteMessage, retryMessage, loadMessages, typingUsers, startTyping, stopTyping } = useChat();

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
  const tabBarInsets = useSafeAreaInsets();
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

  // טען תמונת הערוץ ומספר החברים
  useEffect(() => {
    if (!currentChatId) return;
    
    const loadChannelData = async () => {
      try {
        // טען פרטי הערוץ ומספר חברים במקביל
        const [
          { data: channelData, error: channelError },
          { count }
        ] = await Promise.all([
          supabase
            .from('channels')
            .select('id, name, image_url, icon_name')
            .eq('id', currentChatId)
            .single(),
          ChatService.getChannelMembersCount(currentChatId).then(r => r)
        ]);
        
        if (channelError) {
          console.error('❌ ChatRoomScreen: Error loading channel:', channelError);
          return;
        }
        if (typeof count === 'number') {
          setMembersCount(count);
        }
        
        // טיפול בתמונה - אם זה path ב-storage, נקבל signed URL
        if (channelData?.image_url) {
          let finalImageUrl = channelData.image_url;
          
          // אם זה לא URL מלא, ננסה לקבל signed URL
          if (!channelData.image_url.startsWith('http')) {
            // ננסה מספר buckets אפשריים
            const bucketsToTry = ['chat-files', 'media', 'app-media', 'avatars'];
            let signedUrlFound = false;
            
            for (const bucketName of bucketsToTry) {
              try {
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                  .from(bucketName)
                  .createSignedUrl(channelData.image_url, 3600);
                
                if (!signedUrlError && signedUrlData) {
                  finalImageUrl = signedUrlData.signedUrl;
                  signedUrlFound = true;
                  break;
                }
              } catch (error) {
                // Continue to next bucket
              }
            }
            
            if (!signedUrlFound) {
              // אם לא מצאנו signed URL, ננסה להשתמש ב-URL הציבורי
              finalImageUrl = `https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/chat-files/${channelData.image_url}`;
            }
          }
          
          setChannelImageUrl(finalImageUrl);
        } else {
          setChannelImageUrl(null);
        }
      } catch (error) {
        console.error('❌ ChatRoomScreen: Error in loadChannelData:', error);
      }
    };
    
    loadChannelData();
  }, [currentChatId]);

  // עדכן isLoading ל-false אחרי שההודעות נטענו או שיש currentChatId
  useEffect(() => {
    if (!isLoading) return;
    
    if (currentChatId) {
      // אם יש הודעות, סיים את הטעינה
      if (messages.length > 0) {
        setIsLoading(false);
      } else {
        // אם אין הודעות עדיין, נסה לטעון אותן
        loadMessages(currentChatId).then(() => {
          setIsLoading(false);
        }).catch((error) => {
          console.error('❌ ChatRoomScreen: Error loading messages:', error);
          setIsLoading(false);
        });
      }
    } else {
      // אם אין currentChatId, סיים את הטעינה אחרי זמן קצר
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
      }, 1500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentChatId, messages.length, isLoading, loadMessages]);

  // הסתר TabBar כשנכנסים למסך זה
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      if (parent) {
        parent.setOptions({
          tabBarStyle: { display: 'none' }
        });
      }

      return () => {
        if (parent) {
          parent.setOptions({
            tabBarStyle: {
              backgroundColor: DesignTokens.colors.background.primary,
              borderTopWidth: 0,
              height: Platform.OS === 'ios' ? 90 : 70 + tabBarInsets.bottom,
              paddingBottom: Platform.OS === 'ios' ? 15 : tabBarInsets.bottom + 10,
              paddingTop: 15,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              display: 'flex'
            }
          });
        }
      };
    }, [navigation])
  );

  // מרווחים דינמיים מול ה-MessageInputBar (ללא TabBar)
  const INPUT_BAR_HEIGHT = 40; // גובה משוער של אזור ההקלדה
  // ברשימה הפוכה מספיק ריווח קטן נוסף כדי שהבועה האחרונה לא תתחבא מאחורי ה-InputBar
  const LIST_BOTTOM_PADDING = INPUT_BAR_HEIGHT + tabBarInsets.bottom + 24; // ריווח עדין לבועה התחתונה
  const SCROLL_BTN_BOTTOM = 90 + tabBarInsets.bottom; // מיקום מעל ה-InputBar כולל SafeArea
  const MENTION_BTN_BOTTOM = 140 + tabBarInsets.bottom; // מעט מעל כפתור הגלילה כולל SafeArea

  // State לחיפוש
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const newMessagesSet = useRef<Set<string>>(new Set());
  const previousMessagesRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  
  // זיהוי הודעות חדשות - רק אחרי שהטעינה הראשונית הסתיימה
  useEffect(() => {
    // אם זה עדיין טעינה ראשונית, אל תסמן הודעות כחדשות
    if (isInitialLoadRef.current) {
      // עדכן את ה-ref אבל אל תסמן הודעות כחדשות
      previousMessagesRef.current = new Set(messages.map(m => m.id));
      // סמן שהטעינה הראשונית הסתיימה אחרי 1 שנייה
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 1000);
      return;
    }
    
    const currentMessageIds = new Set(messages.map(m => m.id));
    const previousMessageIds = previousMessagesRef.current;
    
    // מצא הודעות חדשות (קיימות עכשיו אבל לא היו קודם)
    messages.forEach(msg => {
      if (!previousMessageIds.has(msg.id)) {
        // זו הודעה חדשה - הוסף ל-Set
        newMessagesSet.current.add(msg.id);
        
        // הסר אחרי 2 שניות (כדי שהאנימציה תופיע רק פעם אחת)
        setTimeout(() => {
          newMessagesSet.current.delete(msg.id);
        }, 2000);
      }
    });
    
    // עדכן את ה-ref
    previousMessagesRef.current = currentMessageIds;
  }, [messages]);
  
  // איפוס כשעוברים לערוץ אחר
  useEffect(() => {
    isInitialLoadRef.current = true;
    newMessagesSet.current.clear();
    previousMessagesRef.current.clear();
  }, [currentChatId]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);

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

  // Check if two dates are the same day (using UTC to match DayDivider)
  const isSameDay = (date1: Date, date2: Date) => {
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;

    // Use UTC methods to ensure consistency regardless of timezone
    return date1.getUTCFullYear() === date2.getUTCFullYear() &&
      date1.getUTCMonth() === date2.getUTCMonth() &&
      date1.getUTCDate() === date2.getUTCDate();
  };

  const handleSendMessage = (content: string, mentions?: any[]) => {
    console.log('📱 ChatRoomScreen handleSendMessage:', { content, mentions, replyMessage: replyingTo?.id, user: user?.id, currentChatId });
    console.log('🔍 ChatRoomScreen: Mentions details:', mentions?.map(m => ({ user_id: m.user_id, display: m.display, start: m.start, end: m.end })));

    if (!currentChatId) {
      console.error('❌ ChatRoomScreen: No currentChatId');
      return;
    }

    // שליחת הודעה דרך ChatContext (שמעדכן את הרשימה המקומית באופן אופטימי)
    if (replyingTo) {
      console.log('📤 Sending reply to message:', replyingTo.id);
      sendMessage(content, replyingTo.id, mentions).catch(error => {
        console.error('❌ Error sending reply message:', error);
        Alert.alert('שגיאה', 'לא ניתן לשלוח הודעה');
      });
    } else {
      console.log('📤 Sending regular message');
      sendMessage(content, undefined, mentions).catch(error => {
        console.error('❌ Error sending message:', error);
        Alert.alert('שגיאה', 'לא ניתן לשלוח הודעה');
      });
    }

    // איפוס ה-reply מיד אחרי השליחה
    setReplyingTo(null);

    // גלילה אוטומטית לתחתית מיד אחרי הוספת ההודעה המקומית
    scrollToBottom();
  };

  // Create data with day dividers
  const messagesWithDividers = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const data: Array<Message | { type: 'divider'; date: Date; id: string } | { type: 'unread'; count: number; id: string }> = [];

    // In an inverted list, we iterate from newest (index 0) to oldest.
    // We want the divider to appear ABOVE the message group.
    // In inverted list, "above" means a HIGHER index.
    // So we should push the message first, then check if we need a divider (which will be at next index).

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const nextMessage = i < messages.length - 1 ? messages[i + 1] : null;

      // 1. Push the message itself
      data.push(message);

      // 2. Check if we need a DayDivider AFTER this message (which means ABOVE it visually)
      // We need a divider if:
      // a) It's the last message in the list (oldest message) - always gets a divider above it
      // b) The next message (older) is from a different day

      let messageDate: Date;
      try {
        messageDate = new Date(message.created_at);
      } catch (e) {
        messageDate = new Date();
      }

      let showDivider = false;

      if (!nextMessage) {
        // Last message (oldest) - always show divider
        showDivider = true;
      } else {
        // Check if day changed compared to next (older) message
        let nextDate: Date;
        try {
          nextDate = new Date(nextMessage.created_at);
        } catch (e) {
          nextDate = new Date();
        }

        if (!isSameDay(messageDate, nextDate)) {
          showDivider = true;
        }
      }

      if (showDivider) {
        const dividerKey = messageDate.toISOString().split('T')[0];
        data.push({
          type: 'divider',
          date: messageDate,
          id: `divider-${dividerKey}-${i}`, // Unique ID
        });
      }
    }

    // Add unread divider logic
    if (unreadCount > 0 && user && lastReadMessageId) {
      // We want the unread divider to appear ABOVE the last read message.
      // In inverted list, "above" means HIGHER index.
      // So we need to find the last read message in 'data', and insert the divider AFTER it (higher index).

      let lastReadIndex = -1;

      // Find index of last read message in the new data array
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if ('id' in item && item.id === lastReadMessageId) {
          lastReadIndex = i;
          break;
        }
      }

      if (lastReadIndex !== -1) {
        // Insert AFTER the last read message (so it appears above it)
        // Note: If there was a day divider pushed after the message, we should probably put the unread divider
        // BEFORE the day divider (so unread divider is below day divider visually, but above message).
        // Wait, visually:
        // [Day Divider]
        // [Unread Divider]
        // [Message (Last Read)]

        // In inverted list (indices):
        // 0: Message
        // 1: Unread Divider
        // 2: Day Divider

        // Currently 'data' might look like: [..., Message, DayDivider, ...]
        // If we insert at lastReadIndex + 1, we get: [..., Message, UnreadDivider, DayDivider, ...]
        // This seems correct! The UnreadDivider will be "above" the message, and "below" the DayDivider.

        data.splice(lastReadIndex + 1, 0, {
          type: 'unread',
          count: unreadCount,
          id: 'unread-divider'
        });
      } else {
        // If last read message not found (maybe too old), put it at the end (top of chat visually)
        // But wait, if all messages are unread, lastReadMessageId might be null or not in list.
        // If unreadCount > 0 but we can't find the anchor, maybe we shouldn't show it or show at top?
        // Let's stick to the logic: if not found, maybe it's very old.
        // If we want to show "Unread Messages" bar at the top (oldest), we push to end of data.
        data.push({
          type: 'unread',
          count: unreadCount,
          id: 'unread-divider'
        });
      }
    } else if (unreadCount > 0 && user && !lastReadMessageId) {
      // All messages are unread (no last read message)
      // Show divider at the very end (top of chat visually)
      data.push({
        type: 'unread',
        count: unreadCount,
        id: 'unread-divider'
      });
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
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;

    /**
     * ברשימה הפוכה (inverted = true):
     * - כשהמשתמש בתחתית (הודעות חדשות) → y קרוב ל-0
     * - כשהמשתמש גולל למעלה (הודעות ישנות) → y גדל
     */

    const y = contentOffset.y;
    // האם אנחנו קרובים לתחתית (עם טולרנס)
    const isAtBottomNow = y < 50;
    setIsAtBottom(isAtBottomNow);

    // הצגת כפתור חזרה לתחתית:
    // כשהמשתמש גולל יותר מ-100px מהתחתית, נציג את הכפתור
    const shouldShowScrollButton = y > 100;
    
    if (shouldShowScrollButton !== showScrollToBottom) {
      setShowScrollToBottom(shouldShowScrollButton);
      
      // אנימציה לכפתור הגלילה
      Animated.timing(scrollButtonOpacity, {
        toValue: shouldShowScrollButton ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    // אנימציה לכפתור ה-mention (תמיד מעודכן)
    Animated.timing(mentionButtonOpacity, {
      toValue: showScrollToMention ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // בינתיים, לא נאפס אוטומטית - רק אם המשתמש גולל הרבה
    if (unreadCount > 0 && contentOffset.y > 200) {
      console.log('📜 ChatRoomScreen: User scrolled significantly (y:', contentOffset.y, '), considering reset');
    }
  }, [showScrollToBottom, showScrollToMention, unreadCount, scrollButtonOpacity, mentionButtonOpacity]);

  const handleGroupInfoPress = () => {
    navigation.navigate('GroupInfo', { chatId: currentChatId });
  };

  // פונקציה לגלילה לתחתית
  const scrollToBottom = useCallback(() => {
    console.log('📜 ChatRoomScreen: scrollToBottom called');
    if (!flatListRef.current) return;

    // ברשימה הפוכה, offset 0 = תחתית (הודעות חדשות)
    flatListRef.current.scrollToOffset({ offset: 0, animated: true });

    // עדכון מיידי של המצב
    setIsAtBottom(true);
    setShowScrollToBottom(false);
    
    // אנימציה להסתרת הכפתור
    Animated.timing(scrollButtonOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // אפס את unreadCount כשגוללים לתחתית
    if (unreadCount > 0 && currentChatId && user?.id) {
      console.log('📜 ChatRoomScreen: Scrolling to bottom - resetting unread count');
      setUnreadCount(0);
      if (messages.length > 0) {
        const lastMessage = messages[0]; // ההודעה החדשה ביותר
        ChatService.markMessagesAsRead(currentChatId, user.id, lastMessage.id);
      }
    }
  }, [unreadCount, currentChatId, user?.id, messages, scrollButtonOpacity]);

  // גלילה אוטומטית לתחתית כאשר המשתמש בתחתית ונוספת הודעה חדשה
  useEffect(() => {
    if (!user?.id) return;
    if (!isAtBottom) return; // רק אם המשתמש כבר בתחתית
    if (!messages.length) return;

    const latest = messages[0];
    // אם ההודעה האחרונה היא של המשתמש הנוכחי – גלול אליה
    if (latest.sender_id === user.id) {
      console.log('📜 ChatRoomScreen: Auto scroll after own message');
      scrollToBottom();
    }
  }, [messages.length, isAtBottom, user?.id]);

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
            mediaMetadata = {
              ...(uploadResult.metadata || {}),
              file_name: mediaFile.fileName || mediaFile.name || undefined,
              file_size: mediaFile.fileSize || mediaFile.size || undefined,
              duration: mediaFile.duration || undefined,
              width: mediaFile.width || undefined,
              height: mediaFile.height || undefined,
              // שמור waveformData אם יש (להקלטות)
              ...(mediaFile.waveformData ? { waveformData: mediaFile.waveformData } : {})
            };
            console.log('✅ Media uploaded successfully:', { type: mediaFile.type, url: mediaUrl, metadata: mediaMetadata });
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
          paddingTop: tabBarInsets.top + 10,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: DesignTokens.colors.border.main,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 8,
          minHeight: tabBarInsets.top + 60,
          overflow: 'hidden',
          backgroundColor: DesignTokens.colors.background.primary
        }}
      >
        {/* חזרה לרקע המקורי */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: DesignTokens.colors.background.primary
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
          <ArrowRight size={24} color={DesignTokens.colors.primary.main} strokeWidth={2} />
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
                borderColor: DesignTokens.colors.primary.main,
                shadowColor: DesignTokens.colors.primary.main,
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
              backgroundColor: DesignTokens.colors.primary.main,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 12,
              borderWidth: 2,
              borderColor: DesignTokens.colors.primary.main,
              shadowColor: DesignTokens.colors.primary.main,
              shadowOpacity: 0.3,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 }
            }}>
              <Ionicons name={iconName as any} size={18} color={DesignTokens.colors.text.primary} />
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
              color: typingUsers.length > 0 ? DesignTokens.colors.success.main : DesignTokens.colors.text.tertiary,
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
            color={DesignTokens.colors.primary.main}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // מסך טעינה
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
        <LinearGradient
          colors={[`${DesignTokens.colors.success.main}14`, `${DesignTokens.colors.success.main}08`, `${DesignTokens.colors.success.main}0D`]}
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
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['left', 'right']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{
              backgroundColor: DesignTokens.colors.background.secondary,
              paddingHorizontal: 32,
              paddingVertical: 24,
              borderRadius: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: `${DesignTokens.colors.success.main}33`
            }}>
              <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
              <Text style={{
                color: DesignTokens.colors.text.primary,
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

  // שימוש ב-tabBarInsets שכבר הוגדר בראש הקומפוננטה (שורה 160)
  // נמחק: const insets = useSafeAreaInsets(); - הפרה של Rules of Hooks
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}
    >
        <ImageBackground
          source={{ uri: backgroundImage }}
          style={{
            flex: 1
          }}
          resizeMode="cover"
        >
          <SafeAreaView
            style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}
            edges={['left', 'right', 'bottom']}
          >
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
                  backgroundColor: DesignTokens.colors.background.secondary,
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
                    backgroundColor: DesignTokens.colors.background.tertiary,
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
                    color={DesignTokens.colors.primary.main}
                    style={{ marginLeft: 8 }}
                  />
                  <TextInput
                    placeholder="חיפוש בהודעות..."
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    value={searchQuery}
                    onChangeText={(text: string) => {
                      setSearchQuery(text);
                      filterMessages(text);
                    }}
                    style={{
                      flex: 1,
                      textAlign: 'right',
                      fontSize: 16,
                      color: DesignTokens.colors.text.primary
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
                      <XCircle size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
              onScrollToIndexFailed={(info) => {
                console.warn('⚠️ ChatRoomScreen: scrollToIndex failed, using offset fallback:', info);
                setTimeout(() => {
                  if (!flatListRef.current || !messagesWithDividers.length) {
                    console.warn('❌ ChatRoomScreen: Cannot scroll, list not ready');
                    return;
                  }
                  const estimatedItemHeight = 80;
                  const targetOffset = Math.max(0, info.index * estimatedItemHeight - 100);
                  console.log('📏 ChatRoomScreen: Scrolling to offset fallback:', targetOffset);
                  try {
                    flatListRef.current?.scrollToOffset({
                      offset: targetOffset,
                      animated: true,
                    });
                  } catch (error) {
                    console.error('❌ ChatRoomScreen: Error in scrollToOffset fallback:', error);
                  }
                }, 100);
              }}
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

                // הגדר משתנים מחוץ ל-if block כדי שיהיו זמינים בשימוש ב-ChatBubble
                let hasPrevFromSameSender = false;
                let hasNextFromSameSender = false;

                if (messageIndex !== -1) {
                  const currentDate = new Date(currentMessage.created_at);

                  // בדוק אם יש הודעה קודמת (לפני בזמן) מאותו משתמש באותה דקה
                  hasPrevFromSameSender = messageIndex < messages.length - 1 && (() => {
                    const prevMessage = messages[messageIndex + 1];
                    const prevDate = new Date(prevMessage.created_at);
                    return prevMessage.sender_id === currentMessage.sender_id &&
                      isSameMinute(currentDate, prevDate);
                  })();

                  // בדוק אם יש הודעה הבאה (אחרי בזמן) מאותו משתמש באותה דקה
                  hasNextFromSameSender = messageIndex > 0 && (() => {
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
                const isNewMessage = newMessagesSet.current.has(currentMessage.id);
                return (
                  <ChatBubble
                    message={currentMessage}
                    isMe={currentMessage.sender_id === user?.id}
                    onReply={handleReply}
                    onEditMessage={handleEditMessage}
                    onDeleteMessage={handleDeleteMessage}
                    onRetryMessage={retryMessage}
                    allMessages={messages}
                    onJumpToMessage={handleJumpToMessage}
                    channelMembers={channelMembers}
                    currentUserId={user?.id}
                    shouldHighlight={latestMentionMessageId === currentMessage.id}
                    isGrouped={isGrouped}
                    isGroupStart={isGroupStart}
                    isGroupEnd={isGroupEnd}
                    hasPrevFromSameSender={hasPrevFromSameSender}
                    isNewMessage={isNewMessage}
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
              // ברשימה הפוכה (inverted), הפריט האחרון ויזואלית נמצא בתחתית,
              // לכן את הריווח מתחתיו צריך לתת דרך paddingTop ולא paddingBottom.
              contentContainerStyle={{
                paddingTop: LIST_BOTTOM_PADDING,
                paddingHorizontal: 8,
                paddingBottom: 8,
              }}
              showsVerticalScrollIndicator={false}
            />
            </TouchableWithoutFeedback>
            {/* כפתור גלילה לתחתית - תמיד מרונדר עם אנימציית opacity */}
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
                zIndex: 1000,
              }}
              pointerEvents={showScrollToBottom ? 'auto' : 'none'}
            >
              <TouchableOpacity
                onPress={scrollToBottom}
                activeOpacity={0.8}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: DesignTokens.colors.background.secondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: DesignTokens.colors.border.primary,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 6,
                }}
              >
                <ChevronDown size={22} color={DesignTokens.colors.text.primary} strokeWidth={2.3} />
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
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: DesignTokens.colors.success.main,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: DesignTokens.colors.primary.main,
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
                  bottom: INPUT_BAR_HEIGHT + tabBarInsets.bottom + 10,
                  zIndex: 1001,
                  marginHorizontal: 0,
                  backgroundColor: DesignTokens.colors.background.secondary,
                  borderRadius: 0,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderLeftWidth: 3,
                  borderLeftColor: DesignTokens.colors.success.main,
                  borderWidth: 0,
                  borderBottomWidth: 1,
                  borderColor: DesignTokens.colors.border.primary
                }}
              >
                <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start' }}>
                  {/* אייקון לפי סוג */}
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: `${DesignTokens.colors.success.main}26`,
                    alignItems: 'center', justifyContent: 'center',
                    marginLeft: 10, marginTop: 2,
                    borderWidth: 1, borderColor: `${DesignTokens.colors.success.main}40`
                  }}>
                    {replyingTo.type === 'image' && <ImageIcon size={16} color={DesignTokens.colors.primary.main} strokeWidth={2} />}
                    {replyingTo.type === 'video' && <Video size={16} color={DesignTokens.colors.primary.main} strokeWidth={2} />}
                    {replyingTo.type === 'audio' && <Music size={16} color={DesignTokens.colors.primary.main} strokeWidth={2} />}
                    {replyingTo.type === 'document' && <FileText size={16} color={DesignTokens.colors.primary.main} strokeWidth={2} />}
                    {!replyingTo.type && <MessageCircle size={16} color={DesignTokens.colors.primary.main} strokeWidth={2} />}
                  </View>

                  {/* תוכן */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
                        {replyingTo.sender?.full_name || 'משתמש'}
                      </Text>
                      <Pressable onPress={cancelReply} hitSlop={10}>
                        <X size={20} color="#888" strokeWidth={2} />
                      </Pressable>
                    </View>
                    <Text
                      style={{
                        color: DesignTokens.colors.text.secondary,
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
  );
}

// הסרת הכפילות - ChatProvider נשאר רק ב-ChatStack.tsx 