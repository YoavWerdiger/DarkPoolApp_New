import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import OtpInput from './OtpInput';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  /** שורת הסבר מעל הקוד (למשל «שלחנו קוד ל-…») */
  hint?: string;
  canResend: boolean;
  countdown: number;
  onResend: () => void;
  /** שליחת קוד בתהליך */
  sending?: boolean;
  disabled?: boolean;
};

/**
 * גוף מסך קוד אימות — משותף לטלפון / מייל / שחזור סיסמה:
 * הסבר, שש תיבות, באנר שגיאה וקישור «שלח שוב» עם ספירה לאחור — לפי ערכת הנושא.
 */
export function OtpBody({
  value,
  onChangeText,
  error,
  hint,
  canResend,
  countdown,
  onResend,
  sending = false,
  disabled = false,
}: Props) {
  const tokens = useDesignTokens();
  const resendEnabled = canResend && !sending && !disabled;

  return (
    <View style={styles.wrap}>
      {hint ? (
        <Text style={[styles.hint, { color: tokens.colors.text.secondary }]}>{hint}</Text>
      ) : null}

      <OtpInput value={value} onChangeText={onChangeText} autoFocus error={!!error} />

      {error ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.errorRow}>
          <Ionicons name="alert-circle" size={16} color={tokens.colors.danger.main} />
          <Text style={[styles.errorText, { color: tokens.colors.danger.main }]}>{error}</Text>
        </Animated.View>
      ) : null}

      <Pressable
        onPress={onResend}
        disabled={!resendEnabled}
        hitSlop={10}
        style={styles.resend}
        accessibilityRole="button"
      >
        {sending ? (
          <ActivityIndicator size="small" color={tokens.colors.text.secondary} />
        ) : (
          <Text
            style={[
              styles.resendText,
              { color: resendEnabled ? tokens.colors.text.primary : tokens.colors.text.tertiary },
              resendEnabled ? styles.resendActive : null,
            ]}
          >
            {canResend ? 'לא קיבלת? שלח קוד שוב' : `שליחה חוזרת בעוד 0:${String(countdown).padStart(2, '0')}`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: APP_LAYOUT.componentGap,
    paddingTop: APP_LAYOUT.stackGapSmall,
  },
  hint: {
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: 'rtl',
  },
  resend: {
    alignSelf: 'center',
    minHeight: 32,
    justifyContent: 'center',
    marginTop: APP_LAYOUT.stackGapSmall,
  },
  resendText: {
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
    fontVariant: ['tabular-nums'],
  },
  resendActive: {
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    textDecorationLine: 'underline',
  },
});
