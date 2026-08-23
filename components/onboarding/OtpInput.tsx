import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { DesignTokens } from '../ui/DesignTokens';

interface OtpInputProps {
  /** Current OTP value (6 digits string) */
  value: string;
  /** Called with new complete 6-digit value */
  onChangeText: (text: string) => void;
  /** Auto-focus first input on mount */
  autoFocus?: boolean;
  /** Error state (red borders) */
  error?: boolean;
}

/**
 * קומפוננטת OTP עם 6 תיבות נפרדות.
 * auto-focus בין תיבות, תמיכה ב-paste, backspace חכם.
 */
const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChangeText,
  autoFocus = false,
  error = false,
}) => {
  const inputRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(autoFocus ? 0 : null);

  // ערך מסודר ל-6 תיבות
  const digits = (value || '').split('').slice(0, 6);
  while (digits.length < 6) digits.push('');

  const handleChange = (text: string, index: number) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) {
      // backspace — מחק תו נוכחי ועבור לאחור
      const newDigits = [...digits];
      newDigits[index] = '';
      onChangeText(newDigits.join(''));
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }

    // תמיכה ב-paste של מספר ארוך
    if (cleaned.length > 1) {
      const pasteDigits = cleaned.slice(0, 6).split('');
      const newDigits = [...digits];
      for (let i = 0; i < pasteDigits.length && index + i < 6; i++) {
        newDigits[index + i] = pasteDigits[i];
      }
      onChangeText(newDigits.join(''));
      // עבור לתיבה הבאה אחרי paste
      const nextEmpty = newDigits.findIndex((d) => d === '');
      if (nextEmpty >= 0 && nextEmpty < 6) {
        inputRefs.current[nextEmpty]?.focus();
      } else {
        inputRefs.current[5]?.blur();
      }
      return;
    }

    // תו בודד
    const newDigits = [...digits];
    newDigits[index] = cleaned[0];
    onChangeText(newDigits.join(''));

    // עבור לתיבה הבאה
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else {
      // הסתיים — הסר focus
      inputRefs.current[5]?.blur();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && digits[index] === '' && index > 0) {
      // backspace בתיבה ריקה — עבור לתיבה הקודמת
      inputRefs.current[index - 1]?.focus();
    }
  };

  const borderColor = error ? '#F85149' : 'rgba(255,255,255,0.12)';
  const focusedBorderColor = error ? '#F85149' : DesignTokens.colors.primary.main;

  return (
    <View style={styles.container}>
      {digits.map((digit, index) => {
        const isFocused = focusedIndex === index;
        return (
          <Pressable
            key={index}
            onPress={() => inputRefs.current[index]?.focus()}
            style={[
              styles.box,
              {
                borderColor: isFocused ? focusedBorderColor : borderColor,
                backgroundColor: isFocused
                  ? error
                    ? 'rgba(248,81,73,0.08)'
                    : 'rgba(0,200,5,0.08)'
                  : DesignTokens.colors.background.input,
              },
            ]}
          >
            <TextInput
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={styles.input}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              keyboardType="number-pad"
              maxLength={6} // תמיכה ב-paste של כמה ספרות
              autoFocus={autoFocus && index === 0}
              selectTextOnFocus
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
            />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: DesignTokens.borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    height: '100%',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    padding: 0,
  },
});

export default OtpInput;
