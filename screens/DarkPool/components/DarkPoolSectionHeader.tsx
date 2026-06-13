/**
 * כותרת section במסך Dark Pool — RTL, כמו שאר האפליקציה.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

export function DarkPoolSectionHeader({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  icon,
}: SectionHeaderProps) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.wrap}>
      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          {icon ? (
            <Ionicons name={icon} size={18} color={tokens.colors.primary.main} />
          ) : null}
          <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: tokens.colors.text.tertiary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel ? (
        <Pressable
          onPress={
            onActionPress
              ? () => {
                  void HapticFeedback.selection();
                  onActionPress();
                }
              : undefined
          }
          hitSlop={12}
          style={styles.action}
        >
          <Text style={[styles.actionLabel, { color: tokens.colors.primary.main }]}>
            {actionLabel}
          </Text>
          <Ionicons name="chevron-back" size={14} color={tokens.colors.primary.main} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  textCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'left',
    writingDirection: 'rtl',
    lineHeight: 17,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
});
