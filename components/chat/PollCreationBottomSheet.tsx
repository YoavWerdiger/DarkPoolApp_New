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
import { PollService } from '../../services/pollService';

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

export default function PollCreationBottomSheet({
  visible,
  onClose,
  chatId,
  onPollCreated,
}: PollCreationBottomSheetProps) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(tokens, insets.bottom), [tokens, insets.bottom]);
  const { user } = useAuth();
  const animatedClose = useBottomSheetClose();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multipleChoice, setMultipleChoice] = useState(false);
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

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setMultipleChoice(false);
  };

  const handleClose = () => {
    if (question.trim() || options.some((opt) => opt.trim())) {
      legacyAlert('ביטול יצירת סקר', 'האם אתה בטוח שברצונך לבטל? כל הנתונים יימחקו.', [
        { text: 'המשך עריכה', style: 'cancel' },
        {
          text: 'בטל',
          style: 'destructive',
          onPress: () => {
            resetForm();
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
    setIsCreating(true);
    try {
      const poll = await PollService.createPoll(
        chatId,
        trimmedQuestion,
        trimmedOptions,
        user.id,
        multipleChoice
      );
      if (poll) {
        onPollCreated(poll);
        resetForm();
        onClose();
      } else {
        legacyAlert('שגיאה', 'לא ניתן ליצור את הסקר, נסה שוב');
      }
    } catch (error: any) {
      legacyAlert('שגיאה', error?.message || 'לא ניתן ליצור את הסקר');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ChatBottomSheet visible={visible} onClose={handleClose} snapPoints={[0.9]} showBrandWatermark={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
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
            onPress={resetForm}
            style={styles.headerTextButton}
            disabled={isCreating || (!question.trim() && options.every((o) => !o.trim()))}
          >
            <Text style={styles.headerTextButtonLabel}>נקה</Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Question card */}
          <UICard variant="blur" padding="none" contentContainerStyle={glassCardStyles.inner}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.counter}>{question.length}/{QUESTION_MAX_LEN}</Text>
              <Text style={styles.cardTitle}>שאלה</Text>
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
            />
          </UICard>

          {/* Options card */}
          <UICard variant="blur" padding="none" contentContainerStyle={glassCardStyles.inner}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.counter}>{options.length}/{MAX_OPTIONS}</Text>
              <Text style={styles.cardTitle}>אפשרויות</Text>
            </View>

            <View style={styles.optionsList}>
              {options.map((option, index) => {
                const showRemove = options.length > MIN_OPTIONS;
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
            <Text style={styles.cardTitle}>הגדרות</Text>

            <View style={styles.segmented}>
              <TouchableOpacity
                onPress={() => setMultipleChoice(true)}
                style={[styles.segment, multipleChoice && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, multipleChoice && styles.segmentTextActive]}>
                  בחירה מרובה
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMultipleChoice(false)}
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
          </UICard>

          <View style={{ height: 8 }} />
        </ScrollView>

        {/* Footer — respects safe area */}
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

          <TouchableOpacity
            onPress={handleClose}
            disabled={isCreating}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>ביטול</Text>
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
const createStyles = (tokens: any, safeAreaBottom: number) => {
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
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    counter: {
      fontSize: 12,
      fontWeight: '600',
      color: tokens.colors.text.secondary,
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

    /* Footer — safe area aware */
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: Math.max(safeAreaBottom, 16),
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
    secondaryButton: {
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    secondaryButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: tokens.colors.text.secondary,
    },
  });
};
