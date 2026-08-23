import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import DesignTokens, { useDesignTokens } from '../ui/DesignTokens';
import { chatPalette } from '../chat/chatDesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function AdminFilterChip({ label, active, onPress }: Props) {
  const tokens = useDesignTokens();
  return (
    <TouchableOpacity
      onPress={() => {
        void HapticFeedback.selection();
        onPress();
      }}
      activeOpacity={0.75}
      style={[
        styles.chip,
        {
          backgroundColor: active ? tokens.colors.primary.dim : 'rgba(255,255,255,0.04)',
          borderColor: active ? `${tokens.colors.primary.main}66` : chatPalette.glassBorder,
        },
      ]}
    >
      <Text
        style={{
          color: active ? tokens.colors.primary.main : tokens.colors.text.secondary,
          fontWeight: '700',
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: DesignTokens.borderRadius.button,
    borderWidth: 1,
  },
});
