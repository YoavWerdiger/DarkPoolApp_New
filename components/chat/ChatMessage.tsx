// ============================================
// Chat Message Component
// ============================================
// הצגת הודעה בודדת בצ'אט
// ============================================

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatMessage as ChatMessageType, ChatMessageType as MessageType } from '../../types/chat.types';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import MediaViewer from './MediaViewer';
import { useAuth } from '../../context/AuthContext';
import { PollService, PollWithVotes } from '../../services/pollService';
import { supabase } from '../../lib/supabase';
import PollVotesBottomSheet from './PollVotesBottomSheet';

interface ChatMessageProps {
  message: ChatMessageType;
  isMe: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  onLongPress?: () => void;
  onPress?: () => void;
  onReply?: () => void;
  onReactionPress?: (emoji: string) => void;
  onReactionDetailsPress?: (message: ChatMessageType) => void;
  onAvatarPress?: () => void;
  onJumpToMessage?: (messageId: string) => void;
}

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

export default function ChatMessage({
  message,
  isMe,
  showAvatar = true,
  showSenderName = true,
  onLongPress,
  onPress,
  onReply,
  onReactionPress,
  onReactionDetailsPress,
  onAvatarPress,
  onJumpToMessage,
}: ChatMessageProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
  const { user } = useAuth();
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [pollData, setPollData] = useState<PollWithVotes | null>(null);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollVoting, setPollVoting] = useState(false);
  const [pollSelectedOptionIds, setPollSelectedOptionIds] = useState<string[]>([]);
  const [resolvedPollId, setResolvedPollId] = useState<string | null>(null);
  const [showVotesSheet, setShowVotesSheet] = useState(false);
  
  // צבע שם השולח
  const senderColor = useMemo(() => {
    if (message.sender_id) {
      return getUserColor(message.sender_id);
    }
    return DesignTokens.colors.text.secondary;
  }, [message.sender_id, DesignTokens]);

  
  // Audio playback state
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // הודעת מערכת
  if (message.is_system_message) {
    return (
      <View key={`system-message-${message.id}`} style={styles.systemMessageContainer}>
        <View key={`system-line-1-${message.id}`} style={styles.systemMessageLine} />
        <Text key={`system-text-${message.id}`} style={styles.systemMessageText}>
          {getSystemMessageText(message)}
        </Text>
        <View key={`system-line-2-${message.id}`} style={styles.systemMessageLine} />
      </View>
    );
  }

  // הודעה מחוקה
  if (message.is_deleted) {
    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble, styles.deletedBubble]}>
          <Text style={[styles.messageText, styles.deletedText]}>
            🚫 הודעה זו נמחקה
          </Text>
        </View>
      </View>
    );
  }

  const timeText = format(new Date(message.created_at), 'HH:mm');
  const pollId = (message as any)?.system_message_data?.poll_id as string | undefined;
  const pollMeta = (message as any)?.system_message_data as
    | { poll_id?: string; multiple_choice?: boolean; options?: Array<{ id: string; text: string }> }
    | undefined;
  const effectivePollId = pollId || resolvedPollId || undefined;

  // אם זו הודעת סקר ישנה בלי poll_id, ננסה לשחזר אותו ע"י התאמה ל-polls
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (message.message_type !== MessageType.POLL) return;
      if (pollId) return;
      if (resolvedPollId) return;
      if (!message.content) return;

      try {
        const { data, error } = await supabase
          .from('polls')
          .select('id')
          .eq('chat_id', message.group_id)
          .eq('creator_id', message.sender_id)
          .eq('question', message.content)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) return;
        const found = Array.isArray(data) ? data[0] : null;
        if (!cancelled && found?.id) {
          setResolvedPollId(found.id);
        }
      } catch {
        // ignore
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, message.message_type, pollId, resolvedPollId, message.group_id, message.sender_id, message.content]);

  // Reset poll UI when message changes
  useEffect(() => {
    if (message.message_type !== MessageType.POLL) return;
    setPollData(null);
    setPollSelectedOptionIds([]);
    setResolvedPollId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  // טעינת נתוני הסקר ברקע (כדי להציג אופציות/תוצאות בבועה)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (message.message_type !== MessageType.POLL) return;
      if (!effectivePollId) return;
      if (pollData) return;
      try {
        setPollLoading(true);
        const loaded = await PollService.getPollResults(effectivePollId, user?.id);
        if (!cancelled) setPollData(loaded);
      } catch {
        // שקט: נציג UI מבוסס מטא-דאטה/0 עד שייפתח המודאל
      } finally {
        if (!cancelled) setPollLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.message_type, effectivePollId, user?.id]);

  const refreshPoll = async () => {
    if (!effectivePollId) return;
    try {
      setPollLoading(true);
      const loaded = await PollService.getPollResults(effectivePollId, user?.id);
      setPollData(loaded);
    } catch (e) {
      console.error('❌ Error loading poll:', e);
    } finally {
      setPollLoading(false);
    }
  };

  const submitPollVote = async () => {
    if (!effectivePollId || !user?.id) return;

    const multipleChoice = !!(pollData?.multiple_choice ?? pollMeta?.multiple_choice);
    const isLocked = !!pollData?.is_locked;
    const userVotes = pollData?.user_votes || [];
    const canVote = !isLocked && userVotes.length === 0;

    if (!canVote) return;
    if (pollSelectedOptionIds.length === 0) return;
    if (!multipleChoice && pollSelectedOptionIds.length > 1) return;

    try {
      setPollVoting(true);
      await PollService.votePoll(effectivePollId, pollSelectedOptionIds, user.id);
      await refreshPoll();
      setPollSelectedOptionIds([]);
    } catch (e) {
      console.error('❌ Vote failed:', e);
    } finally {
      setPollVoting(false);
    }
  };

  const renderPollBubble = () => {
    const colors = DesignTokens.colors;
    const t = DesignTokens.typography;
    const s = DesignTokens.spacing;
    const r = DesignTokens.borderRadius;

    const optionsFromMeta = Array.isArray(pollMeta?.options) ? pollMeta?.options : [];
    const options = pollData?.options?.length
      ? pollData.options.map(o => ({ id: o.id, text: o.text }))
      : optionsFromMeta;

    const isLocked = !!pollData?.is_locked;
    const multipleChoice = !!(pollData?.multiple_choice ?? pollMeta?.multiple_choice);
    const userVotes = pollData?.user_votes || [];
    const hasVoted = userVotes.length > 0;
    const canVote = !!user?.id && !isLocked && !hasVoted;
    const totalVotes = pollData?.total_votes ?? pollData?.options?.reduce((sum, o) => sum + (o.votes_count || 0), 0) ?? 0;

    // שומרים על אותו סטייל של בועות הצ'אט (טקסט לבן)
    // כדי שלא ייראה "כרטיס בתוך כרטיס".
    const textMain = '#FFFFFF';
    const textSub = colors.text.secondary;
    const dimOpacity = 0.85;
    const fontFamily = t.fontFamily.system[0];

    const getOptionVotesCount = (optionId: string) => {
      const found = pollData?.options?.find(o => o.id === optionId);
      return found?.votes_count ?? 0;
    };

    const getOptionPercent = (optionId: string) => {
      if (!pollData) return 0;
      const votes = getOptionVotesCount(optionId);
      if (!totalVotes) return 0;
      return Math.max(0, Math.min(100, Math.round((votes / totalVotes) * 100)));
    };

    const isSelected = (optionId: string) => {
      // אחרי הצבעה — הדגשה לפי ההצבעה בפועל
      if (hasVoted) return userVotes.includes(optionId);
      // לפני הצבעה — לפי הבחירה המקומית
      return pollSelectedOptionIds.includes(optionId);
    };

    const toggleSelect = (optionId: string) => {
      if (!canVote) return;
      if (multipleChoice) {
        setPollSelectedOptionIds(prev => (prev.includes(optionId) ? prev.filter(id => id !== optionId) : [...prev, optionId]));
      } else {
        setPollSelectedOptionIds([optionId]);
      }
    };

    const canSubmit = canVote && pollSelectedOptionIds.length > 0 && !(multipleChoice === false && pollSelectedOptionIds.length > 1);
    const voteLabel = isLocked ? 'נעול' : hasVoted ? 'הצבעת' : 'הצבע';

    return (
      <View style={styles.pollContainer}>
        <Text style={[styles.pollHint, { color: textSub, opacity: dimOpacity, fontFamily }]}>
          {multipleChoice ? 'בחירה מרובה' : 'בחירה יחידה'}
          {isLocked ? ' · נעול' : ''}
        </Text>

        <Text style={[styles.pollQuestion, { color: textMain, fontFamily }]} numberOfLines={6}>
          {pollData?.question || message.content || 'סקר'}
        </Text>

        <View style={{ gap: s.sm }}>
          {!effectivePollId || options.length === 0 ? (
            <View style={[styles.pollEmptyState, { borderColor: colors.border.primary }]}>
              <Text style={[styles.pollEmptyText, { color: textSub, opacity: dimOpacity, fontFamily }]}>
                {pollLoading
                  ? 'טוען אופציות…'
                  : !effectivePollId
                    ? 'טוען סקר…'
                    : 'לא נטענו אופציות'}
              </Text>
              {pollLoading ? (
                <ActivityIndicator color={colors.primary.main} style={{ marginTop: s.xs }} />
              ) : (
                <TouchableOpacity onPress={refreshPoll} activeOpacity={0.85} style={{ marginTop: s.xs }}>
                  <Text style={{ color: colors.primary.main, fontWeight: t.fontWeight.bold as any, fontFamily }}>
                    רענן
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            options.map(opt => {
              const votesCount = getOptionVotesCount(opt.id);
              const percent = getOptionPercent(opt.id);
              const selected = isSelected(opt.id);
              const leftIcon = multipleChoice
                ? selected
                  ? 'checkbox'
                  : 'checkbox-outline'
                : selected
                ? 'radio-button-on'
                : 'radio-button-off';

              const borderCol = selected
                ? colors.border.active
                : isMe
                  ? 'rgba(255,255,255,0.22)'
                  : colors.border.primary;
              const trackBg = 'rgba(255,255,255,0.12)';
              const fillBg = colors.primary.main;
              const selectedBg = selected ? 'rgba(5, 209, 87, 0.16)' : 'transparent';

              return (
                <TouchableOpacity
                  key={`poll-opt-${message.id}-${opt.id}`}
                  onPress={() => toggleSelect(opt.id)}
                  activeOpacity={0.85}
                  disabled={!effectivePollId || !canVote}
                  style={[
                    styles.pollOption,
                    {
                      borderColor: borderCol,
                      backgroundColor: selectedBg,
                      opacity: canVote ? 1 : 0.85,
                    },
                  ]}
                >
                  <View style={styles.pollOptionRow}>
                    <Ionicons
                      name={leftIcon as any}
                      size={18}
                      color={selected ? colors.primary.main : textSub}
                    />
                    <Text style={[styles.pollOptionText, { color: textMain, fontFamily }]} numberOfLines={2}>
                      {opt.text}
                    </Text>

                    {!!pollData && (
                      <Text style={[styles.pollOptionCount, { color: textSub, opacity: dimOpacity, fontFamily }]}>
                        {votesCount}
                      </Text>
                    )}
                  </View>

                  {!!pollData && (
                    <View style={[styles.pollBarTrack, { backgroundColor: trackBg }]}>
                      <View style={[styles.pollBarFill, { width: `${percent}%`, backgroundColor: fillBg }]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Vote count at top (if exists) */}
        {!!pollData && totalVotes > 0 && (
          <Text style={[styles.pollVotesCount, { color: textSub, opacity: dimOpacity, fontFamily }]}>
            {totalVotes} הצבעות
          </Text>
        )}

        {/* Divider and View Votes button (if has votes) */}
        {totalVotes > 0 && (
          <>
            <View style={styles.pollDivider} />
            <TouchableOpacity
              onPress={() => setShowVotesSheet(true)}
              activeOpacity={0.85}
              style={styles.pollViewVotesBtn}
            >
              <Text style={[styles.pollViewVotesText, { fontFamily }]}>הצג הצבעות</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Vote button - only show if user hasn't voted yet */}
        {!hasVoted && (
          <TouchableOpacity
            onPress={submitPollVote}
            activeOpacity={0.85}
            disabled={!canSubmit || pollVoting || isLocked}
            style={[
              styles.pollVoteBtn,
              {
                borderColor: colors.border.active,
                backgroundColor: isMe ? 'rgba(255,255,255,0.10)' : 'rgba(5, 209, 87, 0.18)',
                opacity: canSubmit && !pollVoting && !isLocked ? 1 : 0.55,
                marginTop: totalVotes > 0 ? s.sm : s.md,
              },
            ]}
          >
            {pollVoting ? (
              <ActivityIndicator color={colors.primary.main} />
            ) : (
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: t.fontSize.sm,
                  fontWeight: t.fontWeight.black as any,
                  fontFamily,
                }}
              >
                {voteLabel}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.theirMessage]}>
      {/* Avatar */}
      {!isMe && showAvatar && (
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
      )}

      {/* Message Content */}
      <View style={[
        styles.messageContent, 
        isMe && styles.messageContentMe,
        message.message_type === MessageType.AUDIO && styles.audioMessageContent
      ]}>
        {/* Bubble */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          onLongPress={onLongPress}
          style={[
            styles.bubble, 
            isMe ? styles.myBubble : styles.theirBubble,
            (message.message_type === MessageType.IMAGE || message.message_type === MessageType.VIDEO) && styles.mediaBubble,
          ]}
        >
          {/* Sender Name - בתוך הבועה */}
          {!isMe && showSenderName && (
            <Text style={[styles.senderNameInside, { color: DesignTokens.colors.text.primary }]}>
              {message.sender?.display_name || 'משתמש'}
            </Text>
          )}

          {/* Reply To - בועה קטנה בתוך הבועה הגדולה */}
          {(() => {
            // לוגים לבדיקה
            if (message.reply_to_message_id || message.reply_to) {
              console.log('🔍 ChatMessage Reply Debug:', {
                messageId: message.id,
                reply_to_message_id: message.reply_to_message_id,
                reply_to: message.reply_to,
                hasReplyTo: !!message.reply_to,
              });
            }
            
            return message.reply_to ? (
              <TouchableOpacity 
                key={`reply-${message.id}-${message.reply_to.message_id}`}
                style={[styles.replyContainer, isMe ? styles.replyContainerMe : styles.replyContainerThem]}
                onPress={() => {
                  // גלול להודעה המקורית
                  if (message.reply_to?.message_id && onJumpToMessage) {
                    onJumpToMessage(message.reply_to.message_id);
                  }
                }}
                activeOpacity={0.7}
              >
                <View key={`reply-bar-${message.id}`} style={styles.replyBar} />
                <View key={`reply-content-${message.id}`} style={styles.replyContent}>
                  <Text key={`reply-name-${message.id}`} style={[styles.replyName, { textAlign: 'right' }]}>
                    {String(message.reply_to.sender_name || 'משתמש')}
                  </Text>
                  <Text key={`reply-text-${message.id}`} style={[styles.replyText, { textAlign: 'right' }]} numberOfLines={1}>
                    {String(message.reply_to.content || getMediaTypeText(message.reply_to.message_type))}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null;
          })()}

          {/* Forwarded Tag */}
          {message.is_forwarded && (
            <View key={`forwarded-tag-${message.id}`} style={styles.forwardedTag}>
              <Text key={`forwarded-text-${message.id}`} style={styles.forwardedText}>הועבר</Text>
            </View>
          )}

          {/* Media Content */}
          {renderMediaContent(message, styles, isMe, () => {
            if (message.media_url && (message.message_type === MessageType.IMAGE || message.message_type === MessageType.VIDEO)) {
              setShowMediaViewer(true);
            }
          })}

          {/* Text Content */}
          {message.content && message.message_type !== MessageType.POLL && (
            <Text 
              style={[
                styles.messageText, 
                isMe ? styles.myMessageText : styles.theirMessageText,
                message.media_url && styles.messageTextWithMedia, // padding נוסף כשיש גם מדיה
                { textAlign: detectTextDirection(message.content) }
              ]}
            >
              {message.content}
            </Text>
          )}

          {/* Poll bubble (DesignTokens) */}
          {message.message_type === MessageType.POLL && renderPollBubble()}

          {/* Metadata */}
          <View style={styles.metadata}>
            <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText]}>{timeText}</Text>
            {message.is_edited && (
              <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.theirTimeText, styles.editedText]}> · נערך</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Reactions - בועה אחת עם כל האימוג'ים */}
        {message.reactions && message.reactions.length > 0 && (
          <TouchableOpacity 
            style={[styles.reactionsContainer, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}
            onPress={() => onReactionDetailsPress?.(message)}
          >
            <View style={styles.singleReactionBubble}>
              {message.reactions.slice(0, 3).map((reaction, index) => (
                <View key={`${message.id}-reaction-${reaction.emoji}-${index}`} style={styles.reactionItem}>
                  <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                  {reaction.count > 1 && (
                    <Text style={styles.reactionCount}>{reaction.count}</Text>
                  )}
                </View>
              ))}
              {message.reactions.length > 3 && (
                <Text style={styles.moreReactionsText}>
                  +{message.reactions.slice(3).reduce((sum, r) => sum + r.count, 0)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Spacer for avatar on my messages */}
      {/* Media Viewer */}
      {(message.message_type === MessageType.IMAGE || message.message_type === MessageType.VIDEO) && message.media_url && (
        <MediaViewer
          visible={showMediaViewer}
          mediaUrl={message.media_url}
          mediaType={message.message_type === MessageType.IMAGE ? 'image' : 'video'}
          caption={message.content || undefined}
          onClose={() => setShowMediaViewer(false)}
        />
      )}

      {/* Poll Votes BottomSheet */}
      {message.message_type === MessageType.POLL && effectivePollId && pollData && (
        <PollVotesBottomSheet
          visible={showVotesSheet}
          onClose={() => setShowVotesSheet(false)}
          pollId={effectivePollId}
          pollOptions={pollData.options}
          pollQuestion={pollData.question || message.content || 'סקר'}
        />
      )}
    </View>
  );
}

// ============================================
// Helper Functions
// ============================================

function renderMediaContent(
  message: ChatMessageType,
  styles: any,
  isMe: boolean,
  onMediaPress?: () => void
) {
  if (!message.media_url) return null;

  switch (message.message_type) {
    case MessageType.IMAGE:
      return (
        <TouchableOpacity onPress={onMediaPress} activeOpacity={0.9}>
          <Image
            source={{ uri: message.media_thumbnail_url || message.media_url }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );

    case MessageType.VIDEO:
      return (
        <TouchableOpacity onPress={onMediaPress} activeOpacity={0.9}>
          <View style={styles.mediaVideo}>
            {message.media_thumbnail_url && (
              <Image
                source={{ uri: message.media_thumbnail_url }}
                style={styles.mediaImage}
                resizeMode="cover"
              />
            )}
            <View style={styles.playButton}>
              <Ionicons name="play" size={32} color="#FFFFFF" />
            </View>
          </View>
        </TouchableOpacity>
      );

    case MessageType.AUDIO:
      return (
        <AudioPlayer
          audioUrl={message.media_url || ''}
          duration={message.media_duration || 0}
          isMe={isMe}
          styles={styles}
          message={message}
        />
      );

    case MessageType.DOCUMENT:
      return (
        <View style={styles.mediaDocument}>
          <Text style={styles.documentIcon}>📎</Text>
          <Text style={styles.documentName} numberOfLines={1}>
            {message.media_file_name || 'מסמך'}
          </Text>
        </View>
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

function getMediaTypeText(type?: MessageType | string | null): string {
  if (!type) return 'מדיה';
  
  switch (type) {
    case MessageType.IMAGE:
      return '📷 תמונה';
    case MessageType.VIDEO:
      return '🎥 סרטון';
    case MessageType.AUDIO:
      return '🎤 הודעה קולית';
    case MessageType.DOCUMENT:
      return '📎 מסמך';
    default:
      return 'מדיה';
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// Audio Player Component
// ============================================
interface AudioPlayerProps {
  audioUrl: string;
  duration: number; // in seconds
  isMe: boolean;
  styles: any;
  message: ChatMessageType;
}

function AudioPlayer({ audioUrl, duration, isMe, styles, message }: AudioPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [actualDuration, setActualDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const positionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const waveformContainerRef = useRef<View | null>(null);

  // Load audio duration on mount
  useEffect(() => {
    if (!audioUrl) return;

    const loadDuration = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
          const durationInSeconds = status.durationMillis / 1000;
          setActualDuration(durationInSeconds);
        }
        await sound.unloadAsync();
      } catch (error) {
        console.log('⚠️ Error loading audio duration:', error);
        // אם נכשל, נשתמש ב-duration prop אם הוא קיים
        if (duration > 0) {
          setActualDuration(duration);
        }
      }
    };

    loadDuration();
  }, [audioUrl]);

  // Update position while playing - עדכון מהיר יותר לחלקות
  useEffect(() => {
    if (isPlaying && soundRef.current) {
      positionIntervalRef.current = setInterval(async () => {
        try {
          if (soundRef.current) {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded) {
              // שימוש ב-milliseconds לחלקות טובה יותר
              const posMillis = status.positionMillis || 0;
              const posSeconds = posMillis / 1000;
              setPosition(posSeconds);
              
              // אם ה-duration לא נטען עדיין, ננסה לטעון אותו
              if (actualDuration === 0 && status.durationMillis && status.durationMillis > 0) {
                setActualDuration(status.durationMillis / 1000);
              }
              
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
                // איפוס ה-sound כדי שניתן יהיה לנגן שוב
                if (soundRef.current && status.isLoaded) {
                  try {
                    await soundRef.current.setPositionAsync(0);
                  } catch (e) {
                    console.log('⚠️ Error resetting position:', e);
                  }
                }
              } else if (!status.isPlaying && isPlaying) {
                setIsPlaying(false);
              }
            }
          }
        } catch (error) {
          console.log('⚠️ Error updating position:', error);
        }
      }, 50); // עדכון כל 50ms במקום 100ms לחלקות טובה יותר
    } else {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
        positionIntervalRef.current = null;
      }
    }

    return () => {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
        positionIntervalRef.current = null;
      }
    };
  }, [isPlaying, actualDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
    };
  }, []);

  const togglePlayPause = async () => {
    try {
      if (!soundRef.current) {
        // Load and play
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true, rate: playbackRate },
          (status) => {
            if (status.isLoaded) {
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
              }
            }
          }
        );
        soundRef.current = sound;
        setIsPlaying(true);
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis && status.durationMillis > 0) {
          setActualDuration(status.durationMillis / 1000);
        } else if (duration > 0 && actualDuration === 0) {
          // אם ה-duration לא נטען מה-sound, נשתמש ב-duration prop
          setActualDuration(duration);
        }
      } else {
        // Toggle play/pause - וודא שה-rate נשמר
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
            setIsPlaying(false);
          } else {
            // אם ההקלטה הסתיימה או קרובה לסיום, התחל מחדש מההתחלה
            if (status.didJustFinish || (actualDuration > 0 && position >= actualDuration - 0.1)) {
              await soundRef.current.setPositionAsync(0);
              setPosition(0);
            }
            // הפעל עם ה-rate הנוכחי
            await soundRef.current.setRateAsync(playbackRate, true);
            await soundRef.current.playAsync();
            setIsPlaying(true);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error toggling audio:', error);
    }
  };

  const togglePlaybackRate = async () => {
    const rates = [1.0, 1.5, 2.0];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          // הפעל את ה-rate גם אם זה לא מנגן כרגע
          await soundRef.current.setRateAsync(nextRate, true);
          // אם זה מנגן, המשך לנגן עם ה-rate החדש
          if (status.isPlaying) {
            await soundRef.current.playAsync();
          }
        }
      } catch (error) {
        console.error('❌ Error setting playback rate:', error);
      }
    }
  };

  // חישוב progress עם דיוק גבוה יותר לחלקות
  const progress = actualDuration > 0 ? Math.min(100, Math.max(0, (position / actualDuration) * 100)) : 0;
  // שימוש ב-actualDuration אם הוא קיים ויותר מ-0, אחרת ב-duration prop
  const displayDuration = (actualDuration > 0) ? actualDuration : (duration > 0 ? duration : 0);
  // יצירת waveformData - שימוש בנתונים אמיתיים אם קיימים, אחרת placeholder יפה יותר
  const waveformData = useMemo(() => {
    const FIXED_BARS_COUNT = 25; // יותר bars לתצוגה חלקה יותר
    
    // בדיקה אם יש waveformData אמיתי ב-metadata
    const realWaveformData = (message as any)?.metadata?.waveformData;
    if (realWaveformData && Array.isArray(realWaveformData) && realWaveformData.length > 0) {
      // נרמל את הנתונים
      const normalizedData = [];
      const step = realWaveformData.length / FIXED_BARS_COUNT;
      for (let i = 0; i < FIXED_BARS_COUNT; i++) {
        const index = Math.floor(i * step);
        const value = realWaveformData[index] || 0.3;
        // נרמל בין 0.25 ל-1.0
        normalizedData.push(Math.max(0.25, Math.min(1.0, value)));
      }
      return normalizedData;
    }
    
    // אם אין נתונים אמיתיים, יצירת waveform יפה יותר
    // סוג של "הר" באמצע עם וריאציות
    const seed = audioUrl ? audioUrl.length : 0;
    const data = [];
    for (let i = 0; i < FIXED_BARS_COUNT; i++) {
      // יצירת צורת גל יפה - גבוה יותר באמצע
      const centerPosition = Math.abs(i - FIXED_BARS_COUNT / 2) / (FIXED_BARS_COUNT / 2);
      const baseHeight = 1 - centerPosition * 0.5; // גבוה יותר במרכז
      
      // הוספת וריאציה אקראית אבל דטרמיניסטית
      const pseudoRandom = Math.sin((seed + i) * 12.9898 + i * 0.5) * 43758.5453;
      const variation = ((pseudoRandom % 1) + 1) / 2 * 0.4; // וריאציה של עד 40%
      
      const finalValue = Math.max(0.25, Math.min(1.0, baseHeight * 0.7 + variation));
      data.push(finalValue);
    }
    return data;
  }, [audioUrl, message]);

  return (
    <View style={[styles.mediaAudio, isMe && styles.mediaAudioMe]}>
      {/* Play/Pause Button */}
      <TouchableOpacity
        onPress={togglePlayPause}
        activeOpacity={0.7}
        style={styles.audioPlayButton}
      >
        <Image
          source={isPlaying 
            ? require('../../assets/icons/ico-24-pause.png')
            : require('../../assets/icons/ico-24-play.png')
          }
          style={styles.audioPlayIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Total Duration - האורך הכולל קודם */}
      <Text style={[styles.audioTimeTotal, isMe ? styles.myAudioTime : styles.theirAudioTime]}>
        {formatDuration(displayDuration)}
      </Text>

      {/* Waveform Container with Progress Indicator */}
      <View style={styles.audioWaveformWrapper}>
        <View style={styles.audioWaveformContainer}>
          <View
            ref={waveformContainerRef}
            style={styles.audioWaveformBars}
          >
            {waveformData.map((value: number, index: number) => {
              const barHeight = Math.max(6, value * 24);
              const audioUrlHash = audioUrl ? audioUrl.substring(audioUrl.length - 10) : 'no-url';
              const uniqueKey = `${audioUrlHash}-waveform-${index}-${value.toFixed(4)}`;
              
              // חישוב האם הפס הזה כבר "נוגן" לפי ה-progress (משמאל לימין)
              const barProgress = (index / waveformData.length) * 100;
              const isPlayed = barProgress <= progress;
              
              // צבעים - ירוק לנוגן, אפור לא נוגן
              const playedColor = '#0FB96E'; // ירוק
              const unplayedColor = 'rgba(255, 255, 255, 0.3)'; // לבן שקוף
              
              return (
                <View
                  key={uniqueKey}
                  style={[
                    styles.audioWaveformBar,
                    {
                      height: barHeight,
                      backgroundColor: isPlayed ? playedColor : unplayedColor,
                    }
                  ]}
                />
              );
            })}
          </View>
          
          {/* Progress Indicator (Circle) - זז משמאל לימין */}
          <View
            style={[
              styles.audioProgressIndicator,
              {
                left: `${progress}%`,
                backgroundColor: '#0FB96E' // ירוק
              }
            ]}
          />
        </View>
      </View>

      {/* Current Time - הזמן הנוכחי אחרי ה-waveform */}
      <Text style={[styles.audioTimeCurrent, isMe ? styles.myAudioTime : styles.theirAudioTime]}>
        {formatDuration(position)}
      </Text>

      {/* Speed Button */}
      <TouchableOpacity
        onPress={togglePlaybackRate}
        style={styles.audioSpeedButton}
        activeOpacity={0.7}
      >
        <Text style={styles.audioSpeedText}>{playbackRate.toFixed(1)}x</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================
// Styles - Modern Design from Reference
// ============================================

// Design Colors (from reference)
const MSG_COLORS = {
  background: {
    primary: 'rgba(0, 10, 4, 1)',
    secondary: 'rgba(6, 18, 12, 0.9)',
    tertiary: 'rgba(10, 24, 16, 0.9)',
  },
  border: 'rgba(255, 255, 255, 0.06)',
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(209, 213, 219, 0.9)',
    tertiary: 'rgba(148, 163, 184, 0.9)',
  },
  accent: '#0FB96E',      // primary green
  accentDark: '#0A8F55',  // darker green
  success: '#22C55E',
  danger: '#EF4444',
};

const createStyles = (tokens: any) => StyleSheet.create({
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 3,
    paddingHorizontal: 8,
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  theirMessage: {
    justifyContent: 'flex-start',
  },
  
  avatarContainer: {
    marginRight: 8,
    marginBottom: 2,
  },
  avatar: {
    width: 32,
    height: 30,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: MSG_COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  messageContent: {
    maxWidth: '75%',
    alignItems: 'flex-start',
  },
  messageContentMe: {
    alignItems: 'flex-end',
  },
  audioMessageContent: {
    maxWidth: '90%', // בועת אודיו צריכה יותר מקום לכל הרכיבים
  },
  
  senderNameInside: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 0,
    marginBottom: 4,
    textAlign: 'right',
    alignSelf: 'flex-end',
    width: '100%',
  },
  
  replyContainer: {
    flexDirection: 'row-reverse',
    borderRadius: 8,
    padding: 10,
    paddingRight: 6,
    marginBottom: 6,
    marginTop: 2,
    overflow: 'hidden',
    borderWidth: 0,
    minHeight: 50,
    width: '100%',
  },
  replyContainerMe: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  replyContainerThem: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  replyBar: {
    width: 3,
    backgroundColor: MSG_COLORS.accent,
    borderRadius: 1.5,
    marginLeft: 8,
    flexShrink: 0,
    minHeight: 24,
  },
  replyContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  replyName: {
    fontSize: 12,
    fontWeight: '600',
    color: MSG_COLORS.accent,
    marginBottom: 3,
    textAlign: 'right',
  },
  replyText: {
    fontSize: 11,
    color: MSG_COLORS.text.secondary,
    opacity: 0.9,
  },
  
  // Bubble - px-4 py-2.5 rounded-2xl
  bubble: {
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: '100%',
  },
  mediaBubble: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  // Sent - glassy green bubble (matches app primary)
  myBubble: {
    backgroundColor: 'rgba(15, 185, 110, 0.25)',
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 185, 110, 0.4)',
    shadowColor: 'rgba(15, 185, 110, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  // Received - glassy dark bubble
  theirBubble: {
    backgroundColor: 'rgba(6, 18, 12, 0.8)',
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
    fontSize: 11,
    fontStyle: 'italic',
    color: MSG_COLORS.text.secondary,
    opacity: 0.7,
  },
  
  mediaImage: {
    width: '100%',
    maxWidth: 240,
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  mediaVideo: {
    position: 'relative',
    width: '100%',
    maxWidth: 240,
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 24,
  },
  
  mediaAudio: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 0,
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: '98%',
    backgroundColor: 'transparent',
  },
  mediaAudioMe: {
    alignSelf: 'flex-end', // מיושר לימין עבור הודעות שלי
  },
  audioPlayButton: {
    width: 32, // הגדלתי מ-28 ל-32
    height: 32, // הגדלתי מ-28 ל-32
    borderRadius: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  audioPlayIcon: {
    width: 24,
    height: 24,
    tintColor: '#FFFFFF', // לבן לנראות טובה יותר
  },
  audioTimeCurrent: {
    fontSize: 11,
    fontWeight: '500',
    width: 30, // רוחב קבוע
    textAlign: 'right',
    flexShrink: 0,
  },
  audioWaveformWrapper: {
    width: 130, // רוחב קצת יותר גדול
    height: 32, // גובה יותר גדול
    flexShrink: 0, // לא להתכווץ
    paddingHorizontal: 6,
  },
  audioWaveformContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    overflow: 'visible',
  },
  audioWaveformBars: {
    flexDirection: 'row', // משמאל לימין כמו שזמן זורם
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  audioWaveformBar: {
    width: 3, // רוחב מותאם
    borderRadius: 2,
  },
  audioProgressIndicator: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6, // מרכוז הנקודה
    top: '50%',
    marginTop: -6,
    zIndex: 10,
    // צל לנקודה
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  audioTimeTotal: {
    fontSize: 11,
    fontWeight: '500',
    width: 30, // רוחב קבוע
    textAlign: 'right',
    flexShrink: 0,
  },
  audioSpeedButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    width: 40, // רוחב קבוע
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  audioSpeedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  myAudioTime: {
    color: 'rgba(255, 255, 255, 0.9)', // לבן להודעות שלי
  },
  theirAudioTime: {
    color: 'rgba(255, 255, 255, 0.85)', // לבן גם להודעות של אחרים
  },
  audioDuration: {
    fontSize: 13,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'left',
  },
  myAudioDuration: {
    color: '#FFFFFF',
  },
  theirAudioDuration: {
    color: MSG_COLORS.text.primary,
  },
  
  mediaDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 150,
  },
  documentIcon: {
    fontSize: 24,
  },
  documentName: {
    fontSize: 14,
    flex: 1,
    color: MSG_COLORS.text.primary,
  },
  
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 0,
    marginBottom: 0,
    color: '#FFFFFF',
  },
  messageTextWithMedia: {
    marginTop: 8,
    paddingHorizontal: 2,
  },
  // Both sent and received have white text
  myMessageText: {
    color: '#FFFFFF', // text-white
  },
  theirMessageText: {
    color: '#FFFFFF', // text-white
  },
  deletedText: {
    fontStyle: 'italic',
    opacity: 0.6,
  },
  
  metadata: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
    justifyContent: 'flex-start',
  },
  editedText: {
    fontStyle: 'italic',
    opacity: 0.7,
  },
  // text-xs text-gray-500
  timeText: {
    fontSize: 11,
    opacity: 0.8,
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  theirTimeText: {
    color: MSG_COLORS.text.tertiary,
  },
  
  // Reactions - בועה אחת לכל האימוג'ים
  reactionsContainer: {
    marginTop: -6,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  singleReactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MSG_COLORS.background.tertiary,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MSG_COLORS.background.tertiary,
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  moreReactionsText: {
    color: MSG_COLORS.text.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
  },
  myReaction: {
    backgroundColor: MSG_COLORS.background.tertiary,
    borderWidth: 1,
    borderColor: MSG_COLORS.accent,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '500',
    color: MSG_COLORS.text.secondary,
    marginLeft: 1,
    marginRight: 4,
  },
  
  systemMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  systemMessageLine: {
    flex: 1,
    height: 1,
    backgroundColor: MSG_COLORS.text.tertiary,
    opacity: 0.3,
  },
  systemMessageText: {
    fontSize: 12,
    fontWeight: '500',
    color: MSG_COLORS.text.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    textAlign: 'center',
    backgroundColor: MSG_COLORS.background.tertiary,
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Poll (DesignTokens)
  pollContainer: {
    marginTop: 2,
    paddingTop: 2,
  },
  pollHint: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.semibold,
    textAlign: 'right',
    marginBottom: tokens.spacing.sm,
  },
  pollQuestion: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.extrabold,
    lineHeight: 22,
    marginBottom: tokens.spacing.md,
    textAlign: 'right',
  },
  pollEmptyState: {
    borderWidth: 1,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollEmptyText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.semibold,
    textAlign: 'center',
  },
  pollOption: {
    borderWidth: 1,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  pollOptionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  pollOptionText: {
    flex: 1,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.bold,
    textAlign: 'right',
  },
  pollOptionCount: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.extrabold,
    minWidth: 22,
    textAlign: 'left',
  },
  pollBarTrack: {
    marginTop: 8,
    height: 3,
    borderRadius: tokens.borderRadius.full,
    overflow: 'hidden',
  },
  pollBarFill: {
    height: '100%',
    borderRadius: tokens.borderRadius.full,
  },
  pollVotesCount: {
    fontSize: tokens.typography.fontSize.xs,
    fontWeight: tokens.typography.fontWeight.semibold,
    textAlign: 'right',
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  pollDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginVertical: tokens.spacing.sm,
  },
  pollViewVotesBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pollViewVotesText: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.primary.main,
  },
  pollVoteBtn: {
    minWidth: 84,
    borderWidth: 1,
    borderRadius: tokens.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
});

