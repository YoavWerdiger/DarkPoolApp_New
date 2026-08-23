// ============================================
// Chat Message Component
// ============================================
// הצגת הודעה בודדת בצ'אט
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useMemo, useState, useRef, useEffect, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Animated, Easing, Linking, Platform } from 'react-native';
import { Gesture, GestureDetector, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import Reanimated, {
  Easing as ReanimatedEasing,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatMessage as ChatMessageType, ChatMessageType as MessageType } from '../../types/chat.types';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import MediaViewer from './MediaViewer';
import MediaGridBubble from './MediaGridBubble';
import VoiceWaveformWithProgress from './VoiceWaveformWithProgress';
import { extractWaveformData, WAVEFORM_STORE_BARS } from '../../utils/waveformSamples';
import { resolveMessageWaveform } from '../../utils/audioWaveformPeaks';
import * as WebBrowser from 'expo-web-browser';
import { logger } from '../../utils/logger';
import { getChatMessagePreview } from '../../utils/chatMessagePreview';
import {
  getChatMediaDisplayUri,
  getCachedChatMediaDisplayUri,
  invalidateChatMediaPathCache,
  chatMediaStoragePathFromRef,
} from '../../services/chat/chatSignedMediaUrl';
import { downloadMediaToCache } from '../../lib/mediaFileCache';
import TradeMessage from './TradeMessage';
import PollMessage from './PollMessage';
import LinkPreview, { extractFirstUrl } from './LinkPreview';
import MessageReactions from './MessageReactions';
import { useAuth } from '../../context/AuthContext';
import { PollService, type PollWithVotes } from '../../services/pollService';
import {
  claimVoicePlayback,
  releaseVoicePlayback,
} from '../../utils/voicePlaybackController';

type ResolvedMessageMedia = {
  main: string | null;
  thumb: string | null;
  audio: string | null;
  doc: string | null;
};

function buildInitialResolvedMedia(message: ChatMessageType): ResolvedMessageMedia {
  // thumb רק אם יש thumbnail מפורש — לא נופלים ל-full local (זה היה גורם ל-decode איטי בבועה)
  const explicitThumb =
    getCachedChatMediaDisplayUri(message.media_thumbnail_url) ||
    message.media_thumbnail_url ||
    null;

  if (message.local_media_uri) {
    return {
      main: message.local_media_uri,
      thumb: explicitThumb,
      audio: message.message_type === MessageType.AUDIO ? message.media_url ?? null : null,
      doc: message.message_type === MessageType.DOCUMENT ? message.media_url ?? null : null,
    };
  }
  return {
    main:
      getCachedChatMediaDisplayUri(message.media_url) ||
      message.media_url ||
      null,
    thumb: explicitThumb,
    audio:
      message.message_type === MessageType.AUDIO
        ? getCachedChatMediaDisplayUri(message.media_url) || message.media_url || null
        : null,
    doc:
      message.message_type === MessageType.DOCUMENT
        ? getCachedChatMediaDisplayUri(message.media_url) || message.media_url || null
        : null,
  };
}

interface ChatMessageProps {
  message: ChatMessageType;
  isMe: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  /** true כש-older (מעל ב-inverted) משולח אחר — מרווח גדול ב-marginTop */
  isAfterSenderChange?: boolean;
  onLongPress?: () => void;
  onPress?: () => void;
  onReply?: () => void;
  onReactionPress?: (emoji: string) => void;
  onReactionDetailsPress?: (message: ChatMessageType) => void;
  onAvatarPress?: () => void;
  onJumpToMessage?: (messageId: string) => void;
  onRetry?: () => void;
  onStatusPress?: () => void;
  isHighlighted?: boolean;
  /** הודעות בערוץ הכרזות — טקסט בולד */
  boldText?: boolean;
}

/** מרווח בין בועות רצופות של אותו שולח */
export const CHAT_BUBBLE_MARGIN = 2;
/** מרווח מול older כשמחליפים שולח (marginTop ב-inverted) */
export const CHAT_SENDER_CHANGE_MARGIN = 12;

// פונקציה לרנדור טקסט עם תיוגים (@mentions)
const renderTextWithMentions = (
  text: string,
  baseStyle: any,
  mentionStyle: any
): React.ReactNode[] => {
  if (!text) return [];

  // חיפוש של @שם משתמש בטקסט
  const mentionRegex = /@[\u0590-\u05FFa-zA-Z0-9_]+/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = mentionRegex.exec(text)) !== null) {
    // טקסט לפני ה-mention
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`text-${keyIndex++}`} style={baseStyle}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }

    // ה-mention עצמו
    parts.push(
      <Text key={`mention-${keyIndex++}`} style={[baseStyle, mentionStyle]}>
        {match[0]}
      </Text>
    );

    lastIndex = match.index + match[0].length;
  }

  // טקסט אחרי ה-mention האחרון
  if (lastIndex < text.length) {
    parts.push(
      <Text key={`text-${keyIndex++}`} style={baseStyle}>
        {text.slice(lastIndex)}
      </Text>
    );
  }

  // אם אין mentions - החזר טקסט רגיל
  if (parts.length === 0) {
    return [<Text key="full-text" style={baseStyle}>{text}</Text>];
  }

  return parts;
};

// פונקציה לזיהוי כיוון טקסט (RTL/LTR)
const detectTextDirection = (text: string): 'right' | 'left' | 'auto' => {
  if (!text) return 'auto';

  // בדיקה אם יש תווים עבריים
  const hebrewRegex = /[\u0590-\u05FF]/;
  const hasHebrew = hebrewRegex.test(text);

  // בדיקה אם יש תווים אנגליים/לטיניים
  const latinRegex = /[A-Za-z]/;
  const hasLatin = latinRegex.test(text);

  // אם יש עברית - RTL
  if (hasHebrew) return 'right';

  // אם יש רק לטיני - LTR
  if (hasLatin && !hasHebrew) return 'left';

  // אחרת - auto
  return 'auto';
};

