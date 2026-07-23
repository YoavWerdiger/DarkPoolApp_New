import React, { useMemo } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../ui/UICard';
import { useDesignTokens } from '../ui/DesignTokens';

/**
 * שורת הקלט המשותפת של הצ'אט — גלולת זכוכית עם שדה טקסט RTL רב-שורות
 * וכפתור שליחה עגול צף בצד (סגנון וואטסאפ). משותפת לצ'אט הרגיל ולפריוויו המדיה
 * כדי שהעיצוב וההתנהגות יהיו זהים בשני המקומות.
 */
export interface ChatComposerBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  inputRef?: React.Ref<TextInput>;
  nativeID?: string;
  keyboardAppearance?: TextInputProps['keyboardAppearance'];
  blurOnSubmit?: boolean;
  showSoftInputOnFocus?: boolean;
  /** נקרא בלחיצה על כפתור השליחה המובנה (מתעלמים ממנו כאשר מסופק `trailing`) */
  onSend?: () => void;
  sendDisabled?: boolean;
  /** תוכן בתוך הגלולה לפני שדה הטקסט (למשל כפתור צירוף) */
  leading?: React.ReactNode;
  /** דריסת כפתור הפעולה החיצוני. אם לא סופק — מוצג כפתור שליחה ברירת מחדל */
  trailing?: React.ReactNode;
  /** תוכן נוסף בתוך הגלולה אחרי שדה הטקסט (למשל מונה תווים) */
  overlay?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export default function ChatComposerBar({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  editable = true,
  multiline = true,
  numberOfLines = 2,
  maxLength,
  inputRef,
  nativeID,
  keyboardAppearance = 'dark',
  blurOnSubmit = false,
  showSoftInputOnFocus = true,
  onSend,
  sendDisabled = false,
  leading,
  trailing,
  overlay,
  containerStyle,
  inputStyle,
}: ChatComposerBarProps) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <View style={[styles.container, containerStyle]}>
      <UICard
        variant="glass"
        glassIntensity="light"
        padding="none"
        style={styles.pillOuter}
        contentContainerStyle={styles.pillContent}
      >
        {leading}
        <TextInput
          ref={inputRef}
          nativeID={nativeID}
          style={[styles.textInput, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor ?? tokens.colors.text.secondary}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          editable={editable}
          blurOnSubmit={blurOnSubmit}
          showSoftInputOnFocus={showSoftInputOnFocus}
          keyboardAppearance={keyboardAppearance}
          importantForAutofill="no"
        />
        {overlay}
      </UICard>

      {trailing !== undefined ? (
        trailing
      ) : (
        <Pressable
          onPress={onSend}
          disabled={sendDisabled}
          style={({ pressed }) => [
            styles.sendButton,
            pressed && !sendDisabled ? { opacity: 0.82 } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="שליחה"
        >
          <Ionicons name="send" size={22} color={tokens.colors.text.inverse} />
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      paddingTop: 2,
      gap: 0,
    },
    /** רדיוס בלבד — רקע/מסגרת מגיעים מ־UICard variant="glass" */
    pillOuter: {
      flex: 1,
      borderRadius: 30,
      overflow: 'hidden',
    },
    pillContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: tokens.spacing.sm + 1,
      paddingVertical: tokens.spacing.xs + 1,
      gap: tokens.spacing.xs,
      minHeight: 46,
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
    /** כפתור שליחה עגול חיצוני — סגנון וואטסאפ */
    sendButton: {
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
  });
