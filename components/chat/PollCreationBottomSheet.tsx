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
  Keyboard,
  Pressable,
  Switch,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../ui/UICard';
import UIButton from '../ui/UIButton';
import { Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomSheetClose } from '../ui/BottomSheet/BottomSheet';
import { ChatBottomSheet } from './ChatBottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { useDesignTokens } from '../ui/DesignTokens';
import { UI_CARD_RADIUS } from '../ui/appLayout';
import { formFieldInputStyle } from '../ui/formControl';
import { appSheetButtonLabelStyle, appSheetSubtitleStyle } from '../ui/appType';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useChatActions } from '../../context/ChatContext';
import { PollService } from '../../services/pollService';
import { makeClientMessageId, makeLocalId } from '../../services/chat/chatOfflineQueue';
import { ChatMessage, ChatMessageType } from '../../types/chat.types';
import {
  CHAT_LAYOUT,
  CHAT_TYPE,
  chatCardSubtitleStyle,
  chatCardTitleStyle,
  chatPhysicalRightText,
  chatSheetTitleStyle,
} from './chatLayout';

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
  const { theme } = useTheme();
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
  const [questionFocused, setQuestionFocused] = useState(false);

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
    const clientMessageId = makeClientMessageId();
    const now = new Date().toISOString();
    const stubOptions = trimmedOptions.map((text, index) => ({
      id: `temp_opt_${Date.now()}_${index}`,
      text,
    }));

    const optimisticMessage: ChatMessage = {
      id: tempId,
      local_id: tempId,
      client_message_id: clientMessageId,
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
            glass={false}
            style={[styles.headerIconButton, { backgroundColor: tokens.colors.background.cardSolid }]}
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
            style={[
              styles.headerTextButton,
              (isCreating || (!question.trim() && options.every((o) => !o.trim()))) &&
                styles.headerTextButtonDisabled,
            ]}
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
          <Pressable onPress={dismissKeyboard} style={styles.form}>
            <View>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.groupLabel}>שאלה</Text>
                <Text style={styles.counter}>
                  {question.length}/{QUESTION_MAX_LEN}
                </Text>
              </View>
              <UICard
                variant="soft"
                padding="none"
                disableBlur
                style={[styles.card, questionFocused && styles.cardFocused]}
              >
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="מה תרצה לשאול?"
                  placeholderTextColor={tokens.colors.text.tertiary}
                  style={styles.questionInput}
                  textAlignVertical="top"
                  multiline
                  maxLength={QUESTION_MAX_LEN}
                  blurOnSubmit
                  returnKeyType="done"
                  onSubmitEditing={dismissKeyboard}
                  onFocus={() => setQuestionFocused(true)}
                  onBlur={() => setQuestionFocused(false)}
                />
              </UICard>
            </View>

            <View>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.groupLabel}>אפשרויות</Text>
                <Text style={styles.counter}>
                  {options.length}/{MAX_OPTIONS}
                </Text>
              </View>
              <UICard variant="soft" padding="none" disableBlur style={styles.card}>
                {options.map((option, index) => {
                  const showRemove = options.length > MIN_OPTIONS;
                  const isLast = index === options.length - 1;
                  return (
                    <View key={`poll-option-${index}`}>
                      {index > 0 ? <View style={styles.rowDivider} /> : null}
                      <View style={styles.optionRow}>
                        <View style={styles.optionIndex}>
                          <Text style={styles.optionIndexText}>{index + 1}</Text>
                        </View>
                        <TextInput
                          value={option}
                          onChangeText={(text) => updateOption(index, text)}
                          placeholder={`אפשרות ${index + 1}`}
                          placeholderTextColor={tokens.colors.text.tertiary}
                          style={styles.optionInput}
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
                            accessibilityLabel="הסר אפשרות"
                          >
                            <Trash2
                              size={18}
                              color={tokens.colors.danger.main}
                              strokeWidth={2}
                            />
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.removeOptionButtonPlaceholder} />
                        )}
                      </View>
                    </View>
                  );
                })}

                <View style={styles.rowDivider} />
                <TouchableOpacity
                  onPress={addOption}
                  disabled={options.length >= MAX_OPTIONS}
                  style={[
                    styles.addOptionRow,
                    options.length >= MAX_OPTIONS && styles.addOptionRowDisabled,
                  ]}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={
                      options.length >= MAX_OPTIONS
                        ? tokens.colors.text.secondary
                        : tokens.colors.primary.main
                    }
                  />
                  <Text
                    style={[
                      styles.addOptionText,
                      options.length >= MAX_OPTIONS && styles.addOptionTextDisabled,
                    ]}
                  >
                    הוסף אפשרות
                  </Text>
                </TouchableOpacity>

                {hasDuplicateOptions ? (
                  <Text style={styles.inlineWarning}>
                    יש אפשרויות כפולות — כל אפשרות צריכה להיות ייחודית.
                  </Text>
                ) : null}
              </UICard>
            </View>

            <View>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.groupLabel}>הגדרות</Text>
              </View>
              <UICard variant="soft" padding="none" disableBlur style={styles.card}>
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

                <View style={styles.rowDivider} />
                <View style={styles.toggleRow}>
                  <View style={styles.toggleCopy}>
                    <Text style={styles.toggleTitle}>אפשר לשנות תשובה</Text>
                    <Text style={styles.toggleSubtitle}>
                      משתמשים יוכלו לשנות את הבחירה אחרי ההצבעה.
                    </Text>
                  </View>
                  <Switch
                    value={allowVoteChange}
                    onValueChange={(next) => {
                      dismissKeyboard();
                      setAllowVoteChange(next);
                    }}
                    trackColor={{
                      false: theme.switchTrackOff,
                      true: tokens.colors.primary.main,
                    }}
                    thumbColor={
                      allowVoteChange ? tokens.colors.text.primary : theme.switchThumbOff
                    }
                    ios_backgroundColor={theme.switchTrackOff}
                    style={styles.switch}
                    accessibilityLabel="אפשר לשנות תשובה"
                  />
                </View>
              </UICard>
            </View>
          </Pressable>
        </ScrollView>

        {/* Footer — bottom inset מגיע מ-contentPaddingBottom של השיט (כולל פיצוי off-screen) */}
        <View style={styles.footer}>
          <UIButton
            title={isCreating ? 'יוצר…' : 'צור סקר'}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canCreate}
            loading={isCreating}
            onPress={handleCreatePoll}
            textStyle={appSheetButtonLabelStyle}
          />
        </View>
      </KeyboardAvoidingView>
    </ChatBottomSheet>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => {
  const borderColor = tokens.colors.border.divider;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },

    header: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: CHAT_LAYOUT.screenPaddingHorizontal,
      paddingVertical: CHAT_LAYOUT.cardTitleToBodyGap,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
      gap: CHAT_LAYOUT.stackGapTight,
    },
    headerIconButton: {
      alignSelf: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'flex-end',
    },
    title: {
      ...chatSheetTitleStyle,
      color: tokens.colors.text.primary,
    },
    subtitle: {
      ...appSheetSubtitleStyle,
      marginTop: CHAT_LAYOUT.titleSubtitleGap,
      color: tokens.colors.text.secondary,
    },
    headerTextButton: {
      minWidth: 44,
      height: 36,
      borderRadius: tokens.borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: CHAT_LAYOUT.stackGapTight,
      backgroundColor: tokens.colors.background.navChrome,
    },
    headerTextButtonDisabled: {
      opacity: 0.45,
    },
    headerTextButtonLabel: {
      ...CHAT_TYPE.footnote,
      color: tokens.colors.text.primary,
    },

    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: CHAT_LAYOUT.screenPaddingHorizontal,
      paddingTop: CHAT_LAYOUT.cardPadding,
      paddingBottom: CHAT_LAYOUT.cardPadding,
    },
    form: {
      gap: CHAT_LAYOUT.cardStackGap,
    },
    sectionLabelRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: CHAT_LAYOUT.groupLabelToContent,
    },
    groupLabel: {
      ...chatPhysicalRightText,
      ...CHAT_TYPE.groupLabel,
      flex: 1,
      color: tokens.colors.text.secondary,
    },
    counter: {
      ...CHAT_TYPE.caption,
      color: tokens.colors.text.secondary,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    card: {
      borderRadius: UI_CARD_RADIUS,
      overflow: 'hidden',
    },
    cardFocused: {
      backgroundColor: tokens.colors.background.tertiary,
    },
    rowDivider: {
      height: 1,
      backgroundColor: borderColor,
      marginHorizontal: CHAT_LAYOUT.cardPadding,
    },

    questionInput: {
      ...formFieldInputStyle(),
      flex: 0,
      width: '100%',
      color: tokens.colors.text.primary,
      paddingHorizontal: CHAT_LAYOUT.cardPadding,
      paddingVertical: CHAT_LAYOUT.cardTitleToBodyGap,
      minHeight: 88,
      textAlignVertical: 'top',
    },

    optionRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: CHAT_LAYOUT.cardPadding,
    },
    optionIndex: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.background.tertiary,
      flexShrink: 0,
    },
    optionIndexText: {
      ...CHAT_TYPE.caption2,
      color: tokens.colors.text.secondary,
    },
    optionInput: {
      ...formFieldInputStyle(),
      flex: 1,
      marginRight: 12,
      color: tokens.colors.text.primary,
      paddingVertical: 0,
    },
    removeOptionButton: {
      width: 32,
      height: 32,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    removeOptionButtonPlaceholder: {
      width: 32,
      height: 32,
      marginRight: 12,
      flexShrink: 0,
    },

    addOptionRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: CHAT_LAYOUT.cardPadding,
    },
    addOptionRowDisabled: {
      opacity: 0.45,
    },
    addOptionText: {
      ...chatPhysicalRightText,
      ...CHAT_TYPE.cardTitle,
      flex: 1,
      marginRight: 12,
      color: tokens.colors.primary.main,
    },
    addOptionTextDisabled: {
      color: tokens.colors.text.secondary,
    },

    inlineWarning: {
      ...chatPhysicalRightText,
      ...CHAT_TYPE.caption,
      color: tokens.colors.warning.main,
      paddingHorizontal: CHAT_LAYOUT.cardPadding,
      paddingBottom: CHAT_LAYOUT.cardPadding,
    },

    segmented: {
      flexDirection: 'row-reverse',
      backgroundColor: tokens.colors.background.tertiary,
      borderRadius: tokens.borderRadius.full,
      padding: 3,
      marginTop: CHAT_LAYOUT.cardPadding,
      marginHorizontal: CHAT_LAYOUT.cardPadding,
    },
    segment: {
      flex: 1,
      paddingVertical: CHAT_LAYOUT.stackGapSmall,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: tokens.borderRadius.full,
    },
    segmentActive: {
      backgroundColor: tokens.colors.background.cardSolid,
    },
    segmentText: {
      ...appSheetButtonLabelStyle,
      color: tokens.colors.text.secondary,
    },
    segmentTextActive: {
      color: tokens.colors.text.primary,
    },
    helperText: {
      ...chatPhysicalRightText,
      ...CHAT_TYPE.cardSubtitle,
      color: tokens.colors.text.secondary,
      marginTop: CHAT_LAYOUT.stackGapSmall,
      marginHorizontal: CHAT_LAYOUT.cardPadding,
      marginBottom: CHAT_LAYOUT.cardTitleToBodyGap,
    },
    toggleRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: CHAT_LAYOUT.cardPadding,
    },
    toggleCopy: {
      flex: 1,
    },
    toggleTitle: {
      ...chatCardTitleStyle,
      color: tokens.colors.text.primary,
    },
    toggleSubtitle: {
      ...chatCardSubtitleStyle,
      color: tokens.colors.text.secondary,
    },
    switch: {
      transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }],
    },

    footer: {
      paddingHorizontal: CHAT_LAYOUT.screenPaddingHorizontal,
      paddingTop: CHAT_LAYOUT.cardTitleToBodyGap,
      paddingBottom: CHAT_LAYOUT.stackGapSmall,
      borderTopWidth: 1,
      borderTopColor: borderColor,
    },
  });
};