// פונקציה לקבלת צבע ייחודי למשתמש
const getUserColor = (userId: string) => {
  const colors = [
    '#E53935', // אדום
    '#D81B60', // ורוד
    '#8E24AA', // סגול
    '#5E35B1', // סגול כהה
    '#3949AB', // אינדיגו
    '#1E88E5', // כחול
    '#039BE5', // תכלת
    '#00ACC1', // ציאן
    '#00897B', // טורקיז
    '#43A047', // ירוק
    '#7CB342', // ירוק בהיר
    '#C0CA33', // ליים
    '#FDD835', // צהוב
    '#FFB300', // אמבר
    '#FB8C00', // כתום
    '#F4511E', // כתום עמוק
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

/** החלקה לריפליי (וואטסאפ): me = שמאלה, other = ימינה */
const REPLY_SWIPE_MAX = 72;
const REPLY_SWIPE_THRESHOLD = 44;
/** חזרה רכה אחרי שחרור — ease-out ארוך במקום spring קשיח */
const REPLY_SWIPE_RESET_MS = 360;

function MessageStatusIcon({
  isMe,
  isSending,
  hasError,
  styles,
  tertiaryColor,
}: {
  isMe: boolean;
  isSending: boolean;
  hasError: boolean;
  styles: any;
  tertiaryColor: string;
}) {
  if (!isMe || hasError || !isSending) return null;

  return <ActivityIndicator size={10} color={tertiaryColor} style={styles.statusIcon} />;
}

function ChatMessage({
  message,
  isMe,
  showAvatar = true,
  showSenderName = true,
  isAfterSenderChange = false,
  onLongPress,
  onPress,
  onReply,
  onReactionPress,
  onReactionDetailsPress,
  onAvatarPress,
  onJumpToMessage,
  onRetry,
  onStatusPress,
  isHighlighted = false,
  boldText = false,
}: ChatMessageProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const [showMediaViewer, setShowMediaViewer] = useState(false);

  const [resolvedMedia, setResolvedMedia] = useState<ResolvedMessageMedia>(() =>
    buildInitialResolvedMedia(message),
  );
  // אם חתימת ה-URL נכשלה (timeout/רשת) main נשאר נתיב לא-מוצג והצרכן תקוע על ספינר.
  // retry חסום-גבול מאפשר התאוששות כשהרשת חוזרת, בלי לולאה אינסופית.
  const [resolveRetry, setResolveRetry] = useState(0);
  const resolveRetryRef = useRef(0);
  const resolveKeyRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    const RESOLVE_MAX_RETRIES = 4;
    const resolveKey = `${message.id}|${message.media_url ?? ''}|${message.media_thumbnail_url ?? ''}|${message.local_media_uri ?? ''}`;
    if (resolveKeyRef.current !== resolveKey) {
      resolveKeyRef.current = resolveKey;
      resolveRetryRef.current = 0;
    }
    setResolvedMedia(buildInitialResolvedMedia(message));

    const isDisplayable = (u: string | null) =>
      !!u && (u.startsWith('http') || u.startsWith('file:') || u.startsWith('content:'));

    const scheduleRetryIfNeeded = (main: string | null) => {
      const needsRemote = !message.local_media_uri && !!message.media_url;
      if (
        needsRemote &&
        !isDisplayable(main) &&
        resolveRetryRef.current < RESOLVE_MAX_RETRIES
      ) {
        resolveRetryRef.current += 1;
        const delay = 1500 * resolveRetryRef.current;
        setTimeout(() => {
          if (!cancelled) setResolveRetry((n) => n + 1);
        }, delay);
      }
    };

    const run = async () => {
      if (message.local_media_uri) {
        // thumb מפורש בלבד — לא נופלים ל-full local (decode איטי בבועה)
        let thumbResolved: string | null = message.media_thumbnail_url || null;
        if (
          thumbResolved &&
          !thumbResolved.startsWith('file:') &&
          !thumbResolved.startsWith('content:')
        ) {
          thumbResolved =
            (await getChatMediaDisplayUri(thumbResolved)) || thumbResolved;
        }
        const audioU =
          message.message_type === MessageType.AUDIO && message.media_url
            ? (await getChatMediaDisplayUri(message.media_url)) || message.media_url
            : null;
        const docU =
          message.message_type === MessageType.DOCUMENT && message.media_url
            ? (await getChatMediaDisplayUri(message.media_url)) || message.media_url
            : null;
        if (!cancelled) {
          setResolvedMedia({
            main: message.local_media_uri!,
            thumb: thumbResolved,
            audio: audioU,
            doc: docU,
          });
        }
        return;
      }

      const main = message.media_url
        ? (await getChatMediaDisplayUri(message.media_url)) || message.media_url
        : null;
      const thumb = message.media_thumbnail_url
        ? (await getChatMediaDisplayUri(message.media_thumbnail_url)) ||
          message.media_thumbnail_url
        : null;
      const audio =
        message.message_type === MessageType.AUDIO && message.media_url
          ? (await getChatMediaDisplayUri(message.media_url)) || message.media_url
          : null;
      const doc =
        message.message_type === MessageType.DOCUMENT && message.media_url
          ? (await getChatMediaDisplayUri(message.media_url)) || message.media_url
          : null;

      if (!cancelled) {
        setResolvedMedia({ main, thumb, audio, doc });
        scheduleRetryIfNeeded(main);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    message.id,
    message.media_url,
    message.media_thumbnail_url,
    message.local_media_uri,
    message.message_type,
    message.media_urls,
    resolveRetry,
  ]);

  // Poster לבועת וידאו: אם אין thumbnail מהשרת (סרטונים ישנים / כשל ביצירה בהעלאה),
  // מייצרים את הפריים הראשון מ-URI הווידאו. ב-iOS יצירה מ-URL מרוחק לא אמינה, לכן
  // מעדיפים קובץ מקומי (הווידאו ממילא יורד ל-disk cache), עם נפילה ל-URL מרוחק/הורדה.
  const [runtimeVideoThumb, setRuntimeVideoThumb] = useState<string | null>(null);
  const [videoServerThumbFailed, setVideoServerThumbFailed] = useState(false);

  useEffect(() => {
    setVideoServerThumbFailed(false);
    setRuntimeVideoThumb(null);
  }, [message.id]);

  useEffect(() => {
    if (message.message_type !== MessageType.VIDEO) return;
    let cancelled = false;

    const isDisplayable = (u: string | null | undefined): u is string =>
      !!u && (u.startsWith('http') || u.startsWith('file:') || u.startsWith('content:'));
    const isLocal = (u: string | null | undefined): u is string =>
      !!u && (u.startsWith('file:') || u.startsWith('content:'));

    // אם כבר יש thumb מקומי/חתום — אין צורך לייצר; רק אם חסר או נכשל
    const existingThumb =
      (isLocal(message.media_thumbnail_url) && message.media_thumbnail_url) ||
      (isDisplayable(resolvedMedia.thumb) && resolvedMedia.thumb) ||
      null;
    if (existingThumb && !videoServerThumbFailed) {
      return;
    }

    const genFrom = async (src: string): Promise<string | null> => {
      for (const time of [1000, 0, 100, 2000]) {
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(src, { time, quality: 0.65 });
          if (uri) return uri;
        } catch {
          /* ננסה נקודת זמן/מקור הבא */
        }
      }
      return null;
    };

    (async () => {
      try {
        const cachedLocal = getCachedChatMediaDisplayUri(message.media_url);
        const localSource =
          (isLocal(message.local_media_uri) && message.local_media_uri) ||
          (isLocal(cachedLocal) && cachedLocal) ||
          (isLocal(resolvedMedia.main) && resolvedMedia.main) ||
          null;

        let uri: string | null = null;
        if (localSource) {
          uri = await genFrom(localSource);
        }

        if (!uri && resolvedMedia.main && resolvedMedia.main.startsWith('http')) {
          uri = await genFrom(resolvedMedia.main);
        }

        if (!uri) {
          const path = chatMediaStoragePathFromRef(message.media_url);
          if (path && resolvedMedia.main && resolvedMedia.main.startsWith('http')) {
            const local = await downloadMediaToCache(path, resolvedMedia.main).catch(() => null);
            if (local) uri = await genFrom(local);
          }
        }

        if (!cancelled && uri) setRuntimeVideoThumb(uri);
      } catch (error) {
        logger.warn('ChatMessage', 'runtime video thumbnail failed', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    message.id,
    message.message_type,
    message.media_url,
    message.media_thumbnail_url,
    message.local_media_uri,
    resolvedMedia.thumb,
    resolvedMedia.main,
    videoServerThumbFailed,
  ]);

  // הודעות אופטימיסטיות (שלחנו) – מוצגות מיידית.
  // הודעות שלי שזה עתה אושרו מהשרת – גם כן מיידית (מניעת "היעלמות" כשמעדכנים מ-temp ל-real).
  // הודעות חדשות מאחרים בלבד – אנימציית fade-in.
  const isSendingOrUploading = !!message.is_sending || !!message.is_uploading;
  const isNewMessage = useRef(
    !isMe && !isSendingOrUploading && Date.now() - new Date(message.created_at).getTime() < 8000
  ).current;
  const fadeAnim = useRef(new Animated.Value(isNewMessage ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(isNewMessage ? 8 : 0)).current;
  const highlightOpacity = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isNewMessage || hasAnimated.current) return;
    hasAnimated.current = true;
    fadeAnim.setValue(0);
    slideAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // הדגשת קפיצה להודעה — רק פלאש שקיפות רך, בלי translate/slide של הבועה
  useEffect(() => {
    if (!isHighlighted) {
      highlightOpacity.setValue(0);
      return;
    }
    highlightOpacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(highlightOpacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(1400),
      Animated.timing(highlightOpacity, {
        toValue: 0,
        duration: 480,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHighlighted]);

  const swipeTranslateX = useSharedValue(0);

  const triggerReplySwipe = useCallback(() => {
    if (!onReply) return;
    onReply();
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* noop */
      }
    }
  }, [onReply]);

  const replyPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!!onReply)
        .failOffsetY([-14, 14])
        .activeOffsetX([-16, 16])
        .onUpdate((e) => {
          'worklet';
          const tx = e.translationX;
          if (isMe) {
            swipeTranslateX.value = tx > 0 ? 0 : Math.max(-REPLY_SWIPE_MAX, tx);
          } else {
            swipeTranslateX.value = tx < 0 ? 0 : Math.min(REPLY_SWIPE_MAX, tx);
          }
        })
        .onEnd(() => {
          'worklet';
          const v = swipeTranslateX.value;
          const crossed = isMe
            ? v <= -REPLY_SWIPE_THRESHOLD
            : v >= REPLY_SWIPE_THRESHOLD;
          if (crossed) {
            runOnJS(triggerReplySwipe)();
          }
          swipeTranslateX.value = withTiming(0, {
            duration: REPLY_SWIPE_RESET_MS,
            easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
          });
        }),
    [isMe, onReply, triggerReplySwipe]
  );

  const swipeReplyAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeTranslateX.value }],
  }));

  // פתיחת מסמך
  const openDocument = async () => {
    const docUri =
      resolvedMedia.doc ||
      (message.media_url
        ? (await getChatMediaDisplayUri(message.media_url)) || message.media_url
        : null);
    if (!docUri) {
      legacyAlert('שגיאה', 'לא נמצא קישור למסמך');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(docUri);
      if (supported) {
        await WebBrowser.openBrowserAsync(docUri);
      } else {
        await Linking.openURL(docUri);
      }
    } catch (error) {
      logger.error('ChatMessage', 'Document open error', error);
      legacyAlert('שגיאה', 'לא ניתן לפתוח את המסמך');
    }
  };

  // צבע שם השולח
  const senderColor = useMemo(() => {
    if (message.sender_id) {
      return getUserColor(message.sender_id);
    }
    return DesignTokens.colors.text.secondary;
  }, [message.sender_id, DesignTokens]);

  const replyTargetId = message.reply_to?.message_id || message.reply_to_message_id;
  const handleReplyJump = useCallback(() => {
    if (replyTargetId && onJumpToMessage) {
      onJumpToMessage(replyTargetId);
    }
  }, [replyTargetId, onJumpToMessage]);

  // הודעת מערכת
  if (message.is_system_message) {
    return (
      <View key={`system-message-${message.id}`} style={styles.systemMessageContainer} accessibilityRole="text" accessibilityLabel={`System message: ${getSystemMessageText(message)}`}>
        <View key={`system-line-1-${message.id}`} style={styles.systemMessageLine} />
        <Text key={`system-text-${message.id}`} style={styles.systemMessageText}>
          {getSystemMessageText(message)}
        </Text>
        <View key={`system-line-2-${message.id}`} style={styles.systemMessageLine} />
      </View>
    );
  }

  // inverted FlatList (scaleY על הרשימה + על התא): אחרי ההיפוך הכפול,
  // marginTop פונה ל-older (מעל), marginBottom ל-newer (מתחת).
  // מרווח גדול ב-marginTop כש-older הוא שולח אחר — בלי marginBottom כפול.
  const senderGapStyle = {
    marginTop: isAfterSenderChange ? CHAT_SENDER_CHANGE_MARGIN : CHAT_BUBBLE_MARGIN,
  };

  // הודעה מחוקה
  if (message.is_deleted) {
    return (
      <View
        style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage, senderGapStyle]}
        accessibilityRole="text"
        accessibilityLabel="Deleted message"
      >
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble, styles.deletedBubble]}>
          <Text style={[styles.messageText, styles.deletedText]}>
            🚫 הודעה זו נמחקה
          </Text>
        </View>
      </View>
    );
  }

  const timeText = format(new Date(message.created_at), 'HH:mm');
  const isSending = !!message.is_sending;
  // הודעות שלי – תמיד opacity 1 (מונע היעלמות כשמחליפים מ-temp ל-real)
  // בלי scale/zoom בכניסה — קפיצה לריפליי מרנדרת בועות מחדש והזום נראה מיותר
  const effectiveOpacity = isMe ? 1 : fadeAnim;
  const effectiveTranslateY = isMe ? 0 : slideAnim;

  return (
    <Animated.View style={[
      styles.messageContainer,
      isMe ? styles.myMessage : styles.theirMessage,
      senderGapStyle,
      { opacity: effectiveOpacity, transform: [{ translateY: effectiveTranslateY }] },
    ]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.highlightOverlay, { opacity: highlightOpacity }]}
      />
      {/* Avatar */}
      {!isMe && (showAvatar ? (
        <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer}>
          {message.sender?.profile_picture ? (
            <Image source={{ uri: message.sender.profile_picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {message.sender?.display_name?.charAt(0) || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.avatarSpacer} />
      ))}

      {/* Message Content — כל הבועה (כולל reply) זזה עם swipe; TouchableOpacity native לא חוסם pan */}
      <View
        collapsable={false}
        style={[
          styles.gestureSwipeWrapper,
          isMe ? styles.gestureSwipeWrapperMe : styles.gestureSwipeWrapperThem,
          message.message_type === MessageType.AUDIO && styles.gestureSwipeWrapperAudio,
          message.message_type === MessageType.POLL && styles.gestureSwipeWrapperPoll,
        ]}
      >
        <View
          style={[
            styles.messageContent,
            isMe && styles.messageContentMe,
            message.message_type === MessageType.AUDIO && styles.audioMessageContent,
            message.message_type === MessageType.POLL && styles.pollMessageContent,
          ]}
        >
        <View style={[styles.bubbleStack, isMe && styles.bubbleStackMe]}>
        <GestureDetector gesture={replyPanGesture}>
          <Reanimated.View
            collapsable={false}
            style={[
              swipeReplyAnimatedStyle,
              styles.bubble,
              isMe ? styles.myBubble : styles.theirBubble,
              (message.message_type === MessageType.IMAGE ||
                message.message_type === MessageType.VIDEO ||
                message.message_type === MessageType.MEDIA_GROUP ||
                message.message_type === MessageType.TRADE) &&
                styles.mediaBubble,
              message.message_type === MessageType.POLL && styles.pollBubble,
              message.reply_to && { minWidth: 200 },
            ]}
          >
          {message.reply_to && (
            <GHTouchableOpacity
              key={`reply-${message.id}-${replyTargetId}`}
              style={[styles.replyContainer, isMe ? styles.replyContainerMe : styles.replyContainerThem]}
              onPress={handleReplyJump}
              onLongPress={onLongPress}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel="קפוץ להודעה המקורית"
            >
              <View key={`reply-bar-${message.id}`} style={styles.replyBar} />
              <View key={`reply-content-${message.id}`} style={styles.replyContent}>
                <Text key={`reply-name-${message.id}`} style={[styles.replyName, { textAlign: 'right' }]}>
                  {String(message.reply_to.sender_name || 'משתמש')}
                </Text>
                <Text key={`reply-text-${message.id}`} style={[styles.replyText, { textAlign: 'right' }]} numberOfLines={1}>
                  {getChatMessagePreview(message.reply_to.message_type, message.reply_to.content)}
                </Text>
              </View>
            </GHTouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityLabel={`${isMe ? 'Your message' : (message.sender?.display_name || 'Message')}: ${message.content || message.message_type}`}
            accessibilityHint="לחיצה ארוכה לתפריט; החלקה אופקית לתשובה"
            style={message.reply_to ? styles.bubbleBodyTouchable : undefined}
          >
          {/* Sender Name - בתוך הבועה – צבע ייחודי לכל משתמש */}
          {!isMe && showSenderName && (
            <Text style={[
              styles.senderNameInside,
              { color: senderColor },
              // Media bubbles have reduced padding — compensate so name isn't cramped
              (message.message_type === MessageType.IMAGE ||
               message.message_type === MessageType.VIDEO ||
               message.message_type === MessageType.MEDIA_GROUP)
                && { paddingHorizontal: 8, paddingTop: 4, paddingBottom: 6 },
            ]}>
              {message.sender?.display_name || 'משתמש'}
            </Text>
          )}

          {/* Forwarded Tag */}
          {message.is_forwarded && (
            <View key={`forwarded-tag-${message.id}`} style={styles.forwardedTag}>
              <Text key={`forwarded-text-${message.id}`} style={styles.forwardedText}>הועבר</Text>
            </View>
          )}

          {/* Media Content */}
          {message.message_type === MessageType.POLL && (
            <PollMessageContent message={message} isMe={isMe} />
          )}

          {message.message_type === MessageType.TRADE &&
            (() => {
              const t = parseTradePayloadFromMessage(message);
              if (!t) {
                return (
                  <Text
                    style={[
                      styles.messageText,
                      isMe ? styles.myMessageText : styles.theirMessageText,
                      { textAlign: 'right' },
                    ]}
                  >
                    טרייד · לא ניתן לטעון פרטים
                  </Text>
                );
              }
              return <TradeMessage trade={t} isMe={isMe} embeddedInBubble />;
            })()}

          {renderMediaContent(
            message,
            resolvedMedia,
            styles,
            isMe,
            DesignTokens,
            () => {
            // Only open viewer for uploaded media, not during upload
            if ((message.media_url || message.local_media_uri) && !message.is_uploading) {
              if (message.message_type === MessageType.IMAGE || message.message_type === MessageType.VIDEO) {
                setShowMediaViewer(true);
              } else if (message.message_type === MessageType.DOCUMENT) {
                openDocument();
              }
            }
          },
            message.message_type === MessageType.AUDIO
              ? { sentTimeText: timeText, isEdited: !!message.is_edited, isSending }
              : undefined,
            /* No time overlay — timestamp always in footer below the bubble */
            undefined,
            onStatusPress,
            runtimeVideoThumb,
            videoServerThumbFailed,
            () => setVideoServerThumbFailed(true),
          )}

          {/* Text Content */}
          {message.content &&
            message.message_type !== MessageType.TRADE &&
            message.message_type !== MessageType.POLL && (() => {
            if (message.message_type === MessageType.AUDIO) return null;

            let displayContent = message.content;

            // Only render if there's content to show
            if (!displayContent) return null;

            const textStyle = [
              styles.messageText,
              isMe ? styles.myMessageText : styles.theirMessageText,
              message.media_url && styles.messageTextWithMedia,
              boldText && styles.messageTextBold,
              { textAlign: detectTextDirection(displayContent) }
            ];
            const mentionStyle = {
              color: isMe
                ? DesignTokens.colors.bubbleMeText
                : DesignTokens.colors.primary.main,
              fontWeight: '700' as const,
            };

            const linkUrl = extractFirstUrl(displayContent);
            return (
              <>
                <Text style={textStyle}>
                  {renderTextWithMentions(displayContent, textStyle, mentionStyle)}
                </Text>
                {linkUrl && !message.is_sending && (
                  <LinkPreview url={linkUrl} isMe={isMe} />
                )}
              </>
            );
          })()}

          {/* Metadata footer — timestamp + checkmarks always below the bubble */}
          {(message.send_error || message.message_type !== MessageType.AUDIO) && (
          <View style={[styles.metadata,
            (message.message_type === MessageType.IMAGE ||
             message.message_type === MessageType.VIDEO ||
             message.message_type === MessageType.MEDIA_GROUP) && { paddingHorizontal: 6, paddingBottom: 2 }
          ]}>
            {message.send_error ? (
              <TouchableOpacity
                style={styles.retryRow}
                onPress={onRetry}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={13} color="#EF4444" />
                <Text style={styles.sendErrorText}>שגיאה בשליחה · נסה שוב</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.metadataRow}>
                {message.is_starred_by_me ? (
                  <Ionicons
                    name="star"
                    size={11}
                    color={
                      isMe
                        ? DesignTokens.colors.bubbleMeMetaText
                        : DesignTokens.colors.text.tertiary
                    }
                    style={styles.starredFooterIcon}
                  />
                ) : (
                  <View style={styles.starredFooterSpacer} />
                )}
                <View style={styles.metadataTimeGroup}>
                  {message.is_edited && (
                    <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText, styles.editedText]}>נערך · </Text>
                  )}
                  <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>{timeText}</Text>
                  <MessageStatusIcon
                    isMe={isMe}
                    isSending={isSending}
                    hasError={!!message.send_error}
                    styles={styles}
                    tertiaryColor={
                      isMe
                        ? DesignTokens.colors.bubbleMeMetaText
                        : DesignTokens.colors.text.tertiary
                    }
                  />
                </View>
              </View>
            )}
          </View>
          )}
          </TouchableOpacity>
          </Reanimated.View>
        </GestureDetector>

        {message.reactions && message.reactions.length > 0 ? (
          <MessageReactions
            reactions={message.reactions}
            isMe={isMe}
            onReactionDetails={() => onReactionDetailsPress?.(message)}
          />
        ) : null}
        </View>
        </View>
      </View>

      {/* Spacer for avatar on my messages */}
      {/* Media Viewer */}
      {(message.message_type === MessageType.IMAGE || message.message_type === MessageType.VIDEO) && message.media_url && (
        <MediaViewer
          visible={showMediaViewer}
          mediaUrl={resolvedMedia.main || message.media_url}
          mediaType={message.message_type === MessageType.IMAGE ? 'image' : 'video'}
          caption={message.content || undefined}
          onClose={() => setShowMediaViewer(false)}
          onReply={onReply ? () => { setShowMediaViewer(false); onReply(); } : undefined}
        />
      )}

    </Animated.View>
  );
}

