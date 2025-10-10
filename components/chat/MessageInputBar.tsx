import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActionSheetIOS, Platform, Alert, KeyboardAvoidingView, Keyboard, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Plus, Square } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MediaPicker from './MediaPicker';
import MediaPreviewModal from './MediaPreviewModal';
import PollCreationModal from './PollCreationModal';
import MentionPicker from './MentionPicker';
// import { MediaFile } from '../../services/mediaService';
import { Audio } from 'expo-av';
import { useMentions } from '../../hooks/useMentions';
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
  const screenWidth = Dimensions.get('window').width;
  const maxBubbleWidth = Math.floor(screenWidth * 0.9);
  const isMe = true; // הקלטה תמיד נחשבת כ-"me"
  
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [textDirection, setTextDirection] = useState<'rtl' | 'ltr'>('rtl');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef<number>(0);

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
    console.log('🔤 Input text direction for:', text, 'is:', direction);
    setTextDirection(direction);
  }, [text]);

  // ניקוי הקלטה בעת unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        console.log('🎤 Cleaning up recording on unmount...');
        try {
          recordingRef.current.stopAndUnloadAsync();
        } catch (error) {
          console.log('🎤 Cleanup error on unmount:', error);
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
  } = useMentions(text);

  const handleSend = () => {
    console.log('📝 MessageInputBar: handleSend called with text:', text);
    if (text.trim()) {
      // Extract mentions if any
      const mentions = getMentionRanges(text);
      console.log('📤 MessageInputBar: Mentions found:', mentions);
      
      // הפסק להקליד כשמשלחים
      if (isTyping) {
        stopTyping?.();
      }
      
      if (editingMessage && onEditMessage) {
        // Editing existing message
        console.log('✏️ MessageInputBar: Editing message:', editingMessage.id);
        onEditMessage(editingMessage.id, text.trim(), mentions);
        onCancelEdit?.();
      } else {
        // Sending new message
        console.log('📤 MessageInputBar: Calling onSend with text:', text.trim());
        onSend(text, mentions);
      }
      
      setText('');
      setIsTyping(false);
      
      // Clear mentions
      closeMentionPicker();
      console.log('✅ MessageInputBar: Message sent/edited, text cleared');
    } else {
      console.log('⚠️ MessageInputBar: Text is empty, not sending');
    }
  };

  const handleTextChange = (newText: string) => {
    console.log('🎨 MessageInputBar: Text changed to:', newText);
    
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
        console.log('✍️ MessageInputBar: User typing (throttled)');
        startTyping?.();
        lastTypingTimeRef.current = now;
      }
      
      // בטל timeout קודם
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // הגדר timeout חדש - אם לא מקלידים 2 שניות, נפסיק
      typingTimeoutRef.current = setTimeout(() => {
        console.log('🛑 MessageInputBar: User stopped typing (timeout)');
        stopTyping?.();
        setIsTyping(false);
      }, 2000);
    } else if (!nowTyping && wasTyping) {
      // הפסיק להקליד (מחק הכל)
      console.log('🛑 MessageInputBar: User cleared text');
      stopTyping?.();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  // Render text with mentions for display
  const renderTextWithMentions = (text: string) => {
    if (!text) return null;
    
    console.log('🎨 renderTextWithMentions called with:', text);
    
    // Split text by @ symbols to find mentions
    const parts = text.split(/(@[^\s]+)/);
    console.log('🎨 Text parts:', parts);
    
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
            console.log('🎨 Rendering mention part:', part, 'in green bold');
            return (
              <Text key={index} style={{ fontWeight: 'bold', color: '#00E654', fontSize: 16 }}>
                {part}
              </Text>
            );
          }
          console.log('🎨 Rendering regular text part:', part, 'in white normal');
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
    console.log('Attachment button pressed');
    setShowMediaPicker(true);
  };

  const handleMediaSelected = (mediaType: string, uri: string, metadata?: any) => {
    console.log('📱 MessageInputBar: Media selected:', { mediaType, uri, metadata });
    
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
    
    // הוסף למערך המדיה הנבחרת
    setSelectedMedia(prev => [...prev, mediaFile]);
    
    // סגור את MediaPicker ופתח את Preview
    setShowMediaPicker(false);
    setShowMediaPreview(true);
  };

  const handleMediaSend = (mediaFiles: any[], captions: Record<string, string>) => {
    console.log('📤 MessageInputBar: Sending media files:', { mediaFiles, captions });
    
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
      console.log('🎤 Starting audio recording...');
      
      // נקה הקלטה קודמת אם קיימת
      if (recordingRef.current) {
        console.log('🎤 Cleaning up previous recording...');
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.log('🎤 Cleanup error (expected):', cleanupError);
        }
        recordingRef.current = null;
      }
      
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
      setRecordingDuration(0);
      
      
      console.log('🎤 Recording started, bubble should be visible!');

      // עדכן משך כל שנייה
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => {
          console.log('🎤 Recording duration:', prev + 1);
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('שגיאה', 'שגיאה בהתחלת ההקלטה');
    }
  };

  // עצירת הקלטה
  const stopAudioRecording = async () => {
    try {
      if (!recordingRef.current) return;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }

      setIsRecording(false);
      setRecordingDuration(0);
      recordingRef.current = null;

      if (uri) {
        // שלח את ההקלטה לצ'אט
        console.log('🎤 Audio recorded:', uri);
        
        // צור אובייקט MediaFile להקלטה
        const audioFile: any = {
          id: Date.now().toString(),
          uri,
          type: 'audio',
          name: `הקלטה_${formatDuration(recordingDuration)}.m4a`,
          size: 0, // לא יודעים את הגודל
          duration: recordingDuration,
          thumbnail: undefined
        };
        
        // שלח את ההקלטה לצ'אט
        if (onSendMedia) {
          onSendMedia([audioFile], { [audioFile.id]: '' });
        } else {
          // Fallback - שלח הודעה רגילה עם הקלטה
          console.log('Sending audio message:', audioFile);
        }
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('שגיאה', 'שגיאה בעצירת ההקלטה');
    }
  };

  // זיהוי שינויים במקלדת
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      setIsKeyboardVisible(true);
    });
    
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // טיפול בלחיצה על כפתור השליחה/הקלטה
  const handleSendOrRecord = () => {
    if (isTyping) {
      // אם יש טקסט - שלח הודעה
      handleSend();
    } else {
      // אם אין טקסט - התחל הקלטה
      if (isRecording) {
        stopAudioRecording();
      } else {
        startAudioRecording();
      }
    }
  };

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      <View
        style={{ 
          flexDirection: 'row',
          alignItems: 'flex-end',
          backgroundColor: '#121212',
          paddingHorizontal: 8,
          paddingVertical: 8,
          marginHorizontal: 0,
          marginBottom: 0,
          borderWidth: 0,
          borderTopWidth: 1,
          borderColor: '#333333',
          minHeight: 60,
        }}
      >
        {/* כפתור צירוף קבצים - ימין */}
        <Pressable 
          onPress={handleAttachmentPress}
          style={{ 
            width: 42,
            height: 42,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
            marginRight: 8,
          }}
        >
          <Plus size={24} color="#00E654" strokeWidth={2} />
        </Pressable>

        {/* אזור הקלדה - מרכז */}
        <View 
          style={{ 
            flex: 1,
            marginHorizontal: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 21,
            borderWidth: 1,
            borderColor: isTyping ? '#00E654' : 'rgba(255, 255, 255, 0.1)',
            minHeight: 42,
            maxHeight: 70, // 2 שורות מקסימום
          }}
        >
          <TextInput
            placeholder="הודעה"
            placeholderTextColor="#A0AEC0"
            value={text}
            onChangeText={handleTextChange}
            multiline={true}
            numberOfLines={2}
            textAlignVertical="top"
            style={{ 
              textAlign: textDirection === 'rtl' ? 'right' : 'left',
              writingDirection: textDirection,
              width: '100%',
              color: '#FFFFFF',
              fontWeight: 'normal' as const,
              fontSize: 15,
              backgroundColor: 'transparent',
              paddingHorizontal: 12,
              paddingVertical: 10,
              minHeight: 42,
              maxHeight: 70, // 2 שורות מקסימום
              includeFontPadding: false,
              lineHeight: 20
            }}
            ref={textInputRef}
          />
        </View>

        {/* כפתור שליחה/הקלטה - שמאל */}
        <Pressable 
          style={{ 
            width: 42,
            height: 42,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
            marginRight: 8,
            opacity: (isTyping && !text.trim()) ? 0.5 : 1,
          }}
          onPress={handleSendOrRecord}
          disabled={isTyping && !text.trim()}
        >
          <Ionicons 
            name={isTyping ? "send" : (isRecording ? "stop" : "mic")}
            size={22} 
            color={isTyping ? '#00E654' : (isRecording ? '#F85149' : '#FFFFFF')} 
          />
        </Pressable>
      </View>

      {/* אינדיקטור הקלטה פעילה */}
      {isRecording && (
        <View style={{
          position: 'absolute',
          bottom: isKeyboardVisible ? 60 : 60,
          left: 0,
          right: 0,
          zIndex: 999,
        }}>
          {/* בועת הקלטה - עיצוב נקי ופשוט */}
          <View style={{
            backgroundColor: 'rgba(19, 19, 19, 0.8)',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 0,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            borderLeftWidth: 3,
            borderLeftColor: '#F85149',
            height: 60
          }}>
            {/* תוכן ההקלטה - מרכז */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ 
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: '600',
                  marginBottom: 2
                }}>
                  הקלטה פעילה
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* נקודה מהבהבת ליד הטיימר */}
                  <View style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: '#F85149',
                    marginRight: 6,
                    opacity: 0.9
                  }} />
                  <Text style={{ 
                    color: '#CCCCCC',
                    fontSize: 11
                  }}>
                    {formatDuration(recordingDuration)}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* כפתור ביטול - ימין */}
            <Pressable 
              onPress={() => {
                setIsRecording(false);
                setRecordingDuration(0);
                if (recordingRef.current) {
                  recordingRef.current.stopAndUnloadAsync();
                  recordingRef.current = null;
                }
                if (durationInterval.current) {
                  clearInterval(durationInterval.current);
                }
              }}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.95 : 1 }]
              })}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Reply Preview - אם עונים להודעה */}
      {replyToMessage && !editingMessage && (
        <View style={{
          position: 'absolute',
          bottom: isKeyboardVisible ? 60 : 60,
          left: 0,
          right: 0,
          zIndex: 999,
        }}>
          {/* בועת תשובה - עיצוב כמו ההקלטה */}
          <View style={{
            backgroundColor: 'rgba(29, 24, 24, 0.95)',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 0,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            borderLeftWidth: 3,
            borderLeftColor: '#00E654',
            height: 60,
          }}>
            {/* תוכן התשובה - מרכז */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ 
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: '600',
                  marginBottom: 2
                }}>
                  תשובה ל{replyToMessage.userName ? ` ${replyToMessage.userName}` : ''}
                </Text>
                <Text 
                  style={{ 
                    color: '#CCCCCC',
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
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.95 : 1 }]
              })}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Edit Preview - אם במצב עריכה */}
      {editingMessage && (
        <View style={{
          position: 'absolute',
          bottom: isKeyboardVisible ? 60 : 60,
          left: 0,
          right: 0,
          zIndex: 999,
        }}>
          {/* בועת עריכה - עיצוב כמו ההקלטה */}
          <View style={{
            backgroundColor: 'rgba(29, 24, 24, 0.95)',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 0,
            borderBottomWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            borderLeftWidth: 3,
            borderLeftColor: '#00E654',
            height: 60,
          }}>
            {/* תוכן העריכה - מרכז */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ 
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: '600',
                  marginBottom: 2
                }}>
                  עריכת הודעה
                </Text>
                <Text 
                  style={{ 
                    color: '#CCCCCC',
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
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.95 : 1 }]
              })}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
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
        visible={showMentionPicker}
        onClose={closeMentionPicker}
        onSelectUser={handleMentionSelect}
        searchQuery={mentionSearchQuery}
        channelId={chatId}
      />
      
    </View>
  );
} 