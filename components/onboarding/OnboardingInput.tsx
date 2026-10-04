import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens, useDesignTokens } from '../ui/DesignTokens';
import {
  formFieldInputStyle,
  formFieldPlaceholderColor,
  formFieldLabelStyle,
  formFieldShellStyle,
} from '../ui/formControl';
import { PasswordVisibilityToggle } from '../ui/PasswordVisibilityToggle';
import { useFocusAfterTransition } from '../../hooks/useFocusAfterTransition';
import { appCaptionStyle, appFormFieldHelperStyle } from '../ui/appType';
import { APP_LAYOUT } from '../ui/appLayout';

interface OnboardingInputProps extends TextInputProps {
  label: string;
  error?: string;
  /** Short helper under the field (hidden when error is shown) */
  helperText?: string;
  multiline?: boolean;
  /** When true, omit bottom margin (last field in a glass group) */
  isLast?: boolean;
}

/**
 * שדה קלט בזרימת רישום — רקע input, פוקוס ניטרלי (ללא tint ירוק).
 */
const OnboardingInput: React.FC<OnboardingInputProps> = ({
  label,
  error,
  helperText,
  multiline = false,
  isLast = false,
  onFocus,
  onBlur,
  secureTextEntry,
  autoFocus,
  ...textInputProps
}) => {
  const tokens = useDesignTokens();
  // autoFocus מושהה עד סוף מעבר המסך (מקלדת + החלקה יחד = גמגום)
  const inputRef = useFocusAfterTransition(!!autoFocus);
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const hasError = !!error;
  const isPassword = secureTextEntry === true;

  return (
    <View style={[styles.block, isLast && styles.blockLast]}>
      <Text style={formFieldLabelStyle({ tokens, focused, error: hasError })}>{label}</Text>

      <View
        style={[
          styles.shell,
          formFieldShellStyle({ tokens, focused, error: hasError, multiline }),
        ]}
      >
        {isPassword ? (
          <PasswordVisibilityToggle
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((v) => !v)}
          />
        ) : null}
        <TextInput
          ref={inputRef}
          style={[
            formFieldInputStyle(tokens),
            {
              paddingHorizontal: 0,
              paddingVertical: multiline ? 4 : 15,
              minHeight: multiline ? 80 : undefined,
              lineHeight: multiline ? 22 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
          placeholderTextColor={formFieldPlaceholderColor(tokens)}
          multiline={multiline}
          {...textInputProps}
          secureTextEntry={isPassword ? !passwordVisible : secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons
            name="alert-circle"
            size={14}
            color={tokens.colors.danger.main}
            style={{ marginLeft: 6 }}
          />
          <Text style={[appCaptionStyle, styles.errorText, { color: tokens.colors.danger.main }]}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={appFormFieldHelperStyle}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    marginBottom: APP_LAYOUT.componentGap,
  },
  blockLast: {
    marginBottom: 0,
  },
  shell: {
    flexDirection: 'row',
    borderRadius: DesignTokens.borderRadius.full,
    paddingHorizontal: 18,
    minHeight: 56,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  errorText: {
    textAlign: 'right',
    flex: 1,
    writingDirection: 'rtl',
  },
});

export default OnboardingInput;