// ============================================
// Helper Functions
// ============================================

type AudioBubbleMeta = { sentTimeText: string; isEdited: boolean; isSending: boolean };

function renderMediaContent(
  message: ChatMessageType,
  resolved: ResolvedMessageMedia,
  styles: any,
  isMe: boolean,
  tokens: ReturnType<typeof useDesignTokens>,
  onMediaPress?: () => void,
  audioMeta?: AudioBubbleMeta,
  timeOverlayNode?: React.ReactNode,
  onStatusPress?: () => void,
  videoPoster?: string | null,
  videoServerThumbFailed?: boolean,
  onVideoThumbError?: () => void,
) {
  const imageUri =
    message.local_media_uri || resolved.main || message.media_url;

  // MEDIA_GROUP uses media_urls/local_media_urls instead
  const hasMediaGroup = message.message_type === MessageType.MEDIA_GROUP &&
    ((message.media_urls && message.media_urls.length > 0) ||
      (message.local_media_urls && message.local_media_urls.length > 0));

  if (!imageUri && !hasMediaGroup && message.message_type !== MessageType.AUDIO && message.message_type !== MessageType.DOCUMENT) return null;

  switch (message.message_type) {
    case MessageType.IMAGE: {
      const imgW = message.media_width;
      const imgH = message.media_height;
      // Mild WhatsApp hint: soft portrait default + clamp (not hard 3:4)
      const rawAspect = imgW && imgH ? imgW / imgH : 0.9;
      const aspectRatio = Math.min(1.15, Math.max(0.65, rawAspect));
      const thumbUri =
        resolved.thumb ||
        getCachedChatMediaDisplayUri(message.media_thumbnail_url) ||
        message.media_thumbnail_url ||
        null;
      const fullUri = imageUri || '';
      const isDisplayableUri = (u: string | null | undefined) =>
        !!u &&
        (u.startsWith('http') || u.startsWith('file:') || u.startsWith('content:'));
      // ⚡ כמו וידאו: בועה מציגה thumb קטן; הקובץ המלא רק ב-MediaViewer
      const bubbleUri =
        (isDisplayableUri(thumbUri) ? thumbUri : null) ||
        (isDisplayableUri(fullUri) ? fullUri : null) ||
        '';

      return (
        <TouchableOpacity onPress={onMediaPress} activeOpacity={0.9} disabled={message.is_uploading}>
          <View style={{ position: 'relative' }}>
            {bubbleUri ? (
              <ExpoImage
                source={{ uri: bubbleUri }}
                style={[styles.mediaImage, { aspectRatio }, message.is_uploading && { opacity: 0.7 }]}
                contentFit="cover"
                transition={0}
                cachePolicy="memory-disk"
                recyclingKey={`${message.id}-bubble-${bubbleUri}`}
              />
            ) : (
              <View style={[styles.mediaImage, styles.mediaImagePlaceholder, { aspectRatio }]}>
                <ActivityIndicator size="small" color={tokens.colors.text.tertiary} />
              </View>
            )}
            {timeOverlayNode}
            {message.is_uploading && (
              <View style={[styles.uploadOverlay, { aspectRatio }]}>
                <ActivityIndicator size="large" color={tokens.colors.primary.main} />
                {message.upload_progress !== undefined && message.upload_progress > 0 && (
                  <Text style={styles.uploadProgress}>{Math.round(message.upload_progress)}%</Text>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    case MessageType.VIDEO: {
      const isDisplayableUri = (u: string | null | undefined): u is string =>
        !!u &&
        (u.startsWith('http') || u.startsWith('file:') || u.startsWith('content:'));

      const serverThumb =
        resolved.thumb ||
        getCachedChatMediaDisplayUri(message.media_thumbnail_url) ||
        (isDisplayableUri(message.media_thumbnail_url) ? message.media_thumbnail_url : null) ||
        null;
      const serverThumbOk =
        isDisplayableUri(serverThumb) && !videoServerThumbFailed;

      // העדפה: פריים מקומי שנוצר (אמין) → thumb שרת → runtime poster
      const thumbUri =
        (isDisplayableUri(videoPoster) ? videoPoster : null) ||
        (serverThumbOk ? serverThumb : null) ||
        null;
      const videoThumbOk = isDisplayableUri(thumbUri);

      return (
        <TouchableOpacity onPress={onMediaPress} activeOpacity={0.9}>
          <View style={styles.mediaVideo}>
            {videoThumbOk ? (
              <Image
                source={{ uri: thumbUri }}
                style={styles.mediaVideoFrame}
                resizeMode="cover"
                onError={() => onVideoThumbError?.()}
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Ionicons name="videocam" size={40} color={tokens.colors.text.tertiary} />
              </View>
            )}

            {/* Overlay עדין — לא מסתיר את הפריים */}
            <View style={styles.videoOverlay} pointerEvents="none" />

            <View style={styles.playButtonContainer} pointerEvents="none">
              <View style={styles.playButton}>
                <Ionicons name="play" size={28} color={tokens.colors.text.primary} style={{ marginLeft: 3 }} />
              </View>
            </View>

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)']}
              locations={[0, 1]}
              style={styles.videoBottomBanner}
              pointerEvents="none"
            >
              {message.media_duration && message.media_duration > 0 ? (
                <View style={styles.videoDuration}>
                  <Ionicons name="play" size={10} color="rgba(255,255,255,0.93)" />
                  <Text style={styles.videoDurationText}>
                    {formatDuration(message.media_duration)}
                  </Text>
                </View>
              ) : (
                <View />
              )}
              {timeOverlayNode}
            </LinearGradient>
          </View>
        </TouchableOpacity>
      );
    }

    case MessageType.AUDIO: {
      let audioDuration = message.media_duration || 0;
      if (audioDuration === 0 && message.content) {
        try {
          const parsed = JSON.parse(message.content);
          if (parsed.duration) audioDuration = parsed.duration;
        } catch { /* not JSON */ }
      }
      return (
        <AudioPlayer
          audioUrl={
            resolved.audio && isPlayableMediaUri(resolved.audio)
              ? resolved.audio
              : message.local_media_uri && isPlayableMediaUri(message.local_media_uri)
                ? message.local_media_uri
                : ''
          }
          duration={audioDuration}
          isMe={isMe}
          styles={styles}
          message={message}
          tokens={tokens}
          sentTimeText={audioMeta?.sentTimeText ?? ''}
          isEdited={audioMeta?.isEdited ?? false}
          isSending={isMe && (audioMeta?.isSending ?? false)}
          onStatusPress={onStatusPress}
        />
      );
    }

    case MessageType.DOCUMENT:
      // חילוץ שם קובץ מה-URL אם חסר
      const fileName = message.media_file_name || extractFileNameFromUrl(message.media_url) || 'מסמך';
      const fileExtension = getFileExtension(fileName);
      // הצג גודל אם קיים, אחרת הצג את סוג הקובץ
      const fileSizeText = message.media_size
        ? formatFileSize(message.media_size)
        : (fileExtension !== 'קובץ' ? fileExtension : '');

      return (
        <View style={styles.documentRow}>
          <Ionicons name="document-text-outline" size={28} color={tokens.colors.text.primary} />
          <View style={styles.documentTextContainer}>
            <Text style={styles.documentName} numberOfLines={1}>{fileName}</Text>
            {fileSizeText ? <Text style={styles.documentSize}>{fileSizeText}</Text> : null}
          </View>
          <TouchableOpacity onPress={onMediaPress} style={styles.downloadButton}>
            <Ionicons name="download-outline" size={22} color={tokens.colors.text.primary} />
          </TouchableOpacity>
        </View>
      );

    case MessageType.MEDIA_GROUP:
      return (
        <MediaGridBubble
          mediaItems={message.media_urls || []}
          localMediaItems={message.local_media_urls}
          isUploading={message.is_uploading}
          maxWidth={220}
        />
      );

    default:
      return null;
  }
}

function getSystemMessageText(message: ChatMessageType): string {
  const data = message.system_message_data || {};

  switch (message.system_message_type) {
    case 'group_created':
      return 'הקבוצה נוצרה';
    case 'user_joined':
      return `${data.user_name || 'משתמש'} הצטרף לקבוצה`;
    case 'user_left':
      return `${data.user_name || 'משתמש'} עזב את הקבוצה`;
    case 'member_added':
      return `${data.user_name || 'משתמש'} נוסף לקבוצה`;
    case 'member_removed':
      return `${data.user_name || 'משתמש'} הוסר מהקבוצה`;
    case 'member_promoted':
      return `${data.user_name || 'משתמש'} הועלה לאדמין`;
    case 'member_demoted':
      return `${data.user_name || 'משתמש'} הורד מאדמין`;
    case 'group_name_changed':
      return `שם הקבוצה שונה ל-"${data.new_value}"`;
    case 'group_avatar_changed':
      return 'תמונת הקבוצה שונתה';
    case 'group_description_changed':
      return 'תיאור הקבוצה שונה';
    default:
      return 'פעולה בקבוצה';
  }
}

type ParsedTrade = {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  quantity: number;
  entry_date: string;
  exit_date: string;
  pnl: number;
  return_percentage?: number;
  notes?: string;
};

function parseTradePayloadFromMessage(message: ChatMessageType): ParsedTrade | null {
  if (message.message_type !== MessageType.TRADE || !message.content?.trim()) return null;
  try {
    const o = JSON.parse(message.content.trim()) as { trade?: ParsedTrade };
    const t = o.trade;
    if (!t || typeof t.symbol !== 'string') return null;
    return t;
  } catch {
    return null;
  }
}

function buildStubPollFromMessage(message: ChatMessageType): PollWithVotes | null {
  const data = message.system_message_data;
  const rawOptions = Array.isArray(data?.options) ? data.options : [];
  const options = rawOptions
    .map((opt: any, index: number) => ({
      id: typeof opt?.id === 'string' ? opt.id : `option_${index}`,
      text: typeof opt?.text === 'string' ? opt.text : String(opt?.text ?? ''),
      votes_count: typeof opt?.votes_count === 'number' ? opt.votes_count : 0,
    }))
    .filter((opt: { text: string }) => opt.text.length > 0);

  if (!message.content?.trim() && options.length === 0) return null;

  return {
    id: typeof data?.poll_id === 'string' ? data.poll_id : `pending-${message.id}`,
    chat_id: message.group_id,
    creator_id: message.sender_id,
    question: message.content?.trim() || 'סקר',
    options,
    multiple_choice: !!data?.multiple_choice,
    allow_vote_change: !!data?.allow_vote_change,
    is_locked: false,
    created_at: message.created_at,
    user_votes: [],
    total_votes: options.reduce((sum: number, o: { votes_count: number }) => sum + o.votes_count, 0),
  };
}

function PollMessageContent({
  message,
  isMe,
}: {
  message: ChatMessageType;
  isMe: boolean;
}) {
  const { user } = useAuth();
  const pollId =
    typeof message.system_message_data?.poll_id === 'string'
      ? message.system_message_data.poll_id
      : null;
  const [poll, setPoll] = useState<PollWithVotes | null>(() => buildStubPollFromMessage(message));
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setPoll(buildStubPollFromMessage(message));
  }, [
    message.id,
    message.content,
    message.group_id,
    message.sender_id,
    message.created_at,
    message.system_message_data?.poll_id,
    message.system_message_data?.multiple_choice,
    message.system_message_data?.allow_vote_change,
  ]);

  useEffect(() => {
    if (!pollId || pollId.startsWith('pending-') || pollId.startsWith('temp')) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await PollService.getPollResults(pollId, user?.id);
        if (!cancelled && result) {
          setPoll(result);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pollId, user?.id]);

  if (!poll) {
    return (
      <View style={{ paddingVertical: 8, alignItems: 'center' }}>
        {loadError ? (
          <Text style={{ color: isMe ? 'rgba(255,255,255,0.85)' : '#9CA3AF', textAlign: 'right' }}>
            לא ניתן לטעון את הסקר
          </Text>
        ) : (
          <ActivityIndicator size="small" color={isMe ? '#fff' : undefined} />
        )}
      </View>
    );
  }

  return (
    <PollMessage
      poll={poll}
      chatId={message.group_id}
      onPollUpdated={setPoll}
      isMe={isMe}
      embeddedInBubble
    />
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// פורמט גודל קובץ
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// קבלת סיומת קובץ
function getFileExtension(fileName: string): string {
  if (!fileName) return 'קובץ';
  const parts = fileName.split('.');
  if (parts.length > 1) {
    const ext = parts.pop()?.toUpperCase();
    return ext || 'קובץ';
  }
  return 'קובץ';
}

// חילוץ שם קובץ מ-URL
function extractFileNameFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    // נסה לחלץ את שם הקובץ מה-URL
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    // הסר query params
    const fileName = lastPart.split('?')[0];
    // decode URI
    return decodeURIComponent(fileName) || null;
  } catch (error) {
    logger.error('ChatMessage', 'File name extraction from URL error', error);
    return null;
  }
}

// קבלת צבע לפי סוג קובץ
function getDocumentColor(extension: string): string {
  const ext = extension.toUpperCase();
  switch (ext) {
    case 'PDF':
      return '#FF4444';
    case 'DOC':
    case 'DOCX':
      return '#2B579A';
    case 'XLS':
    case 'XLSX':
      return '#217346';
    case 'PPT':
    case 'PPTX':
      return '#D24726';
    case 'TXT':
      return '#6B7280';
    case 'ZIP':
    case 'RAR':
    case '7Z':
      return '#F59E0B';
    case 'MP3':
    case 'WAV':
    case 'AAC':
      return '#8B5CF6';
    default:
      return '#FF6B6B';
  }
}

// קבלת אייקון לפי סוג קובץ
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
function getDocumentIcon(extension: string): IoniconsName {
  const ext = extension.toUpperCase();
  switch (ext) {
    case 'PDF':
      return 'document-text';
    case 'DOC':
    case 'DOCX':
    case 'TXT':
      return 'document-text';
    case 'XLS':
    case 'XLSX':
      return 'grid';
    case 'PPT':
    case 'PPTX':
      return 'easel';
    case 'ZIP':
    case 'RAR':
    case '7Z':
      return 'archive';
    case 'MP3':
    case 'WAV':
    case 'AAC':
      return 'musical-notes';
    case 'JPG':
    case 'JPEG':
    case 'PNG':
    case 'GIF':
      return 'image';
    default:
      return 'document';
  }
}

// ============================================
// Audio Player Component
// ============================================

function isPlayableMediaUri(uri: string): boolean {
  const t = uri.trim();
  if (!t) return false;
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('file://') ||
    t.startsWith('content://') ||
    t.startsWith('blob:')
  );
}

interface AudioPlayerProps {
  audioUrl: string;
  duration: number; // in seconds
  isMe: boolean;
  styles: any;
  message: ChatMessageType;
  tokens: ReturnType<typeof useDesignTokens>;
  sentTimeText: string;
  isEdited: boolean;
  isSending: boolean;
  onStatusPress?: () => void;
}

function AudioPlayer({
  audioUrl,
  duration,
  isMe,
  styles,
  message,
  tokens,
  sentTimeText,
  isEdited,
  isSending,
  onStatusPress,
}: AudioPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  /** URI אחרי ניסיון חידוש חתימה (מפחית 400 כשהטוקן בקאש פג) */
  const currentUriRef = useRef(audioUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [actualDuration, setActualDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const isMountedRef = useRef(true);
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const playbackRateRef = useRef(playbackRate);
  const playerId = `msg:${message.id}`;
  const stopExternallyRef = useRef<() => Promise<void>>(async () => {});

  const progressSV = useSharedValue(0);
  const isPlayingSV = useSharedValue(0);
  const isScrubbingSV = useSharedValue(0);
  const durationSV = useSharedValue(Math.max(0, duration));
  const rateSV = useSharedValue(1);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    rateSV.value = playbackRate;
  }, [playbackRate, rateSV]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    currentUriRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (duration > 0) {
      setActualDuration((prev) => (prev > 0 ? prev : duration));
      durationSV.value = duration;
    }
  }, [duration, durationSV]);

  useEffect(() => {
    if (actualDuration > 0) {
      durationSV.value = actualDuration;
    }
  }, [actualDuration, durationSV]);

  const resetPlayheadToStart = useCallback(async () => {
    progressSV.value = 0;
    setPosition(0);
    setIsPlaying(false);
    isPlayingSV.value = 0;
    if (soundRef.current) {
      try {
        // stop לפני seek — מונע replay לא מכוון אחרי didJustFinish בחלק מהפלטפורמות
        await soundRef.current.stopAsync();
        await soundRef.current.setPositionAsync(0);
      } catch (e) {
        try {
          await soundRef.current?.setPositionAsync(0);
        } catch (e2) {
          if (isMountedRef.current) {
            logger.error('ChatMessage', 'Audio reset error', e2 ?? e);
          }
        }
      }
    }
  }, [progressSV, isPlayingSV]);

  // עצירה חיצונית כשנגן אחר תופס את הניגון
  stopExternallyRef.current = async () => {
    if (soundRef.current) {
      try {
        const st = await soundRef.current.getStatusAsync();
        if (st.isLoaded && st.isPlaying) {
          await soundRef.current.pauseAsync();
        }
        await soundRef.current.setPositionAsync(0);
      } catch {
        /* noop */
      }
    }
    if (!isMountedRef.current) return;
    progressSV.value = 0;
    setPosition(0);
    setIsPlaying(false);
    isPlayingSV.value = 0;
  };

  const claimExclusivePlayback = useCallback(() => {
    claimVoicePlayback(playerId, () => stopExternallyRef.current());
  }, [playerId]);

  const syncProgressFromAudio = useCallback(
    (posSeconds: number, durSeconds: number) => {
      if (isScrubbingRef.current) return;
      const d = Math.max(durSeconds, 0.001);
      const p = Math.max(0, Math.min(1, posSeconds / d));
      progressSV.value = p;
      setPosition(posSeconds);
    },
    [progressSV],
  );

  // פלייהד חלק על ה-UI thread — כמו הוויבפורם החי (dt בין פריימים)
  useFrameCallback((frame) => {
    'worklet';
    if (isPlayingSV.value < 0.5 || isScrubbingSV.value > 0.5) return;
    const d = durationSV.value;
    if (d <= 0) return;
    const dt = Math.min(1 / 20, (frame.timeSincePreviousFrame ?? 16) / 1000);
    progressSV.value = Math.min(1, progressSV.value + (dt * rateSV.value) / d);
  }, true);

  const createSoundWithSignedUrlRetry = async (initialUri: string) => {
    let uri = initialUri;
    if (!isPlayableMediaUri(uri) && message.media_url) {
      const signed = await getChatMediaDisplayUri(message.media_url);
      if (signed) {
        uri = signed;
        currentUriRef.current = signed;
      }
    }
    const initialStatus = {
      progressUpdateIntervalMillis: 80,
      isLooping: false,
      shouldPlay: false,
    } as const;
    try {
      return await Audio.Sound.createAsync({ uri }, initialStatus);
    } catch (first) {
      const ref = message.media_url;
      if (!ref) throw first;
      const path = chatMediaStoragePathFromRef(ref);
      if (path) invalidateChatMediaPathCache(path);
      const fresh = await getChatMediaDisplayUri(ref);
      if (!fresh || fresh === uri) throw first;
      currentUriRef.current = fresh;
      return await Audio.Sound.createAsync({ uri: fresh }, initialStatus);
    }
  };

  const handlePlaybackStatus = useCallback(
    (status: any) => {
      if (!isMountedRef.current || !status?.isLoaded) return;
      if (status.durationMillis && status.durationMillis > 0) {
        const sec = status.durationMillis / 1000;
        setActualDuration(sec);
        durationSV.value = sec;
      }
      if (status.didJustFinish) {
        // סיום טבעי: איפוס להתחלה, בלי לופ / playAsync מחדש
        releaseVoicePlayback(playerId);
        void resetPlayheadToStart();
        return;
      }
      if (isScrubbingRef.current) return;
      const pos = (status.positionMillis ?? 0) / 1000;
      const dur =
        status.durationMillis && status.durationMillis > 0
          ? status.durationMillis / 1000
          : actualDuration || duration;
      if (dur > 0) {
        const reported = Math.min(1, pos / dur);
        // סנכרון רק כשיש סטייה — שומר חלקות של ה-frame callback
        if (Math.abs(reported - progressSV.value) > 0.03) {
          syncProgressFromAudio(pos, dur);
        } else {
          setPosition(pos);
        }
      }
      if (status.isPlaying) {
        setIsPlaying(true);
        isPlayingSV.value = 1;
      } else if (!status.isPlaying && isPlayingSV.value > 0.5) {
        setIsPlaying(false);
        isPlayingSV.value = 0;
        progressSV.value = dur > 0 ? Math.min(1, pos / dur) : 0;
      }
    },
    [
      actualDuration,
      duration,
      durationSV,
      isPlayingSV,
      playerId,
      progressSV,
      resetPlayheadToStart,
      syncProgressFromAudio,
    ],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      releaseVoicePlayback(playerId);
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [playerId]);

  const seekToProgress = useCallback(
    async (progress01: number, resumeIfNeeded: boolean) => {
      const dur = actualDuration > 0 ? actualDuration : duration;
      if (dur <= 0) return;
      const clamped = Math.max(0, Math.min(1, progress01));
      const targetMs = clamped * dur * 1000;
      progressSV.value = clamped;
      setPosition(clamped * dur);

      try {
        if (!soundRef.current) {
          if (!isPlayableMediaUri(currentUriRef.current) && message.media_url) {
            const signed = await getChatMediaDisplayUri(message.media_url);
            if (signed) currentUriRef.current = signed;
          }
          if (!isPlayableMediaUri(currentUriRef.current)) return;
          const { sound } = await createSoundWithSignedUrlRetry(currentUriRef.current);
          await sound.setRateAsync(playbackRateRef.current, true);
          sound.setOnPlaybackStatusUpdate(handlePlaybackStatus);
          soundRef.current = sound;
          const st = await sound.getStatusAsync();
          if (st.isLoaded && st.durationMillis && st.durationMillis > 0) {
            setActualDuration(st.durationMillis / 1000);
            durationSV.value = st.durationMillis / 1000;
          }
        }
        await soundRef.current.setPositionAsync(targetMs);
        if (resumeIfNeeded) {
          claimExclusivePlayback();
          await soundRef.current.setRateAsync(playbackRateRef.current, true);
          await soundRef.current.playAsync();
          setIsPlaying(true);
          isPlayingSV.value = 1;
        }
      } catch (error) {
        if (isMountedRef.current) {
          logger.error('ChatMessage', 'Audio seek error', error);
        }
      }
    },
    [
      actualDuration,
      claimExclusivePlayback,
      duration,
      progressSV,
      durationSV,
      isPlayingSV,
      handlePlaybackStatus,
      message.media_url,
    ],
  );

  const onScrubStart = useCallback(() => {
    isScrubbingRef.current = true;
    isScrubbingSV.value = 1;
    wasPlayingBeforeScrubRef.current = isPlayingSV.value > 0.5;
    if (soundRef.current && wasPlayingBeforeScrubRef.current) {
      void soundRef.current.pauseAsync();
      releaseVoicePlayback(playerId);
      setIsPlaying(false);
      isPlayingSV.value = 0;
    }
  }, [isScrubbingSV, isPlayingSV, playerId]);

  const onScrubUpdate = useCallback(
    (progress01: number) => {
      const dur = actualDuration > 0 ? actualDuration : duration;
      if (dur > 0) setPosition(progress01 * dur);
    },
    [actualDuration, duration],
  );

  const onScrubEnd = useCallback(
    (progress01: number) => {
      isScrubbingRef.current = false;
      isScrubbingSV.value = 0;
      void seekToProgress(progress01, wasPlayingBeforeScrubRef.current);
    },
    [isScrubbingSV, seekToProgress],
  );

  const togglePlayPause = async () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {
        /* noop */
      }
    }
    try {
      if (!isPlayableMediaUri(currentUriRef.current) && message.media_url) {
        const signed = await getChatMediaDisplayUri(message.media_url);
        if (signed) currentUriRef.current = signed;
      }
      if (!isPlayableMediaUri(currentUriRef.current)) {
        logger.warn('ChatMessage', 'Audio URL not ready', { messageId: message.id });
        return;
      }

      if (!soundRef.current) {
        const { sound } = await createSoundWithSignedUrlRetry(currentUriRef.current);
        await sound.setRateAsync(playbackRateRef.current, true);
        sound.setOnPlaybackStatusUpdate(handlePlaybackStatus);
        const startProgress = progressSV.value;
        if (startProgress > 0.01) {
          const dur = actualDuration > 0 ? actualDuration : duration;
          if (dur > 0) {
            await sound.setPositionAsync(startProgress * dur * 1000);
          }
        }
        claimExclusivePlayback();
        await sound.playAsync();
        soundRef.current = sound;
        setIsPlaying(true);
        isPlayingSV.value = 1;
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
          setActualDuration(status.durationMillis / 1000);
          durationSV.value = status.durationMillis / 1000;
        } else if (duration > 0 && actualDuration === 0) {
          setActualDuration(duration);
          durationSV.value = duration;
        }
      } else {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
            releaseVoicePlayback(playerId);
            setIsPlaying(false);
            isPlayingSV.value = 0;
            const pos = (status.positionMillis ?? 0) / 1000;
            const dur =
              status.durationMillis && status.durationMillis > 0
                ? status.durationMillis / 1000
                : actualDuration;
            if (dur > 0) {
              progressSV.value = Math.min(1, pos / dur);
              setPosition(pos);
            }
          } else {
            if (status.didJustFinish || progressSV.value >= 0.995) {
              await soundRef.current.setPositionAsync(0);
              progressSV.value = 0;
              setPosition(0);
            }
            claimExclusivePlayback();
            await soundRef.current.setRateAsync(playbackRateRef.current, true);
            await soundRef.current.playAsync();
            setIsPlaying(true);
            isPlayingSV.value = 1;
          }
        }
      }
    } catch (error) {
      logger.error('ChatMessage', 'Audio playback error', error);
    }
  };

  const togglePlaybackRate = async () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {
        /* noop */
      }
    }
    const rates = [1.0, 1.5, 2.0];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    rateSV.value = nextRate;

    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.setRateAsync(nextRate, true);
          if (status.isPlaying) {
            await soundRef.current.playAsync();
          }
        }
      } catch (error) {
        logger.error('ChatMessage', 'Audio playback error', error);
      }
    }
  };

  const displayDuration = actualDuration > 0 ? actualDuration : duration > 0 ? duration : 0;

  // raw samples — VoiceWaveformWithProgress מנרמל ל־DISPLAY_BARS (מתיחה, לא ריפוד באפסים)
  const storedWaveform = useMemo(
    () => extractWaveformData(message),
    [message.content, message.metadata],
  );
  const [recoveredWaveform, setRecoveredWaveform] = useState<number[] | undefined>();

  // אם אין waveform שמור — מנסים peaks מקובץ מקומי (WAV) / URI זמני
  useEffect(() => {
    if (storedWaveform && storedWaveform.length >= 2) {
      setRecoveredWaveform(undefined);
      return;
    }
    const local = message.local_media_uri;
    if (!local || typeof local !== 'string') return;
    let cancelled = false;
    void (async () => {
      const peaks = await resolveMessageWaveform(local, [], WAVEFORM_STORE_BARS);
      if (!cancelled && peaks.length >= 2 && Math.max(...peaks) > 0.12) {
        setRecoveredWaveform(peaks);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storedWaveform, message.local_media_uri]);

  const waveformData = storedWaveform ?? recoveredWaveform;

  return (
    <View style={styles.mediaAudio}>
      <View style={styles.mediaAudioControlsRow}>
        <TouchableOpacity
          onPress={togglePlayPause}
          activeOpacity={0.7}
          style={styles.audioPlayButton}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color={tokens.colors.text.primary}
            style={!isPlaying ? { marginLeft: 2 } : undefined}
          />
        </TouchableOpacity>

        <View style={styles.audioWaveformFlex}>
          <View style={styles.audioWaveformWrapper}>
            <VoiceWaveformWithProgress
              progress={progressSV}
              duration={displayDuration}
              isPlaying={isPlaying}
              waveformData={waveformData}
              interactive
              onScrubStart={onScrubStart}
              onScrubUpdate={onScrubUpdate}
              onScrubEnd={onScrubEnd}
              thumbColor="rgba(255,255,255,0.92)"
              activeColor={
                isMe ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.68)'
              }
              inactiveColor={
                isMe ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.22)'
              }
              nearActiveColor={
                isMe ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.42)'
              }
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={togglePlaybackRate}
          style={styles.audioSpeedButton}
          activeOpacity={0.7}
        >
          <Text style={styles.audioSpeedText}>{playbackRate.toFixed(1)}x</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.audioMetadataMerged}>
        <View style={styles.audioMetadataLeft}>
          {message.is_starred_by_me ? (
            <Ionicons
              name="star"
              size={11}
              color={isMe ? tokens.colors.bubbleMeMetaText : tokens.colors.text.tertiary}
              style={styles.starredFooterIcon}
            />
          ) : null}
          {isEdited && (
            <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText, styles.editedText]}>
              נערך ·{' '}
            </Text>
          )}
          <Text
            style={[
              styles.timeText,
              isMe ? styles.myTimeText : styles.theirTimeText,
              styles.audioPlaybackTimeText,
            ]}
          >
            {formatDuration(position)} / {formatDuration(displayDuration)}
          </Text>
        </View>
        <View style={styles.audioMetadataRight}>
          <MessageStatusIcon
            isMe={isMe}
            isSending={isSending}
            hasError={!!message.send_error}
            styles={styles}
            tertiaryColor={
              isMe ? tokens.colors.bubbleMeMetaText : tokens.colors.text.tertiary
            }
          />
          {!!sentTimeText && (
            <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText, styles.audioSentTimeText]}>
              {sentTimeText}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default memo(ChatMessage, (prevProps, nextProps) => {
  const a = prevProps.message;
  const b = nextProps.message;

  // Fast path: identical id + identical object reference means ChatContext
  // didn't replace the message object → nothing visible could have changed.
  if (a === b && prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.isMe === nextProps.isMe &&
      prevProps.showAvatar === nextProps.showAvatar &&
      prevProps.showSenderName === nextProps.showSenderName &&
      prevProps.isAfterSenderChange === nextProps.isAfterSenderChange &&
      prevProps.boldText === nextProps.boldText) {
    return true;
  }

  // Field-level comparator — every field that ChatMessage renders to the
  // screen MUST be listed here, otherwise edits/reactions/read-receipts
  // can silently fail to update.
  return (
    a.id === b.id &&
    a.content === b.content &&
    a.is_edited === b.is_edited &&
    a.is_deleted === b.is_deleted &&
    a.deleted_for_everyone === b.deleted_for_everyone &&
    a.media_url === b.media_url &&
    a.media_thumbnail_url === b.media_thumbnail_url &&
    a.is_sending === b.is_sending &&
    a.send_error === b.send_error &&
    a.upload_progress === b.upload_progress &&
    a.reactions === b.reactions &&
    a.reactions_count === b.reactions_count &&
    a.read_by_count === b.read_by_count &&
    a.is_starred_by_me === b.is_starred_by_me &&
    a.mentioned_users === b.mentioned_users &&
    a.reply_to === b.reply_to &&
    prevProps.isMe === nextProps.isMe &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.showSenderName === nextProps.showSenderName &&
    prevProps.isAfterSenderChange === nextProps.isAfterSenderChange &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.boldText === nextProps.boldText
  );
});

