import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { sanitizeExploreWarnings } from '../utils/exploreWarnings';

interface Props {
  warnings?: string[];
}

export function UwRateLimitBanner({ warnings }: Props) {
  const tokens = useDesignTokens();
  const clean = useMemo(() => sanitizeExploreWarnings(warnings), [warnings]);
  if (!clean.length) return null;

  const text = clean[0];

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: tokens.colors.border.subtle,
          backgroundColor: 'rgba(255,180,0,0.08)',
        },
      ]}
    >
      <Ionicons name="warning-outline" size={16} color="#E6A817" />
      <Text style={[styles.text, { color: tokens.colors.text.secondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
});
