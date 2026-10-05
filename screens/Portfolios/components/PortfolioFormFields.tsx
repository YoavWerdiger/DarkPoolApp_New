/**
 * שדות טופס משותפים — Portfolios (יצירת תיק, ברוקר, עסקאות).
 * formControl.ts · APP_TYPE · בלי מסגרת ירוקה. עין סיסמה בלבד בתוך השדה, בצד שמאל.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { useTheme } from '../../../context/ThemeContext';
import UICard from '../../../components/ui/UICard';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldNumericInputStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../../../components/ui/formControl';
import { PasswordVisibilityToggle } from '../../../components/ui/PasswordVisibilityToggle';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { APP_TYPE } from '../../../components/ui/appType';
import {
  journalCardSubtitleStyle,
  journalCardTitleStyle,
  journalSectionSubtitleStyle,
  journalSectionTitleStyle,
} from '../../Journal/journalLayout';
import { portfolioFormHelperStyle } from '../portfolioFormLayout';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface SectionHeaderProps {
  title: string;
  caption?: string;
}

export function SectionHeader({ title, caption }: SectionHeaderProps) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[journalSectionTitleStyle, { color: tokens.colors.text.primary }]}>
        {title}
      </Text>
      {caption ? (
        <Text
          style={[
            journalSectionSubtitleStyle,
            { color: tokens.colors.text.secondary, marginTop: APP_LAYOUT.titleSubtitleGap },
          ]}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

interface FieldLabelProps {
  label: string;
  optional?: boolean;
  labelAccessory?: React.ReactNode;
  /** הסבר קצר מתחת לתווית (למשל «מדד השוואה») */
  hint?: string;
}

export function FieldLabel({ label, optional, labelAccessory, hint }: FieldLabelProps) {
  const tokens = useDesignTokens();
  return (
    <>
    <View style={[styles.labelRow, hint ? { marginBottom: 2 } : null]}>
      <View style={styles.labelMain}>
        <Text
          style={[
            formFieldLabelStyle({ tokens, focused: false, error: false }),
            { marginBottom: 0 },
          ]}
        >
          {label}
        </Text>
        {optional ? (
          <Text
            style={[
              journalCardSubtitleStyle,
              {
                color: tokens.colors.text.secondary,
                width: undefined,
                marginTop: 0,
              },
            ]}
          >
            אופציונלי
          </Text>
        ) : null}
      </View>
      {labelAccessory}
    </View>
    {hint ? (
      <Text style={[portfolioFormHelperStyle, { color: tokens.colors.text.secondary, marginTop: 0, marginBottom: 8 }]}>
        {hint}
      </Text>
    ) : null}
    </>
  );
}

interface FieldMessageProps {
  hint?: string;
  error?: string | null;
}

function FieldMessage({ hint, error }: FieldMessageProps) {
  const tokens = useDesignTokens();
  if (error) {
    return (
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle" size={13} color={tokens.colors.text.danger} />
        <Text style={[portfolioFormHelperStyle, { color: tokens.colors.text.danger, flex: 1 }]}>
          {error}
        </Text>
      </View>
    );
  }
  if (!hint) return null;
  return (
    <Text style={[portfolioFormHelperStyle, { color: tokens.colors.text.secondary }]}>
      {hint}
    </Text>
  );
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  onBlur?: () => void;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  numeric?: boolean;
  prefix?: string;
  /** @deprecated */
  accessory?: React.ReactNode;
  labelAccessory?: React.ReactNode;
  spacing?: number;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  optional,
  keyboardType,
  multiline,
  maxLength,
  editable = true,
  onBlur,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  returnKeyType,
  onSubmitEditing,
  numeric,
  prefix,
  accessory,
  labelAccessory,
  spacing,
}: TextFieldProps) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = secureTextEntry === true;
  const shellRadius = multiline ? tokens.borderRadius.xl : tokens.borderRadius.full;

  const shell = useMemo(
    () => [
      formFieldShellStyle({ tokens, focused, error: Boolean(error), multiline }),
      styles.shell,
      {
        borderRadius: shellRadius,
        paddingHorizontal: 16,
        minHeight: multiline ? 104 : 52,
        opacity: editable ? 1 : 0.6,
      },
    ],
    [tokens, focused, error, multiline, shellRadius, editable]
  );

  return (
    <View style={{ marginBottom: spacing ?? APP_LAYOUT.componentGap }}>
      <FieldLabel
        label={label}
        optional={optional}
        labelAccessory={labelAccessory ?? accessory}
      />
      <View style={[shell, isPassword ? styles.passwordShell : null]}>
        {isPassword ? (
          <PasswordVisibilityToggle
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((v) => !v)}
          />
        ) : null}
        <TextInput
          style={[
            formFieldInputStyle(tokens),
            multiline && styles.inputMultiline,
            numeric && formFieldNumericInputStyle(tokens),
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={formFieldPlaceholderColor(tokens)}
          keyboardAppearance={isDarkMode ? 'dark' : 'light'}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          editable={editable}
          secureTextEntry={isPassword ? !passwordVisible : secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        {prefix ? (
          <Text
            style={[
              formFieldInputStyle(tokens),
              {
                fontWeight: '700',
                color: value
                  ? tokens.colors.text.secondary
                  : tokens.colors.text.tertiary,
              },
            ]}
          >
            {prefix}
          </Text>
        ) : null}
      </View>
      <FieldMessage hint={hint} error={error} />
    </View>
  );
}

interface SwitchRowProps {
  title: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  spacing?: number;
}

export function SwitchRow({ title, hint, value, onChange, spacing = 0 }: SwitchRowProps) {
  const tokens = useDesignTokens();
  return (
    <UICard
      variant="soft"
      padding="none"
      onPress={() => {
        void HapticFeedback.selection();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[
        styles.switchCard,
        value && {
          borderWidth: 0,
        },
        spacing ? { marginBottom: spacing } : null,
      ]}
      contentContainerStyle={styles.switchInner}
    >
      <View style={styles.switchTextCol}>
        <Text style={[journalCardTitleStyle, { color: tokens.colors.text.primary }]}>
          {title}
        </Text>
        {hint ? (
          <Text
            style={[
              journalCardSubtitleStyle,
              {
                color: tokens.colors.text.secondary,
                marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
              },
            ]}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.switchTrack,
          {
            backgroundColor: value ? tokens.colors.primary.main : tokens.colors.border.strong,
            justifyContent: value ? 'flex-end' : 'flex-start',
          },
        ]}
      >
        <View style={styles.switchThumb} />
      </View>
    </UICard>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    marginBottom: APP_LAYOUT.sectionHeaderToContent,
    alignSelf: 'stretch',
  },
  labelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  labelMain: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 6,
    flex: 1,
  },
  shell: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  passwordShell: {
    flexDirection: 'row',
  },
  // רב-שורתי: lineHeight מהסקאלה (חד-שורתי בלי — אחרת הטקסט «שוקע» ב-iOS)
  inputMultiline: {
    minHeight: 76,
    textAlignVertical: 'top',
    paddingVertical: 4,
    lineHeight: APP_TYPE.body.lineHeight,
  },
  errorRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  switchCard: {
    marginBottom: APP_LAYOUT.stackGapSmall,
  },
  switchInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  switchTextCol: {
    flex: 1,
    minWidth: 0,
  },
  switchTrack: {
    width: 46,
    height: 28,
    borderRadius: 14,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
});