// ============================================
// Styles - Modern Design from Reference
// ============================================

const createStyles = (tokens: any) => StyleSheet.create({
  /* מרווחים בסגנון WhatsApp: צפיפות בין הודעות אותו שולח;
     מרווח גדול מול older בהחלפת שולח — senderGapStyle.marginTop (isAfterSenderChange) */
  messageContainer: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  theirMessage: {
    justifyContent: 'flex-start',
  },
  highlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.colors.primary.subtle,
    borderRadius: tokens.borderRadius.md,
  },

  avatarContainer: {
    marginRight: 6,
    marginBottom: 2,
  },
  avatarSpacer: {
    width: 26,
    height: 26,
    marginRight: 6,
    marginBottom: 2,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    backgroundColor: tokens.colors.border.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.semibold,
  },

  /** עוטף GestureDetector — View נייטיבי; יישור כמו messageContent */
  gestureSwipeWrapper: {
    maxWidth: '80%',
    minWidth: 0,
  },
  gestureSwipeWrapperMe: {
    alignSelf: 'flex-end',
  },
  gestureSwipeWrapperThem: {
    alignSelf: 'flex-start',
  },
  /** אודיו: בועה רחבה יחסית — כמו לפני ה־narrow polish */
  gestureSwipeWrapperAudio: {
    maxWidth: '78%',
    minWidth: 210,
  },
  /** סקר: מונע התכווצות לרוחב אות בודדת אחרי הסרת כותרת האייקון */
  gestureSwipeWrapperPoll: {
    maxWidth: '80%',
    minWidth: 220,
  },
  messageContent: {
    maxWidth: '100%',
    alignItems: 'flex-start',
  },
  messageContentMe: {
    alignItems: 'flex-end',
  },
  audioMessageContent: {
    minWidth: 200,
    maxWidth: 280,
    width: '100%',
    alignSelf: 'stretch',
  },
  pollMessageContent: {
    minWidth: 220,
    maxWidth: 280,
    width: '100%',
    alignSelf: 'stretch',
  },
  bubbleStack: {
    maxWidth: '100%',
    alignItems: 'flex-start',
  },
  bubbleStackMe: {
    alignItems: 'flex-end',
  },

  senderNameInside: {
    fontSize: tokens.typography.label.size,
    fontWeight: tokens.typography.fontWeight.semibold,
    marginTop: 0,
    marginBottom: 1,
    textAlign: 'right',
    alignSelf: 'flex-end',
    width: '100%',
    lineHeight: 16,
  },

  replyContainer: {
    flexDirection: 'row-reverse',
    borderRadius: 8,
    padding: 10,
    paddingRight: 6,
    marginBottom: 6,
    marginTop: 2,
    overflow: 'visible',
    borderWidth: 0,
    minHeight: 50,
  },
  replyContainerMe: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  replyContainerThem: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  replyBar: {
    width: 3,
    backgroundColor: tokens.colors.primary.main,
    borderRadius: 1.5,
    marginLeft: 8,
    flexShrink: 0,
    minHeight: 24,
  },
  replyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replyName: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.primary.main,
    marginBottom: 3,
    textAlign: 'right',
  },
  replyText: {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.text.secondary,
    opacity: 0.9,
  },

  bubble: {
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 9,
    maxWidth: '100%',
  },
  /** כשיש ריפליי — גוף ההודעה מתחת לרצועת הריפליי */
  bubbleBodyTouchable: {
    alignSelf: 'stretch',
  },
  mediaBubble: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
  },
  pollBubble: {
    minWidth: 220,
    alignSelf: 'stretch',
    // כמו בועת טקסט רגילה — לא mediaBubble (xs) שמצמיד שאלה/שם לקצה
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  myBubble: {
    backgroundColor: tokens.colors.bubbleMe,
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  theirBubble: {
    backgroundColor: tokens.colors.bubbleOther,
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 3,
    elevation: 2,
  },
  deletedBubble: {
    opacity: 0.6,
  },

  forwardedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  forwardedText: {
    fontSize: tokens.typography.fontSize.xs,
    fontStyle: 'italic',
    color: tokens.colors.text.secondary,
    opacity: 0.7,
  },

  mediaImage: {
    width: '100%',
    maxWidth: 220,
    // aspectRatio set dynamically from media dimensions
    borderRadius: tokens.borderRadius.md,
    marginBottom: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  mediaImagePlaceholder: {
    backgroundColor: tokens.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 4,
    backgroundColor: tokens.colors.background.overlay,
    borderRadius: tokens.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadProgress: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    marginTop: 8,
  },
  mediaVideo: {
    position: 'relative',
    width: '100%',
    maxWidth: 220,
    aspectRatio: 0.9,
    borderRadius: tokens.borderRadius.md,
    marginBottom: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  mediaVideoFrame: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* WhatsApp-style timestamp overlay on images/videos */
  imageTimeOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  imageTimeText: {
    color: 'rgba(255,255,255,0.93)',
    fontSize: 11,
    fontWeight: '500',
    writingDirection: 'ltr',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  playButtonContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  videoBottomBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  videoDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  videoDurationText: {
    color: 'rgba(255,255,255,0.93)',
    fontSize: 11,
    fontWeight: '500',
    writingDirection: 'ltr',
  },
  playIcon: {
    fontSize: 24,
  },

  mediaAudio: {
    flexDirection: 'column',
    direction: 'ltr',
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: 280,
    minWidth: 200,
    paddingVertical: 2,
    paddingHorizontal: 2,
    gap: 0,
    backgroundColor: 'transparent',
  },
  audioMetadataMerged: {
    width: '100%',
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  audioMetadataLeft: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    flexShrink: 1,
    minWidth: 0,
  },
  audioMetadataRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    flexShrink: 0,
    marginLeft: 8,
  },
  audioPlaybackTimeText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  audioSentTimeText: {
    textAlign: 'right',
  },
  mediaAudioControlsRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    width: '100%',
    minHeight: 28,
    gap: 6,
  },
  audioWaveformFlex: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 88,
    justifyContent: 'center',
  },
  audioPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  audioPlayIcon: {
    width: 20,
    height: 20,
    tintColor: tokens.colors.text.primary,
    opacity: 0.9,
  },
  audioWaveformWrapper: {
    width: '100%',
    height: 26,
    flexShrink: 0,
  },
  audioWaveformContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  audioWaveformClip: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 4,
    justifyContent: 'center',
  },
  audioWaveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    width: '100%',
    paddingHorizontal: 4,
  },
  audioWaveformBar: {
    width: 2,
    borderRadius: 999,
  },
  audioProgressIndicator: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    top: '50%',
    marginTop: -5,
    zIndex: 2,
    pointerEvents: 'none',
  },
  audioSpeedButton: {
    backgroundColor: tokens.colors.border.hover,
    borderRadius: tokens.borderRadius.full,
    paddingHorizontal: 7,
    height: 28,
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  audioSpeedText: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.text.primary,
  },
  myAudioTime: {
    color: tokens.colors.text.primary,
    opacity: 0.9,
  },
  theirAudioTime: {
    color: tokens.colors.text.secondary,
  },
  audioDuration: {
    fontSize: tokens.typography.label.size,
    fontWeight: tokens.typography.fontWeight.medium,
    minWidth: 40,
    textAlign: 'left',
  },
  myAudioDuration: {
    color: tokens.colors.text.primary,
  },
  theirAudioDuration: {
    color: tokens.colors.text.primary,
  },

  // Document - פשוט בתוך הבועה הקיימת
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 14,
    minWidth: 200,
    paddingVertical: 6,
  },
  documentTextContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  documentName: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.text.primary,
  },
  documentSize: {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.text.secondary,
  },
  downloadButton: {
    width: 36,
    height: 36,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.border.hover,
    justifyContent: 'center',
    alignItems: 'center',
  },

  messageText: {
    fontSize: tokens.typography.body.size - 1,
    lineHeight: Math.round((tokens.typography.body.size - 1) * tokens.typography.lineHeight.normal),
    marginTop: 0,
    marginBottom: 0,
    color: tokens.colors.text.primary,
  },
  messageTextBold: {
    fontWeight: '700',
  },
  messageTextWithMedia: {
    marginTop: 8,
    paddingHorizontal: 2,
  },
  // הודעות שלי — טקסט לבן/כהה מלא על בועה ירוקה (לא text.primary גנרי)
  myMessageText: {
    color: tokens.colors.bubbleMeText,
  },
  theirMessageText: {
    color: tokens.colors.text.primary,
  },
  deletedText: {
    fontStyle: 'italic',
    opacity: 0.6,
  },

  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    gap: 4,
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
  },
  editedText: {
    fontStyle: 'italic',
    opacity: 0.7,
  },
  // text-xs text-gray-500
  timeText: {
    fontSize: tokens.typography.fontSize.xs,
    opacity: 0.8,
  },
  myTimeText: {
    color: tokens.colors.bubbleMeMetaText,
    opacity: 1,
  },
  theirTimeText: {
    color: tokens.colors.text.tertiary,
  },

  metadataRow: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  metadataTimeGroup: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  statusIcon: {
    marginLeft: 2,
    opacity: 0.8,
  },
  starredFooterIcon: {
    opacity: 0.85,
    marginTop: 1,
  },
  starredFooterSpacer: {
    width: 0,
    height: 0,
  },
  retryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  sendErrorText: {
    fontSize: tokens.typography.fontSize.xs,
    color: '#EF4444',
    fontStyle: 'italic',
  },
  systemMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
  },
  systemMessageLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border.divider,
  },
  systemMessageText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.text.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    textAlign: 'center',
    backgroundColor: tokens.colors.border.divider,
    borderRadius: tokens.borderRadius.lg,
    overflow: 'hidden',
  },
});

