// ============================================
// Chat Input Component
// ============================================
// שדה הקלדה ושליחת הודעות עם כל התכונות
// ============================================

import React, { useState, useRef, useMemo, useEffect, useCallback, memo } from 'react';
import { View, TextInput, TouchableOpacity, Pressable, Text, StyleSheet, Alert, Animated, Easing, Platform, Keyboard } from 'react-native';
import { chatInputBottomPadding, CHAT_COMPOSER_NATIVE_ID } from './chatInputLayout';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import MediaPickerSheet from './MediaPickerSheet';
import ChatComposerBar from './ChatComposerBar';
import { runAfterSheetDismiss } from './mediaPickerLaunch';
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
import { useChatActions } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMentions } from '../../hooks/useMentions';
import { useChatDraft } from '../../hooks/useChatDraft';
import { useTypingBroadcast } from '../../hooks/useTypingBroadcast';
import MentionPicker from './MentionPicker';
import { logger } from '../../utils/logger';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  resampleWaveformSamples,
  WAVEFORM_STORE_BARS,
  WAVEFORM_SILENCE,
} from '../../utils/waveformSamples';
import { meteringDbToLevel, resolveMessageWaveform } from '../../utils/audioWaveformPeaks';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

/**
 * iOS: WAV/PCM — חילוץ peaks אמיתיים מהקובץ אחרי עצירה.
 * Android: AAC/m4a — fallback ל־metering envelope (MediaRecorder לא תומך WAV).
 */
const VOICE_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

/**
 * חימום cache של expo-image ברגע שיש URI מקומי — כדי שהפריוויו יציג מיידית
 * במקום לפענח את הקובץ בזמן ה-mount.
 *
 * מנותק לחלוטין מזרימת הבחירה: מופעל דרך microtask ועטוף ב-catch, כך שגם אם
 * prefetch נכשל או נתקע (למשל ב-Expo Go) — פתיחת הפריוויו לעולם לא נחסמת.
 */
function warmImageCache(uris: string[]): void {
  if (uris.length === 0) return;
  void Promise.resolve()
    .then(() => ExpoImage.prefetch(uris, { cachePolicy: 'memory-disk' }))
    .catch(() => {
      /* best effort — נכשל בשקט, הפריוויו עדיין יטען מה-uri */
    });
}

/**
 * יוצר thumbnail מקומי קטן לתמונות (כמו poster של וידאו) — לא חוסם את פתיחת הפריוויו.
 * כשמוכן, מעדכן את selectedMedia כדי שהמודאל/בועה יציגו thumb מיידי.
 */
function attachLocalImageThumbs(
  files: MediaFile[],
  setMedia: React.Dispatch<React.SetStateAction<MediaFile[]>>,
): void {
  const needsThumb = files.filter((f) => f.type === 'image' && !f.thumbnail_url);
  if (needsThumb.length === 0) return;

  void Promise.all(
    needsThumb.map(async (f) => {
      const thumb = await chatMediaService.createLocalImageThumbnail(f.uri);
      return thumb ? { id: f.id, thumb } : null;
    }),
  )
    .then((results) => {
      const byId = new Map<string, string>();
      for (const r of results) {
        if (r) byId.set(r.id, r.thumb);
      }
      if (byId.size === 0) return;
      setMedia((prev) =>
        prev.map((f) => (byId.has(f.id) ? { ...f, thumbnail_url: byId.get(f.id) } : f)),
      );
      warmImageCache([...byId.values()]);
    })
    .catch(() => {
      /* best effort */
    });
}

/** פריים מקומי לסרטונים — בלי זה הבועה נשארת שחורה עד שהשרת/runtime מסיימים */
function attachLocalVideoThumbs(
  files: MediaFile[],
  setMedia: React.Dispatch<React.SetStateAction<MediaFile[]>>,
): void {
  const needsThumb = files.filter((f) => f.type === 'video' && !f.thumbnail_url);
  if (needsThumb.length === 0) return;

  void Promise.all(
    needsThumb.map(async (f) => {
      const thumb = await chatMediaService.createLocalVideoThumbnail(f.uri);
      return thumb ? { id: f.id, thumb } : null;
    }),
  )
    .then((results) => {
      const byId = new Map<string, string>();
      for (const r of results) {
        if (r) byId.set(r.id, r.thumb);
      }
      if (byId.size === 0) return;
      setMedia((prev) =>
        prev.map((f) => (byId.has(f.id) ? { ...f, thumbnail_url: byId.get(f.id) } : f)),
      );
      warmImageCache([...byId.values()]);
    })
    .catch(() => {
      /* best effort */
    });
}

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

