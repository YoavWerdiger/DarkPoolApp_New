import React from 'react';
import { View, Text, Pressable, StyleSheet, Image, Dimensions, Animated, Easing, Alert, TouchableOpacity, Linking, Clipboard, I18nManager } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle, Forward, FileText, Play, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
// חזרה זמנית למצב יציב ללא HoldMenu
const HoldItem: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
import { Message, ReactionSummary } from '../../services/supabase';
// import { RectButton, Swipeable } from 'react-native-gesture-handler'; // Removed - not compatible with New Architecture
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
import TradeMessage from './TradeMessage';
// import { MediaFile } from '../../services/mediaService';
import { PollService, PollWithVotes } from '../../services/pollService';
import { useAuth } from '../../context/AuthContext';
import { extractTextSegments } from '../../utils/textRanges';
import { Audio } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
// רטט נשאר פעיל - אם יש התקנה
let Haptics: any = { impactAsync: async () => { }, ImpactFeedbackStyle: { Light: 'Light' } };
try { Haptics = require('expo-haptics'); } catch { }
import { supabase } from '../../lib/supabase';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatService } from '../../services/chatService';

// פונקציה לזיהוי שפה - משופרת עם ספירת תווים
const detectLanguage = (text: string): 'rtl' | 'ltr' => {
  if (!text || text.trim().length === 0) {
    return 'rtl'; // ברירת מחדל - עברית
  }

  // בדיקה אם הטקסט מכיל תווים עבריים
  const hebrewRegex = /[\u0590-\u05FF]/g;
  const arabicRegex = /[\u0600-\u06FF]/g;

  // בדיקה אם הטקסט מכיל תווים לטיניים (אנגלית)
  const latinRegex = /[a-zA-Z]/g;

  // ספירת תווים מכל שפה
  const hebrewMatches = text.match(hebrewRegex);
  const arabicMatches = text.match(arabicRegex);
  const latinMatches = text.match(latinRegex);

  const hebrewCount = hebrewMatches ? hebrewMatches.length : 0;
  const arabicCount = arabicMatches ? arabicMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;

  const rtlCount = hebrewCount + arabicCount;

  // אם יש עברית או ערבית - RTL (גם אם יש גם לטינית, העברית/ערבית דומיננטית)
  if (rtlCount > 0) {
    return 'rtl';
  }

  // אם יש רק לטינית - LTR
  if (latinCount > 0 && rtlCount === 0) {
    return 'ltr';
  }

  // ברירת מחדל - עברית (RTL)
  return 'rtl';
};

