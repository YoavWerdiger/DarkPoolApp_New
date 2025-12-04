import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActionSheetIOS, Platform, Alert, KeyboardAvoidingView, Keyboard, Animated, Dimensions, I18nManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AntDesign from '@expo/vector-icons/AntDesign';
import Entypo from '@expo/vector-icons/Entypo';
import { Plus, Square } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MediaPicker from './MediaPicker';
import MediaPreviewModal from './MediaPreviewModal';
import PollCreationModal from './PollCreationModal';
import MentionPicker from './MentionPicker';
// import { MediaFile } from '../../services/mediaService';
import { Audio } from 'expo-av';
import { useMentions } from '../../hooks/useMentions';
import { useDesignTokens } from '../ui/DesignTokens';

// פונקציה לזיהוי שפה
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

interface MessageInputBarProps {
  onSend: (message: string, mentions?: any[]) => void;
  onSendMedia?: (mediaFiles: any[], captions: Record<string, string>) => void;
  onAttachmentPress?: () => void;
  onEditMessage?: (messageId: string, newContent: string, mentions?: any[]) => void;
  chatId: string;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  replyToMessage?: { id: string; content: string; userName?: string } | null;
  onCancelReply?: () => void;
  startTyping?: () => void;
  stopTyping?: () => void;
}

