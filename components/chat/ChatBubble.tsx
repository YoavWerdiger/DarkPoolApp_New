import React from 'react';
import { View, Text, Pressable, Alert, Image, Animated, Dimensions, Linking, Modal, Clipboard } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle, Forward, FileText, Play, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
// חזרה זמנית למצב יציב ללא HoldMenu
const HoldItem: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
import { Message, ReactionSummary } from '../../services/supabase';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import MediaBubble from './MediaBubble';
import MediaViewer from './MediaViewer';
import ForwardModal from './ForwardModal';
import ReactionPicker from './ReactionPicker';
import ReactionDetailsModal from './ReactionDetailsModal';
import MessageContextMenu from './MessageContextMenu';
import LongPressOverlay from './LongPressOverlay';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import PollMessage from './PollMessage';
import SeenBySheet from './SeenBySheet';
import MediaMessageRenderer from './MediaMessageRenderer';
import MessageReactions from './MessageReactions';
import MessageContent from './MessageContent';
import ActionMenu from './ActionMenu';
// import { MediaFile } from '../../services/mediaService';
import { PollService, PollWithVotes } from '../../services/pollService';
import { useAuth } from '../../context/AuthContext';
import { extractTextSegments } from '../../utils/textRanges';
import { Audio } from 'expo-av';
// רטט נשאר פעיל - אם יש התקנה
let Haptics: any = { impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 'Light' } };
try { Haptics = require('expo-haptics'); } catch {}
import { supabase } from '../../lib/supabase';
import { DesignTokens } from '../ui/DesignTokens';

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