function ChatInputImpl({
  groupId,
  onSendMessage,
  onTyping,
  replyTo,
  onCancelReply,
  disabled = false,
}: ChatInputProps) {
  const DesignTokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const { addOptimisticMediaMessage, updateOptimisticMessage } = useChatActions();
  const { user } = useAuth();

  /** על עיגול ירוק: כהה (לא לבן) — בבהיר inverse הוא לבן */
  const micOnGreenColor = isDarkMode
    ? DesignTokens.colors.text.inverse
    : DesignTokens.colors.text.primary;

  const inputBottomPadding = chatInputBottomPadding(
    Math.max(DesignTokens.spacing.sm, 6),
  );

  const styles = useMemo(() => {
    return createStyles(DesignTokens, inputBottomPadding);
  }, [DesignTokens, inputBottomPadding]);

  // Per-group draft autosave: text typed but not sent survives screen exits,
  // app background, and process death. The hook restores any saved draft
  // when the user re-enters the same chat.
  const { draft, setDraft, clearDraft } = useChatDraft(groupId);
  const text = draft;
  const setText = setDraft;

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

  // Throttled typing broadcaster: first keystroke fires immediately, then at
  // most once every 1.5s. Idle → fires `false` once after 2s of inactivity.
  const { reportKeystroke: reportTypingKeystroke, flushStop: stopTyping } =
    useTypingBroadcast(onTyping);
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
  // ערכי metering חיים בלי לגרום ל-re-render של ChatInput (חוסך עומס JS thread)
  const audioLevelRef = useRef(0);
  const waveformSamplesRef = useRef<number[]>([]);
  // מדידת משך אמיתית מבוססת timestamp (לא תלויה בדיוק ה-interval)
  const recordingStartRef = useRef(0);
  const recordingAccumMsRef = useRef(0);
  const previewPositionInterval = useRef<NodeJS.Timeout | null>(null);
  const recordingDotOpacity = useRef(new Animated.Value(1)).current;
  const timelineProgress = useSharedValue(0);
  const previewPlayingSV = useSharedValue(0);
  const previewScrubbingSV = useSharedValue(0);
  const previewDurationSV = useSharedValue(0);
  const isPreviewScrubbingRef = useRef(false);
  const wasPreviewPlayingBeforeScrubRef = useRef(false);
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

  // מעבר מיידי מיק↔שליחה לפי תוכן (בלי spring — נתקע לפעמים אחרי re-render / typing)
  const hasText = text.trim().length > 0;

  // ============================================
  // Cleanup typing status when unmounting
  // ============================================

  useEffect(() => {
    return () => {
      // useTypingBroadcast already publishes onTyping(false) on unmount,
      // so we don't need to duplicate that here. Kept as a defence in depth
      // in case parents swap onTyping at runtime.
      stopTyping();
    };
  }, [stopTyping]);

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
  // Auto-focus composer on reply
  // ============================================
  // כשמסמנים הודעה כ־reply target (swipe ימין / לונג-פרס → השב) המקלדת חייבת
  // לקפוץ מיד. בלי זה הבועה מסומנת אבל המשתמש צריך להקיש שוב על השדה.
  // מפעילים .focus() רק במעבר ל־id חדש כדי לא לגנוב פוקוס בכל re-render.
  const prevReplyIdRef = useRef<string | undefined>(replyTo?.id);
  useEffect(() => {
    const prevId = prevReplyIdRef.current;
    const nextId = replyTo?.id;
    prevReplyIdRef.current = nextId;

    if (!nextId || prevId === nextId) return;

    const focusInput = () => {
      const input = textInputRef.current;
      if (!input) return;
      input.focus();
      // הצבת סמן בסוף הטיוטה הקיימת כדי שהמשתמש ימשיך להקליד ברצף
      const len = textRef.current?.length ?? 0;
      if (len > 0) {
        try {
          input.setNativeProps({ selection: { start: len, end: len } });
        } catch {
          /* noop — setNativeProps עלול לזרוק בקונפיגורציות מסוימות באנדרואיד */
        }
      }
    };

    // דחיה קלה כדי לא להתנגש עם אנימציית סגירה של BottomSheet / ContextMenu
    // (הן עלולות לחטוף focus חזרה, במיוחד באנדרואיד). rAF מטפל במקרה שהשיט
    // כבר סגור; setTimeout מכסה את זמן האנימציה.
    const raf = requestAnimationFrame(focusInput);
    const timer = setTimeout(focusInput, Platform.OS === 'android' ? 150 : 80);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [replyTo?.id]);

  // ============================================
  // Handle Text Change
  // ============================================

  const handleTextChange = (newText: string) => {
    textRef.current = newText;
    setText(newText);

    // Handle mentions (@)
    handleMentionInputChange(newText);

    // Throttled typing-indicator broadcast (≤ 1Hz to the realtime channel).
    reportTypingKeystroke(newText);
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
    // Clear local draft state AND persisted AsyncStorage draft. We do this
    // BEFORE awaiting the send: optimistic UI means the bubble shows up
    // instantly, and the user expects the input to clear instantly too.
    clearDraft();
    clearAllMentions();
    stopTyping();

    try {
      // Send message with mentions
      onSendMessage(textToSend, undefined, undefined, {
        mentioned_users: mentionedUserIds,
        mentions: mentions
      }).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Alert.alert('שגיאה', errorMessage || 'לא הצלחנו לשלוח את ההודעה');
        // Restore draft on send error so the user can edit and retry. This
        // also re-persists it via useChatDraft's debounce.
        setText(textToSend);
      });

      // WhatsApp-style: keep composer focused so the keyboard stays open
      requestAnimationFrame(() => {
        textInputRef.current?.focus();
      });
      if (Platform.OS === 'android') {
        setTimeout(() => textInputRef.current?.focus(), 64);
      }
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
        // ⚡ thumb מקומי לבועה מיידית (כמו וידאו) — בלי decode של הקובץ המלא
        media_thumbnail_url: mediaFile.thumbnail_url,
        media_width: mediaFile.width,
        media_height: mediaFile.height,
        media_duration:
          mediaFile.type === 'video' && mediaFile.duration && mediaFile.duration > 0
            ? mediaFile.duration
            : undefined,
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

      // אם ה-thumb עוד לא מוכן (שליחה מיידית) — יצירה ברקע ועדכון הבועה
      if (mediaFile.type === 'image' && !mediaFile.thumbnail_url) {
        void chatMediaService.createLocalImageThumbnail(mediaFile.uri).then((thumb) => {
          if (thumb) updateOptimisticMessage(tempId, { media_thumbnail_url: thumb });
        });
      }
      if (mediaFile.type === 'video' && !mediaFile.thumbnail_url) {
        void chatMediaService.createLocalVideoThumbnail(mediaFile.uri).then((thumb) => {
          if (thumb) updateOptimisticMessage(tempId, { media_thumbnail_url: thumb });
        });
      }

      setIsUploading(true);
      (async () => {
        try {
          const onProgress = (progress: { progress: number }) => {
            updateOptimisticMessage(tempId, { upload_progress: progress.progress });
          };

          let uploadResult: { url: string | null; error: any; thumbnail_url?: string | null };
          if (mediaFile.type === 'image') {
            uploadResult = await chatMediaService.uploadImage(mediaFile.uri, groupId, onProgress, {
              localThumbnailUri: mediaFile.thumbnail_url,
            });
          } else if (mediaFile.type === 'video') {
            uploadResult = await chatMediaService.uploadVideo(mediaFile.uri, groupId, onProgress);
          } else {
            uploadResult = await chatMediaService.uploadImage(mediaFile.uri, groupId, onProgress, {
              localThumbnailUri: mediaFile.thumbnail_url,
            });
          }

          if (uploadResult.error || !uploadResult.url) {
            updateOptimisticMessage(tempId, {
              is_uploading: false,
              is_sending: false,
              send_error: uploadResult.error?.message || 'שגיאה בהעלאה'
            });
            return;
          }

          // משאירים media_thumbnail_url מקומי (אם יש) לבועה מיידית עד שהודעה אמיתית מגיעה
          updateOptimisticMessage(tempId, {
            media_url: uploadResult.url,
            is_uploading: false,
            local_media_uri: undefined,
          });

          const metadata: Record<string, any> = { existing_optimistic_id: tempId };
          if ('thumbnail_url' in uploadResult && uploadResult.thumbnail_url) {
            metadata.media_thumbnail_url = uploadResult.thumbnail_url;
          }
          if (mediaFile.type === 'video' && mediaFile.duration && mediaFile.duration > 0) {
            metadata.media_duration = mediaFile.duration;
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
        media_thumbnail_url: mediaFile.thumbnail_url,
        media_width: mediaFile.width,
        media_height: mediaFile.height,
        media_duration:
          mediaFile.type === 'video' && mediaFile.duration && mediaFile.duration > 0
            ? mediaFile.duration
            : undefined,
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

      if (mediaFile.type === 'image' && !mediaFile.thumbnail_url) {
        void chatMediaService.createLocalImageThumbnail(mediaFile.uri).then((thumb) => {
          if (thumb) updateOptimisticMessage(itemTempId, { media_thumbnail_url: thumb });
        });
      }
      if (mediaFile.type === 'video' && !mediaFile.thumbnail_url) {
        void chatMediaService.createLocalVideoThumbnail(mediaFile.uri).then((thumb) => {
          if (thumb) updateOptimisticMessage(itemTempId, { media_thumbnail_url: thumb });
        });
      }
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
            uploadResult = await chatMediaService.uploadImage(mediaFile.uri, groupId, onProgress, {
              localThumbnailUri: mediaFile.thumbnail_url,
            });
          } else if (mediaFile.type === 'video') {
            uploadResult = await chatMediaService.uploadVideo(mediaFile.uri, groupId, onProgress);
          } else {
            uploadResult = await chatMediaService.uploadImage(mediaFile.uri, groupId, onProgress, {
              localThumbnailUri: mediaFile.thumbnail_url,
            });
          }

          if (uploadResult.error || !uploadResult.url) {
            updateOptimisticMessage(itemTempId, {
              is_uploading: false,
              is_sending: false,
              send_error: uploadResult.error?.message || 'שגיאה בהעלאה'
            });
            return null;
          }

          // עדכון במקום הסרה – מונע flicker; שומרים thumb מקומי לבועה
          updateOptimisticMessage(itemTempId, {
            media_url: uploadResult.url,
            is_uploading: false,
            local_media_uri: undefined,
          });

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
          if (mediaFile.type === 'video' && mediaFile.duration && mediaFile.duration > 0) {
            metadata.media_duration = mediaFile.duration;
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
        // ⚡ פריוויו מיידי — בלי לחכות ל-decode/thumb
        setSelectedMedia(mediaFiles);
        setShowMediaPreview(true);
        warmImageCache(mediaFiles.map((f) => f.uri));
        // ⚡ thumb מקומי ברקע (כמו poster לווידאו) — אז הפריוויו/בועה מרגישים מיידיים
        attachLocalImageThumbs(mediaFiles, setSelectedMedia);
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
          width: asset.width,
          height: asset.height,
        };
        // ⚡ פריוויו מיידי
        setSelectedMedia([mediaFile]);
        setShowMediaPreview(true);
        warmImageCache([mediaFile.uri]);
        attachLocalImageThumbs([mediaFile], setSelectedMedia);
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
      metadata: { waveformData: undefined },
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
    runAfterSheetDismiss(() => setPollCreationVisible(true));
  };

  const handlePollCreated = (_poll: any) => {
    // הסקר יוצג אוטומטית בצ'אט דרך PollService.createPollMessage
    setPollCreationVisible(false);
  };

  // Handle Audio from Media Picker
  // ============================================
  const handleStartAudioRecording = () => {
    runAfterSheetDismiss(() => {
      void startRecording({ openInLockedMode: true });
    });
  };

  // ============================================
  // Record Audio
  // ============================================

  /**
   * Metering חי: דגימה גולמית ל־envelope (שמירה), smoothing רק ל־UI של ההקלטה.
   * הויבפורם הסופי בהודעה נבנה מפיקי הקובץ (WAV) כשאפשר.
   */
  const handleRecordingStatus = useCallback((status: Audio.RecordingStatus) => {
    if (!status.isRecording) return;
    const metering = status.metering;
    if (typeof metering !== 'number') return;

    const raw = meteringDbToLevel(metering);
    const prev = audioLevelRef.current;
    // smoothing משותף ל־UI ולדגימות שנשמרות — כדי שהבועה תתאים לחי
    const next =
      raw <= WAVEFORM_SILENCE * 0.65 ? prev * 0.4 : prev * 0.25 + raw * 0.75;
    const level = next < WAVEFORM_SILENCE * 0.55 ? 0 : Math.min(1, next);
    audioLevelRef.current = level;
    waveformSamplesRef.current.push(level);
  }, []);

  const clearWaveformPolling = useCallback(() => {
    if (waveformIntervalRef.current) {
      clearInterval(waveformIntervalRef.current);
      waveformIntervalRef.current = null;
    }
  }, []);

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

      // יצירת recording — iOS WAV לפיקים מהקובץ; Android m4a + metering
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(VOICE_RECORDING_OPTIONS);
      recording.setOnRecordingStatusUpdate(handleRecordingStatus);
      recording.setProgressUpdateInterval(50);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      setAudioLevel(0);
      setWaveformSamples([]);
      audioLevelRef.current = 0;
      waveformSamplesRef.current = [];
      recordingStartRef.current = Date.now();
      recordingAccumMsRef.current = 0;
      timelineProgress.value = 0;

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
        const elapsedMs = recordingAccumMsRef.current + (Date.now() - recordingStartRef.current);
        const seconds = Math.floor(elapsedMs / 1000);
        const progress = Math.min(seconds / MAX_RECORDING_DURATION, 1);
        timelineProgress.value = progress;
        setRecordingDuration(seconds);
      }, 250);

      isStartingRecordingRef.current = false;
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו להתחיל הקלטה');
      isStartingRecordingRef.current = false;

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

      // צבירת הזמן שחלף עד עכשיו
      recordingAccumMsRef.current += Date.now() - recordingStartRef.current;

      // Stop timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      clearWaveformPolling();
      recordingRef.current?.setOnRecordingStatusUpdate(null);

      setIsRecording(false);
      setIsPaused(true);
      setAudioLevel(0);
      audioLevelRef.current = 0;
      // raw — VoiceWaveformWithProgress מעצב עם shapeWaveformLevel
      setWaveformSamples([...waveformSamplesRef.current]);

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

      // המשך מדידת הזמן מהנקודה שעצרנו
      recordingStartRef.current = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const elapsedMs = recordingAccumMsRef.current + (Date.now() - recordingStartRef.current);
        const seconds = Math.floor(elapsedMs / 1000);
        const progress = Math.min(seconds / MAX_RECORDING_DURATION, 1);
        timelineProgress.value = progress;
        setRecordingDuration(seconds);
      }, 250);

      recordingRef.current.setOnRecordingStatusUpdate(handleRecordingStatus);
      recordingRef.current.setProgressUpdateInterval(50);
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

      clearWaveformPolling();
      recordingRef.current.setOnRecordingStatusUpdate(null);

      const status = await recordingRef.current.getStatusAsync();
      const uri = recordingRef.current.getURI();
      const liveSamples = [...waveformSamplesRef.current];
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      // משך סופי מדויק — מעדיף את durationMillis האמיתי של ההקלטה
      const totalMs = typeof status.durationMillis === 'number'
        ? status.durationMillis
        : recordingAccumMsRef.current + (Date.now() - recordingStartRef.current);
      setRecordingDuration(Math.floor(totalMs / 1000));

      setIsRecording(false);
      setIsPaused(true);
      setAudioLevel(0);
      audioLevelRef.current = 0;
      recordingDotOpacity.setValue(1);

      // peaks מהקובץ (WAV) או envelope מה-metering — raw; עיצוב בתצוגה
      const finalWave = await resolveMessageWaveform(uri, liveSamples, WAVEFORM_STORE_BARS);
      waveformSamplesRef.current = finalWave;
      setWaveformSamples(finalWave);

      if (uri) {
        setRecordedAudioUri(uri);
        setPreviewDuration(totalMs);
        previewDurationSV.value = totalMs;
        setPreviewPosition(0);
        timelineProgress.value = 0;
      }
    } catch (error) {
      logger.error('ChatInput', 'Recording error', error);
      setIsRecording(false);
      setIsPaused(true);
    }
  };

  // פלייהד חלק בפריוויו — UI thread
  useFrameCallback((frame) => {
    'worklet';
    if (previewPlayingSV.value < 0.5 || previewScrubbingSV.value > 0.5) return;
    const d = previewDurationSV.value;
    if (d <= 0) return;
    const dt = Math.min(1 / 20, (frame.timeSincePreviousFrame ?? 16) / 1000);
    timelineProgress.value = Math.min(1, timelineProgress.value + dt / (d / 1000));
  }, true);

  const resetPreviewPlayhead = useCallback(async () => {
    timelineProgress.value = 0;
    setPreviewPosition(0);
    setIsPlayingPreview(false);
    previewPlayingSV.value = 0;
    if (previewPositionInterval.current) {
      clearInterval(previewPositionInterval.current);
      previewPositionInterval.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(0);
      } catch {
        /* noop */
      }
    }
  }, [timelineProgress, previewPlayingSV]);

  // שמיעת ההקלטה (preview) — resume ממקום השהייה/סקראב
  const playPreview = async () => {
    if (!recordedAudioUri) return;

    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.didJustFinish || timelineProgress.value >= 0.995) {
            await soundRef.current.setPositionAsync(0);
            timelineProgress.value = 0;
            setPreviewPosition(0);
          }
          await soundRef.current.playAsync();
          setIsPlayingPreview(true);
          previewPlayingSV.value = 1;
          return;
        }
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const startMs = timelineProgress.value > 0.01 && previewDuration > 0
        ? timelineProgress.value * previewDuration
        : 0;

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedAudioUri },
        {
          shouldPlay: true,
          positionMillis: startMs,
          progressUpdateIntervalMillis: 80,
        },
      );

      soundRef.current = sound;
      setIsPlayingPreview(true);
      previewPlayingSV.value = 1;

      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        const dur = status.durationMillis || 0;
        setPreviewDuration(dur);
        previewDurationSV.value = dur;
        if (dur > 0) {
          timelineProgress.value = (status.positionMillis || startMs) / dur;
        }
      }

      sound.setOnPlaybackStatusUpdate((st) => {
        if (!st.isLoaded) return;
        if (st.durationMillis && st.durationMillis > 0) {
          setPreviewDuration(st.durationMillis);
          previewDurationSV.value = st.durationMillis;
        }
        if (st.didJustFinish) {
          void resetPreviewPlayhead();
          return;
        }
        if (isPreviewScrubbingRef.current) return;
        const dur = st.durationMillis || previewDurationSV.value;
        if (dur > 0) {
          const pos = st.positionMillis || 0;
          const reported = pos / dur;
          if (Math.abs(reported - timelineProgress.value) > 0.03) {
            timelineProgress.value = reported;
          }
          setPreviewPosition(pos);
        }
        if (st.isPlaying) {
          setIsPlayingPreview(true);
          previewPlayingSV.value = 1;
        } else {
          setIsPlayingPreview(false);
          previewPlayingSV.value = 0;
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
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.pauseAsync();
          const dur = status.durationMillis || previewDuration;
          if (dur > 0) {
            timelineProgress.value = (status.positionMillis || 0) / dur;
            setPreviewPosition(status.positionMillis || 0);
          }
        }
      } catch (error) {
        logger.error('ChatInput', 'Pause preview error', error);
      }
      setIsPlayingPreview(false);
      previewPlayingSV.value = 0;
      if (previewPositionInterval.current) {
        clearInterval(previewPositionInterval.current);
        previewPositionInterval.current = null;
      }
    }
  };

  const onPreviewScrubStart = useCallback(() => {
    isPreviewScrubbingRef.current = true;
    previewScrubbingSV.value = 1;
    wasPreviewPlayingBeforeScrubRef.current = previewPlayingSV.value > 0.5;
    if (soundRef.current && wasPreviewPlayingBeforeScrubRef.current) {
      void soundRef.current.pauseAsync();
      setIsPlayingPreview(false);
      previewPlayingSV.value = 0;
    }
  }, [previewScrubbingSV, previewPlayingSV]);

  const onPreviewScrubUpdate = useCallback(
    (progress01: number) => {
      if (previewDuration > 0) {
        setPreviewPosition(progress01 * previewDuration);
      }
    },
    [previewDuration],
  );

  const onPreviewScrubEnd = useCallback(
    async (progress01: number) => {
      isPreviewScrubbingRef.current = false;
      previewScrubbingSV.value = 0;
      const dur = previewDuration > 0 ? previewDuration : previewDurationSV.value;
      if (dur <= 0 || !recordedAudioUri) return;
      const clamped = Math.max(0, Math.min(1, progress01));
      const targetMs = clamped * dur;
      timelineProgress.value = clamped;
      setPreviewPosition(targetMs);

      try {
        if (!soundRef.current) {
          const { sound } = await Audio.Sound.createAsync(
            { uri: recordedAudioUri },
            { progressUpdateIntervalMillis: 80, positionMillis: targetMs },
          );
          soundRef.current = sound;
          sound.setOnPlaybackStatusUpdate((st) => {
            if (!st.isLoaded) return;
            if (st.didJustFinish) {
              void resetPreviewPlayhead();
              return;
            }
            if (isPreviewScrubbingRef.current) return;
            const d = st.durationMillis || previewDurationSV.value;
            if (d > 0) {
              timelineProgress.value = (st.positionMillis || 0) / d;
              setPreviewPosition(st.positionMillis || 0);
            }
          });
        } else {
          await soundRef.current.setPositionAsync(targetMs);
        }

        if (wasPreviewPlayingBeforeScrubRef.current) {
          await soundRef.current.playAsync();
          setIsPlayingPreview(true);
          previewPlayingSV.value = 1;
        }
      } catch (error) {
        logger.error('ChatInput', 'Preview seek error', error);
      }
    },
    [
      previewDuration,
      previewDurationSV,
      previewScrubbingSV,
      previewPlayingSV,
      recordedAudioUri,
      timelineProgress,
      resetPreviewPlayhead,
    ],
  );

  // שליחת ההקלטה
  const sendRecordedAudio = async () => {
    if (!recordedAudioUri || !user) return;

    const tempId = `temp-audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const audioUri = recordedAudioUri;
    const duration = recordingDuration;
    // אחרי stopRecording כבר יש peaks סופיים ב-ref; אם חסר — מחלצים שוב מהקובץ
    // raw resampled — העיצוב לתצוגה ב־normalizeWaveformSamples / shapeWaveformLevel
    let waveform =
      waveformSamplesRef.current.length >= 2
        ? resampleWaveformSamples(waveformSamplesRef.current, WAVEFORM_STORE_BARS)
        : await resolveMessageWaveform(
            audioUri,
            waveformSamples.length >= 2 ? waveformSamples : [],
            WAVEFORM_STORE_BARS,
          );
    waveformSamplesRef.current = waveform;

    // Create optimistic message immediately
    const optimisticMessage: ChatMessage = {
      id: tempId,
      group_id: groupId,
      sender_id: user.id,
      content: JSON.stringify({ waveform, waveformData: waveform, duration }),
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
      metadata: { waveformData: waveform },
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
    previewPlayingSV.value = 0;
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

  const cancelRecording = () => {
    clearWaveformPolling();
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
    previewPlayingSV.value = 0;
    setPreviewPosition(0);
    setIsLocked(false);
    isLockedRef.current = false;
    timelineProgress.value = 0;

    if (recordingRef.current) {
      recordingRef.current.setOnRecordingStatusUpdate(null);
      recordingRef.current.stopAndUnloadAsync().catch((error) => { logger.error('ChatInput', 'Recording error', error); });
      recordingRef.current = null;
    }
    waveformSamplesRef.current = [];
    setWaveformSamples([]);
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
      clearWaveformPolling();
      recordingRef.current.setOnRecordingStatusUpdate(null);

      const uri = recordingRef.current.getURI();
      const duration = recordingDuration;
      const liveSamples = [...waveformSamplesRef.current];
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      const samples = await resolveMessageWaveform(uri, liveSamples, WAVEFORM_STORE_BARS);
      waveformSamplesRef.current = samples;

      setIsRecording(false);
      setIsPaused(false);
      setAudioLevel(0);
      setRecordingDuration(0);
      setWaveformSamples([]);
      timelineProgress.value = 0;

      if (uri && duration >= 1 && user) {
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: ChatMessage = {
          id: tempId,
          group_id: groupId,
          content: JSON.stringify({ duration, waveform: samples, waveformData: samples }),
          message_type: ChatMessageType.AUDIO,
          sender_id: user.id,
          media_url: undefined,
          local_media_uri: uri,
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
          metadata: { waveformData: samples },
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
                '',
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
          // ImagePicker מחזיר duration במילישניות — שומרים בשניות כמו אודיו
          duration:
            asset.duration != null && asset.duration > 0
              ? asset.duration / 1000
              : undefined,
          width: asset.width,
          height: asset.height,
        }));
        // ⚡ Show preview IMMEDIATELY
        setSelectedMedia(mediaFiles);
        setShowMediaPreview(true);
        attachLocalVideoThumbs(mediaFiles, setSelectedMedia);
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו לבחור סרטון');
    }
  };

  const showAttachmentOptions = () => {
    Keyboard.dismiss();
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
          {/* X button on the LEFT — in RTL Hebrew it appears at the leading/far end */}
          <TouchableOpacity
            onPress={() => {
              void HapticFeedback.selection();
              onCancelReply?.();
            }}
            style={styles.cancelReply}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={DesignTokens.colors.text.tertiary} />
          </TouchableOpacity>
          <View style={styles.replyContent}>
            <Text style={styles.replyLabel}>תשובה ל-{replyTo.senderName}</Text>
            <Text style={styles.replyText} numberOfLines={1}>{replyTo.content || 'מדיה'}</Text>
          </View>
          {/* Green bar on the RIGHT — adjacent to text in RTL reading direction */}
          <View style={styles.replyPreviewBar} />
        </View>
      ) : null}

      {(isRecording || isPaused) ? (
      <View style={styles.container}>
        {/* הקלטה — שליחה מחוץ לגלולה כמו באינפוט רגיל */}
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="none"
          style={styles.inputCardOuter}
          contentContainerStyle={styles.inputCardContent}
        >
          {(isRecording || (isPaused && !recordedAudioUri)) ? (
            <View style={styles.recordingRowFull}>
              <View style={styles.recordingLeftCluster}>
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.warning();
                    void cancelRecording();
                  }}
                  style={styles.cancelButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
                {isRecording ? (
                  <TouchableOpacity
                    onPress={() => {
                      void HapticFeedback.selection();
                      void pauseRecording();
                    }}
                    style={styles.pauseResumeButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pause" size={20} color={DesignTokens.colors.text.primary} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      void HapticFeedback.selection();
                      void resumeRecording();
                    }}
                    style={styles.pauseResumeButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="mic" size={20} color={DesignTokens.colors.text.primary} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.recordingCenterCluster}>
                <View style={styles.waveformWrapper}>
                  <VoiceWaveform isRecording={isRecording} audioLevelRef={audioLevelRef} />
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
            </View>
          ) : (
            <View style={styles.recordingRowFull}>
              <View style={styles.recordingLeftCluster}>
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.warning();
                    void cancelRecording();
                  }}
                  style={styles.cancelButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.selection();
                    if (isPlayingPreview) {
                      void pausePreview();
                    } else {
                      void playPreview();
                    }
                  }}
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
                    interactive
                    onScrubStart={onPreviewScrubStart}
                    onScrubUpdate={onPreviewScrubUpdate}
                    onScrubEnd={onPreviewScrubEnd}
                  />
                </View>
                <View style={styles.timerContainer}>
                  <Text style={styles.recordingTime}>{formatRecordingTime(recordingDuration)}</Text>
                  {isPlayingPreview ? (
                    <Animated.View style={[styles.recordingDot, { opacity: recordingDotOpacity }]} />
                  ) : null}
                </View>
              </View>
            </View>
          )}
        </UICard>

        <View style={styles.sendBtnOuter}>
          <Pressable
            onPress={() => {
              void HapticFeedback.medium();
              setIsLocked(false);
              isLockedRef.current = false;
              if (recordedAudioUri) {
                sendRecordedAudio();
              } else {
                stopAndSendRecording();
              }
            }}
            style={styles.sendBtnTouchable}
            disabled={isUploading}
            accessibilityRole="button"
            accessibilityLabel="שליחת הקלטה"
          >
            <Ionicons name="send" size={22} color={DesignTokens.colors.text.inverse} />
          </Pressable>
        </View>
      </View>
      ) : (
        <ChatComposerBar
          value={text}
          onChangeText={handleTextChange}
          onBlur={stopTyping}
          inputRef={textInputRef}
          nativeID={CHAT_COMPOSER_NATIVE_ID}
          placeholder={isUploading ? 'מעלה...' : 'הקלד הודעה...'}
          placeholderTextColor={DesignTokens.colors.text.secondary}
          editable={!disabled && !isUploading}
          maxLength={10000}
          numberOfLines={2}
          containerStyle={{ paddingBottom: inputBottomPadding }}
          leading={
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.impactLight();
                showAttachmentOptions();
              }}
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
          }
          overlay={
            text.length > 8000 ? (
              <Text style={[
                styles.charCounter,
                text.length > 9500 && styles.charCounterDanger,
              ]}>
                {10000 - text.length}
              </Text>
            ) : null
          }
          trailing={
            <View style={styles.sendBtnOuter}>
              {hasText ? (
                <Pressable
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    Animated.sequence([
                      Animated.timing(sendBtnScale, { toValue: 0.82, duration: 70, useNativeDriver: true }),
                      Animated.spring(sendBtnScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
                    ]).start();
                    handleSend();
                  }}
                  style={styles.sendBtnTouchable}
                  disabled={disabled || isUploading}
                  accessibilityRole="button"
                  accessibilityLabel="שליחת הודעה"
                >
                  <Animated.View style={{ transform: [{ scale: sendBtnScale }] }}>
                    <Ionicons name="send" size={22} color={DesignTokens.colors.text.inverse} />
                  </Animated.View>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    handleMicTapToRecord();
                  }}
                  disabled={disabled || isUploading}
                  accessibilityRole="button"
                  accessibilityLabel="הקלטת הודעה קולית"
                  style={({ pressed }) => [
                    styles.sendBtnTouchable,
                    pressed && !disabled && !isUploading ? { opacity: 0.82 } : null,
                  ]}
                >
                  <Ionicons name="mic" size={24} color={DesignTokens.colors.text.inverse} />
                </Pressable>
              )}
            </View>
          }
        />
      )}

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

// PERF: ChatInput hosts a lot of internal state (recording, animations,
// pickers, mention dropdown) that should NOT remount every time the parent
// screen re-renders. With React.memo + memoised handler props in
// ChatGroupScreen, the entire input subtree stays stable while the user
// types — which is what makes the send button feel instant.
const ChatInput = memo(ChatInputImpl, (prev, next) => {
  return (
    prev.groupId === next.groupId &&
    prev.onSendMessage === next.onSendMessage &&
    prev.onTyping === next.onTyping &&
    prev.onCancelReply === next.onCancelReply &&
    prev.disabled === next.disabled &&
    prev.replyTo?.id === next.replyTo?.id &&
    prev.replyTo?.content === next.replyTo?.content &&
    prev.replyTo?.senderName === next.replyTo?.senderName
  );
});

export default ChatInput;

// ============================================
// Styles - Modern Design from Reference
// ============================================

const createStyles = (tokens: any, paddingBottom: number) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingTop: 2,
    paddingBottom,
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
    marginLeft: 10,
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
    marginRight: 8,
    alignSelf: 'center',
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
    minHeight: 46,
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

  /** שורת הקלטה: מחיקה+עצירה · זמן+גלים (שליחה מחוץ לגלולה) */
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
    height: 28,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  waveformPreviewWrapper: {
    flex: 1,
    minWidth: 0,
    height: 28,
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

  sendBtnTouchable: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** Standalone circular send/mic button outside the input pill — WhatsApp style */
  sendBtnOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: tokens.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginStart: 8,
    alignSelf: 'flex-end',
    marginBottom: 3,
  },

  /** Used only inside recording rows */
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    backgroundColor: 'rgba(255, 59, 48, 0.16)',
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

