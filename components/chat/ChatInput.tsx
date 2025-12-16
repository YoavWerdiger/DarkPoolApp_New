// ============================================
// Chat Input Component
// ============================================
// שדה הקלדה ושליחת הודעות עם כל התכונות
// ============================================

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform, KeyboardAvoidingView, Alert, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import MediaPickerSheet from './MediaPickerSheet';
import PollCreationBottomSheet from './PollCreationBottomSheet';

// עבור תאימות עם Expo Go - שימוש ב-MediaTypeOptions עדיין
const MediaType = (ImagePicker as any).MediaType || (ImagePicker as any).MediaTypeOptions || {
  Images: 'images',
  Videos: 'videos',
  All: 'all',
};
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { ChatMessageType } from '../../types/chat.types';
import { chatMediaService } from '../../services/chat';
import { Ionicons } from '@expo/vector-icons';
import VoiceWaveform from './VoiceWaveform';
import VoiceWaveformWithProgress from './VoiceWaveformWithProgress';
import MediaPreviewModal from './MediaPreviewModal';

interface ChatInputProps {
  groupId: string;
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: ChatMessageType) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  onCancelReply?: () => void;
  disabled?: boolean;
}

export default function ChatInput({
  groupId,
  onSendMessage,
  onTyping,
  replyTo,
  onCancelReply,
  disabled = false,
}: ChatInputProps) {
  const DesignTokens = useDesignTokens();
  
  // #region agent log
  if (!DesignTokens) {
    fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatInput.tsx:51',message:'DesignTokens is undefined',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  } else {
    fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatInput.tsx:51',message:'DesignTokens is defined',data:{hasColors:!!DesignTokens.colors,hasText:!!DesignTokens.colors?.text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion
  
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => {
    if (!DesignTokens) {
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatInput.tsx:53',message:'DesignTokens is undefined in useMemo',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      return {};
    }
    return createStyles(DesignTokens, insets.bottom);
  }, [DesignTokens, insets.bottom]) as any;
  
  // Icon styles with DesignTokens
  const iconImageStyle = useMemo(() => {
    if (!DesignTokens || !DesignTokens.colors || !DesignTokens.colors.text) {
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatInput.tsx:56',message:'DesignTokens missing in iconImageStyle',data:{hasDesignTokens:!!DesignTokens,hasColors:!!DesignTokens?.colors,hasText:!!DesignTokens?.colors?.text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      return { width: 28, height: 28, tintColor: '#888' };
    }
    return {
      width: 28,
      height: 28,
      tintColor: DesignTokens.colors.text.secondary
    };
  }, [DesignTokens]);

  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // רמת קול אמיתית
  const [isUploading, setIsUploading] = useState(false);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  
  // Media Preview State
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [previewMediaUri, setPreviewMediaUri] = useState<string>('');
  const [previewMediaType, setPreviewMediaType] = useState<'image' | 'video'>('image');
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [pollCreationVisible, setPollCreationVisible] = useState(false);

  // Log when poll creation opens
  useEffect(() => {
    if (pollCreationVisible) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8b9bfe71-986e-4e14-a9ec-fee0bc691e64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ChatInput.tsx:76',message:'PollCreationBottomSheet opened',data:{groupId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
  }, [pollCreationVisible, groupId]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('🔍 ChatInput state - disabled:', disabled, 'isUploading:', isUploading, 'isRecording:', isRecording, 'isPaused:', isPaused, 'showMediaPreview:', showMediaPreview);
  }, [disabled, isUploading, isRecording, isPaused, showMediaPreview]);

  const textInputRef = useRef<TextInput>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewPositionInterval = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingDotOpacity = useRef(new Animated.Value(1)).current;
  const timelineProgress = useRef(new Animated.Value(0)).current; // Progress on timeline (0-1)
  const isStartingRecordingRef = useRef<boolean>(false); // Flag למניעת קריאות מרובות
  
  const MAX_RECORDING_DURATION = 60; // מקסימום 60 שניות

  const canSend = text.trim().length > 0 || isRecording;

  // ============================================
  // Handle Text Change
  // ============================================

  const handleTextChange = (newText: string) => {
    setText(newText);

    // Typing indicator
    if (onTyping) {
      onTyping(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 3000);
    }
  };

  // ============================================
  // Send Text Message
  // ============================================

  const handleSend = async () => {
    const messageText = text.trim();
    
    console.log('🔍 ChatInput handleSend called:', {
      messageText,
      messageLength: messageText.length,
      disabled,
      hasOnSendMessage: !!onSendMessage,
    });
    
    if (!messageText || disabled) {
      console.log('⚠️ ChatInput handleSend: early return - no text or disabled');
      return;
    }
    
    const textToSend = messageText;
    setText('');
    
    if (onTyping) {
      onTyping(false);
    }

    try {
      console.log('📤 ChatInput: Calling onSendMessage with:', textToSend);
      await onSendMessage(textToSend);
      console.log('✅ ChatInput: onSendMessage completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ ChatInput Error sending message:', errorMessage, error);
      Alert.alert('שגיאה', errorMessage || 'לא הצלחנו לשלוח את ההודעה');
      // Restore text on error
      setText(textToSend);
    }
  };

  // ============================================
  // Send Media with Caption
  // ============================================

  const handleSendMedia = async (caption: string) => {
    if (!previewMediaUri) {
      console.error('❌ handleSendMedia: No previewMediaUri');
      Alert.alert('שגיאה', 'לא נמצא קובץ מדיה');
      return;
    }

    console.log('📤 handleSendMedia: Starting upload', {
      uri: previewMediaUri,
      type: previewMediaType,
      groupId,
      caption: caption.substring(0, 20),
    });

    setIsUploading(true);
    setShowMediaPreview(false);

    try {
      if (previewMediaType === 'image') {
        const uploadResult = await chatMediaService.uploadImage(
          previewMediaUri,
          groupId,
          (progress) => {
            console.log('📤 Image upload progress:', progress.progress);
          }
        );

        if (uploadResult.error) {
          const errorMessage = uploadResult.error.message || 'שגיאה בהעלאת התמונה';
          console.error('❌ Image upload error:', uploadResult.error);
          
          // בדיקה אם זו שגיאת רשת
          if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
            Alert.alert(
              'בעיית חיבור',
              'לא הצלחנו להעלות את התמונה. אנא בדוק:\n\n1. שהמכשיר מחובר לאינטרנט\n2. שהרשת מאפשרת גישה לאתרים חיצוניים\n3. נסה שוב בעוד כמה רגעים',
              [
                { text: 'ביטול', style: 'cancel', onPress: () => setShowMediaPreview(false) },
                { text: 'נסה שוב', onPress: () => setShowMediaPreview(true) }
              ]
            );
          } else {
            Alert.alert('שגיאה', errorMessage);
            setShowMediaPreview(true); // חזור ל-preview אם יש שגיאה
          }
        } else if (uploadResult.url) {
          await onSendMessage(caption.trim(), uploadResult.url, ChatMessageType.IMAGE);
          setPreviewMediaUri(''); // נקה אחרי שליחה מוצלחת
        } else {
          Alert.alert('שגיאה', 'לא התקבל URL לתמונה');
          setShowMediaPreview(true);
        }
      } else if (previewMediaType === 'video') {
        const uploadResult = await chatMediaService.uploadVideo(
          previewMediaUri,
          groupId,
          (progress) => {
            console.log('📤 Video upload progress:', progress.progress);
          }
        );

        if (uploadResult.error) {
          const errorMessage = uploadResult.error.message || 'שגיאה בהעלאת הסרטון';
          console.error('❌ Video upload error:', uploadResult.error);
          
          // בדיקה אם זו שגיאת רשת
          if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
            Alert.alert(
              'בעיית חיבור',
              'לא הצלחנו להעלות את הסרטון. אנא בדוק:\n\n1. שהמכשיר מחובר לאינטרנט\n2. שהרשת מאפשרת גישה לאתרים חיצוניים\n3. נסה שוב בעוד כמה רגעים',
              [
                { text: 'ביטול', style: 'cancel', onPress: () => setShowMediaPreview(false) },
                { text: 'נסה שוב', onPress: () => setShowMediaPreview(true) }
              ]
            );
          } else {
            Alert.alert('שגיאה', errorMessage);
            setShowMediaPreview(true); // חזור ל-preview אם יש שגיאה
          }
        } else if (uploadResult.url) {
          await onSendMessage(caption.trim(), uploadResult.url, ChatMessageType.VIDEO);
          setPreviewMediaUri(''); // נקה אחרי שליחה מוצלחת
        } else {
          Alert.alert('שגיאה', 'לא התקבל URL לסרטון');
          setShowMediaPreview(true);
        }
      }
    } catch (error: any) {
      console.error('❌ Unexpected error uploading media:', error);
      const errorMessage = error?.message || 'לא הצלחנו להעלות את המדיה';
      
      // בדיקה אם זו שגיאת רשת
      if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
        Alert.alert(
          'בעיית חיבור',
          'לא הצלחנו להעלות את המדיה. אנא בדוק:\n\n1. שהמכשיר מחובר לאינטרנט\n2. שהרשת מאפשרת גישה לאתרים חיצוניים\n3. נסה שוב בעוד כמה רגעים',
          [
            { text: 'ביטול', style: 'cancel', onPress: () => setShowMediaPreview(false) },
            { text: 'נסה שוב', onPress: () => setShowMediaPreview(true) }
          ]
        );
      } else {
        Alert.alert('שגיאה', errorMessage);
        setShowMediaPreview(true); // חזור ל-preview אם יש שגיאה
      }
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================
  // Pick Image
  // ============================================

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('הרשאה נדרשת', 'אנא אפשר גישה לגלריה');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: MediaType.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPreviewMediaUri(asset.uri);
        setPreviewMediaType('image');
        setShowMediaPreview(true);
      }
    } catch (error) {
      console.error('❌ Error picking image:', error);
      Alert.alert('שגיאה', 'לא הצלחנו לבחור תמונה');
    }
  };

  // ============================================
  // Take Photo
  // ============================================

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('הרשאה נדרשת', 'אנא אפשר גישה למצלמה');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: MediaType.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPreviewMediaUri(asset.uri);
        setPreviewMediaType('image');
        setShowMediaPreview(true);
      }
    } catch (error) {
      console.error('❌ Error taking photo:', error);
      Alert.alert('שגיאה', 'לא הצלחנו לצלם תמונה');
    }
  };

  // ============================================
  // Pick Document
  // ============================================

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        const asset = result.assets[0];
        
        const uploadResult = await chatMediaService.uploadDocument(
          asset.uri,
          asset.name || 'document',
          groupId,
          (progress) => {
            console.log('📤 Document upload progress:', progress.progress);
          }
        );

        if (uploadResult.error) {
          Alert.alert('שגיאה', uploadResult.error.message);
        } else if (uploadResult.url) {
          await onSendMessage('', uploadResult.url, ChatMessageType.DOCUMENT);
        }
        
        setIsUploading(false);
      }
    } catch (error) {
      console.error('❌ Error picking document:', error);
      Alert.alert('שגיאה', 'לא הצלחנו לבחור מסמך');
      setIsUploading(false);
    }
  };

  // Create Poll
  // ============================================
  const handleCreatePoll = () => {
    setMediaPickerVisible(false);
    setTimeout(() => {
      setPollCreationVisible(true);
    }, 200);
  };

  const handlePollCreated = (poll: any) => {
    console.log('✅ Poll created:', poll);
    // הסקר יוצג אוטומטית בצ'אט דרך PollService.createPollMessage
    setPollCreationVisible(false);
  };

  // Handle Audio from Media Picker
  // ============================================
  const handleStartAudioRecording = async () => {
    setMediaPickerVisible(false);
    setTimeout(async () => {
      await startRecording();
    }, 200);
  };

  // ============================================
  // Record Audio
  // ============================================

  const startRecording = async () => {
    // בדוק אם כבר בתהליך התחלת הקלטה
    if (isStartingRecordingRef.current) {
      console.log('⚠️ Recording start already in progress');
      return;
    }

    // בדוק אם כבר מקליטים
    if (isRecording || isPaused) {
      console.log('⚠️ Recording already in progress');
      return;
    }

    isStartingRecordingRef.current = true;

    try {
      // נקה הקלטה קודמת אם יש
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (error) {
          // התעלם משגיאות בניקוי - אולי ההקלטה כבר נעצרה
          console.log('⚠️ Error cleaning up previous recording:', error);
        }
        recordingRef.current = null;
      }
      
      // נקה גם sound אם יש
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (error) {
          // התעלם משגיאות בניקוי
        }
        soundRef.current = null;
      }
      
      // המתן קצת כדי לוודא שהניקוי הסתיים
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const { status } = await Audio.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('הרשאה נדרשת', 'אנא אפשר גישה למיקרופון');
        isStartingRecordingRef.current = false;
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // המתן עוד קצת כדי לוודא שהניקוי הסתיים לחלוטין
      await new Promise(resolve => setTimeout(resolve, 300));

      // יצירת recording חדש
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      setAudioLevel(0);
      timelineProgress.setValue(0); // איפוס הטיימליין

      // Start pulse animation for recording dot
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingDotOpacity, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordingDotOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          // עדכן את הטיימליין
          const progress = Math.min(newDuration / MAX_RECORDING_DURATION, 1);
          timelineProgress.setValue(progress);
          return newDuration;
        });
      }, 1000);

      // עדכן waveforms כל 50ms בזמן אמת (מהיר יותר)
      waveformIntervalRef.current = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              // קבל metering data אם זמין
              const metering = (status as any).metering;
              let normalizedValue: number;
              
              if (metering !== undefined && typeof metering === 'number') {
                // נרמול - metering בדרך כלל בין -60 ל-0 dB
                // טווח רגישות: -50 עד 0 dB = 0.2 עד 1.0 (יותר רגיש)
                normalizedValue = Math.max(0.2, Math.min(1, (metering + 50) / 50));
              } else {
                // אם אין metering, צור ערכים אקראיים עם וריאציה
                const base = 0.3;
                const variation = Math.random() * 0.7;
                normalizedValue = base + variation;
              }
              
              setAudioLevel(normalizedValue);
            }
          }
        } catch (error) {
          console.log('⚠️ Error getting waveform data:', error);
        }
      }, 50); // מהיר יותר - 50ms במקום 100ms
      
      isStartingRecordingRef.current = false; // איפוס ה-flag אחרי הצלחה
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      Alert.alert('שגיאה', 'לא הצלחנו להתחיל הקלטה');
      isStartingRecordingRef.current = false; // איפוס ה-flag גם במקרה של שגיאה
      
      // נקה את recordingRef אם יש
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (cleanupError) {
          // התעלם משגיאות
        }
        recordingRef.current = null;
      }
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) {
        setIsPaused(true);
        setIsRecording(false);
        return;
      }

      // Stop timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      // Stop waveform updates
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
        waveformIntervalRef.current = null;
      }

      const status = await recordingRef.current.getStatusAsync();
      const uri = recordingRef.current.getURI();
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      setIsRecording(false);
      setIsPaused(true);
      setAudioLevel(0);
      
      // Stop pulse animation
      recordingDotOpacity.setValue(1);
      
      if (uri) {
        setRecordedAudioUri(uri);
        // הזמן נשאר כמו שהוא - לא מאפסים
        // אפס את הטיימליין - הוא יתעדכן כאשר נשמיע את ההקלטה
        timelineProgress.setValue(0);
      }
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      setIsRecording(false);
      setIsPaused(true);
    }
  };

  // שמיעת ההקלטה (preview)
  const playPreview = async () => {
    if (!recordedAudioUri) return;
    
    try {
      // עצור שמיעה קודמת אם יש
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // טען את ההקלטה
      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedAudioUri },
        { shouldPlay: true }
      );
      
      soundRef.current = sound;
      setIsPlayingPreview(true);
      setPreviewPosition(0);
      
      // קבל את אורך ההקלטה
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        setPreviewDuration(status.durationMillis || 0);
      }

      // עדכן את המיקום בזמן אמת
      previewPositionInterval.current = setInterval(async () => {
        if (soundRef.current) {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            const position = status.positionMillis || 0;
            const duration = status.durationMillis || previewDuration;
            setPreviewPosition(position);
            
            // עדכן את הטיימליין
            if (duration > 0) {
              const progress = position / duration;
              timelineProgress.setValue(progress);
            }
            
            // אם הסתיימה השמיעה
            if (status.didJustFinish) {
              setIsPlayingPreview(false);
              setPreviewPosition(0);
              timelineProgress.setValue(0);
              if (previewPositionInterval.current) {
                clearInterval(previewPositionInterval.current);
                previewPositionInterval.current = null;
              }
              if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
              }
            }
          }
        }
      }, 100);

      // האזן לסיום
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            setIsPlayingPreview(false);
            setPreviewPosition(0);
            timelineProgress.setValue(0);
            if (previewPositionInterval.current) {
              clearInterval(previewPositionInterval.current);
              previewPositionInterval.current = null;
            }
          } else {
            // עדכן את הטיימליין בזמן אמת
            const position = status.positionMillis || 0;
            const duration = status.durationMillis || previewDuration;
            if (duration > 0) {
              const progress = position / duration;
              timelineProgress.setValue(progress);
            }
          }
        }
      });
    } catch (error) {
      console.error('Error playing preview:', error);
      Alert.alert('שגיאה', 'לא ניתן להפעיל את ההקלטה');
    }
  };

  // עצירת שמיעת ההקלטה
  const pausePreview = async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlayingPreview(false);
      if (previewPositionInterval.current) {
        clearInterval(previewPositionInterval.current);
        previewPositionInterval.current = null;
      }
    }
  };

  // שליחת ההקלטה
  const sendRecordedAudio = async () => {
    if (!recordedAudioUri) return;

    setIsUploading(true);
    try {
      const uploadResult = await chatMediaService.uploadAudio(
        recordedAudioUri,
        groupId,
        recordingDuration,
        (progress) => {
          console.log('📤 Audio upload progress:', progress.progress);
        }
      );

      if (uploadResult.error) {
        Alert.alert('שגיאה', uploadResult.error.message);
      } else if (uploadResult.url) {
        await onSendMessage('', uploadResult.url, ChatMessageType.AUDIO);
        // נקה את ההקלטה
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        if (previewPositionInterval.current) {
          clearInterval(previewPositionInterval.current);
          previewPositionInterval.current = null;
        }
        setRecordedAudioUri(null);
        setRecordingDuration(0);
        setIsPaused(false);
        setIsPlayingPreview(false);
        setPreviewPosition(0);
      }
    } catch (error) {
      console.error('❌ Error uploading audio:', error);
      Alert.alert('שגיאה', 'לא הצלחנו להעלות את ההקלטה');
    } finally {
      setIsUploading(false);
    }
  };

  const cancelRecording = () => {
    // Stop waveform updates
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }
    // Stop pulse animation
    recordingDotOpacity.setValue(1);
    
    // עצור שמיעה אם יש
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    if (previewPositionInterval.current) {
      clearInterval(previewPositionInterval.current);
      previewPositionInterval.current = null;
    }
    
      setRecordedAudioUri(null);
      setRecordingDuration(0);
      setIsRecording(false);
      setIsPaused(false);
      setIsPlayingPreview(false);
      setPreviewPosition(0);
      timelineProgress.setValue(0); // איפוס הטיימליין
    
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
  };

  // ============================================
  // Show Attachment Options
  // ============================================

  const handlePickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('הרשאה נדרשת', 'אנא אפשר גישה לגלריה');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: MediaType.Videos,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPreviewMediaUri(asset.uri);
        setPreviewMediaType('video');
        setShowMediaPreview(true);
      }
    } catch (error) {
      console.error('❌ Error picking video:', error);
      Alert.alert('שגיאה', 'לא הצלחנו לבחור סרטון');
    }
  };

  const showAttachmentOptions = () => {
    console.log('📱 ChatInput: showAttachmentOptions called, setting mediaPickerVisible to true');
    setMediaPickerVisible(true);
  };

  // ============================================
  // Format Recording Duration
  // ============================================

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // Cleanup
  // ============================================

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
      }
      if (previewPositionInterval.current) {
        clearInterval(previewPositionInterval.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
      }
      if (previewPositionInterval.current) {
        clearInterval(previewPositionInterval.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // ============================================
  // Render
  // ============================================

  return (
    <>
      {/* Reply Preview - Simple card ABOVE input area */}
      {replyTo ? (
        <View style={styles.replyPreviewContainer}>
          <View style={styles.replyAccentBar} />
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel}>↩️ תשובה ל-{replyTo.senderName}</Text>
            <Text style={styles.replyText} numberOfLines={1}>{replyTo.content || '📎 מדיה'}</Text>
          </View>
          <TouchableOpacity 
            onPress={onCancelReply} 
            style={styles.cancelReply}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.5)" />
          </TouchableOpacity>
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.container}>
        {/* Input Container */}
        <View style={styles.inputContainer}>
          {/* Attachment Button */}
          {!isRecording && !(isPaused && recordedAudioUri) && (
            <TouchableOpacity 
              onPress={showAttachmentOptions} 
              style={styles.iconButton}
              disabled={disabled || isUploading}
            >
              <Image 
                source={require('../../assets/icons/ico-32-plus.png')} 
                style={iconImageStyle} 
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}

          {/* Text Input or Recording UI */}
          {isRecording ? (
            <View style={styles.recordingContainerActive}>
              {/* Blur background for glass effect */}
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20, 20, 20, 0.4)' }]} />
              )}
              {/* Border for glass effect */}
              <View style={styles.glassBorder} />
              
              {/* Content */}
              <View style={styles.recordingContent}>
                {/* Timer - fixed width, won't shrink */}
                <View style={styles.timerContainer}>
                  <Text style={styles.recordingTime}>{formatRecordingTime(recordingDuration)}</Text>
                  <Animated.View style={[styles.recordingDot, { opacity: recordingDotOpacity }]} />
                </View>
                
                {/* Waveform - takes remaining space but respects timer */}
                <View style={styles.waveformWrapper}>
                  <VoiceWaveform isRecording={isRecording} audioLevel={audioLevel} />
                </View>
              </View>
            </View>
          ) : isPaused && recordedAudioUri ? (
            <View style={styles.recordingContainer}>
              {/* Blur background for glass effect */}
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20, 20, 20, 0.4)' }]} />
              )}
              {/* Border for glass effect */}
              <View style={styles.glassBorder} />
              
              {/* Content */}
              <View style={styles.timerAndControlsContainer}>
                <View style={styles.timerContainer}>
                  <Text style={styles.recordingTime}>{formatRecordingTime(recordingDuration)}</Text>
                  {isPlayingPreview && (
                    <Animated.View style={[styles.recordingDot, { opacity: recordingDotOpacity }]} />
                  )}
                </View>
                
                {/* Waveforms with Progress */}
                <VoiceWaveformWithProgress 
                  progress={timelineProgress}
                  duration={previewDuration}
                  isPlaying={isPlayingPreview}
                />
                
                {/* Play/Pause Button inside the container */}
                <TouchableOpacity 
                  onPress={isPlayingPreview ? pausePreview : playPreview} 
                  style={styles.playButtonInside}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={isPlayingPreview ? "pause-circle" : "play-circle"} 
                    size={28} 
                    color={DesignTokens?.colors?.primary?.main || '#05d157'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder={isUploading ? 'מעלה...' : 'הקלד הודעה...'}
              placeholderTextColor={DesignTokens?.colors?.text?.secondary || '#888'}
              value={text}
              onChangeText={(newText) => {
                console.log('🔍 TextInput onChangeText called, newText length:', newText.length);
                handleTextChange(newText);
              }}
              multiline
              numberOfLines={2}
              maxLength={4000}
              editable={!disabled && !isUploading}
              onFocus={() => {
                console.log('🔍 TextInput focused, disabled:', disabled, 'isUploading:', isUploading, 'editable:', !disabled && !isUploading);
              }}
              onBlur={() => {
                console.log('🔍 TextInput blurred');
              }}
              onPressIn={() => {
                console.log('🔍 TextInput onPressIn');
              }}
            />
          )}

          {/* Send/Voice Button */}
          {text.trim().length > 0 ? (
            <TouchableOpacity 
              onPress={handleSend} 
              style={styles.sendButton}
              // לא נחסום לפי canSend כדי לא ליפול על לוגיקה; בדיקה נעשית בתוך handleSend
              disabled={disabled || isUploading}
            >
              <Ionicons name="send" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (isRecording || isPaused) ? (
            <View style={styles.recordingButtons}>
              <TouchableOpacity 
                onPress={cancelRecording} 
                style={styles.cancelButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={32} color="#FF3B30" />
              </TouchableOpacity>
              {isPaused ? (
                <TouchableOpacity 
                  onPress={sendRecordedAudio} 
                  style={styles.sendButton}
                  disabled={isUploading}
                  activeOpacity={0.7}
                >
                  <Ionicons name="send" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  onPress={stopRecording} 
                  style={styles.stopButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="stop-circle" size={32} color={DesignTokens?.colors?.primary?.main || '#05d157'} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity 
              onPress={startRecording} 
              style={styles.voiceButton}
              disabled={disabled || isUploading}
            >
              <Image 
                source={require('../../assets/icons/ico-32-mic.png')} 
                style={iconImageStyle} 
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Uploading Indicator */}
        {isUploading && (
          <View style={styles.uploadingContainer}>
            <Text style={styles.uploadingText}>מעלה קובץ...</Text>
          </View>
        )}
        </View>
      </KeyboardAvoidingView>

      {/* Media Preview Modal - מחוץ ל-KeyboardAvoidingView כדי שיוצג נכון */}
      {showMediaPreview && (
        <MediaPreviewModal
          visible={showMediaPreview}
          mediaUri={previewMediaUri}
          mediaType={previewMediaType}
          onSend={handleSendMedia}
          onCancel={() => {
            console.log('🔍 MediaPreviewModal cancelled');
            setShowMediaPreview(false);
            setPreviewMediaUri('');
          }}
          isUploading={isUploading}
        />
      )}

      {/* Custom Media Picker Sheet */}
      <MediaPickerSheet
        visible={mediaPickerVisible}
        onClose={() => setMediaPickerVisible(false)}
        onCamera={handleTakePhoto}
        onGallery={handlePickImage}
        onVideo={handlePickVideo}
        onDocument={handlePickDocument}
        onAudio={handleStartAudioRecording}
        onPoll={handleCreatePoll}
      />

      {/* Poll Creation Bottom Sheet */}
      <PollCreationBottomSheet
        visible={pollCreationVisible}
        onClose={() => setPollCreationVisible(false)}
        chatId={groupId}
        onPollCreated={handlePollCreated}
      />
    </>
  );
}

// ============================================
// Styles - Modern Design from Reference
// ============================================

// Design Colors
const COLORS = {
  background: {
    primary: '#0a0a0a',
    secondary: '#1a1a1a',
    tertiary: '#2a2a2a',
  },
  border: '#2a2a2a',
  text: {
    primary: '#FFFFFF',
    secondary: '#9CA3AF',
    tertiary: '#6B7280',
  },
  accent: '#3B82F6',
  accentDark: '#2563EB',
  success: '#22C55E',
  danger: '#EF4444',
};

const createStyles = (tokens: any, safeAreaBottom: number) => StyleSheet.create({
  // Container - bg-[#1a1a1a] border-t border-[#2a2a2a] px-4 py-3
  container: {
    backgroundColor: 'transparent',
    paddingTop: 0,
    // לא מוסיפים רווח לפי safe-area כאן – ה-safe למטה נשאר ריק מחוץ לאזור הכתיבה
    paddingBottom: 0,
  },
  
  // Reply Preview - Simple clean card above input
  replyPreviewContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 50, 40, 0.9)',
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderRightColor: COLORS.accent,
  },
  replyAccentBar: {
    // לא בשימוש יותר - הגבול בצד ימין
    display: 'none',
  },
  replyContent: {
    flex: 1,
    marginRight: 8,
  },
  replyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
    marginBottom: 2,
    textAlign: 'right',
  },
  replyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  cancelReply: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelReplyText: {
    fontSize: 18,
    color: COLORS.text.secondary,
  },
  
  // Input Container - flex items-center gap-2
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 7, // עוד נגיעה קטנה בגובה הכללי
    gap: 4,
  },
  
  // Icon Button - p-2 hover:bg-[#2a2a2a] rounded-full
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
  },
  
  // Text Input - bg-[#2a2a2a] rounded-full px-4 py-2.5
  textInput: {
    flex: 1,
    minHeight: 40,      // עוד טיפה גובה לכדור
    maxHeight: 90,
    // יותר שקוף כדי להרגיש "זכוכית" כמו הכרטיסים
    backgroundColor: 'rgba(6, 18, 12, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9, // מעט יותר גובה פנימי
    fontSize: 15,
    color: COLORS.text.primary,
    textAlignVertical: 'center',
    textAlign: 'right',
  },
  
  // Recording Container - Glass design (preview)
  recordingContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 8,
    minHeight: 50,
    overflow: 'hidden',
    position: 'relative',
  },
  recordingContainerActive: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 8,
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 50,
  },
  recordingContent: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    zIndex: 1,
  },
  waveformWrapper: {
    flex: 1,
    minWidth: 0, // מאפשר להתכווץ
    marginLeft: 4, // רווח קטן מהטיימר
  },
  timerAndControlsContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    position: 'relative',
    zIndex: 1,
  },
  playButtonInside: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  timerContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    flexShrink: 0,
    minWidth: 65,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.danger,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  recordingTime: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
    minWidth: 60,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  timelineContainer: {
    flex: 1,
    height: 3,
    position: 'relative',
    marginHorizontal: 4,
    justifyContent: 'center',
    minWidth: 60,
  },
  timelineLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 1,
  },
  timelineDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginRight: -3,
    top: -1.5,
  },
  
  // Send Button - p-2.5 bg-blue-600 rounded-full
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17, // חוזר לקוטר נוח לאייקון 24 ויותר ממורכז
    // צבע "כרטיס" כמו הטאבים ב-MainTabs.tsx (זכוכית כהה)
    backgroundColor: 'rgba(15, 15, 15, 0.5)',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Voice Button - p-2 hover:bg-[#2a2a2a] rounded-full
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  recordingButtons: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  stopButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 209, 87, 0.15)',
  },
  
  uploadingContainer: {
    padding: 12,
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
});