interface ChatBubbleProps {
  message: Message;
  isMe: boolean;
  onReply?: (msg: Message) => void;
  onEditMessage?: (msg: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  allMessages?: Message[];
  onJumpToMessage?: (id: string) => void;
  channelMembers?: string[]; // Array of user IDs in the channel
  currentUserId?: string; // Current user ID for mention highlighting
  shouldHighlight?: boolean; // Whether this message should be highlighted
}

export default function ChatBubble({ message, isMe, onReply, onEditMessage, onDeleteMessage, allMessages, onJumpToMessage, channelMembers, currentUserId, shouldHighlight }: ChatBubbleProps) {
  const { user } = useAuth();
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const highlightAnimation = useRef(new Animated.Value(0)).current;
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactions, setReactions] = useState<ReactionSummary[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [showReactionDetailsModal, setShowReactionDetailsModal] = useState(false);
  const [showMessageContextMenu, setShowMessageContextMenu] = useState(false);
  const [messagePosition, setMessagePosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MessageSnapshot | null>(null);
  const [showSeenBySheet, setShowSeenBySheet] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const swipeableRef = useRef<Swipeable>(null);

  // פונקציה לאיפוס כל ה-states (למעט MediaViewer)
  const resetAllStates = () => {
    console.log('🔄 resetAllStates called');
    
    // סגור את ה-Swipeable במפורש
    if (swipeableRef.current) {
      swipeableRef.current.close();
      console.log('🔄 Swipeable closed manually');
    }
    
    setSelectedMessage(null);
    setShowMessageContextMenu(false);
    setActionMenuVisible(false);
    setSwipeEnabled(true);
    console.log('🔄 resetAllStates completed - swipeEnabled set to true');
  };

  // פונקציה לאיפוס מלא כולל MediaViewer
  const resetAllStatesIncludingMedia = () => {
    console.log('🔄 resetAllStatesIncludingMedia called');
    
    // סגור את ה-Swipeable במפורש
    if (swipeableRef.current) {
      swipeableRef.current.close();
      console.log('🔄 Swipeable closed manually');
    }
    
    setSelectedMessage(null);
    setShowMessageContextMenu(false);
    setActionMenuVisible(false);
    setShowMediaViewer(false);
    setSelectedMedia(null);
    setSwipeEnabled(true);
    console.log('🔄 resetAllStatesIncludingMedia completed');
  };
  const [pollData, setPollData] = useState<PollWithVotes | null>(null);
  const [isMessageStarred, setIsMessageStarred] = useState(false);
  const [replyPreviewWidth, setReplyPreviewWidth] = useState(0);
  
  // בדיקה אם זו הודעה זמנית
  const isTemporary = message.id.startsWith('temp_');
  const isSending = isTemporary; // הודעה זמנית נחשבת כנשלחת

  // Debug: עקוב אחרי שינויים ב-showSeenBySheet
  useEffect(() => {
    console.log('🔍 ChatBubble: showSeenBySheet changed to:', showSeenBySheet);
    if (showSeenBySheet) {
      console.log('🎯 ChatBubble: About to render SeenBySheet with props:', {
        visible: showSeenBySheet,
        readByUserIds: message.read_by || [],
        messageTimestamp: message.created_at
      });
    }
  }, [showSeenBySheet, message.read_by, message.created_at]);

  // Debug: עקוב אחרי שינויים ב-showMediaViewer
  useEffect(() => {
    console.log('🎯 ChatBubble: showMediaViewer changed to:', showMediaViewer);
  }, [showMediaViewer]);

  // Debug: עקוב אחרי שינויים ב-selectedMessage
  useEffect(() => {
    console.log('🎯 ChatBubble: selectedMessage changed to:', selectedMessage?.id);
  }, [selectedMessage]);

  // Debug: עקוב אחרי שינויים ב-swipeEnabled
  useEffect(() => {
    console.log('🎯 ChatBubble: swipeEnabled changed to:', swipeEnabled);
  }, [swipeEnabled]);
  
  // State לניהול הקלטה
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  
  const bubbleScale = useRef(new Animated.Value(0.8)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const screenWidth = Dimensions.get('window').width;
  const maxBubbleWidth = Math.floor(screenWidth * 0.9);

  // לוג לבדיקת פרטי השולח
  useEffect(() => {
    console.log('💬 ChatBubble render:', {
      messageId: message.id,
      content: message.content,
      senderId: message.sender_id,
      sender: message.sender,
      isMe
    });
  }, [message]);

  // Check if message is starred by current user
  useEffect(() => {
    const checkStarStatus = async () => {
      if (!user?.id) return;
      
      try {
        console.log('⭐ ChatBubble: Checking star status for message:', message.id);
        
        const ChatService = await import('../../services/chatService');
        const isStarred = await ChatService.ChatService.isMessageStarred(
          message.id,
          user.id
        );
        
        console.log('⭐ ChatBubble: Star status result:', { isStarred });
        
        setIsMessageStarred(isStarred);
      } catch (error) {
        console.error('❌ Error checking star status:', error);
        setIsMessageStarred(false);
      }
    };
    
    checkStarStatus();
  }, [user?.id, message.id]);

  // פונקציות לניהול הקלטה
  const loadAudio = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: message.file_url! },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      setSound(newSound);
      
      // קבלת משך ההקלטה
      const status = await newSound.getStatusAsync();
      if (status.isLoaded) {
        setDuration(status.durationMillis || 0);
      }
    } catch (error) {
      console.error('❌ Error loading audio:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setCurrentTime(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    }
  };

  const togglePlayPause = async () => {
    try {
      if (!sound) {
        await loadAudio();
        return;
      }
      
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('❌ Error toggling audio:', error);
    }
  };

  const seekTo = async (position: number) => {
    try {
      if (sound) {
        await sound.setPositionAsync(position);
      }
    } catch (error) {
      console.error('❌ Error seeking audio:', error);
    }
  };

  const formatTime = (millis: number) => {
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // ניקוי הקלטה בעת unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // זיהוי כיוון שפה לפי תוכן ההודעה
  const getTextDirection = () => {
    if (!message.content) return 'rtl'; // ברירת מחדל
    
    const language = detectLanguage(message.content);
    console.log('🌐 Language detection:', { content: message.content, language });
    return language;
  };

  const textDirection = getTextDirection();

  // אנימציה כניסה לבועה
  useEffect(() => {
    Animated.parallel([
      Animated.timing(bubbleScale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(bubbleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ביטול אנימציית 'שולח...' כדי למנוע הבהובים
  useEffect(() => {
    return undefined;
  }, []);

  // טעינת ריאקציות
  useEffect(() => {
    loadReactions();
  }, [message.id]);

  // טען נתוני סקר אם ההודעה היא מסוג poll
  useEffect(() => {
    if (message.type === 'poll' && message.poll_id) {
      loadPollData();
    }
  }, [message.poll_id]);

  // אנימציית הדגשה להודעה עם mention
  useEffect(() => {
    console.log('🎯 ChatBubble: useEffect shouldHighlight triggered:', { shouldHighlight, messageId: message.id });
    if (shouldHighlight) {
      console.log('🎯 ChatBubble: Starting highlight animation for message:', message.id);
      
      // אנימציה של הדגשה
      Animated.sequence([
        Animated.timing(highlightAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(highlightAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [shouldHighlight, highlightAnimation, message.id]);

  const loadPollData = async () => {
    if (!message.poll_id) return;
    
    try {
      const poll = await PollService.getPollResults(message.poll_id);
      setPollData(poll);
    } catch (error) {
      console.error('❌ Error loading poll data:', error);
    }
  };

  // Render text with mentions - now using MessageContent component
  const renderTextWithMentions = (text: string, mentions?: any[]) => {
    return (
      <MessageContent
        content={text}
        mentions={mentions}
        isMe={isMe}
        textDirection={'rtl'}
      />
    );
  };

  // Get read receipt status - תיקון להצגה נכונה של סימני קריאה
  const getReadReceiptStatus = () => {
    if (!isMe || !channelMembers) return null;
    
    const readByCount = message.read_by ? message.read_by.length : 0;
    const totalRecipients = channelMembers.length - 1; // Exclude sender
    
    console.log('📋 Read Receipt Status:', {
      messageId: message.id,
      status: message.status,
      readByCount,
      totalRecipients,
      readBy: message.read_by
    });
    
    // בדיקה לפי status ו-read_by
    if (message.status === 'sent' && readByCount === 0) {
      return { icon: '✓', color: '#9CA3AF' }; // נשלח אבל לא נקרא על ידי אף אחד
    } else if (readByCount > 0 && readByCount >= totalRecipients) {
      return { icon: '✓✓', color: '#00E654' }; // נקרא על ידי כולם - ירוק
    } else if (readByCount > 0 && readByCount < totalRecipients) {
      return { icon: '✓✓', color: '#9CA3AF' }; // נקרא על ידי חלק - אפור
    } else {
      return { icon: '✓', color: '#9CA3AF' }; // ברירת מחדל - נשלח
    }
  };

  const handleSeenByPress = async () => {
    console.log('👀 ChatBubble: SeenBy pressed for message:', {
      messageId: message.id,
      readBy: message.read_by,
      readByLength: message.read_by?.length || 0,
      status: message.status
    });
    
    // Mark message as viewed by current user
    if (user?.id) {
      try {
        const ChatService = await import('../../services/chatService');
        await ChatService.ChatService.markMessageAsViewed(message.id, user.id);
        console.log('✅ ChatBubble: Message marked as viewed by user');
      } catch (error) {
        console.error('❌ ChatBubble: Error marking message as viewed:', error);
      }
    }
    
    // פתח את הדיאלוג תמיד, גם אם אין משתמשים שראו
    console.log('✅ ChatBubble: Opening SeenBySheet for message:', message.id);
    setShowSeenBySheet(true);
    console.log('🎯 ChatBubble: showSeenBySheet set to true');
  };

  const onLongPress = async () => {
    console.log('🎯 onLongPress called - swipeEnabled:', swipeEnabled);
    
    // בדוק אם אנחנו כבר במצב של long press
    if (selectedMessage) {
      console.log('🎯 Already in long press mode, ignoring');
      return;
    }
    
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    // אנימציית scale קצרה לבועה
    try {
      Animated.sequence([
        Animated.timing(pressScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
        Animated.spring(pressScale, { toValue: 1, useNativeDriver: true })
      ]).start();
    } catch {}
    
    // אפס רק את ה-states הרלוונטיים
    setShowMediaViewer(false);
    setSelectedMedia(null);
    setShowMessageContextMenu(false);
    setActionMenuVisible(false);
    
    const snapshot: MessageSnapshot = {
      id: message.id,
      content: message.content || '',
      mediaUrl: message.media_url,
      senderName: message.sender?.full_name,
      senderAvatar: (message.sender as any)?.avatar_url,
      timestamp: new Date(message.created_at).toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      reactions: Array.isArray(message.reactions) ? message.reactions : [],
      type: message.type as any,
      createdAt: message.created_at,
      isMe: isMe,
      channelId: (message as any).channel_id,
    };
    setSelectedMessage(snapshot);
    setSwipeEnabled(false);
    setActionMenuVisible(true);
    
    console.log('🎯 selectedMessage set, actionMenuVisible set to true, swipeEnabled set to false');
  };
  
  const onCopy = () => { 
    // העתקה אמיתית ל-Clipboard
    if (message.content) {
      Clipboard.setString(message.content);
      Alert.alert('הועתק!', 'הטקסט הועתק ללוח');
    }
  };
  
  const onDelete = () => { 
    Alert.alert('נמחק!', 'ההודעה נמחקה'); 
  };
  
  const handleReply = () => { 
    setIsReplying(true);
    onReply && onReply(message); 
  };
  
  const handleForward = () => {
    // פתיחת Forward Modal להודעות טקסט
    setShowForwardModal(true);
  };
  
  const onReact = () => { 
    setShowReactionPicker(true);
  };

  const onEdit = () => {
    // Call parent's edit function if available
    if (onEditMessage) {
      onEditMessage(message);
    }
  };

  const handleReaction = async (emoji: string) => {
    try {
      setLoadingReactions(true);
      
      // קריאה ל-ChatService
      const ChatService = await import('../../services/chatService');
      const wasAdded = await ChatService.ChatService.toggleReaction(message.id, emoji);
      
      if (wasAdded) {
        // ריאקציה נוספה - עדכן את הרשימה
        await loadReactions();
      } else {
        // ריאקציה הוסרה - עדכן את הרשימה
        await loadReactions();
      }
    } catch (error) {
      console.error('❌ Error handling reaction:', error);
      Alert.alert('שגיאה', 'שגיאה בהוספת ריאקציה');
    } finally {
      setLoadingReactions(false);
    }
  };

  const loadReactions = async () => {
    try {
      const ChatService = await import('../../services/chatService');
      const reactionsData = await ChatService.ChatService.getMessageReactions(message.id);
      setReactions(reactionsData);
    } catch (error) {
      console.error('❌ Error loading reactions:', error);
    }
  };

  const handleReactionDetails = () => {
    // פתיחת מודל פירוט ריאקציות
    setShowReactionDetailsModal(true);
  };

  // Star/Unstar message functions
  const handleStarMessage = async () => {
    try {
      if (!user?.id) return;
      
      console.log('⭐ ChatBubble: Attempting to star message:', {
        messageId: message.id,
        userId: user.id
      });
      
      const ChatService = await import('../../services/chatService');
      const success = await ChatService.ChatService.starMessage(
        message.id,
        user.id
      );
      
      console.log('⭐ ChatBubble: Star message result:', success);
      
      if (success) {
        setIsMessageStarred(true);
        Alert.alert('הצלחה', 'ההודעה סומנה בכוכב');
      } else {
        Alert.alert('שגיאה', 'לא ניתן לסמן את ההודעה בכוכב');
      }
    } catch (error) {
      console.error('❌ Error starring message:', error);
      Alert.alert('שגיאה', 'שגיאה בסימון ההודעה בכוכב');
    }
  };

  const handleUnstarMessage = async () => {
    try {
      if (!user?.id) return;
      
      console.log('⭐ ChatBubble: Attempting to unstar message:', {
        messageId: message.id,
        userId: user.id
      });
      
      const ChatService = await import('../../services/chatService');
      const success = await ChatService.ChatService.unstarMessage(
        message.id,
        user.id
      );
      
      console.log('⭐ ChatBubble: Unstar message result:', success);
      
      if (success) {
        setIsMessageStarred(false);
        Alert.alert('הצלחה', 'ההודעה הוסרה מהכוכבים');
      } else {
        Alert.alert('שגיאה', 'לא ניתן להסיר את ההודעה מהכוכבים');
      }
    } catch (error) {
      console.error('❌ Error unstarring message:', error);
      Alert.alert('שגיאה', 'שגיאה בהסרת ההודעה מהכוכבים');
    }
  };

  // Function to jump to a specific message
  const handleJumpToMessage = (messageId: string) => {
    if (onJumpToMessage) {
      onJumpToMessage(messageId);
    }
  };

  // Swipe actions
  const handleSwipeReply = () => {
    // הפעלת reply דרך onReply
    onReply && onReply(message);
  };

  const handleSwipeForward = () => {
    // פתיחת Forward Modal
    setShowForwardModal(true);
  };

  const renderReactions = () => {
    if (!reactions || reactions.length === 0) return null;

    const displayReactions = reactions.slice(0, 3); // רק 3 הראשונות
    const remainingCount = reactions.length > 3 ? reactions.length - 3 : 0;

    return (
      <Pressable 
        onPress={handleReactionDetails}
        className="absolute -bottom-1 -left-1 flex-row items-center"
      >
        {/* בועות הריאקציה */}
        <View className="flex-row">
          {displayReactions.map((reaction, index) => (
            <View
              key={index}
              className="px-2 py-1 rounded-full border items-center justify-center"
              style={{
                backgroundColor: 'rgba(55, 65, 81, 0.7)',
                borderColor: 'rgba(107, 114, 128, 0.5)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 2,
                minWidth: 28,
                minHeight: 24,
                marginLeft: index > 0 ? -8 : 0, // חיבור הבועות
                zIndex: reactions.length - index // שכבות
              }}
            >
              <Text className="text-xs">{reaction.emoji}</Text>
              {reaction.count > 1 && (
                <Text className="text-xs text-gray-400 ml-1 font-medium">
                  {reaction.count}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* +X אם יש יותר מ-3 */}
        {remainingCount > 0 && (
          <View className="px-2 py-1 rounded-full border ml-1 items-center justify-center"
            style={{
              backgroundColor: 'rgba(55, 65, 81, 0.7)',
              borderColor: 'rgba(107, 114, 128, 0.5)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
              minWidth: 28,
              minHeight: 24
            }}>
            <Text className="text-xs text-gray-400 font-medium">
              +{remainingCount}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };
  
  const handleMediaPress = (media: any) => {
    console.log('🎯 handleMediaPress called with:', media);
    
    // אפס רק את ה-states הרלוונטיים, לא את showMediaViewer
    setSelectedMessage(null);
    setShowMessageContextMenu(false);
    setActionMenuVisible(false);
    setSwipeEnabled(true);
    
    setSelectedMedia(media);
    setShowMediaViewer(true);
    
    console.log('🎯 showMediaViewer set to true');
  };

  // מצא את הודעת ה-reply אם יש (תמיכה בשם שדה חלופי)
  const replyId: string | undefined = (message as any).reply_to_message_id || (message as any).reply_to_id;
  let replyMsg: Message | undefined = undefined;
  if (replyId && allMessages) {
    replyMsg = allMessages.find(m => m.id === replyId);
  }

  // רנדר סטטוס הודעה
  const renderMessageStatus = () => {
    if (!isMe) return null;
    
    const status = message.status || 'sent';
    let icon = '';
    let color = '#888';
    
    switch (status) {
      case 'sent':
        icon = 'checkmark';
        color = '#888';
        break;
      case 'delivered':
        icon = 'checkmark-done';
        color = '#888';
        break;
      case 'read':
        icon = 'checkmark-done';
        color = '#00E654';
        break;
    }
    
    return (
      <View className="flex-row items-center">
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
    );
  };

  // Swipe Actions
  const renderLeftActions = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 20 }}>
      {/* Reply Action - Circle */}
      <RectButton
        onPress={handleSwipeReply}
        style={{
          backgroundColor: '#3B82F6',
          width: 40,
          height: 40,
          borderRadius: 30,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5
        }}
      >
        <MessageCircle size={20} color="white" strokeWidth={2} />
      </RectButton>
    </View>
  );

  const renderRightActions = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 20 }}>
      {/* Forward Action - Circle */}
      <RectButton
        onPress={handleSwipeForward}
        style={{
          backgroundColor: '#F59E0B',
          width: 40,
          height: 40,
          borderRadius: 30,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5
        }}
      >
        <Forward size={20} color="white" strokeWidth={2} />
      </RectButton>
    </View>
  );

  // הצג preview של הודעת reply בתוך הבועה
  const renderReplyPreview = () => {
    if (!replyId) return null;
    if (!replyMsg) {
      return (
          <View
            onLayout={(e) => setReplyPreviewWidth(e.nativeEvent.layout.width)}
            style={{
            backgroundColor: isMe ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',
            paddingVertical: 6,
            paddingHorizontal: 8,
            borderRadius: 8,
            marginBottom: 6,
            flexDirection: 'row-reverse',
            alignItems: 'flex-start',
            borderRightWidth: 3,
            borderRightColor: '#3B82F6',
            borderLeftWidth: 0,
            borderWidth: 1,
            borderColor: 'rgba(83, 83, 83, 0.1)',
            flexShrink: 1,
            maxWidth: maxBubbleWidth - 20,
            minWidth: 230
          }}
          >
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: isMe ? '#000000' : '#FFFFFF',
              fontSize: 11,
              fontWeight: 'bold',
              textAlign: 'right',
              writingDirection: 'rtl',
              marginBottom: 1,
              width: '100%'
            }}>
              תשובה להודעה
            </Text>
            <Text style={{ 
              color: isMe ? '#000000' : '#FFFFFF',
              fontSize: 10,
              textAlign: 'right',
              writingDirection: 'rtl'
            }}>
              {replyId?.slice(0, 8)}...
            </Text>
          </View>
        </View>
      );
    }
    
    let icon = '';
    let previewText = '';
    const rawContent = (replyMsg.content && replyMsg.content.trim().length > 0)
      ? replyMsg.content
      : (
          (replyMsg as any)?.caption ||
          (replyMsg as any)?.text ||
          (replyMsg as any)?.message ||
          (replyMsg as any)?.metadata?.caption ||
          (replyMsg as any)?.meta?.caption ||
          (replyMsg as any)?.file_caption ||
          (replyMsg as any)?.extra?.text ||
          ''
        );
    const contentText = typeof rawContent === 'string' ? rawContent : '';
    switch (replyMsg.type) {
      case 'image':
        icon = '🖼️'; previewText = contentText || 'תמונה'; break;
      case 'video':
        icon = '🎥'; previewText = contentText || 'וידאו'; break;
      case 'audio':
        icon = '🎵'; previewText = contentText || 'הקלטת קול'; break;
      case 'document':
      case 'file':
        icon = '📄'; previewText = contentText || 'מסמך'; break;
      case 'voice':
        icon = '🎤'; previewText = contentText || 'הודעת קול'; break;
      default:
        previewText = contentText || 'הודעה';
    }
    if (!previewText || previewText.trim().length === 0) {
      previewText = 'הודעה';
    }
    
    const senderName =
      (replyMsg as any)?.sender?.full_name ||
      (replyMsg as any)?.user?.full_name ||
      (replyMsg as any)?.user_data?.full_name ||
      (replyMsg as any)?.author?.full_name ||
      (replyMsg as any)?.sender_name ||
      (replyMsg as any)?.sender_full_name ||
      (replyMsg as any)?.user_full_name ||
      (replyMsg as any)?.display_name ||
      (replyMsg.sender_id ? `משתמש ${replyMsg.sender_id.slice(0, 4)}` : 'משתמש');
    
    return (
        <Pressable 
        onPress={() => onJumpToMessage && replyId && onJumpToMessage(replyId)} 
        style={{ 
          backgroundColor: isMe ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 8,
          marginBottom: 6,
          flexDirection: 'row-reverse',
          alignItems: 'flex-start',
          borderRightWidth: 3,
          borderRightColor: '#3B82F6',
          borderLeftWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          flexShrink: 1,
          maxWidth: maxBubbleWidth - 12,
          minWidth: Math.max(230, Math.min(replyPreviewWidth + 24, maxBubbleWidth - 12))
        }}
      >
        {/* תוכן התשובה */}
        <View style={{ flex: 1 }}>
          <Text 
            style={{ 
              color: isMe ? '#000000' : '#FFFFFF',
              fontSize: 11,
              fontWeight: 'bold',
              textAlign: 'right',
              writingDirection: 'rtl',
              marginBottom: 1,
              width: '100%'
            }}
          >
            {senderName}
          </Text>
          <Text 
            style={{ 
              color: isMe ? '#000000' : '#FFFFFF',
              fontSize: 10,
              textAlign: 'right',
              writingDirection: 'rtl'
            }}
            numberOfLines={2}
          >
            {previewText}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderContent = () => {
    // בדיקה אם זו הודעת חדשות
    if (message.type === 'news') {
      // נסה לקבל את הנתונים מ-news_data או מ-content (fallback)
      let newsData = (message as any).news_data;
      
      // אם אין news_data, נסה לחלץ מה-content
      if (!newsData && message.content.startsWith('📰NEWS_DATA:')) {
        try {
          const jsonStr = message.content.replace('📰NEWS_DATA:', '');
          newsData = JSON.parse(jsonStr);
        } catch (e) {
          console.error('Error parsing news data from content:', e);
          return null;
        }
      }
      
      if (!newsData) return null;
      return (
        <View 
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            borderWidth: 1,
            borderColor: 'rgba(0, 216, 74, 0.2)',
            maxWidth: 280
          }}
        >
          {/* תמונה אם קיימת */}
          {newsData.image_url && (
            <View className="relative h-32">
              <Image
                source={{ uri: newsData.image_url }}
                className="w-full h-full"
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
                locations={[0, 0.6, 1]}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0
                }}
              />
              <View className="absolute bottom-2 right-3 left-3">
                <View className="flex-row items-center justify-between">
                  <View 
                    className="px-2 py-1 rounded-full"
                    style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                  >
                    <Text 
                      className="text-xs font-medium"
                      style={{ color: '#FFFFFF' }}
                    >
                      {newsData.source}
                    </Text>
                  </View>
                  <View 
                    className="px-2 py-1 rounded-full"
                    style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                  >
                    <Text 
                      className="text-xs font-medium"
                      style={{ color: '#FFFFFF' }}
                    >
                      חדשות
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          
          {/* תוכן החדשה */}
          <View className="p-4">
            <Text 
              className="text-base font-bold mb-2 leading-6"
              style={{ 
                color: DesignTokens.colors.text.primary,
                textAlign: 'right'
              }}
              numberOfLines={3}
            >
              {newsData.title}
            </Text>
            
            {newsData.summary && (
              <Text 
                className="text-sm leading-5"
                style={{ 
                  color: DesignTokens.colors.text.secondary,
                  textAlign: 'right'
                }}
                numberOfLines={3}
              >
                {newsData.summary}
              </Text>
            )}
            
            {/* מידע תחתון */}
            <View className="flex-row items-center justify-between mt-3 pt-3 border-t-2" style={{ borderTopColor: 'rgba(255, 255, 255, 0.05)' }}>
              <Text 
                className="text-xs font-medium"
                style={{ color: DesignTokens.colors.text.tertiary }}
              >
                {new Date(newsData.published_at).toLocaleDateString('he-IL')}
              </Text>
              <View 
                className="px-2 py-1 rounded-full"
                style={{ backgroundColor: '#00D84A20' }}
              >
                <Text 
                  className="text-xs font-bold"
                  style={{ color: '#00D84A' }}
                >
                  📰 חדשות
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    // בדיקה אם זו הודעת סקר
    if (message.type === 'poll' && pollData) {
      return (
        <PollMessage
          poll={pollData}
          chatId={message.channel_id || message.chat_id || ''}
          onPollUpdated={(updatedPoll) => {
            setPollData(updatedPoll);
          }}
          isAdmin={pollData.creator_id === user?.id}
          isMe={isMe}
        />
      );
    }

    // בדיקה אם זו הודעת מדיה לפי type ו-file_url
    if (message.type === 'image' && message.file_url) {
      return (
        <MediaMessageRenderer
          message={message}
          isMe={isMe}
          onMediaPress={handleMediaPress}
          textDirection={textDirection}
        />
      );
    }
    
    if (message.type === 'video' && message.file_url) {
      return (
        <MediaMessageRenderer
          message={message}
          isMe={isMe}
          onMediaPress={handleMediaPress}
          textDirection={textDirection}
        />
      );
    }
    
    if (message.type === 'audio' && message.file_url) {
      return (
        <MediaMessageRenderer
          message={message}
          isMe={isMe}
          onMediaPress={handleMediaPress}
          textDirection={textDirection}
        />
      );
    }
    
    if (message.type === 'document' && message.file_url) {
      return (
        <MediaMessageRenderer
          message={message}
          isMe={isMe}
          onMediaPress={handleMediaPress}
          textDirection={textDirection}
        />
      );
    }
    
    // בדיקה אם ההודעה מכילה URL של תמונה (פורמט ישן)
    if (message.content && message.content.includes('http') && (message.content.includes('.jpg') || message.content.includes('.png') || message.content.includes('.jpeg'))) {
      const lines = message.content.split('\n');
      const imageUrl = lines.find(line => line.includes('http') && (line.includes('.jpg') || line.includes('.png') || line.includes('.jpeg')));
      const caption = lines.filter(line => !line.includes('http')).join('\n').trim();
      
      // בדיקה מחמירה יותר של URL
      if (imageUrl && imageUrl.trim() !== '' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        return (
          <View>
            <Image 
              source={{ uri: imageUrl.trim() }} 
              style={{ width: 180, height: 180, borderRadius: 12, marginBottom: 8 }} 
              onError={(error) => {
                console.error('Image load error in ChatBubble (legacy format):', error);
              }}
            />
            {caption ? (
              <Text style={{ 
                color: isMe ? '#000' : '#fff', 
                textAlign: textDirection === 'rtl' ? 'right' : 'left',
                writingDirection: textDirection
              }}>
                {caption}
              </Text>
            ) : null}
          </View>
        );
      }
    }
    
    // תמיכה בפורמט הישן (לאחור)
    if (message.content && message.content.startsWith('[תמונה]')) {
      const url = message.content.split('\n')[1];
      const extra = message.content.split('\n').slice(2).join('\n');
      
      // בדיקה מחמירה יותר של URL
      if (url && url.trim() !== '' && (url.startsWith('http://') || url.startsWith('https://'))) {
        return (
          <View>
            <Image 
              source={{ uri: url.trim() }} 
              style={{ width: 180, height: 180, borderRadius: 12, marginBottom: 8 }} 
              onError={(error) => {
                console.error('Image load error in ChatBubble (old format):', error);
              }}
            />
            {extra ? (
              <Text style={{ 
                color: isMe ? '#000' : '#fff', 
                textAlign: textDirection === 'rtl' ? 'right' : 'left',
                writingDirection: textDirection
              }}>
                {extra}
              </Text>
            ) : null}
          </View>
        );
      }
    }
    
    if (message.content.startsWith('[קובץ]')) {
      const lines = message.content.split('\n');
      const name = lines[0].replace('[קובץ]', '').trim();
      const url = lines[1];
      const extra = lines.slice(2).join('\n');
      return (
        <View>
          <Pressable onPress={() => Linking.openURL(url)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <FileText size={24} color={isMe ? "#000" : "#fff"} strokeWidth={2} />
            <Text style={{ color: isMe ? '#000' : '#fff', marginLeft: 8 }}>{name || 'קובץ'}</Text>
          </Pressable>
          {extra ? (
            <Text style={{ 
              color: isMe ? '#000' : '#fff', 
              textAlign: textDirection === 'rtl' ? 'right' : 'left',
              writingDirection: textDirection
            }}>
              {extra}
            </Text>
          ) : null}
        </View>
      );
    }
    
    if (message.content.startsWith('[הקלטה]')) {
      const url = message.content.split('\n')[1];
      return (
        <Pressable onPress={() => Linking.openURL(url)} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Play size={24} color={isMe ? "#000" : "#fff"} strokeWidth={2} />
          <Text style={{ color: isMe ? '#000' : '#fff', marginLeft: 8 }}>האזן להקלטה</Text>
        </Pressable>
      );
    }
    
    // ברירת מחדל: טקסט רגיל
    return renderTextWithMentions(message.content, message.mentions);
  };

  // זמן
  const formattedTime = new Date(message.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <Animated.View 
        className={`w-full mb-3 flex-row${isMe ? '-reverse' : ''}`}
        style={{ 
          transform: [{ scale: bubbleScale }],
          opacity: bubbleOpacity,
        }}
      >
        {/* תמונת משתמש - רק עבור אחרים */}
         {!isMe && (
           <View style={{ 
             flexDirection: 'column', 
             alignItems: 'center', 
             justifyContent: 'flex-end', 
             marginRight: 4,
             marginBottom: 2
           }}>
             {(message.sender && typeof (message.sender as any).profile_picture === 'string' && (message.sender as any).profile_picture) ? (
               <Image 
                 source={{ uri: (message.sender as any).profile_picture }} 
                 style={{ 
                   width: 28, 
                   height: 28, 
                   borderRadius: 14,
                   borderWidth: 1,
                   borderColor: '#00E654'
                 }} 
               />
             ) : (
               <View 
                 style={{ 
                   width: 28, 
                   height: 28, 
                   borderRadius: 14, 
                   alignItems: 'center', 
                   justifyContent: 'center',
                   backgroundColor: '#00E654',
                   borderWidth: 1,
                   borderColor: '#00E654'
                 }}
               >
                 <Text 
                   style={{ 
                     color: '#FFFFFF',
                     fontSize: 12,
                     fontWeight: 'bold'
                   }}
                 >
                   {message.sender?.full_name ? message.sender.full_name[0] : 'מ'}
                 </Text>
               </View>
             )}
           </View>
         )}
        <Animated.View
          style={{
            backgroundColor: highlightAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: ['transparent', 'rgba(0, 230, 84, 0.1)'],
            }),
            borderRadius: 12,
            margin: highlightAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 4],
            }),
            flexShrink: 1,
            alignSelf: isMe ? 'flex-end' : 'flex-start'
          }}
        >
        <Swipeable
          ref={swipeableRef}
          enabled={swipeEnabled}
          renderLeftActions={renderLeftActions}
          renderRightActions={renderRightActions}
          leftThreshold={40}
          rightThreshold={40}
          friction={2}
          overshootLeft={false}
          overshootRight={false}
        >
          <Animated.View
            style={{
              transform: [{ scale: bubbleScale }],
              opacity: bubbleOpacity,
               alignSelf: isMe ? 'flex-end' : 'flex-start',
               marginLeft: isMe ? 0 : 12,
               marginRight: isMe ? 12 : 0,
               marginVertical: 2,
               flexDirection: 'row',
               alignItems: 'flex-end',
            }}
          >
             <View style={{ position: 'relative' }}>
              {/* עיטוף ניטרלי בלבד */}
              <HoldItem>
              <Pressable
                onPress={() => {
                  console.log('🎯 ChatBubble onPress (short press) - swipeEnabled:', swipeEnabled, 'selectedMessage:', !!selectedMessage);
                  // לחיצה קצרה לא עושה כלום - רק MediaViewer או LongPress
                }}
                onLongPress={onLongPress}
                delayLongPress={180}
                hitSlop={14}
                pressRetentionOffset={{ top: 18, left: 18, right: 18, bottom: 18 }}
                disabled={false}
              >
              <Animated.View
                style={{ 
                  transform: [{ scale: pressScale }],
                  alignItems: 'flex-end', 
                   backgroundColor: isMe ? '#00E654' : '#181818',
                  borderRadius: 18,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: isMe ? '#00E654' : 'rgba(255,255,255,0.2)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                  minWidth: 60,
                  maxWidth: maxBubbleWidth,
                }}
              >
                 {/* תוכן ההודעה */}
                 <View style={{ maxWidth: maxBubbleWidth - 8 }}>
                   {/* שם השולח בראש הבועה (רק אצל אחרים) - רק אם זה לא הודעת מדיה */}
                   {!isMe && message.type === 'text' && (
                     <Text 
                       style={{ 
                         textAlign: 'right',
                         writingDirection: 'rtl',
                         color: '#00E654',
                         fontSize: 13,
                         fontWeight: 'bold',
                         marginBottom: 4
                       }}
                     >
                       {message.sender?.full_name || 'משתמש'}
                     </Text>
                   )}
                   {renderReplyPreview()}
                   {renderContent()}
                </View>
                
                {/* Star indicator */}
                {isMessageStarred && (
                  <View className="absolute top-2 left-2 bg-yellow-500 rounded-full p-1">
                    <Star size={12} color="#000" strokeWidth={2} />
                  </View>
                )}
                {/* Footer - סטטוס ושעה - תמיד בצד ימין */}
                <View className="flex-row items-center justify-end mt-1">
                  {/* צד ימין - סטטוס ושעה תמיד */}
                  <View className="flex-row items-center">
                    {/* בוטל אינדיקטור 'שולח...' כדי למנוע הבהוב */}
                    
                  {/* פוטר: שעה תמיד בצד ימין; ללא וי/סטטוס */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text 
                      style={{ 
                        color: isMe ? '#000000' : '#FFFFFF',
                        textAlign: 'right',
                        writingDirection: 'ltr',
                        fontSize: 10,
                      }}
                    >
                      {formattedTime}
                    </Text>
                  </View>
                  </View>
                </View>
              </Animated.View>
              </Pressable>
              </HoldItem>
              
              {/* ריאקציות - מוצגות בפינה התחתונה-שמאלית של הבועה */}
              <MessageReactions
                reactions={reactions}
                onReactionDetails={handleReactionDetails}
              />
            </View>
          </Animated.View>
        </Swipeable>
        </Animated.View>
      </Animated.View>

      <ActionMenu
        visible={actionMenuVisible}
        onClose={() => { setActionMenuVisible(false); setSwipeEnabled(true); }}
        isMe={isMe}
        messageId={message.id}
        currentReactions={message.reactions || {}}
        onReact={(emoji) => {
          // הוספת ריאקציה בפועל
          handleReaction(emoji);
          setActionMenuVisible(false);
          setSwipeEnabled(true);
        }}
        onOpenPicker={() => {
          setActionMenuVisible(false);
          setSwipeEnabled(true);
          setShowReactionPicker(true);
        }}
        preview={
          <View style={{
            backgroundColor: isMe ? '#00E654' : '#181818',
            borderRadius: 18,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: isMe ? '#00E654' : 'rgba(0,230,84,0.3)',
            maxWidth: 280,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}>
            {renderContent()}
          </View>
        }
        items={[
          { key: 'reply', label: 'השב', icon: 'reply', onPress: handleReply },
          { key: 'forward', label: 'העבר', icon: 'forward', onPress: handleForward },
          { key: 'copy', label: 'העתק', icon: 'copy', onPress: onCopy },
          { key: 'info', label: 'פרטים', icon: 'info', onPress: () => setShowSeenBySheet(true) },
          { key: 'star', label: isMessageStarred ? 'הסר כוכב' : 'סמן בכוכב', icon: 'star', onPress: () => (isMessageStarred ? handleUnstarMessage() : handleStarMessage()) },
          { key: 'pin', label: 'הצמד', icon: 'pin', onPress: () => {} },
          { key: 'delete', label: 'מחק', icon: 'trash', destructive: true, onPress: () => onDeleteMessage?.(message.id) },
        ]}
      />

      {/* Media Viewer Modal */}
       <MediaViewer
         visible={showMediaViewer}
         onClose={() => {
           console.log('🎯 MediaViewer onClose called');
           resetAllStatesIncludingMedia();
         }}
         mediaUrl={selectedMedia?.uri || message.file_url || ''}
         mediaType={selectedMedia?.type || message.type || 'image'}
         caption={selectedMedia?.name || message.content}
         message={message}
         onReply={() => {
           setShowMediaViewer(false);
           setIsReplying(true);
           onReply && onReply(message);
         }}
         onForward={() => {
           console.log('📤 MediaViewer onForward called - opening ForwardModal');
           console.log('📤 Current showForwardModal state:', showForwardModal);
           setShowForwardModal(true);
           console.log('📤 setShowForwardModal(true) called');
         }}
       />

       {/* Forward Modal for text messages */}
       <ForwardModal
         visible={showForwardModal}
         onClose={() => {
           console.log('📤 ForwardModal onClose called');
           setShowForwardModal(false);
         }}
         messageId={message.id}
                 onForward={async (channelId, channelName) => {
          console.log('🚀 onForward called:', { channelId, channelName, userId: user?.id });
          try {
            if (!user?.id) {
              Alert.alert('שגיאה', 'משתמש לא מחובר');
              return;
            }

            console.log('📤 Sending message to channel:', channelId);
            // העברת ההודעה
            const ChatService = await import('../../services/chatService');
            const result = await ChatService.ChatService.sendMessage({
              channelId: channelId,
              content: message.content || 'הודעה מועברת',
              senderId: user.id,
              type: 'channel'
            });

            console.log('✅ Message forwarded successfully:', { channelName, result });
          } catch (error) {
            console.error('❌ Error forwarding message:', error);
            Alert.alert('שגיאה', 'לא ניתן להעביר את ההודעה: ' + (error instanceof Error ? error.message : String(error)));
          }
        }}
       />

       {/* Reaction Picker */}
       <ReactionPicker
         visible={showReactionPicker}
         onClose={() => setShowReactionPicker(false)}
         onReaction={handleReaction}
       />

       {/* Reaction Details Modal */}
       <ReactionDetailsModal
         visible={showReactionDetailsModal}
         onClose={() => setShowReactionDetailsModal(false)}
         messageId={message.id}
       />

      {/* Seen By Sheet */}
             <SeenBySheet
        visible={showSeenBySheet}
        onClose={() => setShowSeenBySheet(false)}
        messageId={message.id}
        messageTimestamp={message.created_at}
      />

      {/* Long Press Overlay */}
      <LongPressOverlay
        visible={!!selectedMessage}
        message={selectedMessage}
        onClose={() => {
          console.log('🎯 LongPressOverlay onClose called');
          resetAllStates();
        }}
        onAction={(actionName, payload) => {
          console.log('🎯 LongPressOverlay action:', actionName, payload);
          
          // אפס states לפני הפעולה כדי לסגור את ה-overlay
          resetAllStates();
          
          // אז בצע את הפעולה
          switch (actionName) {
            case 'react':
              if (payload?.emoji) {
                console.log('🎯 Adding reaction:', payload.emoji);
                handleReaction(payload.emoji);
              }
              break;
            case 'reply':
              console.log('🎯 Reply action');
              handleReply();
              break;
            case 'forward':
              console.log('🎯 Forward action');
              handleForward();
              break;
            case 'copy':
              console.log('🎯 Copy action');
              onCopy();
              break;
            case 'info':
              console.log('🎯 Info action');
              setShowSeenBySheet(true);
              break;
            case 'star':
              console.log('🎯 Star action');
              handleStarMessage();
              break;
            case 'pin':
              console.log('🎯 Pin action');
              // TODO: Implement pin
              break;
            case 'delete':
              console.log('🎯 Delete action');
              onDeleteMessage?.(message.id);
              break;
          }
        }}
      />
     </>
   );
 }