// ============================================
// Chat Input Component
// ============================================
// שדה הקלדה ושליחת הודעות עם כל התכונות
// ============================================

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Pressable, Text, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import * as ImagePicker from 'expo-image-picker';
import MediaPickerSheet from './MediaPickerSheet';
import PollCreationBottomSheet from './PollCreationBottomSheet';

// ImagePicker media types - using new array format for Expo SDK 52+
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { ChatMessage, ChatMessageType } from '../../types/chat.types';
import { chatMediaService } from '../../services/chat';
import { Ionicons } from '@expo/vector-icons';
import VoiceWaveform from './VoiceWaveform';
import VoiceWaveformWithProgress from './VoiceWaveformWithProgress';
import MediaPreviewModal from './MediaPreviewModal';
import { MediaFile } from '../../services/mediaService';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMentions } from '../../hooks/useMentions';
import MentionPicker from './MentionPicker';
import { logger } from '../../utils/logger';

interface ChatInputProps {
  groupId: string;
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: ChatMessageType, metadata?: { waveformData?: number[];[key: string]: any }) => Promise<void>;
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
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const { addOptimisticMediaMessage, updateOptimisticMessage } = useChat();
  const { user } = useAuth();

  /** על עיגול ירוק: כהה (לא לבן) — בבהיר inverse הוא לבן */
  const micOnGreenColor = isDarkMode
    ? DesignTokens.colors.text.inverse
    : DesignTokens.colors.text.primary;

  const styles = useMemo(() => {
    return createStyles(DesignTokens, insets.bottom);
  }, [DesignTokens, insets.bottom]);

  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  // Mentions hook
  const {
    mentionTokens,
    showMentionPicker,
    mentionSearchQuery,
    insertMention,
    handleInputChange: handleMentionInputChange,
    getMentionRanges,
    closeMentionPicker,
    clearAllMentions,
  } = useMentions(text);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // רמת קול אמיתית
  const [waveformSamples, setWaveformSamples] = useState<number[]>([]); // שמירת ה-waveform data
  const [isUploading, setIsUploading] = useState(false);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);

  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);

  // Media Preview State
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [pollCreationVisible, setPollCreationVisible] = useState(false);


  const textInputRef = useRef<TextInput>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waveformIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewPositionInterval = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingDotOpacity = useRef(new Animated.Value(1)).current;
  const timelineProgress = useRef(new Animated.Value(0)).current;
  const sendBtnScale = useRef(new Animated.Value(1)).current;
  const attachmentIconRotate = useRef(new Animated.Value(0)).current;
  const isStartingRecordingRef = useRef<boolean>(false);
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const [isLocked, setIsLocked] = useState(false);
  const isLockedRef = useRef(false);

  // Callback refs (מונעים closures ישנים ב-handlers)
  const cancelRecordingRef = useRef<() => void>(() => {});
  const stopAndSendRecordingRef = useRef<() => void>(() => {});
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const disabledRef = useRef(disabled);
  const isUploadingRef = useRef(false);
  const textRef = useRef(text);

  const MAX_RECORDING_DURATION = 60; // מקסימום 60 שניות

  const canSend = text.trim().length > 0 || isRecording;

  // אנימציית מעבר בין מיקרופון לשליחה (0 = מיק, 1 = שלח)
  const iconAnim = useRef(new Animated.Value(canSend ? 1 : 0)).current;
  useEffect(() => {
    const showSend = canSend && !isRecording && !isPaused;
    Animated.spring(iconAnim, {
      toValue: showSend ? 1 : 0,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [canSend, isRecording, isPaused]);

  // ============================================
  // Cleanup typing status when unmounting
  // ============================================

  useEffect(() => {
    return () => {
      // נקה timeout ו-שלח stop typing כשיוצאים מהמסך
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (onTyping) {
        onTyping(false);
      }
    };
  }, [onTyping]);

  // הרשאות גלריה/מצלמה מראש – הפicker נפתח מיד בלחיצה
  useEffect(() => {
    ImagePicker.getMediaLibraryPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') ImagePicker.requestMediaLibraryPermissionsAsync().catch((error) => { logger.error('ChatInput', 'Media library permission request error', error); });
    });
    ImagePicker.getCameraPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') ImagePicker.requestCameraPermissionsAsync().catch((error) => { logger.error('ChatInput', 'Camera permission request error', error); });
    });
  }, []);

  // ============================================
  // Handle Text Change
  // ============================================

  const handleTextChange = (newText: string) => {
    const previousText = text;
    setText(newText);

    // Handle mentions (@)
    handleMentionInputChange(newText);

    // Typing indicator
    if (onTyping) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      // אם הטקסט ריק - הפסק להקליד מיד
      if (newText.trim().length === 0) {
        onTyping(false);
        return;
      }

      // יש טקסט - שלח typing status
      onTyping(true);

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  // Handle mention selection
  const handleMentionSelect = (user: { id: string; display: string }) => {
    const newText = insertMention(user);
    if (newText) {
      setText(newText);
    }
  };

  // ============================================
  // Send Text Message
  // ============================================

  const handleSend = async () => {
    const messageText = text.trim();

    if (!messageText || disabled) {
      return;
    }

    // Extract mentions before clearing
    const mentions = getMentionRanges(text);
    const mentionedUserIds = mentions.map(m => m.user_id);

    const textToSend = messageText;
    setText('');
    clearAllMentions(); // Clear mentions after sending

    if (onTyping) {
      onTyping(false);
    }

    // Keep reference to input for refocus
    const inputRef = textInputRef.current;

    try {
      // Send message with mentions
      onSendMessage(textToSend, undefined, undefined, {
        mentioned_users: mentionedUserIds,
        mentions: mentions
      }).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Alert.alert('שגיאה', errorMessage || 'לא הצלחנו לשלוח את ההודעה');
        // Restore text on error
        setText(textToSend);
      });

      // Immediately refocus to keep keyboard open
      inputRef?.focus();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('שגיאה', errorMessage || 'לא הצלחנו לשלוח את ההודעה');
      setText(textToSend);
    }
  };

  // ============================================
  // Send Media with Caption
  // ============================================

  const handleSendMedia = async (mediaFiles: MediaFile[], captions: Record<string, string>) => {
    if (mediaFiles.length === 0 || !user) {
      Alert.alert('שגיאה', 'לא נמצא קובץ מדיה');
      return;
    }

    const MAX_SIZE: Record<string, number> = {
      image: 10 * 1024 * 1024,
      video: 100 * 1024 * 1024,
      audio: 50 * 1024 * 1024,
      document: 50 * 1024 * 1024,
    };

    for (const file of mediaFiles) {
      const limit = MAX_SIZE[file.type] ?? 50 * 1024 * 1024;
      if (file.size && file.size > limit) {
        Alert.alert('שגיאה', `הקובץ ${file.name || ''} גדול מדי (מקסימום ${Math.round(limit / 1024 / 1024)}MB)`);
        return;
      }
    }

    setShowMediaPreview(false);
    setSelectedMedia([]);

    const tempId = `temp-media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get first caption (used for all media in group)
    const firstCaption = Object.values(captions).find(c => c.trim()) || '';

    // Single media - send as IMAGE/VIDEO
    if (mediaFiles.length === 1) {
      const mediaFile = mediaFiles[0];

      let messageType: ChatMessageType;
      switch (mediaFile.type) {
        case 'image': messageType = ChatMessageType.IMAGE; break;
        case 'video': messageType = ChatMessageType.VIDEO; break;
        case 'audio': messageType = ChatMessageType.AUDIO; break;
        default: messageType = ChatMessageType.IMAGE;
      }

      const optimisticMessage: ChatMessage = {
        id: tempId,
        group_id: groupId,
        sender_id: user.id,
        content: firstCaption.trim(),
        message_type: messageType,
        media_url: undefined,
        local_media_uri: mediaFile.uri,
        is_uploading: true,
        upload_progress: 0,
        is_sending: true,
        is_forwarded: false,
        mentioned_users: [],
        is_edited: false,
        is_deleted: false,
        deleted_for_everyone: false,
        is_silent: false,
        is_system_message: false,
        created_at: new Date().toISOString(),
        reactions_count: 0,
        read_by_count: 0,
        sender: {
          id: user.id,
          display_name: user.display_name || 'אני',
          profile_picture: user.profile_picture,
          is_online: true,
        },
      };

      addOptimisticMediaMessage(optimisticMessage);

      setIsUploading(true);
      (async () => {
        try {
          const onProgress = (progress: { progress: number }) => {
            updateOptimisticMessage(tempId, { upload_progress: progress.progress });
          };

          let uploadResult: { url: string | null; error: any };
          if (mediaFile.type === 'image') {
            uploadResult = await chatMediaService.uploadImage(mediaFile.uri, groupId, onProgress);
          } else if (mediaFile.type === 'video') {
            uploadResult = await chatMediaService.uploadVideo(mediaFile.uri, groupId, onProgress);
          } else {
            uploadResult = await chatMediaService.uploadImage(mediaFile.uri, groupId, onProgress);
          }

          if (uploadResult.error || !uploadResult.url) {
            updateOptimisticMessage(tempId, {
              is_uploading: false,
              is_sending: false,
              send_error: uploadResult.error?.message || 'שגיאה בהעלאה'
            });
            return;
          }

          updateOptimisticMessage(tempId, { media_url: uploadResult.url, is_uploading: false, local_media_uri: undefined });

          const metadata: Record<string, any> = { existing_optimistic_id: tempId };
          if ('thumbnail_url' in uploadResult && uploadResult.thumbnail_url) {
            metadata.media_thumbnail_url = uploadResult.thumbnail_url;
          }

          await onSendMessage(firstCaption.trim(), uploadResult.url, messageType, metadata);

        } catch (error: any) {
          updateOptimisticMessage(tempId, {
            is_uploading: false,
            is_sending: false,
            send_error: error?.message || 'שגיאה בהעלאה'
          });
        } finally {
          setIsUploading(false);
        }
      })();
      return;
    }

    // Multiple media - send each as a separate message (like WhatsApp)
    // This avoids the MEDIA_GROUP type that's not in the database constraint

    // Create optimistic messages for each media file
    const optimisticIds: string[] = [];

    for (let i = 0; i < mediaFiles.length; i++) {
      const mediaFile = mediaFiles[i];
      const itemTempId = `temp-media-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
      optimisticIds.push(itemTempId);

      let messageType: ChatMessageType;
      switch (mediaFile.type) {
        case 'image': messageType = ChatMessageType.IMAGE; break;
        case 'video': messageType = ChatMessageType.VIDEO; break;
        case 'audio': messageType = ChatMessageType.AUDIO; break;
        default: messageType = ChatMessageType.IMAGE;
      }

      const optimisticMessage: ChatMessage = {
        id: itemTempId,
        group_id: groupId,
        sender_id: user.id,
        content: i === 0 ? firstCaption.trim() : '', // Only first message gets caption
        message_type: messageType,
        media_url: undefined,
        local_media_uri: mediaFile.uri,
        is_uploading: true,
        upload_progress: 0,
        is_sending: true,
        is_forwarded: false,
        mentioned_users: [],
        is_edited: false,
        is_deleted: false,
        deleted_for_everyone: false,
        is_silent: false,
        is_system_message: false,
        created_at: new Date(Date.now() + i).toISOString(), // Slight offset to maintain order
        reactions_count: 0,
        read_by_count: 0,
        sender: {
          id: user.id,
          display_name: user.display_name || 'אני',
          profile_picture: user.profile_picture,
          is_online: true,
        },
      };

      addOptimisticMediaMessage(optimisticMessage);
    }

    setIsUploading(true);
    (async () => {
      const uploadPromises = mediaFiles.map(async (mediaFile, index) => {
        const itemTempId = optimisticIds[index];

        try {
          const onProgress = (progress: { progress: number }) => {
            updateOptimisticMessage(itemTempId, { upload_progress: progress.progress });
          };

          let uploadResult: { url: string | null; error: any; thumbnail_url?: string | null;[key: string]: any };
          if (mediaFile.type === 'image') {
            uploadResult = await chatMediaService.uploadImage(mediaFile.uri, groupId, onProgress);
          } else if (mediaFile.type === 'video') {
            uploadResult = await chatMediaService.uploadVideo(mediaFile.uri, groupId, onProgress);
          } else {
            uploadResult = await chatMediaService.uploadImage(mediaFile.uri, groupId, onProgress);
          }

          if (uploadResult.error || !uploadResult.url) {
            updateOptimisticMessage(itemTempId, {
              is_uploading: false,
              is_sending: false,
              send_error: uploadResult.error?.message || 'שגיאה בהעלאה'
            });
            return null;
          }

          // עדכון במקום הסרה – מונע flicker
          updateOptimisticMessage(itemTempId, { media_url: uploadResult.url, is_uploading: false, local_media_uri: undefined });

          let messageType: ChatMessageType;
          switch (mediaFile.type) {
            case 'image': messageType = ChatMessageType.IMAGE; break;
            case 'video': messageType = ChatMessageType.VIDEO; break;
            case 'audio': messageType = ChatMessageType.AUDIO; break;
            default: messageType = ChatMessageType.IMAGE;
          }

          const metadata: Record<string, any> = { existing_optimistic_id: itemTempId };
          if ('thumbnail_url' in uploadResult && uploadResult.thumbnail_url) {
            metadata.media_thumbnail_url = uploadResult.thumbnail_url;
          }

          await onSendMessage(
            index === 0 ? firstCaption.trim() : '', // Only first message gets caption
            uploadResult.url,
            messageType,
            metadata
          );

          return uploadResult.url;

        } catch (error: any) {
          updateOptimisticMessage(itemTempId, {
            is_uploading: false,
            is_sending: false,
            send_error: error?.message || 'שגיאה בהעלאה'
          });
          return null;
        }
      });

      await Promise.all(uploadPromises);
      setIsUploading(false);
    })();
  };

  // ============================================
  // Pick Image
  // ============================================

  const handlePickImage = async () => {
    try {
      const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

      if (currentStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('הרשאה נדרשת', 'אנא אפשר גישה לגלריה');
          return;
        }
      }

      // ⚡ quality 0.8 = החזרה מהירה מהמערכת + תמונה יפה
      let result;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: 10,
          quality: 0.8,
          exif: false,
        });
      } catch (launchError) {
        Alert.alert('שגיאה', 'לא הצלחנו לפתוח את הגלריה');
        return;
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const mediaFiles: MediaFile[] = result.assets.map((asset, index) => ({
          id: `${Date.now()}_${index}`,
          uri: asset.uri,
          type: 'image' as const,
          name: asset.fileName || `image_${index + 1}.jpg`,
          size: asset.fileSize,
          width: asset.width,
          height: asset.height,
        }));
        // ⚡ Show preview IMMEDIATELY
        setSelectedMedia(mediaFiles);
        setShowMediaPreview(true);
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו לבחור תמונה');
    }
  };

  // ============================================
  // Take Photo
  // ============================================

  const handleTakePhoto = async () => {
    try {
      // Check permission status first (fast) - only request if not determined
      const { status: currentStatus } = await ImagePicker.getCameraPermissionsAsync();

      if (currentStatus !== 'granted') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('הרשאה נדרשת', 'אנא אפשר גישה למצלמה');
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mediaFile: MediaFile = {
          id: Date.now().toString(),
          uri: asset.uri,
          type: 'image',
          name: asset.fileName || 'photo.jpg',
          size: asset.fileSize,
        };
        // Set media and show preview immediately
        setSelectedMedia([mediaFile]);
        setShowMediaPreview(true);
      }
    } catch (error) {
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
        copyToCacheDirectory: false, // ⚡ מהיר יותר – לא להעתיק, להשתמש ב-URI המקורי
      });

      if (!result.canceled && result.assets[0] && user) {
        const asset = result.assets[0];
        const fileName = asset.name || 'document';
        const fileSize = asset.size || 0;
        const tempId = `temp-doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create optimistic message immediately
        const optimisticMessage: ChatMessage = {
          id: tempId,
          group_id: groupId,
          sender_id: user.id,
          content: '',
          message_type: ChatMessageType.DOCUMENT,
          media_url: undefined,
          local_media_uri: asset.uri,
          media_file_name: fileName,
          media_size: fileSize,
          is_uploading: true,
          upload_progress: 0,
          is_sending: true,
          is_forwarded: false,
          mentioned_users: [],
          is_edited: false,
          is_deleted: false,
          deleted_for_everyone: false,
          is_silent: false,
          is_system_message: false,
          created_at: new Date().toISOString(),
          reactions_count: 0,
          read_by_count: 0,
          sender: {
            id: user.id,
            display_name: user.display_name || 'אני',
            profile_picture: user.profile_picture,
            is_online: true,
          },
        };

        // Add optimistic message immediately - user sees it right away!
        addOptimisticMediaMessage(optimisticMessage);

        setIsUploading(true);
        (async () => {
          try {
            const uploadResult = await chatMediaService.uploadDocument(
              asset.uri,
              fileName,
              groupId,
              (progress) => {
                updateOptimisticMessage(tempId, { upload_progress: progress.progress });
              }
            );

            if (uploadResult.error || !uploadResult.url) {
              updateOptimisticMessage(tempId, {
                is_uploading: false,
                is_sending: false,
                send_error: uploadResult.error?.message || 'שגיאה בהעלאה'
              });
              return;
            }

            updateOptimisticMessage(tempId, { media_url: uploadResult.url, is_uploading: false, local_media_uri: undefined });

            await onSendMessage('', uploadResult.url, ChatMessageType.DOCUMENT, {
              existing_optimistic_id: tempId,
              media_file_name: fileName,
              media_size: fileSize,
            });
          } catch (error: any) {
            updateOptimisticMessage(tempId, {
              is_uploading: false,
              is_sending: false,
              send_error: error?.message || 'שגיאה בהעלאה'
            });
          } finally {
            setIsUploading(false);
          }
        })();
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו לבחור מסמך');
    }
  };

  // Create Poll
  // ============================================
  const handleCreatePoll = () => {
    setMediaPickerVisible(false);
    // ⚡ ללא השהייה – פתיחה מיידית
    setPollCreationVisible(true);
  };

  const handlePollCreated = (_poll: any) => {
    // הסקר יוצג אוטומטית בצ'אט דרך PollService.createPollMessage
    setPollCreationVisible(false);
  };

  // Handle Audio from Media Picker
  // ============================================
  const handleStartAudioRecording = async () => {
    setMediaPickerVisible(false);
    requestAnimationFrame(() => startRecording({ openInLockedMode: true }));
  };

  // ============================================
  // Record Audio
  // ============================================

  const startRecording = async (opts?: { openInLockedMode?: boolean }) => {
    if (isStartingRecordingRef.current) {
      return;
    }

    if (isRecording || isPaused) {
      return;
    }

    isStartingRecordingRef.current = true;

    try {
      // נקה הקלטה קודמת אם יש
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (error) {
          logger.error('ChatInput', 'Recording error', error);
        }
        recordingRef.current = null;
      }

      // נקה גם sound אם יש
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (error) {
          logger.error('ChatInput', 'Recording error', error);
        }
        soundRef.current = null;
      }

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

      // יצירת recording חדש
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      setAudioLevel(0);
      setWaveformSamples([]); // איפוס ה-waveform data
      timelineProgress.setValue(0); // איפוס הטיימליין

      pulseAnimationRef.current?.stop();
      const pulseAnim = Animated.loop(
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
      pulseAnimationRef.current = pulseAnim;
      pulseAnim.start();

      if (opts?.openInLockedMode) {
        setIsLocked(true);
        isLockedRef.current = true;
      }

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          // עדכן את הטיימליין
          const progress = Math.min(newDuration / MAX_RECORDING_DURATION, 1);
          timelineProgress.setValue(progress);
          return newDuration;
        });
      }, 1000);

      // עדכן waveforms כל 50ms בזמן אמת
      // גם מציג את האנימציה וגם שומר samples עבור ההודעה
      waveformIntervalRef.current = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              // קבל metering data אם זמין
              const metering = (status as any).metering;
              let normalizedValue: number;

              if (metering !== undefined && typeof metering === 'number') {
                // נרמול רגיש יותר - metering בדרך כלל בין -60 ל-0 dB
                // טווח רגישות: -35 עד 0 dB (רגיש יותר לקולות חלשים)
                // ואז עקומת power לעשות את ההבדלים יותר בולטים
                const clamped = Math.max(-35, Math.min(0, metering));
                const linear = (clamped + 35) / 35; // 0 to 1
                // Apply power curve to make differences more visible
                normalizedValue = Math.pow(linear, 0.7); // 0.7 power = more sensitive
                // Ensure minimum of 0.15 and max of 1.0
                normalizedValue = 0.15 + normalizedValue * 0.85;
              } else {
                // אם אין metering, צור ערכים אקראיים עם וריאציה
                const base = 0.25;
                const variation = Math.random() * 0.75;
                normalizedValue = base + variation;
              }

              // עדכון רמת הקול לאנימציה חיה
              setAudioLevel(normalizedValue);

              // שמירת sample עבור ה-waveform של ההודעה (מקסימום 100 samples)
              setWaveformSamples(prev => {
                if (prev.length < 100) {
                  return [...prev, normalizedValue];
                }
                // אם יש יותר מ-100, החלף כל sample שני
                const newSamples = [...prev];
                newSamples[Math.floor(Math.random() * 100)] = normalizedValue;
                return newSamples;
              });
            }
          }
        } catch (error) {
          logger.error('ChatInput', 'Recording error', error);
        }
      }, 50);

      isStartingRecordingRef.current = false; // איפוס ה-flag אחרי הצלחה
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו להתחיל הקלטה');
      isStartingRecordingRef.current = false; // איפוס ה-flag גם במקרה של שגיאה

      // נקה את recordingRef אם יש
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (cleanupError) {
          logger.error('ChatInput', 'Recording error', cleanupError);
        }
        recordingRef.current = null;
      }
    }
  };

  // השהיית הקלטה (pause) - ממשיך מאיפה שעצרנו
  const pauseRecording = async () => {
    try {
      if (!recordingRef.current) {
        return;
      }

      // Pause the recording
      await recordingRef.current.pauseAsync();

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

      setIsRecording(false);
      setIsPaused(true);
      setAudioLevel(0);

      pulseAnimationRef.current?.stop();
      pulseAnimationRef.current = null;
      recordingDotOpacity.setValue(1);
    } catch (error) {
      logger.error('ChatInput', 'Recording error', error);
    }
  };

  // המשך הקלטה אחרי pause
  const resumeRecording = async () => {
    try {
      if (!recordingRef.current) {
        // אם אין הקלטה פעילה, התחל מחדש
        await startRecording({ openInLockedMode: true });
        return;
      }

      // Resume the recording
      await recordingRef.current.startAsync();

      setIsRecording(true);
      setIsPaused(false);

      pulseAnimationRef.current?.stop();
      const pulseAnim = Animated.loop(
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
      pulseAnimationRef.current = pulseAnim;
      pulseAnim.start();

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          const progress = Math.min(newDuration / MAX_RECORDING_DURATION, 1);
          timelineProgress.setValue(progress);
          return newDuration;
        });
      }, 1000);

      // Restart waveform updates
      waveformIntervalRef.current = setInterval(async () => {
        try {
          if (recordingRef.current) {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording) {
              const metering = (status as any).metering;
              let normalizedValue: number;

              if (metering !== undefined && typeof metering === 'number') {
                const clamped = Math.max(-35, Math.min(0, metering));
                const linear = (clamped + 35) / 35;
                normalizedValue = Math.pow(linear, 0.7);
                normalizedValue = 0.15 + normalizedValue * 0.85;
              } else {
                const base = 0.25;
                const variation = Math.random() * 0.75;
                normalizedValue = base + variation;
              }

              setAudioLevel(normalizedValue);

              setWaveformSamples(prev => {
                if (prev.length < 100) {
                  return [...prev, normalizedValue];
                }
                const newSamples = [...prev];
                newSamples[Math.floor(Math.random() * 100)] = normalizedValue;
                return newSamples;
              });
            }
          }
        } catch (error) {
          logger.error('ChatInput', 'Recording error', error);
        }
      }, 50);
    } catch (error) {
      logger.error('ChatInput', 'Recording error', error);
      Alert.alert('שגיאה', 'לא הצלחנו להמשיך את ההקלטה');
    }
  };

  // סיום הקלטה ושמירה לשליחה
  const stopRecording = async () => {
    try {
      pulseAnimationRef.current?.stop();
      pulseAnimationRef.current = null;
      recordingDotOpacity.setValue(1);

      if (!recordingRef.current) {
        setIsPaused(true);
        setIsRecording(false);
        return;
      }

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

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
      logger.error('ChatInput', 'Recording error', error);
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
      logger.error('ChatInput', 'Playback error', error);
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
    if (!recordedAudioUri || !user) return;

    const tempId = `temp-audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const audioUri = recordedAudioUri;
    const duration = recordingDuration;
    const waveform = normalizeWaveformSamples(waveformSamples, 20);

    // Create optimistic message immediately
    const optimisticMessage: ChatMessage = {
      id: tempId,
      group_id: groupId,
      sender_id: user.id,
      content: '',
      message_type: ChatMessageType.AUDIO,
      media_url: undefined,
      local_media_uri: audioUri,
      media_duration: duration,
      is_uploading: true,
      upload_progress: 0,
      is_sending: true,
      is_forwarded: false,
      mentioned_users: [],
      is_edited: false,
      is_deleted: false,
      deleted_for_everyone: false,
      is_silent: false,
      is_system_message: false,
      created_at: new Date().toISOString(),
      reactions_count: 0,
      read_by_count: 0,
      sender: {
        id: user.id,
        display_name: user.display_name || 'אני',
        profile_picture: user.profile_picture,
        is_online: true,
      },
    };

    // Add optimistic message immediately - user sees it right away!
    addOptimisticMediaMessage(optimisticMessage);

    // נקה את ההקלטה מיד כדי שה-UI יתעדכן
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch((error) => { logger.error('ChatInput', 'Playback error', error); });
      soundRef.current = null;
    }
    if (previewPositionInterval.current) {
      clearInterval(previewPositionInterval.current);
      previewPositionInterval.current = null;
    }
    setRecordedAudioUri(null);
    setRecordingDuration(0);
    setWaveformSamples([]);
    setIsPaused(false);
    setIsPlayingPreview(false);
    setPreviewPosition(0);

    setIsUploading(true);
    (async () => {
      try {
        const uploadResult = await chatMediaService.uploadAudio(
          audioUri,
          groupId,
          duration,
          (progress) => {
            updateOptimisticMessage(tempId, { upload_progress: progress.progress });
          }
        );

        if (uploadResult.error || !uploadResult.url) {
          updateOptimisticMessage(tempId, {
            is_uploading: false,
            is_sending: false,
            send_error: uploadResult.error?.message || 'שגיאה בהעלאה'
          });
          return;
        }

        updateOptimisticMessage(tempId, { media_url: uploadResult.url, is_uploading: false, local_media_uri: undefined });

        await onSendMessage('', uploadResult.url, ChatMessageType.AUDIO, {
          existing_optimistic_id: tempId,
          waveformData: waveform,
          media_duration: duration,
        });
      } catch (error: any) {
        updateOptimisticMessage(tempId, {
          is_uploading: false,
          is_sending: false,
          send_error: error?.message || 'שגיאה בהעלאה'
        });
      } finally {
        setIsUploading(false);
      }
    })();
  };

  // פונקציה לנרמול ה-waveform samples למספר קבוע
  // לוקח את המקסימום מכל חלון כדי לשמר את הפיקים
  const normalizeWaveformSamples = (samples: number[], targetCount: number): number[] => {
    if (samples.length === 0) return Array(targetCount).fill(0.3);
    if (samples.length <= targetCount) {
      // Pad with existing values if not enough
      const padded = [...samples];
      while (padded.length < targetCount) {
        padded.push(samples[padded.length % samples.length]);
      }
      return padded;
    }

    const result: number[] = [];
    const windowSize = samples.length / targetCount;

    for (let i = 0; i < targetCount; i++) {
      const start = Math.floor(i * windowSize);
      const end = Math.floor((i + 1) * windowSize);

      // Take the maximum value in this window to preserve peaks
      let maxValue = 0;
      for (let j = start; j < end && j < samples.length; j++) {
        maxValue = Math.max(maxValue, samples[j]);
      }
      result.push(maxValue);
    }

    // Enhance contrast - find min/max and stretch
    const minVal = Math.min(...result);
    const maxVal = Math.max(...result);
    const range = maxVal - minVal;

    if (range > 0.1) {
      // Stretch to 0.2-1.0 range for better visibility
      return result.map(v => 0.2 + ((v - minVal) / range) * 0.8);
    }

    return result;
  };

  const cancelRecording = () => {
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }
    pulseAnimationRef.current?.stop();
    pulseAnimationRef.current = null;
    recordingDotOpacity.setValue(1);

    // עצור שמיעה אם יש
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch((error) => { logger.error('ChatInput', 'Playback error', error); });
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
    setIsLocked(false);
    isLockedRef.current = false;
    timelineProgress.setValue(0);

    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch((error) => { logger.error('ChatInput', 'Recording error', error); });
      recordingRef.current = null;
    }
  };

  // ============================================
  // שליחת הקלטה מממשק נעול (כפתור שליחה)
  // ============================================

  const stopAndSendRecording = async () => {
    try {
      pulseAnimationRef.current?.stop();
      pulseAnimationRef.current = null;
      recordingDotOpacity.setValue(1);

      if (!recordingRef.current) return;

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (waveformIntervalRef.current) {
        clearInterval(waveformIntervalRef.current);
        waveformIntervalRef.current = null;
      }

      const uri = recordingRef.current.getURI();
      const duration = recordingDuration;
      const samples = [...waveformSamples];
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      setIsRecording(false);
      setIsPaused(false);
      setAudioLevel(0);
      setRecordingDuration(0);
      setWaveformSamples([]);
      timelineProgress.setValue(0);

      if (uri && duration >= 1 && user) {
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
          id: tempId,
          group_id: groupId,
          content: JSON.stringify({ duration, waveformData: samples }),
          message_type: ChatMessageType.AUDIO,
          sender_id: user.id,
          is_uploading: true,
          upload_progress: 0,
          is_sending: true,
          is_forwarded: false,
          mentioned_users: [],
          is_edited: false,
          is_deleted: false,
          deleted_for_everyone: false,
          is_silent: false,
          is_system_message: false,
          created_at: new Date().toISOString(),
          reactions_count: 0,
          read_by_count: 0,
          sender: {
            id: user.id,
            display_name: user.display_name || 'אני',
            profile_picture: user.profile_picture,
            is_online: true,
          },
        };
        addOptimisticMediaMessage(optimisticMessage);

        setIsUploading(true);
        (async () => {
          try {
            const uploadResult = await chatMediaService.uploadAudio(
              uri, groupId, duration,
              (progress) => updateOptimisticMessage(tempId, { upload_progress: progress.progress })
            );
            if (uploadResult.error || !uploadResult.url) {
              updateOptimisticMessage(tempId, { is_uploading: false, is_sending: false, send_error: uploadResult.error?.message || 'שגיאה בהעלאה' });
            } else {
              await onSendMessage(
                JSON.stringify({ duration, waveformData: samples }),
                uploadResult.url,
                ChatMessageType.AUDIO,
                { waveformData: samples, media_duration: duration, existing_optimistic_id: tempId }
              );
            }
          } catch (e) {
            logger.error('ChatInput', 'Hold-to-record send error', e);
            updateOptimisticMessage(tempId, { is_uploading: false, is_sending: false, send_error: 'שגיאה בשליחה' });
          } finally {
            setIsUploading(false);
          }
        })();
      }
    } catch (error) {
      logger.error('ChatInput', 'stopAndSendRecording error', error);
      setIsRecording(false);
    }
  };

  // Keep callback refs in sync (runs every render, no deps needed)
  useEffect(() => {
    cancelRecordingRef.current = cancelRecording;
    stopAndSendRecordingRef.current = stopAndSendRecording;
    isRecordingRef.current = isRecording;
    isPausedRef.current = isPaused;
    disabledRef.current = disabled;
    isUploadingRef.current = isUploading;
    textRef.current = text;
  });

  /** לחיצה קצרה על המיקרופון → הקלטה + ממשק נעול (השהה / ביטול / שליחה) */
  const handleMicTapToRecord = () => {
    if (
      isRecordingRef.current ||
      isPausedRef.current ||
      disabledRef.current ||
      isUploadingRef.current ||
      textRef.current.trim().length > 0
    ) {
      return;
    }
    void startRecording({ openInLockedMode: true });
  };

  // ============================================
  // Show Attachment Options
  // ============================================

  const handlePickVideo = async () => {
    try {
      const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

      if (currentStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('הרשאה נדרשת', 'אנא אפשר גישה לגלריה');
          return;
        }
      }

      let result;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          allowsMultipleSelection: true,
          selectionLimit: 5,
          quality: 0.9,
          videoQuality: 1,
        });
      } catch (launchError) {
        Alert.alert('שגיאה', 'לא הצלחנו לפתוח את הגלריה');
        return;
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const mediaFiles: MediaFile[] = result.assets.map((asset, index) => ({
          id: `${Date.now()}_${index}`,
          uri: asset.uri,
          type: 'video' as const,
          name: asset.fileName || `video_${index + 1}.mp4`,
          size: asset.fileSize,
          duration: asset.duration ?? undefined,
          width: asset.width,
          height: asset.height,
        }));
        // ⚡ Show preview IMMEDIATELY
        setSelectedMedia(mediaFiles);
        setShowMediaPreview(true);
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו לבחור סרטון');
    }
  };

  const showAttachmentOptions = () => {
    attachmentIconRotate.setValue(0);
    Animated.sequence([
      Animated.timing(attachmentIconRotate, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(attachmentIconRotate, {
        toValue: 0,
        friction: 6,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch((error) => { logger.error('ChatInput', 'Recording error', error); });
        recordingRef.current = null;
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((error) => { logger.error('ChatInput', 'Playback error', error); });
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
      pulseAnimationRef.current?.stop();
      pulseAnimationRef.current = null;
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
          <View style={styles.replyPreviewBar} />
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel}>תשובה ל-{replyTo.senderName}</Text>
            <Text style={styles.replyText} numberOfLines={1}>{replyTo.content || 'מדיה'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onCancelReply?.()}
            style={styles.cancelReply}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={DesignTokens.colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.container}>
        {/* Input Container - glass pill */}
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="none"
          style={styles.inputCardOuter}
          contentContainerStyle={styles.inputCardContent}
        >
          {/* Attachment Button - hidden during recording */}
          {!isRecording && !isPaused && (
            <TouchableOpacity
              onPress={showAttachmentOptions}
              style={styles.iconButton}
              disabled={disabled || isUploading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="צירוף מדיה"
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: attachmentIconRotate.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '45deg'],
                      }),
                    },
                  ],
                }}
              >
                <Ionicons name="add" size={28} color={DesignTokens.colors.text.secondary} />
              </Animated.View>
            </TouchableOpacity>
          )}

          {/* Text Input or Recording UI */}
          {(isRecording || (isPaused && !recordedAudioUri)) ? (
            /* שורה אחת: משמאל עצירה+מחיקה · במרכז זמן+גלים · מימין שליחה */
            <View style={styles.recordingRowFull}>
              <View style={styles.recordingLeftCluster}>
                <TouchableOpacity onPress={cancelRecording} style={styles.cancelButton} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={20} color={DesignTokens.colors.text.danger} />
                </TouchableOpacity>
                {isRecording ? (
                  <TouchableOpacity onPress={pauseRecording} style={styles.pauseResumeButton} activeOpacity={0.7}>
                    <Ionicons name="pause" size={20} color={DesignTokens.colors.text.primary} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={resumeRecording} style={styles.pauseResumeButton} activeOpacity={0.7}>
                    <Ionicons name="mic" size={20} color={DesignTokens.colors.text.primary} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.recordingCenterCluster}>
                <View style={styles.waveformWrapper}>
                  <VoiceWaveform isRecording={isRecording} audioLevel={audioLevel} />
                </View>
                <View style={styles.timerContainer}>
                  <Text style={styles.recordingTime}>{formatRecordingTime(recordingDuration)}</Text>
                  {isRecording ? (
                    <Animated.View style={[styles.recordingDot, { opacity: recordingDotOpacity }]} />
                  ) : (
                    <View style={[styles.recordingDot, { backgroundColor: '#888' }]} />
                  )}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setIsLocked(false);
                  isLockedRef.current = false;
                  if (recordedAudioUri) {
                    sendRecordedAudio();
                  } else {
                    stopAndSendRecording();
                  }
                }}
                style={styles.sendButton}
                disabled={isUploading}
                activeOpacity={0.7}
              >
                <Ionicons name="send" size={24} color={DesignTokens.colors.text.inverse} />
              </TouchableOpacity>
            </View>
          ) : isPaused && recordedAudioUri ? (
            /* תצוגה לפני שליחה — אותה לוגיקה: שמאל ניגון+מחיקה · מרכז זמן+גלים · ימין שליחה */
            <View style={styles.recordingRowFull}>
              <View style={styles.recordingLeftCluster}>
                <TouchableOpacity onPress={cancelRecording} style={styles.cancelButton} activeOpacity={0.7}>
                  <Ionicons name="trash-outline" size={20} color={DesignTokens.colors.text.danger} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={isPlayingPreview ? pausePreview : playPreview}
                  style={styles.playButtonInside}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isPlayingPreview ? 'pause' : 'play'}
                    size={18}
                    color={DesignTokens.colors.primary.main}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.recordingCenterCluster}>
                <View style={styles.waveformPreviewWrapper}>
                  <VoiceWaveformWithProgress
                    progress={timelineProgress}
                    duration={previewDuration}
                    isPlaying={isPlayingPreview}
                    waveformData={waveformSamples}
                  />
                </View>
                <View style={styles.timerContainer}>
                  <Text style={styles.recordingTime}>{formatRecordingTime(recordingDuration)}</Text>
                  {isPlayingPreview ? (
                    <Animated.View style={[styles.recordingDot, { opacity: recordingDotOpacity }]} />
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setIsLocked(false);
                  isLockedRef.current = false;
                  if (recordedAudioUri) {
                    sendRecordedAudio();
                  } else {
                    stopAndSendRecording();
                  }
                }}
                style={styles.sendButton}
                disabled={isUploading}
                activeOpacity={0.7}
              >
                <Ionicons name="send" size={24} color={DesignTokens.colors.text.inverse} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                ref={textInputRef}
                style={styles.textInput}
                placeholder={isUploading ? 'מעלה...' : 'הקלד הודעה...'}
                placeholderTextColor={DesignTokens.colors.text.secondary}
                value={text}
                onChangeText={handleTextChange}
                multiline
                numberOfLines={2}
                maxLength={10000}
                editable={!disabled && !isUploading}
                blurOnSubmit={false}
              />
              {/* L2: character counter – only shown when approaching the limit */}
              {text.length > 8000 && (
                <Text style={[
                  styles.charCounter,
                  text.length > 9500 && styles.charCounterDanger,
                ]}>
                  {10000 - text.length}
                </Text>
              )}
            </>
          )}
          {/* במצב נעול כל הבקרות בשורת ההקלטה המרכזית — כאן רק מיקרופון/שליחה כשאין הקלטה */}
          {!isLocked ? (
            <View
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
                zIndex: 2,
                elevation: 2,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* רקע ירוק קבוע — לא בתוך אנימציית opacity (שהייתה מעיפה את הירוק) */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.sendButton,
                    {
                      position: 'absolute',
                      width: 40,
                      height: 40,
                      left: 2,
                      top: 2,
                    },
                  ]}
                />

                <Animated.View
                  pointerEvents={text.trim().length === 0 ? 'auto' : 'none'}
                  style={{
                    position: 'absolute',
                    width: 44,
                    height: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: iconAnim.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' }),
                    transform: [
                      { scale: iconAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5], extrapolate: 'clamp' }) },
                      { rotate: iconAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-30deg'], extrapolate: 'clamp' }) },
                    ],
                  }}
                >
                  <Pressable
                    onPress={handleMicTapToRecord}
                    disabled={disabled || isUploading}
                    accessibilityRole="button"
                    accessibilityLabel="הקלטת הודעה קולית"
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      justifyContent: 'center',
                      alignItems: 'center',
                      opacity: pressed && !disabled && !isUploading ? 0.88 : 1,
                    })}
                  >
                    <Ionicons name="mic-outline" size={26} color={micOnGreenColor} />
                  </Pressable>
                </Animated.View>

                <Animated.View
                  pointerEvents={text.trim().length > 0 ? 'auto' : 'none'}
                  style={{
                    position: 'absolute',
                    width: 44,
                    height: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: iconAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
                    transform: [
                      { scale: iconAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1], extrapolate: 'clamp' }) },
                      { rotate: iconAnim.interpolate({ inputRange: [0, 1], outputRange: ['30deg', '0deg'], extrapolate: 'clamp' }) },
                    ],
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      Animated.sequence([
                        Animated.timing(sendBtnScale, { toValue: 0.82, duration: 70, useNativeDriver: true }),
                        Animated.spring(sendBtnScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
                      ]).start();
                      handleSend();
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: 'transparent',
                    }}
                    disabled={disabled || isUploading || text.trim().length === 0}
                    activeOpacity={1}
                  >
                    <Animated.View style={{ transform: [{ scale: sendBtnScale }] }}>
                      <Ionicons name="send" size={24} color={DesignTokens.colors.text.inverse} />
                    </Animated.View>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          ) : null}
        </UICard>

        {/* Uploading indicator removed – upload progress is shown on the optimistic message itself */}
      </View>

      {/* Media Preview Modal */}
      {showMediaPreview && selectedMedia.length > 0 && (
        <MediaPreviewModal
          visible={showMediaPreview}
          onClose={() => {
            setShowMediaPreview(false);
            setSelectedMedia([]);
          }}
          onSend={handleSendMedia}
          mediaFiles={selectedMedia}
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

      {/* Mention Picker */}
      <MentionPicker
        visible={showMentionPicker && !isRecording}
        onClose={closeMentionPicker}
        onSelectUser={handleMentionSelect}
        groupId={groupId}
        searchQuery={mentionSearchQuery}
      />
    </>
  );
}

