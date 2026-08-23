import { legacyAlert } from '../../utils/appDialog';
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../ui/UICard';
import { Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomSheetClose } from '../ui/BottomSheet/BottomSheet';
import { ChatBottomSheet } from './ChatBottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { useDesignTokens } from '../ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { useChatActions } from '../../context/ChatContext';
import { PollService } from '../../services/pollService';
import { makeLocalId } from '../../services/chat/chatOfflineQueue';
import { ChatMessage, ChatMessageType } from '../../types/chat.types';

interface PollCreationBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  onPollCreated: (poll: any) => void;
}

const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;
const QUESTION_MAX_LEN = 180;
const OPTION_MAX_LEN = 80;
/** תואם את ה-clamp המקסימלי ב-BottomSheet (0.9) */
const POLL_SHEET_SNAP = 0.9;
/**
 * Container של השיט הוא בגובה מסך מלא + translateY לפי snap —
 * התחתית (1-snap) נמצאת מתחת ל-viewport. חייבים לפצות על זה
 * כשיש footer ב-flex בסוף התוכן, אחרת הכפתור נחתך.
 */
const POLL_SHEET_OFFSCREEN_BELOW = Math.ceil(
  Dimensions.get('window').height * (1 - POLL_SHEET_SNAP),
);

export default function PollCreationBottomSheet({
  visible,
  onClose,
  chatId,
  onPollCreated,
}: PollCreationBottomSheetProps) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { user } = useAuth();
  const animatedClose = useBottomSheetClose();
  const { addOptimisticMediaMessage, removeOptimisticMessage } = useChatActions();

  /** ריפוד תחתון: אזור מחוץ למסך בגלל snap + safe area + מרווח נוחות */
  const sheetBottomPad = useMemo(() => {
    const minInset = Platform.OS === 'android' ? 24 : 20;
    const safeBottom = Math.max(insets.bottom, minInset);
    return POLL_SHEET_OFFSCREEN_BELOW + safeBottom + 12;
  }, [insets.bottom]);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [allowVoteChange, setAllowVoteChange] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const trimmedQuestion = question.trim();
  const trimmedOptions = options.map((o) => o.trim());
  const hasEmptyOption = trimmedOptions.some((o) => !o);
  const hasEnoughOptions = trimmedOptions.length >= MIN_OPTIONS;
  const hasQuestion = !!trimmedQuestion;
  const uniqueOptionsCount = new Set(trimmedOptions.filter(Boolean)).size;
  const hasDuplicateOptions = uniqueOptionsCount !== trimmedOptions.filter(Boolean).length;

  const canCreate =
    hasQuestion && hasEnoughOptions && !hasEmptyOption && !hasDuplicateOptions && !isCreating;

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setMultipleChoice(false);
    setAllowVoteChange(false);
  };

  const handleClose = () => {
    dismissKeyboard();
    if (question.trim() || options.some((opt) => opt.trim())) {
      legacyAlert('ביטול יצירת סקר', 'האם אתה בטוח שברצונך לבטל? כל הנתונים יימחקו.', [
        { text: 'המשך עריכה', style: 'cancel' },
        {
          text: 'בטל',
          style: 'destructive',
          onPress: () => {
            resetForm();
            dismissKeyboard();
            (animatedClose ?? onClose)();
          },
        },
      ]);
    } else {
      (animatedClose ?? onClose)();
    }
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, '']);
  };

  const removeOption = (index: number) => {
    dismissKeyboard();
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, text: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const validateForm = (): boolean => {
    if (!trimmedQuestion) {
      legacyAlert('שגיאה', 'יש להזין שאלה לסקר');
      return false;
    }
    if (!hasEnoughOptions) {
      legacyAlert('שגיאה', `יש צורך לפחות ב-${MIN_OPTIONS} אפשרויות`);
      return false;
    }
    if (hasEmptyOption) {
      legacyAlert('שגיאה', 'יש למלא את כל האפשרויות');
      return false;
    }
    if (hasDuplicateOptions) {
      legacyAlert('שגיאה', 'יש אפשרויות כפולות — כל אפשרות צריכה להיות ייחודית.');
      return false;
    }
    return true;
  };

  const handleCreatePoll = async () => {
    if (isCreating) return;
    if (!validateForm()) return;
    if (!user?.id) {
      legacyAlert('שגיאה', 'לא ניתן ליצור סקר - משתמש לא מזוהה');
      return;
    }

    dismissKeyboard();
    setIsCreating(true);

    const tempId = makeLocalId();
    const now = new Date().toISOString();
    const stubOptions = trimmedOptions.map((text, index) => ({
      id: `temp_opt_${Date.now()}_${index}`,
      text,
    }));

    const optimisticMessage: ChatMessage = {
      id: tempId,
      group_id: chatId,
      sender_id: user.id,
      content: trimmedQuestion,
      message_type: ChatMessageType.POLL,
      system_message_data: {
        poll_id: tempId,
        multiple_choice: multipleChoice,
        allow_vote_change: allowVoteChange,
        options: stubOptions,
      },
      is_forwarded: false,
      mentioned_users: [],
      is_edited: false,
      is_deleted: false,
      deleted_for_everyone: false,
      is_silent: false,
      is_system_message: false,
      created_at: now,
      reactions_count: 0,
      read_by_count: 0,
      sender: {
        id: user.id,
        display_name: user?.display_name || 'אני',
        profile_picture: user?.profile_picture,
        is_online: true,
      },
      is_sending: true,
    };

    addOptimisticMediaMessage(optimisticMessage);

    try {
      const poll = await PollService.createPoll(
        chatId,
        trimmedQuestion,
        trimmedOptions,
        user.id,
        multipleChoice,
        allowVoteChange
      );
      if (poll) {
        onPollCreated(poll);
        resetForm();
        dismissKeyboard();
        onClose();
        // Realtime / ingestIncomingInsert מחליף את temp- לפי content + message_type
      } else {
        removeOptimisticMessage(tempId);
        legacyAlert('שגיאה', 'לא ניתן ליצור את הסקר, נסה שוב');
      }
    } catch (error: any) {
      removeOptimisticMessage(tempId);
      legacyAlert('שגיאה', error?.message || 'לא ניתן ליצור את הסקר');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={handleClose}
      snapPoints={[POLL_SHEET_SNAP]}
      showBrandWatermark={false}
      contentPaddingBottom={sheetBottomPad}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <Pressable onPress={dismissKeyboard} style={styles.header}>
          <DayNavBlurButton
            onPress={handleClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            style={styles.headerIconButton}
            accessibilityLabel="חזרה"
          >
            <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
          </DayNavBlurButton>

          <View style={styles.headerCenter}>
            <Text style={styles.title}>יצירת סקר</Text>
            <Text style={styles.subtitle}>הסקר יישלח לצ׳אט אחרי יצירה</Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              dismissKeyboard();
              resetForm();
            }}
            style={styles.headerTextButton}
            disabled={isCreating || (!question.trim() && options.every((o) => !o.trim()))}
          >
            <Text style={styles.headerTextButtonLabel}>נקה</Text>
          </TouchableOpacity>
        </Pressable>

        {/* Body */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={dismissKeyboard}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={dismissKeyboard} style={{ gap: 12 }}>
            {/* Question card */}
            <UICard variant="blur" padding="none" contentContainerStyle={glassCardStyles.inner}>
              <View style={styles.cardHeaderRow}>
                {/* row-reverse: child ראשון = ימין */}
                <Text style={styles.cardTitle}>שאלה</Text>
                <Text style={styles.counter}>{question.length}/{QUESTION_MAX_LEN}</Text>
              </View>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder="מה תרצה לשאול?"
                placeholderTextColor={tokens.colors.text.secondary}
                style={[styles.questionInput, { writingDirection: 'rtl' }]}
                textAlign="right"
                textAlignVertical="top"
                multiline
                maxLength={QUESTION_MAX_LEN}
                blurOnSubmit
                returnKeyType="done"
                onSubmitEditing={dismissKeyboard}
              />
            </UICard>

            {/* Options card */}
            <UICard variant="blur" padding="none" contentContainerStyle={glassCardStyles.inner}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>אפשרויות</Text>
                <Text style={styles.counter}>{options.length}/{MAX_OPTIONS}</Text>
              </View>

              <View style={styles.optionsList}>
                {options.map((option, index) => {
                  const showRemove = options.length > MIN_OPTIONS;
                  const isLast = index === options.length - 1;
                  return (
                    <View key={`poll-option-${index}`} style={styles.optionRow}>
                      {/* row-reverse: first child = rightmost */}
                      <View style={styles.optionIndexPill}>
                        <Text style={styles.optionIndexText}>{index + 1}</Text>
                      </View>

                      <TextInput
                        value={option}
                        onChangeText={(text) => updateOption(index, text)}
                        placeholder={`אפשרות ${index + 1}`}
                        placeholderTextColor={tokens.colors.text.secondary}
                        style={[styles.optionInput, { writingDirection: 'rtl' }]}
                        textAlign="right"
                        maxLength={OPTION_MAX_LEN}
                        returnKeyType={isLast ? 'done' : 'next'}
                        blurOnSubmit={isLast}
                        onSubmitEditing={() => {
                          if (isLast) {
                            dismissKeyboard();
                          }
                        }}
                      />

                      {showRemove ? (
                        <TouchableOpacity
                          onPress={() => removeOption(index)}
                          style={styles.removeOptionButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color={tokens.colors.text.danger ?? '#EF4444'} strokeWidth={2} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.removeOptionButtonPlaceholder} />
                      )}
                    </View>
                  );
                })}

                {/* Add option */}
                <TouchableOpacity
                  onPress={addOption}
                  disabled={options.length >= MAX_OPTIONS}
                  style={[
                    styles.addOptionRow,
                    options.length >= MAX_OPTIONS && styles.addOptionRowDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.addOptionText,
                      options.length >= MAX_OPTIONS && styles.addOptionTextDisabled,
                    ]}
                  >
                    הוסף אפשרות
                  </Text>
                  <View style={styles.addOptionLeft}>
                    <Ionicons
                      name="add"
                      size={18}
                      color={
                        options.length >= MAX_OPTIONS
                          ? tokens.colors.text.secondary
                          : tokens.colors.primary.main
                      }
                    />
                  </View>
                </TouchableOpacity>

                {hasDuplicateOptions && (
                  <Text style={styles.inlineWarning}>
                    יש אפשרויות כפולות — כל אפשרות צריכה להיות ייחודית.
                  </Text>
                )}
              </View>
            </UICard>

            {/* Settings card */}
            <UICard variant="blur" padding="none" contentContainerStyle={glassCardStyles.inner}>
              <Text style={[styles.cardTitle, styles.cardTitleBlock]}>הגדרות</Text>

              <View style={styles.segmented}>
                <TouchableOpacity
                  onPress={() => {
                    dismissKeyboard();
                    setMultipleChoice(true);
                  }}
                  style={[styles.segment, multipleChoice && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, multipleChoice && styles.segmentTextActive]}>
                    בחירה מרובה
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    dismissKeyboard();
                    setMultipleChoice(false);
                  }}
                  style={[styles.segment, !multipleChoice && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, !multipleChoice && styles.segmentTextActive]}>
                    בחירה יחידה
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helperText}>
                {multipleChoice
                  ? 'משתמשים יוכלו לבחור יותר מתשובה אחת.'
                  : 'משתמשים יוכלו לבחור תשובה אחת בלבד.'}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  dismissKeyboard();
                  setAllowVoteChange((prev) => !prev);
                }}
                activeOpacity={0.75}
                style={styles.toggleRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: allowVoteChange }}
              >
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>אפשר לשנות תשובה</Text>
                  <Text style={styles.helperText}>
                    משתמשים יוכלו לשנות את הבחירה אחרי ההצבעה.
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    allowVoteChange && styles.checkboxChecked,
                  ]}
                >
                  {allowVoteChange && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
            </UICard>

            <View style={{ height: 8 }} />
          </Pressable>
        </ScrollView>

        {/* Footer — bottom inset מגיע מ-contentPaddingBottom של השיט (כולל פיצוי off-screen) */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleCreatePoll}
            disabled={!canCreate}
            activeOpacity={0.85}
            style={[styles.primaryButton, !canCreate && styles.primaryButtonDisabled]}
          >
            {isCreating ? (
              <View style={styles.primaryButtonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.primaryButtonText}>יוצר…</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>צור סקר</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ChatBottomSheet>
  );
}

const glassCardStyles = StyleSheet.create({
  inner: {
    padding: 16,
    gap: 10,
  },
});

/* ── Main styles ── */
const createStyles = (tokens: any) => {
  const borderColor = 'rgba(255,255,255,0.1)';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },

    /* Header */
    header: {
      flexDirection: 'row-reverse' as any,
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
      gap: 10,
    },
    headerIconButton: {
      alignSelf: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'flex-end',
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.secondary,
      textAlign: 'right',
    },
    headerTextButton: {
      minWidth: 44,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    headerTextButtonLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: tokens.colors.text.primary,
    },

    /* Scroll */
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },

    /* Card internals */
    cardHeaderRow: {
      flexDirection: 'row-reverse' as any,
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl' as any,
    },
    cardTitleBlock: {
      alignSelf: 'stretch',
      width: '100%',
    },
    counter: {
      fontSize: 12,
      fontWeight: '600',
      color: tokens.colors.text.secondary,
      textAlign: 'left',
    },

    /* Question input */
    questionInput: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: tokens.colors.text.primary,
      fontSize: 16,
      minHeight: 80,
    },

    /* Options */
    optionsList: {
      gap: 9,
    },
    optionRow: {
      flexDirection: 'row-reverse' as any,
      alignItems: 'center',
      gap: 8,
    },
    optionIndexPill: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    optionIndexText: {
      fontSize: 11,
      fontWeight: '800',
      color: tokens.colors.text.secondary,
    },
    optionInput: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: tokens.colors.text.primary,
      fontSize: 15,
    },
    removeOptionButton: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: 'rgba(239,68,68,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    removeOptionButtonPlaceholder: {
      width: 32,
      height: 32,
      flexShrink: 0,
    },

    /* Add option */
    addOptionRow: {
      flexDirection: 'row-reverse' as any,
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: borderColor,
      borderStyle: 'dashed' as any,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 14,
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
    addOptionRowDisabled: {
      opacity: 0.45,
    },
    addOptionLeft: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,200,5,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    addOptionText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: tokens.colors.primary.main,
      textAlign: 'right',
    },
    addOptionTextDisabled: {
      color: tokens.colors.text.secondary,
    },

    inlineWarning: {
      fontSize: 12,
      fontWeight: '600',
      color: '#F59E0B',
      textAlign: 'right',
    },

    /* Segmented control — RTL: מרובה | יחידה */
    segmented: {
      flexDirection: 'row-reverse' as any,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 8,
    },
    segment: {
      flex: 1,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    segmentActive: {
      backgroundColor: tokens.colors.primary.main,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '700',
      color: tokens.colors.text.secondary,
    },
    segmentTextActive: {
      color: '#fff',
      fontWeight: '800' as any,
    },
    helperText: {
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.secondary,
      textAlign: 'right',
    },
    toggleRow: {
      flexDirection: 'row-reverse' as any,
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: borderColor,
    },
    toggleCopy: {
      flex: 1,
      gap: 4,
      alignItems: 'flex-end',
    },
    toggleTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: borderColor,
      backgroundColor: 'rgba(255,255,255,0.04)',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    checkboxChecked: {
      backgroundColor: tokens.colors.primary.main,
      borderColor: tokens.colors.primary.main,
    },

    /* Footer — bottom inset מ-ChatBottomSheet contentPaddingBottom */
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: borderColor,
    },
    primaryButton: {
      height: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.primary.main,
    },
    primaryButtonDisabled: {
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#fff',
    },
    primaryButtonContent: {
      flexDirection: 'row-reverse' as any,
      alignItems: 'center',
      gap: 8,
    },
  });
};
