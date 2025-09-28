import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AccessLevel } from '../../types/learning';
import { DesignTokens } from '../ui/DesignTokens';

interface AccessBadgeProps {
  access: AccessLevel;
}

export const AccessBadge: React.FC<AccessBadgeProps> = ({ access }) => {
  const getBadgeConfig = (access: AccessLevel) => {
    switch (access) {
      case 'free':
        return {
          text: 'חינם',
          backgroundColor: DesignTokens.colors.success,
          textColor: '#FFFFFF',
        };
      case 'registration':
        return {
          text: 'הרשמה',
          backgroundColor: DesignTokens.colors.info,
          textColor: '#FFFFFF',
        };
      case 'paid':
        return {
          text: 'בתשלום',
          backgroundColor: DesignTokens.colors.warning,
          textColor: '#FFFFFF',
        };
      default:
        return {
          text: 'לא ידוע',
          backgroundColor: DesignTokens.colors.textMuted,
          textColor: '#FFFFFF',
        };
    }
  };

  const config = getBadgeConfig(access);

  return (
    <View style={[styles.badge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.badgeText, { color: config.textColor }]}>
        {config.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: DesignTokens.spacing.sm,
    paddingVertical: DesignTokens.spacing.xs,
    borderRadius: DesignTokens.borderRadius.sm,
    ...DesignTokens.shadows.sm,
  },
  badgeText: {
    fontSize: DesignTokens.typography.fontSize.xs,
    fontWeight: DesignTokens.typography.fontWeight.semibold,
    textAlign: 'center',
  },
});