export default function MessageInputBar({
  onSend,
  onSendMedia,
  onAttachmentPress,
  onEditMessage,
  chatId,
  editingMessage,
  onCancelEdit,
  replyToMessage,
  onCancelReply,
  startTyping,
  stopTyping
}: MessageInputBarProps) {
  const DesignTokens = useDesignTokens();
  const screenWidth = Dimensions.get('window').width;
  const maxBubbleWidth = Math.floor(screenWidth * 0.70);
  const isMe = true; // הקלטה תמיד נחשבת כ-"me"
  const insets = useSafeAreaInsets();

  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  // isKeyboardVisible הוסר - גרם לריצוד מיותר
  const [textDirection, setTextDirection] = useState<'rtl' | 'ltr'>('rtl');
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef<number>(0);
  const [waveformData, setWaveformData] = useState<number[]>(Array(30).fill(0.1)); // 30 bars קבועים
  const waveformInterval = useRef<NodeJS.Timeout | null>(null);
  const waveformIndex = useRef<number>(0); // אינדקס נוכחי ב-circular buffer

  // Initialize text with editing message content
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content);
      textInputRef.current?.focus();
    } else {
      setText('');
    }
  }, [editingMessage]);

  // Update text direction when text changes
  useEffect(() => {
    const direction = detectLanguage(text);
    // console.log('🔤 Input text direction for:', text, 'is:', direction);
    setTextDirection(direction);
  }, [text]);

  // ניקוי הקלטה בעת unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        // console.log('🎤 Cleaning up recording on unmount...');
        try {
          recordingRef.current.stopAndUnloadAsync();
        } catch (error) {
          // console.log('🎤 Cleanup error on unmount:', error);
        }
        recordingRef.current = null;
      }
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      // נקה גם את typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        stopTyping?.();
      }
    };
  }, []);

  // Mentions hook
  const {
    mentionTokens,
    showMentionPicker,
    mentionSearchQuery,
    insertMention,
    handleInputChange,
    removeMention,
    getMentionRanges,
    closeMentionPicker,
    clearAllMentions,
  } = useMentions(text);

  const hasText = text.trim().length > 0;

  const handleSend = () => {
    if (hasText) {
      // Extract mentions if any
      const mentions = getMentionRanges(text);

      // הפסק להקליד כשמשלחים
      if (isTyping) {
        stopTyping?.();
      }

      if (editingMessage && onEditMessage) {
        // Editing existing message
        onEditMessage(editingMessage.id, text.trim(), mentions);
        onCancelEdit?.();
      } else {
        // Sending new message
        onSend(text, mentions);
      }

      setText('');
      setIsTyping(false);

      // Clear all mentions properly
      clearAllMentions();
    }
  };

  const handleTextChange = (newText: string) => {

    const wasTyping = isTyping;
    const nowTyping = newText.length > 0;

    setText(newText);
    setIsTyping(nowTyping);

    // Handle mentions in the hook (this will handle the mention picker logic)
    handleInputChange(newText);

    // Typing indicator עם throttling - שולח עדכון רק אחת ל-500ms
    if (nowTyping) {
      const now = Date.now();
      const timeSinceLastTyping = now - lastTypingTimeRef.current;

      // שלח typing indicator אם עברו לפחות 500ms מהעדכון האחרון
      if (timeSinceLastTyping > 500) {
        // console.log('✍️ MessageInputBar: User typing (throttled)');
        startTyping?.();
        lastTypingTimeRef.current = now;
      }

      // בטל timeout קודם
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // הגדר timeout חדש - אם לא מקלידים 2 שניות, נפסיק
      typingTimeoutRef.current = setTimeout(() => {
        // console.log('🛑 MessageInputBar: User stopped typing (timeout)');
        stopTyping?.();
      }, 2000);
    } else if (!nowTyping && wasTyping) {
      // הפסיק להקליד (מחק הכל)
      // console.log('🛑 MessageInputBar: User cleared text');
      stopTyping?.();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  // Render text with mentions for display
  const renderTextWithMentions = (text: string) => {
    if (!text) return null;

    // console.log('🎨 renderTextWithMentions called with:', text);

    // Split text by @ symbols to find mentions
    const parts = text.split(/(@[^\s]+)/);
    // console.log('🎨 Text parts:', parts);

    return (
      <Text
        className="text-base"
        style={{
          textAlign: textDirection === 'rtl' ? 'right' : 'left',
          writingDirection: textDirection
        }}
      >
        {parts.map((part, index) => {
          if (part.startsWith('@')) {
            // console.log('🎨 Rendering mention part:', part, 'in green bold');
            return (
              <Text key={index} style={{ fontWeight: 'bold', color: DesignTokens.colors.success.main, fontSize: 16 }}>
                {part}
              </Text>
            );
          }
          // console.log('🎨 Rendering regular text part:', part, 'in white normal');
          return (
            <Text key={index} style={{ color: '#fff', fontSize: 16 }}>
              {part}
            </Text>
          );
        })}
      </Text>
    );
  };



  const handleMentionSelect = (user: { id: string; display: string }) => {
    console.log('🎯 handleMentionSelect called with user:', user);

    // Insert mention using the hook
    const newText = insertMention(user);

    if (newText) {
      console.log('🎯 Setting new text:', newText);
      setText(newText);
      setIsTyping(newText.length > 0);

      // Focus back to input
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    }
  };

  const handleAttachmentPress = () => {
    // console.log('📎 Attachment button pressed, setting showMediaPicker to true');
    setShowMediaPicker(true);
    // console.log('📎 showMediaPicker state should be true now');
  };

  const handleMediaSelected = (mediaType: string, uri: string, metadata?: any) => {
    console.log('📱 MessageInputBar: Media selected:', { mediaType, uri, metadata });
    console.log('📱 MessageInputBar: showMediaPicker before:', showMediaPicker);
    console.log('📱 MessageInputBar: showMediaPreview before:', showMediaPreview);

    // צור אובייקט MediaFile
    const mediaFile: any = {
      id: Date.now().toString(), // ID זמני
      uri,
      type: mediaType as 'image' | 'video' | 'audio' | 'document',
      name: metadata?.file_name,
      size: metadata?.file_size,
      duration: metadata?.duration,
      thumbnail: metadata?.thumbnail_url
    };

    console.log('📱 MessageInputBar: Created media file:', mediaFile);

    // קודם סוגרים את ה-MediaPicker
    setShowMediaPicker(false);
    
    // עדכון המדיה הנבחרת
    setSelectedMedia([mediaFile]);
    
    // פתח את ה-preview אחרי delay קצר כדי לתת ל-BottomSheet להיסגר
    setTimeout(() => {
      console.log('📱 MessageInputBar: Opening MediaPreview with selectedMedia:', [mediaFile]);
      setShowMediaPreview(true);
    }, 250); // delay ארוך יותר כדי לתת ל-BottomSheet להיסגר

    console.log('📱 MessageInputBar: Set showMediaPicker to false, scheduled showMediaPreview to true');
  };

  const handleMediaSend = (mediaFiles: any[], captions: Record<string, string>) => {
    // console.log('📤 MessageInputBar: Sending media files:', { mediaFiles, captions });

    if (onSendMedia) {
      onSendMedia(mediaFiles, captions);
    } else {
      // Fallback - שלח כל קובץ מדיה בנפרד
      mediaFiles.forEach(mediaFile => {
        const caption = captions[mediaFile.id] || '';
        console.log('Sending media:', { type: mediaFile.type, uri: mediaFile.uri, caption });
      });
    }

    // נקה את המערך
    setSelectedMedia([]);
    setShowMediaPreview(false);
  };

  const handleMediaPreviewClose = () => {
    setShowMediaPreview(false);
    setSelectedMedia([]);
  };

  const handlePollCreated = (poll: any) => {
    console.log('📊 Poll created:', poll);
    // כאן אפשר להוסיף רענון של ההודעות או עדכון אחר
  };

  // פורמט זמן להקלטה
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // התחלת הקלטה
  const startAudioRecording = async () => {
    try {
      // console.log('🎤 Starting audio recording...');

      // סגור את המקלדת אם היא פתוחה
      Keyboard.dismiss();

      // נקה הקלטה קודמת אם קיימת
      if (recordingRef.current) {
        // console.log('🎤 Cleaning up previous recording...');
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (cleanupError) {
          // console.log('🎤 Cleanup error (expected):', cleanupError);
        }
        recordingRef.current = null;
      }

      // נקה הקלטה שמורה אם יש
      setRecordedAudioUri(null);
      setIsPaused(false);

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('אישור נדרש', 'אנא אשר גישה למיקרופון');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setIsPaused(false);
      
      // אם יש הקלטה קודמת, המשך מהזמן הקודם
      if (!recordedAudioUri) {
        setRecordingDuration(0);
        setWaveformData(Array(30).fill(0.1));
        waveformIndex.current = 0;
      }

      // console.log('🎤 Recording started, bubble should be visible!');

      // עדכן משך כל שנייה
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => {
          // console.log('🎤 Recording duration:', prev + 1);
          return prev + 1;
        });
      }, 1000);

      // עדכן waveforms כל 100ms בזמן אמת (circular buffer - לא scroll)
      waveformInterval.current = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              // קבל metering data אם זמין
              const metering = (status as any).metering;
              let normalizedValue: number;
              
              if (metering !== undefined && typeof metering === 'number') {
                // נרמול רגיש יותר - metering בדרך כלל בין -60 ל-0
                // רגישות גבוהה יותר - כל ערך מעל -50 יגרום ל-bar גבוה
                // טווח רגישות: -50 עד 0 dB = 0.15 עד 1.0
                normalizedValue = Math.max(0.15, Math.min(1, (metering + 50) / 50));
              } else {
                // אם אין metering, צור ערכים אקראיים עם רגישות גבוהה יותר
                // ערכים בין 0.2 ל-1.0 עם וריאציה
                normalizedValue = 0.2 + Math.random() * 0.8;
              }
              
              // עדכן את ה-bar הנוכחי ב-circular buffer
              setWaveformData(prev => {
                const newData = [...prev];
                newData[waveformIndex.current] = normalizedValue;
                return newData;
              });
              
              // עבור ל-bar הבא (circular)
              waveformIndex.current = (waveformIndex.current + 1) % 30;
            }
          }
        } catch (error) {
          console.log('Error getting waveform data:', error);
        }
      }, 100);

    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('שגיאה', 'שגיאה בהתחלת ההקלטה');
    }
  };

  // עצירת הקלטה (pause - לא שולח, רק עוצר)
  const stopAudioRecording = async () => {
    try {
      if (!recordingRef.current) {
        setIsPaused(true);
        setIsRecording(false);
        return;
      }

      // עצור את ההקלטה ושמור את ה-URI
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      if (waveformInterval.current) {
        clearInterval(waveformInterval.current);
        waveformInterval.current = null;
      }

      setIsRecording(false);
      setIsPaused(true);
      
      if (uri) {
        // שמור את ה-URI (לא שולח עדיין)
        // console.log('🎤 Recording paused, URI saved:', uri);
        setRecordedAudioUri(uri);
        // הזמן נשאר כמו שהוא - לא מאפסים
      } else {
        console.warn('⚠️ No URI returned from recording');
      }
      
      recordingRef.current = null;
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
      setIsPaused(true);
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      if (waveformInterval.current) {
        clearInterval(waveformInterval.current);
        waveformInterval.current = null;
      }
      if (recordingRef.current) {
        recordingRef.current = null;
      }
      Alert.alert('שגיאה', 'שגיאה בעצירת ההקלטה');
    }
  };

  // המשך הקלטה (resume)
  const resumeRecording = async () => {
    // שמור את הזמן הנוכחי לפני התחלת הקלטה חדשה
    const currentDuration = recordingDuration;
    const currentWaveform = [...waveformData];
    const currentWaveformIndex = waveformIndex.current;
    
    // התחל הקלטה חדשה
    await startAudioRecordingResume(currentDuration, currentWaveform, currentWaveformIndex);
  };

  // התחלת הקלטה עם ערכים שמורים (לצורך resume)
  const startAudioRecordingResume = async (
    preservedDuration: number = 0, 
    preservedWaveform: number[] = Array(30).fill(0.1),
    preservedWaveformIndex: number = 0
  ) => {
    try {
      // סגור את המקלדת אם היא פתוחה
      Keyboard.dismiss();

      // נקה הקלטה קודמת אם קיימת
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (cleanupError) {
          // Expected error on cleanup
        }
        recordingRef.current = null;
      }

      // נקה הקלטה שמורה אם יש
      setRecordedAudioUri(null);
      setIsPaused(false);

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('אישור נדרש', 'אנא אשר גישה למיקרופון');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setIsPaused(false);
      
      // שמור על הזמן והוואבפורם הקודמים (resume)
      setRecordingDuration(preservedDuration);
      setWaveformData(preservedWaveform);
      waveformIndex.current = preservedWaveformIndex;

      // עדכן משך כל שנייה
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // עדכן waveforms כל 100ms בזמן אמת
      waveformInterval.current = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              const metering = (status as any).metering;
              let normalizedValue: number;
              
              if (metering !== undefined && typeof metering === 'number') {
                normalizedValue = Math.max(0.15, Math.min(1, (metering + 50) / 50));
              } else {
                normalizedValue = 0.2 + Math.random() * 0.8;
              }
              
              setWaveformData(prev => {
                const newData = [...prev];
                newData[waveformIndex.current] = normalizedValue;
                return newData;
              });
              
              waveformIndex.current = (waveformIndex.current + 1) % 30;
            }
          }
        } catch (error) {
          // Silently ignore waveform errors
        }
      }, 100);

    } catch (error) {
      console.error('Error resuming recording:', error);
      Alert.alert('שגיאה', 'שגיאה בהמשך ההקלטה');
    }
  };

  // שליחת ההקלטה
  const sendRecordedAudio = async () => {
    let uriToSend = recordedAudioUri;
    let finalWaveformData = [...waveformData]; // שמור את ה-waveforms
    
    // אם עדיין מקליטים, עצור קודם
    if (isRecording && recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync();
      uriToSend = recordingRef.current.getURI();
      recordingRef.current = null;
    }

    if (!uriToSend) {
      Alert.alert('שגיאה', 'אין הקלטה לשליחה');
      return;
    }

    const audioFile: any = {
      id: Date.now().toString(),
      uri: uriToSend,
      type: 'audio',
      name: `הקלטה_${formatDuration(recordingDuration)}.m4a`,
      size: 0,
      duration: recordingDuration,
      thumbnail: undefined,
      waveformData: finalWaveformData // שמור את ה-waveforms ב-metadata
    };

    if (onSendMedia) {
      onSendMedia([audioFile], { [audioFile.id]: '' });
    }

    // נקה את ההקלטה
    setRecordedAudioUri(null);
    setRecordingDuration(0);
    setIsRecording(false);
    setIsPaused(false);
    setWaveformData(Array(30).fill(0.1));
    waveformIndex.current = 0;
    
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (waveformInterval.current) {
      clearInterval(waveformInterval.current);
      waveformInterval.current = null;
    }
  };

  // ביטול ההקלטה
  const cancelRecording = async () => {
    try {
      setRecordedAudioUri(null);
      setRecordingDuration(0);
      setIsRecording(false);
      setIsPaused(false);
      setWaveformData(Array(30).fill(0.1)); // תיקון: מערך של 30 אלמנטים
      waveformIndex.current = 0;
      
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (error) {
          // console.log('🎤 Error stopping recording on cancel:', error);
        }
        recordingRef.current = null;
      }
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      if (waveformInterval.current) {
        clearInterval(waveformInterval.current);
        waveformInterval.current = null;
      }
    } catch (error) {
      console.error('Error canceling recording:', error);
    }
  };

  // Keyboard listener הוסר - היה גורם לריצוד ולא היה בשימוש אמיתי

  // טיפול בלחיצה על כפתור השליחה/הקלטה
  const handleSendOrRecord = async () => {
    // console.log('🎤 handleSendOrRecord called:', { hasText, isRecording });
    if (hasText) {
      // אם יש טקסט - שלח הודעה
      // console.log('📤 Sending message (has text)');
      handleSend();
    } else {
      // אם אין טקסט - התחל/עצור הקלטה
      if (isRecording) {
        // console.log('🛑 Stopping recording');
        await stopAudioRecording();
      } else {
        // console.log('🎤 Starting recording');
        await startAudioRecording();
      }
    }
  };

  return (
    <View
      style={{
        backgroundColor: DesignTokens.colors.background.primary,
        borderTopWidth: 1,
        borderTopColor: DesignTokens.colors.border.main,
      }}
      pointerEvents="box-none"
    >
      <SafeAreaView
        edges={['bottom']}
        style={{
          backgroundColor: DesignTokens.colors.background.primary,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 6,
            minHeight: 56,
            backgroundColor: DesignTokens.colors.background.primary,
          }}
        >
          {/* כפתור צירוף קבצים - ימין */}
          <Pressable
            onPress={handleAttachmentPress}
            disabled={isRecording}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              opacity: isRecording ? 0.3 : (pressed ? 0.7 : 1),
              transform: [{ scale: pressed ? 0.95 : 1 }]
            })}
          >
            <Plus size={24} color={DesignTokens.colors.primary.main} strokeWidth={2} />
          </Pressable>

          {/* אזור הקלדה - מרכז */}
          <Pressable
            onPress={() => {
              if (!isRecording && textInputRef.current) {
                textInputRef.current.focus();
              }
            }}
            style={{
              flex: 1,
              backgroundColor: DesignTokens.colors.background.secondary,
              borderRadius: 20,
              minHeight: 40,
              maxHeight: 100,
              justifyContent: 'center',
              paddingHorizontal: 4,
              opacity: isRecording ? 0.5 : 1,
              marginHorizontal: 4,
            }}
          >
            <TextInput
              placeholder={isRecording ? 'הקלטה פעילה...' : 'הודעה'}
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              value={text}
              onChangeText={handleTextChange}
              multiline={true}
              numberOfLines={1}
              textAlignVertical="center"
              editable={!isRecording}
              // ב-RTL mode, 'right' ו-'left' מתהפכים אוטומטית
              // אז אם רוצים עברית מימין ב-RTL mode, צריך 'left' (תהפך ל-'right')
              // ואם רוצים אנגלית משמאל ב-RTL mode, צריך 'right' (תהפך ל-'left')
              textAlign={I18nManager.isRTL 
                ? (textDirection === 'rtl' ? 'left' : 'right')
                : (textDirection === 'rtl' ? 'right' : 'left')}
              style={{
                writingDirection: textDirection,
                width: '100%',
                color: DesignTokens.colors.text.primary,
                fontSize: 16,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minHeight: 40,
                maxHeight: 100,
                includeFontPadding: false,
              }}
              ref={textInputRef}
            />
          </Pressable>

          {/* כפתור שליחה/הקלטה - שמאל */}
          <Pressable
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
              borderRadius: 20,
              backgroundColor: hasText ? DesignTokens.colors.primary.main : 'transparent',
              transform: [{ scale: pressed ? 0.95 : 1 }],
              opacity: (!hasText && !isRecording) ? 1 : 1,
            })}
            onPress={() => {
              // console.log('🎤 Pressable pressed:', { hasText, isRecording });
              handleSendOrRecord();
            }}
            disabled={false}
          >
            {hasText ? (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            ) : isRecording ? (
              <AntDesign name="pause" size={20} color={DesignTokens.colors.danger.main} />
            ) : (
              <Ionicons name="mic" size={20} color={DesignTokens.colors.primary.main} />
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      {/* אינדיקטור הקלטה פעילה או מושהית */}
      {(isRecording || isPaused) && (
        <View style={{
          position: 'absolute',
          bottom: 60 + insets.bottom,
          left: 0,
          right: 0,
          zIndex: 999,
        }}>
          {/* בועת הקלטה - עיצוב חדש */}
          <View style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 0,
            borderWidth: 0,
            borderBottomWidth: 1,
            borderColor: DesignTokens.colors.border.primary,
            borderLeftWidth: 3,
            borderLeftColor: isPaused ? DesignTokens.colors.success.main : DesignTokens.colors.danger.main,
            minHeight: 80
          }}>
            {/* שורה עליונה - זמן ו-waveforms */}
            <View style={{ 
              flexDirection: 'row-reverse', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 12
            }}>
              {/* זמן - שמאל למעלה */}
              <Text style={{
                color: DesignTokens.colors.text.primary,
                fontSize: 14,
                fontWeight: '600'
              }}>
                {formatDuration(recordingDuration)}
              </Text>
              
              {/* Waveforms - מרכז (קבועים, לא scroll) */}
              <View style={{
                flex: 1,
                height: 24,
                marginHorizontal: 12,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2
              }}>
                {waveformData.map((value, index) => (
                  <View
                    key={index}
                    style={{
                      width: 3,
                      height: isPaused ? 4 : Math.max(4, value * 20),
                      backgroundColor: isPaused ? DesignTokens.colors.background.tertiary : DesignTokens.colors.danger.main,
                      borderRadius: 1.5,
                      opacity: isPaused ? 0.5 : 1
                    }}
                  />
                ))}
              </View>
            </View>

            {/* שורה תחתונה - כפתורים */}
            <View style={{ 
              flexDirection: 'row-reverse', 
              alignItems: 'center', 
              justifyContent: 'space-between'
            }}>
              {/* כפתור שליחה - שמאל */}
              <Pressable
                onPress={sendRecordedAudio}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: DesignTokens.colors.success.main,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.95 : 1 }]
                })}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </Pressable>

              {/* כפתור pause/resume - מרכז */}
              <Pressable
                onPress={isPaused ? resumeRecording : stopAudioRecording}
                style={({ pressed }) => ({
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: isPaused ? DesignTokens.colors.success.main : DesignTokens.colors.danger.main,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.95 : 1 }]
                })}
              >
                {isPaused ? (
                  <Entypo name="controller-play" size={24} color="#FFFFFF" />
                ) : (
                  <AntDesign name="pause" size={24} color="#FFFFFF" />
                )}
              </Pressable>

              {/* כפתור פח (מחיקה) - ימין */}
              <Pressable
                onPress={cancelRecording}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: DesignTokens.colors.background.tertiary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.95 : 1 }]
                })}
              >
                <Ionicons name="trash-outline" size={20} color={DesignTokens.colors.danger.main} />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Reply Preview - אם עונים להודעה */}
      {replyToMessage && !editingMessage && (
        <View style={{
          position: 'absolute',
          bottom: 60 + insets.bottom,
          left: 0,
          right: 0,
          zIndex: 999,
        }}>
          {/* בועת תשובה - עיצוב כמו ההקלטה */}
          <View style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 0,
            borderBottomWidth: 1,
            borderColor: DesignTokens.colors.border.primary,
            borderLeftWidth: 3,
            borderLeftColor: DesignTokens.colors.success.main,
            height: 60,
          }}>
            {/* תוכן התשובה - מרכז */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  color: DesignTokens.colors.text.primary,
                  fontSize: 13,
                  fontWeight: '600',
                  marginBottom: 2
                }}>
                  תשובה ל{replyToMessage.userName ? ` ${replyToMessage.userName}` : ''}
                </Text>
                <Text
                  style={{
                    color: DesignTokens.colors.text.secondary,
                    fontSize: 11,
                    textAlign: detectLanguage(replyToMessage.content) === 'rtl' ? 'right' : 'left',
                    writingDirection: detectLanguage(replyToMessage.content)
                  }}
                  numberOfLines={1}
                >
                  {replyToMessage.content.length > 30
                    ? replyToMessage.content.substring(0, 30) + '...'
                    : replyToMessage.content}
                </Text>
              </View>
            </View>

            {/* כפתור ביטול - ימין */}
            <Pressable
              onPress={onCancelReply}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: DesignTokens.colors.background.tertiary,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.95 : 1 }]
              })}
            >
              <Ionicons name="close" size={16} color={DesignTokens.colors.text.primary} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Edit Preview - אם במצב עריכה */}
      {editingMessage && (
        <View style={{
          position: 'absolute',
          bottom: 60 + insets.bottom,
          left: 0,
          right: 0,
          zIndex: 999,
        }}>
          {/* בועת עריכה - עיצוב כמו ההקלטה */}
          <View style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 0,
            borderBottomWidth: 1,
            borderColor: DesignTokens.colors.border.primary,
            borderLeftWidth: 3,
            borderLeftColor: DesignTokens.colors.success.main,
            height: 60,
          }}>
            {/* תוכן העריכה - מרכז */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  color: DesignTokens.colors.text.primary,
                  fontSize: 13,
                  fontWeight: '600',
                  marginBottom: 2
                }}>
                  עריכת הודעה
                </Text>
                <Text
                  style={{
                    color: DesignTokens.colors.text.secondary,
                    fontSize: 11
                  }}
                  numberOfLines={1}
                >
                  {editingMessage.content.length > 30
                    ? editingMessage.content.substring(0, 30) + '...'
                    : editingMessage.content}
                </Text>
              </View>
            </View>

            {/* כפתור ביטול - ימין */}
            <Pressable
              onPress={onCancelEdit}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: DesignTokens.colors.background.tertiary,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.95 : 1 }]
              })}
            >
              <Ionicons name="close" size={16} color={DesignTokens.colors.text.primary} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Media Picker Modal */}
      <MediaPicker
        visible={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onMediaSelected={handleMediaSelected}
        onPollRequest={() => setShowPollModal(true)}
        chatId={chatId}
      />

      {/* Media Preview Modal */}
      <MediaPreviewModal
        visible={showMediaPreview}
        onClose={handleMediaPreviewClose}
        onSend={handleMediaSend}
        mediaFiles={selectedMedia}
      />

      {/* Poll Creation Modal */}
      <PollCreationModal
        visible={showPollModal}
        onClose={() => setShowPollModal(false)}
        chatId={chatId}
        onPollCreated={handlePollCreated}
      />

      {/* Mention Picker */}
      <MentionPicker
        visible={showMentionPicker && !isRecording}
        onClose={closeMentionPicker}
        onSelectUser={handleMentionSelect}
        searchQuery={mentionSearchQuery}
        channelId={chatId}
      />

    </View>
  );
} 