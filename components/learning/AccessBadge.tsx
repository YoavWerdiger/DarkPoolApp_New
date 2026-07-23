import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AccessLevel } from '../../types/learning';
import { useDesignTokens } from '../ui/DesignTokens';

interface AccessBadgeProps {
  access: AccessLevel;
}

export const AccessBadge: React.FC<AccessBadgeProps> = ({ access }) => {
  const DesignTokens = useDesignTokens();
  
  const styles = useMemo(() => StyleSheet.create({
    badge: {
      paddingHorizontal: DesignTokens.spacing.sm,
      paddingVertical: DesignTokens.spacing.xs,
      borderRadius: DesignTokens.borderRadius.sm,
      ...DesignTokens.shadows.sm,
    },
    badgeText: {
      fontSize: DesignTokens.typography.fontSize.xs,
      fontWeight: DesignTokens.typography.fontWeight.semibold as any,
      textAlign: 'center',
    },
  }), [DesignTokens]);
  
  const getBadgeConfig = (access: AccessLevel) => {
    switch (access) {
      case 'free':
        return {
          text: 'חינם',
          backgroundColor: DesignTokens.colors.success.main,
          textColor: '#FFFFFF',
        };
      case 'registration':
        return {
          text: 'הרשמה',
          backgroundColor: DesignTokens.colors.info.main,
          textColor: '#FFFFFF',
        };
      case 'paid':
        return {
          text: 'בתשלום',
          backgroundColor: DesignTokens.colors.warning.main,
          textColor: '#FFFFFF',
        };
      default:
        return {
          text: 'לא ידוע',
          backgroundColor: DesignTokens.colors.text.tertiary,
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