interface ChatBubbleProps {
  message: Message;
  isMe: boolean;
  onReply?: (msg: Message) => void;
  onEditMessage?: (msg: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onRetryMessage?: (message: Message) => void; // Retry failed message
  allMessages?: Message[];
  onJumpToMessage?: (id: string) => void;
  channelMembers?: string[]; // Array of user IDs in the channel
  currentUserId?: string; // Current user ID for mention highlighting
  shouldHighlight?: boolean; // Whether this message should be highlighted
  isGrouped?: boolean; // Whether this message is grouped with the previous one
  isGroupStart?: boolean; // Whether this is the first message in a group
  isGroupEnd?: boolean; // Whether this is the last message in a group
  hasPrevFromSameSender?: boolean; // Whether there's a previous message from same sender in same minute
  isNewMessage?: boolean; // Whether this is a new message that just arrived
}

export default function ChatBubble({ message, isMe, onReply, onEditMessage, onDeleteMessage, onRetryMessage, allMessages, onJumpToMessage, channelMembers, currentUserId, shouldHighlight, isGrouped, isGroupStart, isGroupEnd, hasPrevFromSameSender, isNewMessage }: ChatBubbleProps) {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
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
  // const [swipeEnabled, setSwipeEnabled] = useState(true); // Removed - Swipeable not compatible with New Architecture
  // const swipeableRef = useRef<Swipeable>(null); // Removed - Swipeable not compatible with New Architecture
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const hasAnimatedRef = useRef(false);

  // פונקציה לאיפוס כל ה-states (למעט MediaViewer)
  const resetAllStates = () => {
    // console.log('🔄 resetAllStates called');

    // Swipeable removed - not compatible with New Architecture

    setSelectedMessage(null);
    setShowMessageContextMenu(false);
    setActionMenuVisible(false);
    // console.log('🔄 resetAllStates completed');
  };

  // פונקציה לאיפוס מלא כולל MediaViewer
  const resetAllStatesIncludingMedia = () => {
    // console.log('🔄 resetAllStatesIncludingMedia called');

    // Swipeable removed - not compatible with New Architecture

    setSelectedMessage(null);
    setShowMessageContextMenu(false);
    setActionMenuVisible(false);
    setShowMediaViewer(false);
    setSelectedMedia(null);
    // console.log('🔄 resetAllStatesIncludingMedia completed');
  };
  const [pollData, setPollData] = useState<PollWithVotes | null>(null);
  const [isMessageStarred, setIsMessageStarred] = useState(false);
  const [replyPreviewWidth, setReplyPreviewWidth] = useState(0);

  // בדיקה אם זו הודעה זמנית
  const isTemporary = message.id.startsWith('temp_');
  const isSending = isTemporary; // הודעה זמנית נחשבת כנשלחת

  // Debug: עקוב אחרי שינויים ב-showSeenBySheet
  useEffect(() => {
    // Debug logs removed for production
  }, [showSeenBySheet, message.read_by, message.created_at]);

  // Debug: עקוב אחרי שינויים ב-showMediaViewer
  useEffect(() => {
    // console.log('🎯 ChatBubble: showMediaViewer changed to:', showMediaViewer);
  }, [showMediaViewer]);

  // Debug: עקוב אחרי שינויים ב-selectedMessage
  useEffect(() => {
    // console.log('🎯 ChatBubble: selectedMessage changed to:', selectedMessage?.id);
  }, [selectedMessage]);

  // swipeEnabled removed - Swipeable not compatible with New Architecture

  // State לניהול הקלטה
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // בוטל זום – נשתמש רק בפייד דרך fadeAnim
  const pressScale = useRef(new Animated.Value(1)).current;
  const screenWidth = Dimensions.get('window').width;
  const maxBubbleWidth = Math.floor(screenWidth * 0.70);

  // לוג לבדיקת פרטי השולח
  useEffect(() => {
    // Debug log removed for production
  }, [message]);

  // Check if message is starred by current user
  useEffect(() => {
    const checkStarStatus = async () => {
      if (!user?.id) return;

      try {
        // console.log('⭐ ChatBubble: Checking star status for message:', message.id);

        const ChatService = await import('../../services/chatService');
        const isStarred = await ChatService.ChatService.isMessageStarred(
          message.id,
          user.id
        );

        // console.log('⭐ ChatBubble: Star status result:', { isStarred });

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
    // בלי template string כדי למנוע באג בפרסר: MM:SS
    return (
      String(minutes) +
      ':' +
      seconds.toString().padStart(2, '0')
    );
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
    // console.log('🌐 Language detection:', { content: message.content, language });
    return language;
  };

  const textDirection = getTextDirection();

  // אנימציה כניסה לבועה
  // בוטלו האנימציות הישנות (זום + אופסיטי). נשאר רק fadeAnim
  useEffect(() => {
    return undefined;
  }, []);

  // ביטול אנימציית 'שולח...' כדי למנוע הבהובים
  useEffect(() => {
    return undefined;
  }, []);

  // אנימציית פייד ו-scale להוספת הודעה - עבור הודעות זמניות וחדשות
  useEffect(() => {
    // אם כבר עשינו אנימציה להודעה הזו, אל תעשה שוב
    if (hasAnimatedRef.current) {
      return;
    }
    
    // הפעל אנימציה עבור:
    // 1. הודעות זמניות (שנשלחו על ידי המשתמש)
    // 2. הודעות חדשות שמגיעות מהשרת (isNewMessage = true)
    const shouldAnimate = message.id.startsWith('temp_') || isNewMessage === true;
    
    if (shouldAnimate) {
      fadeAnim.setValue(0.3); // התחל מ-30% (לא 0 כדי לא להיראות כמו טעינה)
      scaleAnim.setValue(0.98); // התחל מ-98% (שינוי קטן יותר)
      
      // אנימציה משולבת - fade + scale (מהירה וחלקה, לא נראית כמו טעינה)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 150,
          friction: 10,
          useNativeDriver: true,
        })
      ]).start(() => {
        hasAnimatedRef.current = true; // סמן שכבר עשינו אנימציה
      });
    } else {
      // הודעות ישנות - אין אנימציה (מוצגות מיד)
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
      hasAnimatedRef.current = true;
    }
  }, [message.id, isNewMessage]);

