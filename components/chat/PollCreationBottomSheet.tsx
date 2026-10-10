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
  Dimensions,
} from 'react-native';
import { SlidingPillGroup } from '../ui/DayDividerPill';
import { AppSwitch } from '../ui/AppSwitch';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../ui/UICard';
import UIButton from '../ui/UIButton';
import { Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomSheetClose } from '../ui/BottomSheet/BottomSheet';
import { ChatSheetTopoHeader, useChatFitContentSnap } from './ChatBottomSheet';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE, headerExitButtonFill } from '../ui/DayNavBlurButton';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../ui/formControl';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { useAuth } from '../../context/AuthContext';
import { HapticFeedback } from '../../utils/hapticFeedback';
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

  const { snapPoint, onContentLayout } = useChatFitContentSnap(0.8, 0.92, 0.4, `${visible}`);
  const optionsMaxH = Math.round(Dimensions.get('window').height * 0.32);
  const field = (focused: boolean, multiline = false) => [
    formFieldShellStyle({ tokens, focused, multiline }),
    styles.fieldShell,
  ];

  return (
    // אותו שיט כמו «קבוצה חדשה» (הטופו): קנבס ערכת הנושא, פינות xl, גובה לפי התוכן
    <BottomSheet
      isOpen={visible}
      onClose={handleClose}
      snapPoints={[snapPoint]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      avoidKeyboard
      contentPaddingBottom={0}
    >
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={onContentLayout}>
        <ChatSheetTopoHeader title="סקר חדש" onClose={handleClose} />

        {/* מרווח מהכותרת — ב«קבוצה חדשה» התמונה יושבת כאן */}
        <View style={[styles.labelRow, styles.firstLabel]}>
          <Text style={[formFieldLabelStyle({ tokens, focused: questionFocused }), styles.labelFlex]}>שאלה</Text>
          <Text style={[styles.counter, { color: tokens.colors.text.tertiary }]}>
            {question.length}/{QUESTION_MAX_LEN}
          </Text>
        </View>
        <View style={field(questionFocused, true)}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            onFocus={() => setQuestionFocused(true)}
            onBlur={() => setQuestionFocused(false)}
            placeholder="מה תרצה לשאול?"
            placeholderTextColor={formFieldPlaceholderColor(tokens)}
            style={[formFieldInputStyle(tokens), appPhysicalRightText, styles.textArea]}
            multiline
            maxLength={QUESTION_MAX_LEN}
            textAlignVertical="top"
          />
        </View>

        <View style={[styles.labelRow, styles.labelGap]}>
          <Text style={[formFieldLabelStyle({ tokens, focused: false }), styles.labelFlex]}>אפשרויות</Text>
          <Text style={[styles.counter, { color: tokens.colors.text.tertiary }]}>
            {options.length}/{MAX_OPTIONS}
          </Text>
        </View>
        <ScrollView
          style={{ maxHeight: optionsMaxH }}
          contentContainerStyle={styles.optionsList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {options.map((option, index) => {
            const showRemove = options.length > MIN_OPTIONS;
            const isLast = index === options.length - 1;
            return (
              <View key={`poll-option-${index}`} style={[field(false), styles.optionShell]}>
                <TextInput
                  value={option}
                  onChangeText={(text) => updateOption(index, text)}
                  placeholder={`אפשרות ${index + 1}`}
                  placeholderTextColor={formFieldPlaceholderColor(tokens)}
                  style={[formFieldInputStyle(tokens), appPhysicalRightText, styles.optionInput]}
                  maxLength={OPTION_MAX_LEN}
                  returnKeyType={isLast ? 'done' : 'next'}
                  blurOnSubmit={isLast}
                  onSubmitEditing={() => {
                    if (isLast) dismissKeyboard();
                  }}
                />
                {showRemove ? (
                  <Pressable
                    onPress={() => removeOption(index)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="הסר אפשרות"
                  >
                    <Ionicons name="close-circle" size={20} color={tokens.colors.text.tertiary} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
        {options.length < MAX_OPTIONS ? (
          <Pressable
            onPress={() => {
              void HapticFeedback.selection();
              addOption();
            }}
            style={[styles.addChip, { backgroundColor: tokens.colors.background.cardSolid }]}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={16} color={tokens.colors.text.secondary} />
            <Text style={[styles.addChipText, { color: tokens.colors.text.primary }]}>הוסף אפשרות</Text>
          </Pressable>
        ) : null}
        {hasDuplicateOptions ? (
          <Text style={[styles.warning, { color: tokens.colors.warning.main }]}>
            יש אפשרויות כפולות — כל אפשרות צריכה להיות ייחודית.
          </Text>
        ) : null}

        {/* סוג הבחירה — כמו «מי כותב בקבוצה» */}
        <Text style={[formFieldLabelStyle({ tokens, focused: false }), styles.labelGap, { marginBottom: 4 }]}>סוג בחירה</Text>
        <View style={[styles.segment, { backgroundColor: tokens.colors.background.cardSolid }]}>
          {([
            { key: false, label: 'בחירה יחידה' },
            { key: true, label: 'בחירה מרובה' },
          ] as const).map((opt) => {
            const active = multipleChoice === opt.key;
            return (
              <Pressable
                key={opt.label}
                onPress={() => {
                  if (!active) void HapticFeedback.selection();
                  dismissKeyboard();
                  setMultipleChoice(opt.key);
                }}
                style={[styles.segmentItem, active && { backgroundColor: tokens.colors.background.tertiary }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? tokens.colors.text.primary : tokens.colors.text.secondary },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.toggleRow, { backgroundColor: tokens.colors.background.cardSolid }]}>
          <View style={styles.toggleCopy}>
            <Text style={[styles.toggleTitle, { color: tokens.colors.text.primary }]}>אפשר לשנות תשובה</Text>
            <Text style={[styles.toggleSubtitle, { color: tokens.colors.text.secondary }]}>
              אפשר לשנות את הבחירה אחרי ההצבעה
            </Text>
          </View>
          <AppSwitch
            value={allowVoteChange}
            onValueChange={(next) => {
              dismissKeyboard();
              setAllowVoteChange(next);
            }}
            trackColor={{ false: theme.switchTrackOff, true: tokens.colors.primary.main }}
            thumbColor={allowVoteChange ? tokens.colors.text.primary : theme.switchThumbOff}
            ios_backgroundColor={theme.switchTrackOff}
            style={styles.switch}
            accessibilityLabel="אפשר לשנות תשובה"
          />
        </View>

        <View style={styles.cta}>
          <UIButton
            title={isCreating ? 'יוצר…' : 'צור סקר'}
            variant="primary"
            fullWidth
            disabled={!canCreate}
            loading={isCreating}
            onPress={handleCreatePoll}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: {
    direction: 'rtl',
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  labelFlex: {
    flex: 1,
  },
  // מרווחים נדיבים בין הקטעים — היה צפוף
  labelGap: {
    marginTop: 26,
  },
  firstLabel: {
    marginTop: 22,
  },
  counter: {
    fontSize: APP_TYPE.caption.fontSize,
    lineHeight: APP_TYPE.caption.lineHeight,
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
  // כמו שדות «קבוצה חדשה»
  fieldShell: {
    borderRadius: 16,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  textArea: {
    alignSelf: 'stretch',
    minHeight: 72,
    lineHeight: APP_TYPE.body.lineHeight,
  },
  optionsList: {
    gap: 10,
  },
  optionShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionInput: {
    flex: 1,
    minHeight: 48,
  },
  addChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addChipText: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  warning: {
    ...appPhysicalRightText,
    marginTop: 8,
    fontSize: APP_TYPE.caption.fontSize,
    lineHeight: APP_TYPE.caption.lineHeight,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
  },
  segmentText: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 26,
    paddingVertical: 14,
    paddingHorizontal: APP_LAYOUT.cardPadding,
    borderRadius: 16,
  },
  toggleCopy: {
    flex: 1,
  },
  toggleTitle: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  toggleSubtitle: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
  },
  switch: {
    transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }],
  },
  cta: {
    marginTop: 30,
  },
});
