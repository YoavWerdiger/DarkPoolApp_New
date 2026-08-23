/**
 * שדות טופס משותפים למסכי Portfolios (יצירת תיק, חיבור ברוקר).
 * RTL, glass כהה, מסגרת ירוקה ב-focus, שגיאות inline מתחת לשדה.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';

/* -------------------------------------------------------------------------- */

interface SectionHeaderProps {
  title: string;
  caption?: string;
}

export function SectionHeader({ title, caption }: SectionHeaderProps) {
  const tokens = useDesignTokens();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 0.3,
          color: tokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
        }}
      >
        {title}
      </Text>
      {caption ? (
        <Text
          style={{
            fontSize: 12,
            color: tokens.colors.text.muted,
            marginTop: 3,
            lineHeight: 17,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */

interface FieldLabelProps {
  label: string;
  hint?: string;
  optional?: boolean;
}

export function FieldLabel({ label, hint, optional }: FieldLabelProps) {
  const tokens = useDesignTokens();
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', gap: 6 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: tokens.colors.text.primary,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {label}
        </Text>
        {optional ? (
          <Text
            style={{
              fontSize: 11,
              color: tokens.colors.text.muted,
              writingDirection: 'rtl',
            }}
          >
            אופציונלי
          </Text>
        ) : null}
      </View>
      {hint ? (
        <Text
          style={{
            fontSize: 11,
            color: tokens.colors.text.tertiary,
            marginTop: 3,
            lineHeight: 16,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */

interface FieldMessageProps {
  hint?: string;
  error?: string | null;
}

function FieldMessage({ hint, error }: FieldMessageProps) {
  const tokens = useDesignTokens();
  if (error) {
    return (
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 5,
          marginTop: 6,
          marginRight: 6,
        }}
      >
        <Ionicons name="alert-circle" size={13} color={tokens.colors.text.danger} />
        <Text
          style={{
            flex: 1,
            fontSize: 11,
            color: tokens.colors.text.danger,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {error}
        </Text>
      </View>
    );
  }
  if (!hint) return null;
  return (
    <Text
      style={{
        fontSize: 11,
        color: tokens.colors.text.tertiary,
        lineHeight: 16,
        marginTop: 6,
        marginRight: 6,
        textAlign: 'right',
        writingDirection: 'rtl',
      }}
    >
      {hint}
    </Text>
  );
}

/* -------------------------------------------------------------------------- */

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
  /** ערך מספרי — יישור LTR, סימן המטבע מוצג בקצה שמאל */
  numeric?: boolean;
  /** סימן מטבע / יחידה שמוצמד לשדה */
  prefix?: string;
  /** אלמנט בקצה השדה (למשל כפתור הצגת סיסמה) */
  accessory?: React.ReactNode;
  /** מרווח תחתון — 0 כשהשדה אחרון בקבוצה */
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
  spacing = 18,
}: TextFieldProps) {
  const tokens = useDesignTokens();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? tokens.colors.text.danger
    : focused
    ? tokens.colors.primary.main
    : tokens.colors.glass.card.border;

  return (
    <View style={{ marginBottom: spacing }}>
      <FieldLabel label={label} optional={optional} />
      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 14 : 4,
          minHeight: multiline ? 104 : 52,
          borderRadius: multiline ? tokens.borderRadius['2xl'] : tokens.borderRadius.full,
          borderWidth: error || focused ? 1.5 : StyleSheet.hairlineWidth * 2,
          borderColor,
          backgroundColor: error
            ? 'rgba(255, 68, 68, 0.06)'
            : tokens.colors.background.input,
          opacity: editable ? 1 : 0.6,
          overflow: 'hidden',
        }}
      >
        <TextInput
          style={{
            flex: 1,
            fontSize: 15,
            color: tokens.colors.text.primary,
            paddingVertical: multiline ? 0 : 12,
            minHeight: multiline ? 76 : undefined,
            textAlign: numeric ? 'left' : 'right',
            writingDirection: numeric ? 'ltr' : 'rtl',
            textAlignVertical: multiline ? 'top' : 'center',
          }}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.text.muted}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          editable={editable}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
        />
        {prefix ? (
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: value ? tokens.colors.text.secondary : tokens.colors.text.muted,
            }}
          >
            {prefix}
          </Text>
        ) : null}
        {accessory}
      </View>
      <FieldMessage hint={hint} error={error} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */

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
    <TouchableOpacity
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: spacing,
        borderRadius: tokens.borderRadius['2xl'],
        borderWidth: value ? 1.5 : StyleSheet.hairlineWidth * 2,
        borderColor: value ? tokens.colors.border.accent : tokens.colors.glass.card.border,
        backgroundColor: value
          ? tokens.colors.primary.subtle
          : tokens.colors.background.surface,
        overflow: 'hidden',
      }}
      onPress={() => {
        void HapticFeedback.selection();
        onChange(!value);
      }}
      activeOpacity={0.75}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: tokens.colors.text.primary,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {title}
        </Text>
        {hint ? (
          <Text
            style={{
              fontSize: 11,
              color: tokens.colors.text.tertiary,
              marginTop: 3,
              lineHeight: 16,
              textAlign: 'right',
              writingDirection: 'rtl',
            }}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          width: 46,
          height: 28,
          borderRadius: 14,
          padding: 3,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: value ? 'flex-end' : 'flex-start',
          backgroundColor: value ? tokens.colors.primary.main : tokens.colors.border.strong,
          overflow: 'hidden',
        }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' }} />
      </View>
    </TouchableOpacity>
  );
}
