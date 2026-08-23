import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens } from '../ui/DesignTokens';

interface OnboardingInputProps extends TextInputProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  /** Short helper under the field (hidden when error is shown) */
  helperText?: string;
  multiline?: boolean;
  /** When true, omit bottom margin (last field in a glass group) */
  isLast?: boolean;
}

/**
 * Flat field for use inside a shared glass card (not its own bubble).
 * Matches EditProfile / ChangePassword field styling inside UICard glass.
 */
const OnboardingInput: React.FC<OnboardingInputProps> = ({
  label,
  icon,
  error,
  helperText,
  multiline = false,
  isLast = false,
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? '#F85149'
    : focused
      ? DesignTokens.colors.primary.main
      : DesignTokens.colors.border.divider;

  return (
    <View style={[styles.block, isLast && styles.blockLast]}>
      <Text
        style={[
          styles.label,
          { color: focused ? 'rgba(255,255,255,0.78)' : DesignTokens.colors.text.tertiary },
        ]}
      >
        {label}
      </Text>

      <View
        style={[
          styles.shell,
          {
            borderColor,
            backgroundColor: focused
              ? 'rgba(0,200,5,0.08)'
              : DesignTokens.colors.background.input,
            paddingVertical: multiline ? 12 : 0,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? DesignTokens.colors.primary.main : 'rgba(255,255,255,0.38)'}
            style={{ marginTop: multiline ? 4 : 0 }}
          />
        ) : null}
        <TextInput
          style={[
            styles.input,
            {
              paddingHorizontal: icon ? 12 : 0,
              paddingVertical: multiline ? 4 : 15,
              minHeight: multiline ? 80 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
          placeholderTextColor={DesignTokens.colors.text.muted}
          multiline={multiline}
          {...textInputProps}
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
          <Ionicons name="alert-circle" size={14} color="#F85149" style={{ marginLeft: 6 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    marginBottom: 16,
  },
  blockLast: {
    marginBottom: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'right',
    letterSpacing: 0.1,
    writingDirection: 'rtl',
  },
  shell: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: DesignTokens.borderRadius.md,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  errorText: {
    color: '#F85149',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    writingDirection: 'rtl',
  },
  helperText: {
    marginTop: 8,
    paddingHorizontal: 2,
    color: 'rgba(255,255,255,0.38)',
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'right',
    lineHeight: 18,
    writingDirection: 'rtl',
  },
});

export default OnboardingInput;