  // טעינת ריאקציות
  useEffect(() => {
    loadReactions();

    // Real-time subscription לריאקשנים
    const reactionSubscription = supabase
      .channel(`message_reactions:${message.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${message.id}`
        },
        (payload) => {
          // console.log('🔄 Reaction update received:', payload);
          // רענן את הריאקשנים
          loadReactions();
        }
      )
      .subscribe();

    return () => {
      reactionSubscription.unsubscribe();
    };
  }, [message.id]);

  // טען נתוני סקר אם ההודעה היא מסוג poll
  useEffect(() => {
    if (message.type === 'poll' && message.poll_id) {
      loadPollData();
    }
  }, [message.poll_id]);

  // אנימציית הדגשה להודעה עם mention
  useEffect(() => {
    // console.log('🎯 ChatBubble: useEffect shouldHighlight triggered:', { shouldHighlight, messageId: message.id });
    if (shouldHighlight) {
      // console.log('🎯 ChatBubble: Starting highlight animation for message:', message.id);

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
        textDirection={textDirection}
      />
    );
  };

  // Get read receipt status - תיקון להצגה נכונה של סימני קריאה
  const getReadReceiptStatus = () => {
    if (!isMe || !channelMembers) return null;

    const readByCount = message.read_by ? message.read_by.length : 0;
    const totalRecipients = channelMembers.length - 1; // Exclude sender

    // Debug log removed for production

    // בדיקה לפי status ו-read_by
    if (message.status === 'sent' && readByCount === 0) {
      return { icon: '✓', color: DesignTokens.colors.text.tertiary }; // נשלח אבל לא נקרא על ידי אף אחד
    } else if (readByCount > 0 && readByCount >= totalRecipients) {
      return { icon: '✓✓', color: DesignTokens.colors.success.main }; // נקרא על ידי כולם - ירוק
    } else if (readByCount > 0 && readByCount < totalRecipients) {
      return { icon: '✓✓', color: DesignTokens.colors.text.tertiary }; // נקרא על ידי חלק - אפור
    } else {
      return { icon: '✓', color: DesignTokens.colors.text.tertiary }; // ברירת מחדל - נשלח
    }
  };

  const handleSeenByPress = async () => {
    // Debug log removed for production

    // Mark message as viewed by current user
    if (user?.id) {
      try {
        const ChatService = await import('../../services/chatService');
        await ChatService.ChatService.markMessageAsViewed(message.id, user.id);
        // console.log('✅ ChatBubble: Message marked as viewed by user');
      } catch (error) {
        console.error('❌ ChatBubble: Error marking message as viewed:', error);
      }
    }

    // פתח את הדיאלוג תמיד, גם אם אין משתמשים שראו
    // console.log('✅ ChatBubble: Opening SeenBySheet for message:', message.id);
    setShowSeenBySheet(true);
    // console.log('🎯 ChatBubble: showSeenBySheet set to true');
  };

  const onLongPress = async () => {
    // console.log('🎯 onLongPress called');

    // בדוק אם אנחנו כבר במצב של long press
    if (selectedMessage) {
      // console.log('🎯 Already in long press mode, ignoring');
      return;
    }

    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
    // אנימציית scale קצרה לבועה
    try {
      Animated.sequence([
        Animated.timing(pressScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
        Animated.spring(pressScale, { toValue: 1, useNativeDriver: true })
      ]).start();
    } catch { }

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
    // setSwipeEnabled(false); // Removed - Swipeable not compatible with New Architecture
    // לא נפתח ActionMenu ב-long press - רק LongPressOverlay
    // setActionMenuVisible(true);

    // console.log('🎯 selectedMessage set, LongPressOverlay should open now');
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

      // עדכן את הרשימה בכל מקרה
      await loadReactions();
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
    // console.log('🎯 ChatBubble: handleReactionDetails called, messageId:', message.id);
    // console.log('🎯 ChatBubble: Current showReactionDetailsModal state:', showReactionDetailsModal);
    // פתיחת מודל פירוט ריאקציות
    setShowReactionDetailsModal(true);
    // console.log('🎯 ChatBubble: showReactionDetailsModal set to true');
    // בדיקה שהסטייט השתנה
    setTimeout(() => {
      // console.log('🎯 ChatBubble: After 100ms, showReactionDetailsModal should be true');
    }, 100);
  };

  // Star/Unstar message functions
  const handleStarMessage = async () => {
    try {
      if (!user?.id) return;

      // Debug log removed for production

      const ChatService = await import('../../services/chatService');
      const success = await ChatService.ChatService.starMessage(
        message.id,
        user.id
      );

      // console.log('⭐ ChatBubble: Star message result:', success);

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

      // Debug log removed for production

      const ChatService = await import('../../services/chatService');
      const success = await ChatService.ChatService.unstarMessage(
        message.id,
        user.id
      );

      // console.log('⭐ ChatBubble: Unstar message result:', success);

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
                backgroundColor: DesignTokens.colors.background.secondary,
                borderColor: DesignTokens.colors.border.primary,
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
              backgroundColor: DesignTokens.colors.background.secondary,
              borderColor: DesignTokens.colors.border.primary,
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
    // console.log('🎯 handleMediaPress called with:', media);

    // אפס רק את ה-states הרלוונטיים, לא את showMediaViewer
    setSelectedMessage(null);
    setShowMessageContextMenu(false);
    setActionMenuVisible(false);
    // setSwipeEnabled removed - not compatible with New Architecture

    setSelectedMedia(media);
    setShowMediaViewer(true);

    // console.log('🎯 showMediaViewer set to true');
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
      case 'sending':
        icon = 'time-outline';
        color = DesignTokens.colors.text.tertiary;
        break;
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
        color = DesignTokens.colors.success.main;
        break;
      case 'failed':
        icon = 'alert-circle';
        color = DesignTokens.colors.danger.main;
        break;
    }

    return (
      <View className="flex-row items-center">
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
    );
  };

  // רנדור כפתור "נסה שוב" להודעות שנכשלו
  const renderRetryButton = () => {
    if (!isMe || message.status !== 'failed') return null;

    return (
      <Pressable
        onPress={() => onRetryMessage?.(message)}
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          backgroundColor: `${DesignTokens.colors.danger.main}20`,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 12,
          marginTop: 6,
          borderWidth: 1,
          borderColor: DesignTokens.colors.danger.main,
        }}
      >
        <Ionicons name="refresh" size={14} color={DesignTokens.colors.danger.main} />
        <Text style={{ 
          color: DesignTokens.colors.danger.main, 
          fontSize: 12, 
          fontWeight: '600',
          marginRight: 6 
        }}>
          נסה שוב
        </Text>
      </Pressable>
    );
  };

  // Swipe Actions
  const renderLeftActions = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 20 }}>
      {/* Reply Action - Circle */}
      <TouchableOpacity
        onPress={handleSwipeReply}
        style={{
          backgroundColor: DesignTokens.colors.accent.main,
          width: 40,
          height: 40,
          borderRadius: 20,
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
      </TouchableOpacity>
    </View>
  );

  const renderRightActions = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 20 }}>
      {/* Forward Action - Circle */}
      <TouchableOpacity
        onPress={handleSwipeForward}
        style={{
          backgroundColor: DesignTokens.colors.warning.main,
          width: 40,
          height: 40,
          borderRadius: 20,
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
      </TouchableOpacity>
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
            backgroundColor: isMe ? `${DesignTokens.colors.primary.dark}80` : DesignTokens.colors.background.secondary,
            paddingVertical: 6,
            paddingHorizontal: 8,
            borderRadius: 8,
            marginBottom: 6,
            flexDirection: 'row-reverse',
            alignItems: 'flex-start',
            borderRightWidth: 3,
            borderRightColor: DesignTokens.colors.accent.main,
            borderLeftWidth: 0,
            borderWidth: 1,
            borderColor: DesignTokens.colors.border.primary,
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
      (replyMsg.sender_id
        ? 'משתמש ' + String(replyMsg.sender_id).slice(0, 4)
        : 'משתמש');

    return (
      <Pressable
        onPress={() => {
          if (onJumpToMessage && replyId) {
            // console.log('🎯 Jumping to message:', replyId);
            onJumpToMessage(replyId);
          }
        }}
        style={{
          backgroundColor: isMe ? `${DesignTokens.colors.primary.dark}80` : DesignTokens.colors.background.secondary,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 8,
          marginBottom: 6,
          flexDirection: 'row-reverse',
          alignItems: 'flex-start',
          borderRightWidth: 3,
          borderRightColor: DesignTokens.colors.accent.main,
          borderLeftWidth: 0,
          borderWidth: 1,
          borderColor: DesignTokens.colors.border.primary,
          flexShrink: 1,
          maxWidth: maxBubbleWidth - 12,
          minWidth: Math.max(230, Math.min(replyPreviewWidth + 24, maxBubbleWidth - 12)),
          alignSelf: isMe ? 'flex-end' : 'flex-start'
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
              textAlign: detectLanguage(previewText) === 'rtl' ? 'right' : 'left',
              writingDirection: detectLanguage(previewText)
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
    // בדיקה אם זו הודעת טרייד
    if (message.type === 'trade') {
      console.log('📈 Trade message rendering:', {
        id: message.id,
        has_trade_data: !!(message as any).trade_data,
        content: message.content,
        tradeData: (message as any).trade_data
      });

      let tradeData = (message as any).trade_data;

      // אם אין trade_data, נסה לחלץ מה-content
      if (!tradeData && message.content && message.content.startsWith('📈TRADE_DATA:')) {
        try {
          const jsonStr = message.content.replace('📈TRADE_DATA:', '');
          tradeData = JSON.parse(jsonStr);
          console.log('📈 Parsed trade data from content:', tradeData);
        } catch (e) {
          console.error('❌ Error parsing trade data from content:', e);
          return null;
        }
      }

      if (!tradeData) {
        console.error('❌ No trade data found for message:', message.id, 'Full message:', message);
        // במקרה שאין trade_data, נציג הודעה פשוטה במקום להסתיר את ההודעה
        return (
          <View style={{
            padding: DesignTokens.spacing.md,
            backgroundColor: isMe ? `${DesignTokens.colors.primary.main}20` : `${DesignTokens.colors.background.tertiary}`,
            borderRadius: DesignTokens.borderRadius.md,
            alignItems: 'flex-end',
          }}>
            <Text style={{
              fontSize: DesignTokens.typography.fontSize.base,
              fontWeight: '700' as any,
              color: isMe ? DesignTokens.colors.text.primary : DesignTokens.colors.text.primary,
              textAlign: 'right',
              marginBottom: DesignTokens.spacing.xs,
            }}>
              {message.content || 'טרייד משותף'}
            </Text>
            <Text style={{
              fontSize: DesignTokens.typography.fontSize.sm,
              color: isMe ? DesignTokens.colors.text.secondary : DesignTokens.colors.text.secondary,
              textAlign: 'right',
            }}>
              נתוני הטרייד לא זמינים
            </Text>
          </View>
        );
      }

      // console.log('✅ Rendering trade with data:', tradeData);

      return (
        <TradeMessage
          trade={tradeData}
          isMe={isMe}
        />
      );
    }

    // בדיקה אם זו הודעת חדשות
    if (message.type === 'news') {
      // נסה לקבל את הנתונים מ-news_data או מ-content (fallback)
      let newsData = (message as any).news_data;

      console.log('📰 News message rendering:', {
        id: message.id,
        has_news_data: !!newsData,
        content: message.content,
        newsData
      });

      // אם אין news_data, נסה לחלץ מה-content
      if (!newsData && message.content && message.content.startsWith('📰NEWS_DATA:')) {
        try {
          const jsonStr = message.content.replace('📰NEWS_DATA:', '');
          newsData = JSON.parse(jsonStr);
          console.log('📰 Parsed news data from content:', newsData);
        } catch (e) {
          console.error('❌ Error parsing news data from content:', e);
          return null;
        }
      }

      if (!newsData) {
        console.error('❌ No news data found for message:', message.id);
        return null;
      }

      // console.log('✅ Rendering news with data:', newsData);

      // פונקציה לטיפול בלחיצה על החדשה
      const handleNewsPress = () => {
        Alert.alert(
          'מעבר לחדשות',
          'האם ברצונך לעבור לטאב החדשות ולראות את החדשה?',
          [
            {
              text: 'ביטול',
              style: 'cancel'
            },
            {
              text: 'עבור',
              onPress: () => {
                // מעבר לטאב החדשות דרך MainTabs
                try {
                  // נסה לנווט דרך המסך הראשי
                  const parent = navigation.getParent();
                  if (parent) {
                    parent.navigate('Main', { screen: 'News' });
                  } else {
                    // אם אין parent, נסה לנווט ישירות
                    navigation.navigate('Main', { screen: 'News' });
                  }
                } catch (error) {
                  console.error('❌ Error navigating to News:', error);
                  // נסה דרך אחרת
                  navigation.navigate('Main', { screen: 'News' });
                }
              }
            }
          ]
        );
      };

      return (
        <Pressable
          onPress={handleNewsPress}
          style={({ pressed }) => ({
            opacity: pressed ? 0.9 : 1,
            marginBottom: 4
          })}
        >
          <View
            style={{
              backgroundColor: DesignTokens.colors.background.secondary,
              borderRadius: 16,
              overflow: 'hidden',
              maxWidth: '85%',
              minWidth: 280,
              borderWidth: 1,
              borderColor: DesignTokens.colors.border.primary
            }}
          >
            {/* תמונה אם קיימת */}
            {newsData.image_url && (
              <View style={{ height: 180, width: '100%', position: 'relative' }}>
                <Image
                  source={{ uri: newsData.image_url }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.2)'
                  }}
                />
                <View style={{ position: 'absolute', bottom: 12, right: 12, left: 12 }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 12,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.2)'
                      }}
                    >
                      <Text
                        style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}
                      >
                        חדשות
                      </Text>
                    </View>
                    {newsData.source && (
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 12,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.2)'
                        }}
                      >
                        <Text
                          style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}
                        >
                          {newsData.source}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* תוכן החדשה */}
            <View style={{ padding: 14 }}>
              <Text
                style={{
                  color: DesignTokens.colors.text.primary,
                  fontSize: 15,
                  fontWeight: '700',
                  marginBottom: 8,
                  textAlign: 'right',
                  lineHeight: 22
                }}
                numberOfLines={3}
              >
                {newsData.title}
              </Text>

              {newsData.summary && (
                <Text
                  style={{
                    color: DesignTokens.colors.text.secondary,
                    fontSize: 13,
                    textAlign: 'right',
                    lineHeight: 20,
                    marginBottom: 12
                  }}
                  numberOfLines={3}
                >
                  {newsData.summary}
                </Text>
              )}

              {/* מידע תחתון */}
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: DesignTokens.colors.text.tertiary, fontSize: 11 }}>
                  {new Date(newsData.published_at || Date.now()).toLocaleDateString('he-IL')}
                </Text>
                {newsData.sentiment && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{
                      color: newsData.sentiment === 'Positive' ? DesignTokens.colors.success.main :
                        newsData.sentiment === 'Negative' ? DesignTokens.colors.danger.main :
                          DesignTokens.colors.text.tertiary,
                      fontSize: 11,
                      fontWeight: '600'
                    }}>
                      {newsData.sentiment === 'Positive' ? 'חיובי' :
                        newsData.sentiment === 'Negative' ? 'שלילי' : 'ניטרלי'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Pressable>
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
          isGrouped={isGrouped}
          isGroupStart={isGroupStart}
          isGroupEnd={isGroupEnd}
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
          isGrouped={isGrouped}
          isGroupStart={isGroupStart}
          isGroupEnd={isGroupEnd}
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
          isGrouped={isGrouped}
          isGroupStart={isGroupStart}
          isGroupEnd={isGroupEnd}
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
          isGrouped={isGrouped}
          isGroupStart={isGroupStart}
          isGroupEnd={isGroupEnd}
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
              // ב-RTL mode, 'right' ו-'left' מתהפכים אוטומטית
              textAlign: I18nManager.isRTL 
                ? (textDirection === 'rtl' ? 'left' : 'right')
                : (textDirection === 'rtl' ? 'right' : 'left'),
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

  // className לחישוב דינמי בלי template strings כדי לא לבלבל את הפרסר
  const rowClassName =
    'w-full flex-row ' +
    (hasPrevFromSameSender ? 'mb-0.5 ' : 'mb-2 ');

  return (
    <>
      <Animated.View
        className={rowClassName}
        style={{ 
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          flexDirection: 'row',
          width: '100%',
          justifyContent: isMe ? 'flex-start' : 'flex-end'
        }}
      >
        <Animated.View
          style={{
            backgroundColor: highlightAnimation.interpolate({
              inputRange: [0, 1],
              // צבע רקע מודגש ללא template string (RGBA במקום HEX+אלפא טקסטואלי)
              outputRange: ['transparent', DesignTokens.colors.success.main],
            }),
            borderRadius: 12,
            margin: highlightAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 4],
            }),
            flexShrink: 1,
            // isMe משמאל, אחרים מימין
            alignSelf: isMe ? 'flex-start' : 'flex-end'
          }}
        >
          {/* Swipeable removed - not compatible with New Architecture */}
          <Animated.View
            style={{
              alignSelf: isMe ? 'flex-start' : 'flex-end',
              marginLeft: isMe ? 0 : 8,
              marginRight: isMe ? 8 : 0,
              marginVertical: hasPrevFromSameSender ? 0.5 : 1,
              flexDirection: 'row',
              alignItems: 'flex-end',
            }}
          >
            <View
              style={{
                position: 'relative',
                // בהודעות שלי (שמאל) השעון/סטטוס יהיו מימין; בהודעות אחרים (ימין) – מימין
                flexDirection: isMe ? 'row-reverse' : 'row-reverse',
                marginBottom: reactions && reactions.length > 0 ? 8 : undefined, // מרווח תחתון רק כשיש ריאקשנים
              }}
            >
              {/* עיטוף ניטרלי בלבד */}
              <HoldItem>
                <Pressable
                  onPress={() => {
                    // console.log('🎯 ChatBubble onPress (short press) - selectedMessage:', !!selectedMessage);
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
                      alignItems: isMe ? 'flex-end' : 'flex-end',
                      backgroundColor: isMe ? DesignTokens.colors.bubbleMe : DesignTokens.colors.bubbleOther,
                      borderRadius: 16,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      paddingBottom: reactions && reactions.length > 0 ? 20 : undefined, // מרווח תחתון רק כשיש ריאקשנים
                      borderWidth: 0.5,
                      borderColor: DesignTokens.colors.border.primary,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 2,
                      elevation: 1,
                      minWidth: 50,
                      maxWidth: maxBubbleWidth,
                      width: 'auto',
                      flexShrink: 1,
                      position: 'relative', // כדי שהריאקשנים יהיו יחסית לבועה
                    }}
                  >
                    {/* תוכן ההודעה */}
                    <View style={{
                      maxWidth: maxBubbleWidth - 8,
                      width: '100%',
                      flexShrink: 1,
                      flexWrap: 'wrap',
                      alignItems: isMe ? 'flex-end' : 'flex-end'
                    }}>
                      {/* שם השולח בראש הבועה (רק אצל אחרים) - רק אם זה לא הודעת מדיה ורק אם זה תחילת קבוצה */}
                      {!isMe && message.type === 'text' && (!isGrouped || isGroupStart) && (
                        <Text
                          style={{
                            textAlign: 'right',
                            writingDirection: 'rtl',
                            color: DesignTokens.colors.success.main,
                            fontSize: 12,
                            fontWeight: '700' as any,
                            marginBottom: 3,
                            flexWrap: 'wrap',
                            alignSelf: 'flex-end'
                          }}
                        >
                          {message.sender?.full_name || 'משתמש'}
                        </Text>
                      )}
                      {renderReplyPreview()}
                      {renderContent()}
                      {/* כפתור "נסה שוב" להודעות שנכשלו */}
                      {renderRetryButton()}
                    </View>

                    {/* Footer - סטטוס ושעה */}
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: isMe ? 'space-between' : 'flex-end', marginTop: 2 }}>
                      {/* כוכב אם ההודעה מסומנת */}
                      {isMessageStarred && (
                        <Star
                          size={9}
                          color={isMe ? DesignTokens.colors.bubbleOther : DesignTokens.colors.success.main}
                          strokeWidth={2}
                          fill={isMe ? DesignTokens.colors.bubbleOther : DesignTokens.colors.success.main}
                        />
                      )}

                      {/* שעה */}
                      <Text
                        style={{
                          color: isMe ? '#000000' : '#FFFFFF',
                          textAlign: 'right',
                          writingDirection: 'ltr',
                          fontSize: 9,
                          marginRight: isMessageStarred ? 4 : 0,
                        }}
                      >
                        {formattedTime}
                      </Text>
                    </View>
                  </Animated.View>
                </Pressable>
              </HoldItem>

              {/* ריאקציות - מוצגות בפינה התחתונה של הבועה */}
              {reactions && reactions.length > 0 && (
                <MessageReactions
                  reactions={reactions}
                  onReactionDetails={handleReactionDetails}
                  isMe={isMe}
                />
              )}
            </View>
          </Animated.View>
          {/* Swipeable removed - not compatible with New Architecture */}
        </Animated.View>
      </Animated.View>

      <ActionMenu
        visible={actionMenuVisible}
        onClose={() => { setActionMenuVisible(false); }}
        isMe={isMe}
        messageId={message.id}
        currentReactions={message.reactions || {}}
        onReact={(emoji) => {
          // הוספת ריאקציה בפועל
          handleReaction(emoji);
          setActionMenuVisible(false);
        }}
        onOpenPicker={() => {
          setActionMenuVisible(false);
          setShowReactionPicker(true);
        }}
        preview={
          <View style={{
            backgroundColor: isMe ? DesignTokens.colors.bubbleMe : DesignTokens.colors.bubbleOther,
            borderRadius: 18,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: isMe ? DesignTokens.colors.bubbleMe : DesignTokens.colors.border.primary,
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
          { key: 'pin', label: 'הצמד', icon: 'pin', onPress: () => { } },
          { key: 'delete', label: 'מחק', icon: 'trash', destructive: true, onPress: () => onDeleteMessage?.(message.id) },
        ]}
      />

      {/* Media Viewer Modal */}
      <MediaViewer
        visible={showMediaViewer}
        onClose={() => {
          // console.log('🎯 MediaViewer onClose called');
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

            // console.log('✅ Message forwarded successfully:', { channelName, result });
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
        onClose={() => {
          // console.log('🎯 ChatBubble: ReactionDetailsModal onClose called');
          setShowReactionDetailsModal(false);
        }}
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
          // console.log('🎯 LongPressOverlay onClose called');
          resetAllStates();
        }}
        onAction={(actionName, payload) => {
          // console.log('🎯 LongPressOverlay action:', actionName, payload);

          // אפס states לפני הפעולה כדי לסגור את ה-overlay
          resetAllStates();

          // אז בצע את הפעולה
          switch (actionName) {
            case 'react':
              if (payload?.emoji) {
                // console.log('🎯 Adding reaction:', payload.emoji);
                handleReaction(payload.emoji);
              }
              break;
            case 'reply':
              // console.log('🎯 Reply action');
              handleReply();
              break;
            case 'forward':
              // console.log('🎯 Forward action');
              handleForward();
              break;
            case 'copy':
              // console.log('🎯 Copy action');
              onCopy();
              break;
            case 'info':
              // console.log('🎯 Info action');
              setShowSeenBySheet(true);
              break;
            case 'star':
              // console.log('🎯 Star action');
              handleStarMessage();
              break;
            case 'pin':
              // console.log('🎯 Pin action');
              // TODO: Implement pin
              break;
            case 'delete':
              // console.log('🎯 Delete action');
              onDeleteMessage?.(message.id);
              break;
          }
        }}
      />
    </>
  );
}