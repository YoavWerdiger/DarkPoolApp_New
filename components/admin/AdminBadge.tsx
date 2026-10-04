import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { adminCaption, adminHebrewText } from './adminType';

type Props = {
  label: string;
  color: string;
};

export function AdminBadge({ label, color }: Props) {
  const tokens = useDesignTokens();
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tokens.colors.background.tertiary },
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  label: {
    ...adminHebrewText,
    ...adminCaption,
    textAlign: 'right',
  },
});
