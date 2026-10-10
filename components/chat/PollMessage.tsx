import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Collapsible } from '../ui/Collapsible';
import { APP_TYPE } from '../ui/appType';
import { Ionicons } from '@expo/vector-icons';
import { Lock, Trash2 } from 'lucide-react-native';
import { PollService, PollWithVotes } from '../../services/pollService';
import PollResults from './PollResults';
import { useAuth } from '../../context/AuthContext';
import { useDesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { chatPalette, chatRtlRow, chatRtlText } from './chatDesignTokens';

interface PollMessageProps {
  poll: PollWithVotes;
  chatId: string;
  onPollUpdated: (updatedPoll: PollWithVotes) => void;
  isAdmin?: boolean;
  isMe?: boolean;
  /** כשמרנדרים בתוך בועת ChatMessage — בלי רקע/מסגרת כפולה */
  embeddedInBubble?: boolean;
}

function applyOptimisticVotes(
  poll: PollWithVotes,
  nextVotes: string[],
): PollWithVotes {
  const prevVotes = new Set(poll.user_votes || []);
  const nextSet = new Set(nextVotes);
  const options = poll.options.map((opt) => {
    let count = opt.votes_count || 0;
    if (prevVotes.has(opt.id) && !nextSet.has(opt.id)) count -= 1;
    if (!prevVotes.has(opt.id) && nextSet.has(opt.id)) count += 1;
    return { ...opt, votes_count: Math.max(0, count) };
  });
  const total_votes = options.reduce((sum, o) => sum + (o.votes_count || 0), 0);
  return {
    ...poll,
    options,
    user_votes: nextVotes,
    total_votes,
  };
}

function PollMessage({
  poll,
  onPollUpdated,
  isAdmin = false,
  isMe = false,
  embeddedInBubble = false,
}: PollMessageProps) {
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  const lightOnBubble = embeddedInBubble && isMe;
  const styles = useMemo(
    () => createStyles(DesignTokens, isMe, lightOnBubble, embeddedInBubble),
    [DesignTokens, isMe, lightOnBubble, embeddedInBubble],
  );
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [currentPoll, setCurrentPoll] = useState<PollWithVotes>(poll);

  useEffect(() => {
    setCurrentPoll(poll);
    if (poll.user_votes && poll.user_votes.length > 0) {
      setShowResults(true);
    }
  }, [poll]);

  const allowVoteChange = !!currentPoll.allow_vote_change;
  const isUserVoted = !!(currentPoll.user_votes && currentPoll.user_votes.length > 0);
  const canVote = !currentPoll.is_locked && (!isUserVoted || allowVoteChange);
  const showAdmin = isAdmin && currentPoll.creator_id === user?.id;
  const isChangingVote = isUserVoted && allowVoteChange && !showResults;

  const handleOptionSelect = (optionId: string) => {
    if (currentPoll.is_locked || !canVote) return;

    if (currentPoll.multiple_choice) {
      setSelectedOptions((prev) => {
        if (prev.includes(optionId)) {
          return prev.filter((id) => id !== optionId);
        }
        return [...prev, optionId];
      });
      return;
    }

    // בחירה יחידה + שינוי מותר: לחיצה מיידית מעדכנת הצבעה
    if (isUserVoted && allowVoteChange) {
      const sameAsCurrent =
        (currentPoll.user_votes?.length === 1 && currentPoll.user_votes[0] === optionId);
      if (sameAsCurrent && showResults) {
        // retap על אותה אפשרות — אין שינוי
        return;
      }
      void submitVote([optionId], { silent: true });
      return;
    }

    setSelectedOptions([optionId]);
  };

  const submitVote = async (
    optionIds: string[],
    opts?: { silent?: boolean },
  ) => {
    if (optionIds.length === 0) {
      legacyAlert('שגיאה', 'יש לבחור לפחות אפשרות אחת');
      return;
    }

    if (!currentPoll.multiple_choice && optionIds.length > 1) {
      legacyAlert('שגיאה', 'סקר זה מאפשר רק תשובה אחת');
      return;
    }

    if (!user?.id || isVoting) return;

    const previous = currentPoll;
    const optimistic = applyOptimisticVotes(currentPoll, optionIds);
    setCurrentPoll(optimistic);
    onPollUpdated(optimistic);
    setShowResults(true);
    setSelectedOptions([]);
    setIsVoting(true);

    try {
      await PollService.votePoll(currentPoll.id, optionIds, user.id);
      const updatedPoll = await PollService.getPollResults(currentPoll.id, user.id);
      if (updatedPoll) {
        setCurrentPoll(updatedPoll);
        onPollUpdated(updatedPoll);
        void HapticFeedback.impactLight();
        if (!opts?.silent) {
          legacyAlert(
            'הצלחה',
            isUserVoted && allowVoteChange
              ? 'הבחירה עודכנה בהצלחה!'
              : 'ההצבעה נשלחה בהצלחה!',
          );
        }
      }
    } catch (error: any) {
      setCurrentPoll(previous);
      onPollUpdated(previous);
      setShowResults(!!(previous.user_votes && previous.user_votes.length > 0));
      void HapticFeedback.error();
      legacyAlert('שגיאה', error.message || 'לא ניתן לשלוח את ההצבעה');
    } finally {
      setIsVoting(false);
    }
  };

  const handleVote = async () => {
    await submitVote(selectedOptions, { silent: false });
  };

  const handleStartChangeVote = () => {
    if (!allowVoteChange || currentPoll.is_locked) return;
    setSelectedOptions([...(currentPoll.user_votes || [])]);
    setShowResults(false);
  };

  const handleResultsOptionPress = (optionId: string) => {
    if (!allowVoteChange || currentPoll.is_locked || isVoting) return;

    if (currentPoll.multiple_choice) {
      handleStartChangeVote();
      return;
    }

    handleOptionSelect(optionId);
  };

  const handleLockPoll = async () => {
    if (!isAdmin || currentPoll.creator_id !== user?.id) return;

    legacyAlert('נעילת סקר', 'האם אתה בטוח שברצונך לנעול את הסקר? לא ניתן יהיה להצביע יותר.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'נעל',
        style: 'destructive',
        onPress: async () => {
          try {
            await PollService.lockPoll(currentPoll.id, user?.id || '');
            const updatedPoll = await PollService.getPollResults(currentPoll.id, user?.id);
            if (updatedPoll) {
              setCurrentPoll(updatedPoll);
              onPollUpdated(updatedPoll);
              void HapticFeedback.impactLight();
            }
            legacyAlert('הצלחה', 'הסקר ננעל בהצלחה');
          } catch (error: any) {
            legacyAlert('שגיאה', error.message || 'לא ניתן לנעול את הסקר');
          }
        },
      },
    ]);
  };

  const handleDeletePoll = async () => {
    if (!isAdmin || currentPoll.creator_id !== user?.id) return;

    legacyAlert('מחיקת סקר', 'האם אתה בטוח שברצונך למחוק את הסקר? פעולה זו אינה הפיכה!', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          try {
            await PollService.deletePoll(currentPoll.id, user?.id || '');
            legacyAlert('הצלחה', 'הסקר נמחק בהצלחה');
          } catch (error: any) {
            legacyAlert('שגיאה', error.message || 'לא ניתן למחוק את הסקר');
          }
        },
      },
    ]);
  };

  // נבחר = צבע כפתור ה-CTA → האייקון בצבע הטקסט ההפוך; לא נבחר = צבע משני של הבועה
  const accent = DesignTokens.colors.text.inverse;
  const mutedIcon = lightOnBubble ? DesignTokens.colors.bubbleMeMetaText : DesignTokens.colors.text.tertiary;

  return (
    <View style={styles.container}>
      {(currentPoll.multiple_choice ||
        currentPoll.is_locked ||
        allowVoteChange ||
        showAdmin) && (
        <View style={styles.topMeta}>
          <View style={styles.topMetaLeft}>
            {currentPoll.multiple_choice && (
              <Text style={styles.metaHint}>בחירה מרובה</Text>
            )}
            {allowVoteChange && !currentPoll.is_locked && (
              <Text style={styles.metaHint}>ניתן לשנות</Text>
            )}
            {currentPoll.is_locked && (
              <Text style={styles.lockedHint}>נעול</Text>
            )}
          </View>
          {showAdmin && (
            <View style={styles.adminActions}>
              {!currentPoll.is_locked && (
                <TouchableOpacity
                  onPress={handleLockPoll}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Lock size={14} color={mutedIcon} strokeWidth={2} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleDeletePoll}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Trash2 size={14} color={chatPalette.danger} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Text style={styles.question}>{currentPoll.question}</Text>

      {!showResults ? (
        <View style={styles.optionsBlock}>
          {currentPoll.options.map((option) => {
            const isSelected = selectedOptions.includes(option.id);
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleOptionSelect(option.id)}
                disabled={!canVote || isVoting}
                activeOpacity={0.7}
                style={[
                  styles.optionButton,
                  isSelected && styles.optionButtonSelected,
                  (!canVote || isVoting) && styles.optionButtonDisabled,
                ]}
              >
                <Ionicons
                  name={
                    currentPoll.multiple_choice
                      ? isSelected
                        ? 'checkbox'
                        : 'checkbox-outline'
                      : isSelected
                        ? 'radio-button-on'
                        : 'radio-button-off'
                  }
                  size={18}
                  color={isSelected ? accent : mutedIcon}
                  style={styles.optionIcon}
                />
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]} numberOfLines={1}>
                  {option.text}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* הכפתור נכנס בהנפשת גובה — הבועה גדלה בצורה חלקה ולא קופצת */}
          <Collapsible open={canVote && selectedOptions.length > 0}>
            <TouchableOpacity
              onPress={handleVote}
              disabled={isVoting}
              activeOpacity={0.85}
              style={[styles.voteButton, isVoting && styles.voteButtonDisabled]}
            >
              <Text style={styles.voteButtonText}>
                {isVoting
                  ? 'שולח...'
                  : isChangingVote
                    ? 'עדכן בחירה'
                    : 'בחירה'}
              </Text>
            </TouchableOpacity>
          </Collapsible>

          {isUserVoted && allowVoteChange && (
            <TouchableOpacity
              onPress={() => {
                setShowResults(true);
                setSelectedOptions([]);
              }}
              style={styles.showResultsButton}
            >
              <Text style={styles.showResultsText}>חזרה לתוצאות</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.optionsBlock}>
          <PollResults
            options={currentPoll.options}
            userVotes={currentPoll.user_votes || []}
            totalVotes={currentPoll.total_votes}
            multipleChoice={currentPoll.multiple_choice}
            isLocked={currentPoll.is_locked}
            isMe={isMe}
            embeddedInBubble={embeddedInBubble}
            allowChangeVote={canVote && allowVoteChange}
            onOptionPress={
              canVote && allowVoteChange ? handleResultsOptionPress : undefined
            }
          />
          {canVote && allowVoteChange && currentPoll.multiple_choice && (
            <TouchableOpacity onPress={handleStartChangeVote} style={styles.showResultsButton}>
              <Text style={styles.showResultsText}>שנה בחירה</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default React.memo(PollMessage);

const createStyles = (
  tokens: ReturnType<typeof useDesignTokens>,
  isMe: boolean,
  lightOnBubble: boolean,
  embeddedInBubble: boolean,
) => {
  // צבעים מהטוקנים של הבועה (לא לבן קבוע — בבהיר הבועה שלי ירוקה בהירה עם טקסט כהה)
  const text = lightOnBubble ? tokens.colors.bubbleMeText : tokens.colors.text.primary;
  const muted = lightOnBubble ? tokens.colors.bubbleMeMetaText : tokens.colors.text.tertiary;
  // אפשרות: מילוי רך מצבע הטקסט של הבועה (כמו כרטיס הלינק), בלי מסגרת
  const optionFill = withAlpha(text, 0.08);
  // נבחר + כפתור ההצבעה: צבע כפתור ה-CTA של הטופו
  const ctaBg = tokens.colors.primary.lightCta;
  const ctaFg = tokens.colors.text.inverse;

  return StyleSheet.create({
    container: embeddedInBubble
      ? {
          width: '100%',
          minWidth: 220,
          maxWidth: 280,
          alignSelf: 'stretch',
          paddingVertical: 2,
          // הבועה כבר נותנת paddingHorizontal: 9 כמו טקסט; מעט נוסף כמו messageTextWithMedia
          paddingHorizontal: 2,
          direction: 'rtl',
        }
      : {
          backgroundColor: isMe ? tokens.colors.bubbleMe : tokens.colors.background.secondary,
          borderRadius: tokens.borderRadius.lg,
          padding: tokens.spacing.md,
          marginBottom: tokens.spacing.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tokens.colors.border.primary,
          direction: 'rtl',
          minWidth: 220,
          maxWidth: 300,
        },
    topMeta: {
      ...chatRtlRow,
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
      minHeight: 16,
      alignSelf: 'stretch',
    },
    topMetaLeft: {
      ...chatRtlRow,
      alignItems: 'center',
      gap: 8,
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    metaHint: {
      color: muted,
      fontSize: tokens.typography.fontSize.xs,
      ...chatRtlText,
    },
    lockedHint: {
      color: chatPalette.danger,
      fontSize: tokens.typography.fontSize.xs,
      ...chatRtlText,
    },
    adminActions: {
      ...chatRtlRow,
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
    },
    question: {
      color: text,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      fontSize: APP_TYPE.cardTitle.fontSize,
      lineHeight: APP_TYPE.cardTitle.lineHeight,
      marginBottom: 12,
      ...chatRtlText,
    },
    optionsBlock: {
      gap: 8,
      alignSelf: 'stretch',
    },
    optionButton: {
      ...chatRtlRow,
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: tokens.borderRadius.lg,
      backgroundColor: optionFill,
    },
    optionButtonSelected: {
      backgroundColor: ctaBg,
    },
    optionTextSelected: {
      color: ctaFg,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
    },
    optionButtonDisabled: {
      opacity: 0.5,
    },
    optionIcon: {
      flexShrink: 0,
    },
    optionText: {
      color: text,
      fontSize: APP_TYPE.cardBody.fontSize,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      ...chatRtlText,
    },
    voteButton: {
      marginTop: 6,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: tokens.borderRadius.full,
      backgroundColor: ctaBg,
    },
    voteButtonDisabled: {
      opacity: 0.5,
    },
    voteButtonText: {
      textAlign: 'center',
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      fontSize: APP_TYPE.cardTitle.fontSize,
      color: ctaFg,
    },
    showResultsButton: {
      paddingVertical: 8,
    },
    showResultsText: {
      color: muted,
      textAlign: 'center',
      fontSize: tokens.typography.fontSize.sm,
    },
  });
};

/** #RRGGBB / #RGB → rgba עם שקיפות; צבע אחר מוחזר כמו שהוא */
function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