// ============================================
// Styles - Modern Design from Reference
// ============================================

const createStyles = (tokens: any, safeAreaBottom: number) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingTop: 2,
    paddingBottom: Math.max(tokens.spacing.xs, safeAreaBottom > 0 ? 4 : 2),
    gap: 0,
  },

  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: tokens.colors.border.divider,
    marginHorizontal: tokens.spacing.xs,
    marginBottom: tokens.spacing.sm,
    paddingVertical: tokens.spacing.sm + 2,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.borderRadius.lg,
    overflow: 'hidden',
  },
  /** כמו replyBar בבועת הודעה – פס אנכי ישר, לא בורדר מעוגל */
  replyPreviewBar: {
    width: 3,
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 1.5,
    marginLeft: 8,
    flexShrink: 0,
    minHeight: 24,
    alignSelf: 'stretch',
  },
  replyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replyLabel: {
    fontSize: tokens.typography.label.size,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.primary.main,
    marginBottom: 2,
    textAlign: 'right',
  },
  replyText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
  },
  cancelReply: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.colors.border.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  cancelReplyText: {
    fontSize: 18,
    color: tokens.colors.text.secondary,
  },

  /** רדיוס בלבד — רקע/מסגרת מגיעים מ־UICard variant="glass" */
  inputCardOuter: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
  },
  inputCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.sm + 1,
    paddingVertical: tokens.spacing.xs + 1,
    gap: tokens.spacing.xs,
    minHeight: 52,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 88,
    paddingHorizontal: tokens.spacing.md - 2,
    paddingVertical: tokens.spacing.sm - 1,
    fontSize: tokens.typography.body.size,
    color: tokens.colors.text.primary,
    textAlignVertical: 'center',
    textAlign: 'right',
  },
  charCounter: {
    position: 'absolute',
    bottom: 4,
    left: 8,
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.tertiary,
  },
  charCounterDanger: {
    color: tokens.colors.text.danger,
    fontWeight: tokens.typography.fontWeight.semibold,
  },

  /** שורת הקלטה: שמאל עצירה+מחיקה · מרכז זמן+גלים · ימין שליחה (ltr כדי שיתאים למסך) */
  recordingRowFull: {
    flex: 1,
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    minWidth: 0,
  },
  recordingLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  recordingCenterCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  waveformWrapper: {
    flex: 1,
    minWidth: 0,
    height: 24,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  waveformPreviewWrapper: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  playButtonInside: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.border.primary,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.text.danger,
    shadowColor: tokens.colors.text.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  recordingTime: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
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
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 1,
  },
  timelineDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.primary.main,
    marginRight: -3,
    top: -1.5,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    /** ירוק מותג מלא — לא צבע בועה (הבועה עדינה; הכפתור נשאר “פעמון”) */
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  pauseResumeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.border.hover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.border.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  uploadingContainer: {
    padding: 12,
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
  },
});

