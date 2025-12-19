import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Trash2 } from 'lucide-react-native';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
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
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const { user } = useAuth();

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

  const canCreate = hasQuestion && hasEnoughOptions && !hasEmptyOption && !hasDuplicateOptions && !isCreating;

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setMultipleChoice(false);
  };

  const handleClose = () => {
    if (question.trim() || options.some((opt) => opt.trim())) {
      Alert.alert('ביטול יצירת סקר', 'האם אתה בטוח שברצונך לבטל? כל הנתונים יימחקו.', [
        { text: 'המשך עריכה', style: 'cancel' },
        {
          text: 'בטל',
          style: 'destructive',
          onPress: () => {
            resetForm();
            onClose();
          },
        },
      ]);
    } else {
      onClose();
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
      Alert.alert('שגיאה', 'יש להזין שאלה לסקר');
      return false;
    }

    if (!hasEnoughOptions) {
      Alert.alert('שגיאה', `יש צורך לפחות ב-${MIN_OPTIONS} אפשרויות`);
      return false;
    }

    if (hasEmptyOption) {
      Alert.alert('שגיאה', 'יש למלא את כל האפשרויות');
      return false;
    }

    if (hasDuplicateOptions) {
      Alert.alert('שגיאה', 'יש אפשרויות כפולות. אנא שנה כדי שכל האפשרויות יהיו שונות.');
      return false;
    }

    return true;
  };

  const handleCreatePoll = async () => {
    if (isCreating) return;
    if (!validateForm()) return;

    if (!user?.id) {
      Alert.alert('שגיאה', 'לא ניתן ליצור סקר - משתמש לא מזוהה');
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
      }
    } catch (error: any) {
      console.error('❌ Error creating poll:', error);
      Alert.alert('שגיאה', error?.message || 'לא ניתן ליצור את הסקר');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <BottomSheet
      isOpen={visible}
      onClose={handleClose}
      snapPoints={[0.9]}
      showHandle
      enablePanDownToClose
      useModal
      backdropOpacity={0.4}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerIconButton}>
            <Ionicons name="close" size={22} color={tokens.colors.text.primary} />
          </TouchableOpacity>

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
          {/* Question */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>שאלה</Text>
              <Text style={styles.counter}>{question.length}/{QUESTION_MAX_LEN}</Text>
            </View>

            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="מה תרצה לשאול?"
              placeholderTextColor={tokens.colors.text.secondary}
              style={styles.questionInput}
              textAlign="right"
              multiline
              maxLength={QUESTION_MAX_LEN}
            />
          </View>

          {/* Options */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>אפשרויות</Text>
              <Text style={styles.counter}>{options.length}/{MAX_OPTIONS}</Text>
            </View>

            <View style={styles.optionsList}>
              {options.map((option, index) => {
                const showRemove = options.length > MIN_OPTIONS;

                return (
                  <View key={`poll-option-${index}`} style={styles.optionRow}>
                    <View style={styles.optionIndexPill}>
                      <Text style={styles.optionIndexText}>{index + 1}</Text>
                    </View>

                    <TextInput
                      value={option}
                      onChangeText={(text) => updateOption(index, text)}
                      placeholder={`אפשרות ${index + 1}`}
                      placeholderTextColor={tokens.colors.text.secondary}
                      style={styles.optionInput}
                      textAlign="right"
                      maxLength={OPTION_MAX_LEN}
                    />

                    {showRemove ? (
                      <TouchableOpacity
                        onPress={() => removeOption(index)}
                        style={styles.removeOptionButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={18} color={tokens.colors.text.primary} strokeWidth={2} />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.removeOptionButtonPlaceholder} />
                    )}
                  </View>
                );
              })}

              <TouchableOpacity
                onPress={addOption}
                disabled={options.length >= MAX_OPTIONS}
                style={[styles.addOptionRow, options.length >= MAX_OPTIONS && styles.addOptionRowDisabled]}
              >
                <View style={styles.addOptionLeft}>
                  <Ionicons
                    name="add"
                    size={18}
                    color={options.length >= MAX_OPTIONS ? tokens.colors.text.secondary : tokens.colors.text.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.addOptionText,
                    options.length >= MAX_OPTIONS && styles.addOptionTextDisabled,
                  ]}
                >
                  הוסף אפשרות
                </Text>
              </TouchableOpacity>

              {hasDuplicateOptions && (
                <Text style={styles.inlineWarning}>יש אפשרויות כפולות — כל אפשרות צריכה להיות ייחודית.</Text>
              )}
            </View>
          </View>

          {/* Settings */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>הגדרות</Text>

            <View style={styles.segmented}>
              <TouchableOpacity
                onPress={() => setMultipleChoice(false)}
                style={[styles.segment, !multipleChoice && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, !multipleChoice && styles.segmentTextActive]}>בחירה יחידה</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMultipleChoice(true)}
                style={[styles.segment, multipleChoice && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, multipleChoice && styles.segmentTextActive]}>בחירה מרובה</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.helperText}>
              {multipleChoice
                ? 'משתמשים יוכלו לבחור יותר מתשובה אחת.'
                : 'משתמשים יוכלו לבחור תשובה אחת בלבד.'}
            </Text>
          </View>

          {/* Spacer to not hide behind footer */}
          <View style={{ height: 12 }} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleCreatePoll}
            disabled={!canCreate}
            activeOpacity={0.85}
            style={[styles.primaryButton, !canCreate && styles.primaryButtonDisabled]}
          >
            {isCreating ? (
              <View style={styles.primaryButtonContent}>
                <ActivityIndicator color={tokens.colors.text.primary} />
                <Text style={[styles.primaryButtonText, styles.primaryButtonTextDisabled]}>יוצר…</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>צור סקר</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} disabled={isCreating} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>ביטול</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const createStyles = (tokens: any) => {
  const borderColor = tokens.colors.border?.primary || tokens.colors.border?.main || 'rgba(255,255,255,0.12)';
  const cardBg = tokens.colors.background.elevated || tokens.colors.background.secondary;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },

    header: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: borderColor,
      gap: tokens.spacing.sm,
    },
    headerIconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
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

    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.md,
      paddingBottom: tokens.spacing.xl,
      gap: tokens.spacing.md,
    },

    card: {
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 16,
      padding: tokens.spacing.md,
    },
    cardHeaderRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.sm,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    counter: {
      fontSize: 12,
      fontWeight: '600',
      color: tokens.colors.text.secondary,
    },

    questionInput: {
      backgroundColor: tokens.colors.background.tertiary,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 14,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: tokens.spacing.sm,
      color: tokens.colors.text.primary,
      fontSize: 16,
      minHeight: 84,
    },

    optionsList: {
      gap: 10,
    },
    optionRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
    },
    optionIndexPill: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionIndexText: {
      fontSize: 12,
      fontWeight: '800',
      color: tokens.colors.text.primary,
    },
    optionInput: {
      flex: 1,
      backgroundColor: tokens.colors.background.tertiary,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 14,
      paddingHorizontal: tokens.spacing.md,
      paddingVertical: 10,
      color: tokens.colors.text.primary,
      fontSize: 15,
    },
    removeOptionButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: 'rgba(239, 68, 68, 0.16)', // danger tint
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeOptionButtonPlaceholder: {
      width: 36,
      height: 36,
    },

    addOptionRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: tokens.spacing.md,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    addOptionRowDisabled: {
      opacity: 0.55,
    },
    addOptionLeft: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addOptionText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'right',
    },
    addOptionTextDisabled: {
      color: tokens.colors.text.secondary,
    },

    inlineWarning: {
      marginTop: 6,
      fontSize: 12,
      fontWeight: '600',
      color: tokens.colors.warning?.main || '#F59E0B',
      textAlign: 'right',
    },

    segmented: {
      flexDirection: 'row-reverse',
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 14,
      overflow: 'hidden',
      marginTop: tokens.spacing.sm,
    },
    segment: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    segmentActive: {
      backgroundColor: tokens.colors.primary.main,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '800',
      color: tokens.colors.text.primary,
    },
    segmentTextActive: {
      color: tokens.colors.text.inverse,
    },
    helperText: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: '600',
      color: tokens.colors.text.secondary,
      textAlign: 'right',
    },

    footer: {
      paddingHorizontal: tokens.spacing.md,
      paddingTop: tokens.spacing.sm,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: borderColor,
      backgroundColor: tokens.colors.background.secondary,
    },
    primaryButton: {
      height: 46,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.primary.main,
    },
    primaryButtonDisabled: {
      backgroundColor: tokens.colors.background.tertiary,
    },
    primaryButtonText: {
      fontSize: 15,
      fontWeight: '900',
      color: tokens.colors.text.inverse,
    },
    primaryButtonTextDisabled: {
      color: tokens.colors.text.secondary,
    },
    primaryButtonContent: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
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
      fontWeight: '800',
      color: tokens.colors.text.primary,
    },
  });
};
