import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lock, Trash2, Clock, X } from 'lucide-react-native';
import { PollService, PollWithVotes, PollOption } from '../../services/pollService';
import PollResults from './PollResults';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDesignTokens } from '../ui/DesignTokens';

interface PollMessageProps {
  poll: PollWithVotes;
  chatId: string;
  onPollUpdated: (updatedPoll: PollWithVotes) => void;
  isAdmin?: boolean;
  isMe?: boolean;
}

function PollMessage({
  poll,
  chatId,
  onPollUpdated,
  isAdmin = false,
  isMe = false
}: PollMessageProps) {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens, isMe, isDarkMode), [DesignTokens, isMe, isDarkMode]);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [currentPoll, setCurrentPoll] = useState<PollWithVotes>(poll);

  // עדכון הסקר כאשר הוא משתנה
  useEffect(() => {
    setCurrentPoll(poll);
    // אם המשתמש כבר הצביע, הצג תוצאות
    if (poll.user_votes && poll.user_votes.length > 0) {
      setShowResults(true);
    }
  }, [poll]);

  const handleOptionSelect = (optionId: string) => {
    if (currentPoll.is_locked) return;

    if (currentPoll.multiple_choice) {
      // בחירה מרובה - toggle
      setSelectedOptions(prev => {
        if (prev.includes(optionId)) {
          return prev.filter(id => id !== optionId);
        } else {
          return [...prev, optionId];
        }
      });
    } else {
      // בחירה יחידה - החלף
      setSelectedOptions([optionId]);
    }
  };

  const handleVote = async () => {
    if (selectedOptions.length === 0) {
      Alert.alert('שגיאה', 'יש לבחור לפחות אפשרות אחת');
      return;
    }

    if (!currentPoll.multiple_choice && selectedOptions.length > 1) {
      Alert.alert('שגיאה', 'סקר זה מאפשר רק תשובה אחת');
      return;
    }

    setIsVoting(true);
    try {
      await PollService.votePoll(
        currentPoll.id,
        selectedOptions,
        user?.id || ''
      );

      const updatedPoll = await PollService.getPollResults(currentPoll.id, user?.id);
      
      if (updatedPoll) {
        setCurrentPoll(updatedPoll);
        onPollUpdated(updatedPoll);
        setShowResults(true);
        setSelectedOptions([]);
      }

      Alert.alert('הצלחה', 'ההצבעה נשלחה בהצלחה!');
    } catch (error: any) {
      Alert.alert('שגיאה', error.message || 'לא ניתן לשלוח את ההצבעה');
    } finally {
      setIsVoting(false);
    }
  };

  const handleLockPoll = async () => {
    if (!isAdmin || currentPoll.creator_id !== user?.id) return;

    Alert.alert(
      'נעילת סקר',
      'האם אתה בטוח שברצונך לנעול את הסקר? לא ניתן יהיה להצביע יותר.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'נעל',
          style: 'destructive',
          onPress: async () => {
            try {
              await PollService.lockPoll(currentPoll.id, user?.id || '');
              
              // רענן את הסקר
              const updatedPoll = await PollService.getPollResults(currentPoll.id, user?.id);
              if (updatedPoll) {
                setCurrentPoll(updatedPoll);
                onPollUpdated(updatedPoll);
              }

              Alert.alert('הצלחה', 'הסקר ננעל בהצלחה');
            } catch (error: any) {
              Alert.alert('שגיאה', error.message || 'לא ניתן לנעול את הסקר');
            }
          }
        }
      ]
    );
  };

  const handleDeletePoll = async () => {
    if (!isAdmin || currentPoll.creator_id !== user?.id) return;

    Alert.alert(
      'מחיקת סקר',
      'האם אתה בטוח שברצונך למחוק את הסקר? פעולה זו אינה הפיכה!',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await PollService.deletePoll(currentPoll.id, user?.id || '');
              Alert.alert('הצלחה', 'הסקר נמחק בהצלחה');
              // כאן צריך להודיע להורה על המחיקה
            } catch (error: any) {
              Alert.alert('שגיאה', error.message || 'לא ניתן למחוק את הסקר');
            }
          }
        }
      ]
    );
  };

  const isUserVoted = currentPoll.user_votes && currentPoll.user_votes.length > 0;
  const canVote = !currentPoll.is_locked && !isUserVoted;

  return (
    <View style={styles.container}>
      {/* Poll Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('../../assets/icons/ico-40-poll-2.png')} 
            style={styles.pollIcon} 
            resizeMode="contain"
          />
          <Text style={styles.pollLabel}>סקר</Text>
          {currentPoll.multiple_choice && (
            <View style={styles.multipleChoiceBadge}>
              <Text style={styles.multipleChoiceText}>בחירה מרובה</Text>
            </View>
          )}
        </View>
        
        <View style={styles.headerRight}>
          {currentPoll.is_locked && (
            <View style={styles.lockedBadge}>
              <Lock size={14} color="#ff6b6b" strokeWidth={2} />
              <Text style={styles.lockedText}>נעול</Text>
            </View>
          )}
          
          {/* Admin Actions */}
          {isAdmin && currentPoll.creator_id === user?.id && (
            <View style={styles.adminActions}>
              {!currentPoll.is_locked && (
                <TouchableOpacity onPress={handleLockPoll} style={styles.lockButton}>
                  <Lock size={16} color={DesignTokens.colors.text.inverse} strokeWidth={2} />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity onPress={handleDeletePoll} style={styles.deleteButton}>
                <Trash2 size={16} color={DesignTokens.colors.text.inverse} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Question */}
      <Text style={styles.question}>{currentPoll.question}</Text>

      {/* Options */}
      {!showResults ? (
        <View>
          {currentPoll.options.map((option) => {
            const isSelected = selectedOptions.includes(option.id);
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleOptionSelect(option.id)}
                disabled={!canVote}
                style={[
                  styles.optionButton,
                  isSelected ? styles.optionButtonSelected : styles.optionButtonUnselected,
                  !canVote && styles.optionButtonDisabled
                ]}
              >
                <View style={styles.optionContent}>
                  <Ionicons
                    name={
                      currentPoll.multiple_choice
                        ? isSelected ? 'checkbox' : 'checkbox-outline'
                        : isSelected ? 'radio-button-on' : 'radio-button-off'
                    }
                    size={20}
                    color={isSelected ? DesignTokens.colors.primary.main : DesignTokens.colors.text.tertiary}
                    style={styles.optionIcon}
                  />
                  <Text style={styles.optionText}>{option.text}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Vote Button - הצבעה ישירה */}
          {canVote && selectedOptions.length > 0 && (
            <TouchableOpacity
              onPress={handleVote}
              disabled={isVoting}
              style={[styles.voteButton, isVoting && styles.voteButtonDisabled]}
            >
              <Text style={[styles.voteButtonText, isVoting && styles.voteButtonTextDisabled]}>
                {isVoting ? 'שולח...' : 'הצבע'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Show Results Button */}
          {isUserVoted && (
            <TouchableOpacity onPress={() => setShowResults(true)} style={styles.showResultsButton}>
              <Text style={styles.showResultsText}>הצג תוצאות</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* Results View */
        <PollResults
          options={currentPoll.options}
          userVotes={currentPoll.user_votes || []}
          totalVotes={currentPoll.total_votes}
          multipleChoice={currentPoll.multiple_choice}
          isLocked={currentPoll.is_locked}
        />
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          נוצר על ידי {currentPoll.creator_id === user?.id ? 'אתה' : 'משתמש אחר'}
        </Text>
        
        <View style={styles.footerRight}>
          <Clock size={14} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
          <Text style={styles.footerDate}>
            {new Date(currentPoll.created_at).toLocaleDateString('he-IL')}
          </Text>
        </View>
      </View>

    </View>
  );
}

export default React.memo(PollMessage);

const createStyles = (tokens: ReturnType<typeof useDesignTokens>, isMe: boolean, isDarkMode: boolean) => StyleSheet.create({
  container: {
    backgroundColor: isMe ? tokens.colors.primary.main : tokens.colors.background.secondary,
    borderRadius: tokens.borderRadius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pollIcon: {
    width: 20,
    height: 20,
    marginRight: tokens.spacing.sm,
  },
  pollLabel: {
    color: isMe
      ? isDarkMode
        ? tokens.colors.text.inverse
        : tokens.colors.text.primary
      : tokens.colors.primary.main,
    fontWeight: tokens.typography.fontWeight.bold,
    fontSize: tokens.typography.bodySmall.size,
    marginRight: tokens.spacing.sm,
  },
  multipleChoiceBadge: {
    backgroundColor: tokens.colors.background.surface,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.borderRadius.sm,
    marginRight: tokens.spacing.sm,
  },
  multipleChoiceText: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.fontSize.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  lockedText: {
    color: tokens.colors.text.danger,
    fontSize: tokens.typography.fontSize.sm,
    marginLeft: tokens.spacing.xs,
  },
  adminActions: {
    flexDirection: 'row',
  },
  lockButton: {
    backgroundColor: tokens.colors.text.warning,
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.sm,
    marginRight: tokens.spacing.sm,
  },
  deleteButton: {
    backgroundColor: tokens.colors.text.danger,
    padding: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.sm,
  },
  question: {
    color: isMe
      ? isDarkMode
        ? tokens.colors.text.inverse
        : tokens.colors.text.primary
      : tokens.colors.text.primary,
    fontWeight: tokens.typography.fontWeight.bold,
    fontSize: tokens.typography.titleSmall.size,
    marginBottom: tokens.spacing.lg,
    textAlign: 'center',
  },
  optionButton: {
    marginBottom: tokens.spacing.md,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
    borderWidth: tokens.layout.borderWidth.thick,
  },
  optionButtonSelected: {
    borderColor: isMe
      ? isDarkMode
        ? tokens.colors.text.inverse
        : tokens.colors.text.primary
      : tokens.colors.primary.main,
    backgroundColor: isMe
      ? `${tokens.colors.text.inverse}33`
      : `${tokens.colors.primary.main}33`,
  },
  optionButtonUnselected: {
    borderColor: tokens.colors.border.primary,
    backgroundColor: isMe ? tokens.colors.border.hover : tokens.colors.background.tertiary,
  },
  optionButtonDisabled: {
    opacity: 0.5,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    marginRight: tokens.spacing.md,
  },
  optionText: {
    color: isMe
      ? isDarkMode
        ? tokens.colors.text.inverse
        : tokens.colors.text.primary
      : tokens.colors.text.primary,
    fontSize: tokens.typography.titleXs.size,
    flex: 1,
    textAlign: 'right',
  },
  voteButton: {
    marginTop: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: isMe
      ? isDarkMode
        ? tokens.colors.text.inverse
        : tokens.colors.text.primary
      : tokens.colors.primary.main,
  },
  voteButtonDisabled: {
    backgroundColor: tokens.colors.background.surface,
  },
  voteButtonText: {
    textAlign: 'center',
    fontWeight: tokens.typography.fontWeight.bold,
    fontSize: tokens.typography.titleSmall.size,
    color: !isMe
      ? isDarkMode
        ? tokens.colors.text.inverse
        : tokens.colors.text.primary
      : isDarkMode
        ? tokens.colors.text.primary
        : tokens.colors.text.inverse,
  },
  voteButtonTextDisabled: {
    color: tokens.colors.text.tertiary,
  },
  showResultsButton: {
    marginTop: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.background.tertiary,
    borderWidth: 1,
    borderColor: tokens.colors.border.primary,
  },
  showResultsText: {
    color: tokens.colors.text.primary,
    textAlign: 'center',
    fontWeight: tokens.typography.fontWeight.bold,
    fontSize: tokens.typography.bodySmall.size,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
  },
  footerText: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.fontSize.sm,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerDate: {
    color: tokens.colors.text.tertiary,
    fontSize: tokens.typography.fontSize.sm,
    marginLeft: tokens.spacing.xs,
  },
});
