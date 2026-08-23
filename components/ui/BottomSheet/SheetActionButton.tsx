import React, { useMemo } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useDesignTokens } from '../DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { sheetActionColors, type SheetActionVariant } from './sheetGlass';

export type SheetActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: SheetActionVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** ברירת מחדל: selection haptic */
  haptic?: boolean;
};

/**
 * כפתור פעולה אחיד לפוטרי BottomSheet / UIBottomSheet —
 * מבוסס `sheetActionColors` (בלי מילוי לבן כפוי).
 */
export function SheetActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  haptic = true,
}: SheetActionButtonProps) {
  const tokens = useDesignTokens();
  const palette = useMemo(() => sheetActionColors(tokens), [tokens]);
  const colors = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={() => {
        if (haptic) {
          if (variant === 'destructive') void HapticFeedback.warning();
          else void HapticFeedback.selection();
        }
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: colors.borderWidth,
          opacity: disabled || loading ? 0.55 : pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.color}
        />
      ) : (
        <Text style={[styles.label, { color: colors.color }, textStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 50,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default SheetActionButton;
