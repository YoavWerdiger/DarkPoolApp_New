/**
 * כותרת section במסך Dark Pool — אותה סקאלה ויישור פיזי כמו בגילוי.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
  darkPoolSectionSubtitleStyle,
  darkPoolSectionTitleStyle,
} from '../darkPoolLayout';

interface SectionHeaderProps {
  title: string;
  /** `group` — תווית 15/500 מעל כרטיס. `section` — כותרת מדף 22. */
  variant?: 'section' | 'group';
  /** מחרוזת עברית טהורה, או ילדי Text מעורבים (שם LTR + טיקר מבודד). לא LRI על המשפט. */
  subtitle?: React.ReactNode;
  subtitleA11y?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

export function DarkPoolSectionHeader({
  title,
  variant = 'section',
  subtitle,
  subtitleA11y,
  actionLabel,
  onActionPress,
  icon,
}: SectionHeaderProps) {
  const tokens = useDesignTokens();
  return (
    <View style={[styles.wrap, variant === 'group' && styles.wrapGroup]}>
      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          {icon ? (
            <View style={styles.leadingIcon}>
              <Ionicons name={icon} size={18} color={tokens.colors.text.primary} />
            </View>
          ) : null}
          <Text
            style={[
              variant === 'group' ? styles.groupTitle : styles.title,
              { color: variant === 'group' ? tokens.colors.text.secondary : tokens.colors.text.primary },
            ]}
          >
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: tokens.colors.text.secondary }]}
            accessibilityLabel={subtitleA11y}
          >
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
          <Text style={[styles.actionLabel, { color: tokens.colors.text.secondary }]}>
            {actionLabel}
          </Text>
          <Ionicons name="chevron-back" size={14} color={tokens.colors.text.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    direction: 'rtl',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
    width: '100%',
    alignSelf: 'stretch',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'stretch',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leadingIcon: {
    marginLeft: 12,
  },
  title: {
    ...darkPoolSectionTitleStyle,
    flex: 1,
    minWidth: 0,
  },
  wrapGroup: {
    marginBottom: APP_LAYOUT.groupLabelToContent,
  },
  groupTitle: {
    ...darkPoolPhysicalRightText,
    flex: 1,
    minWidth: 0,
    fontSize: DARK_POOL_TYPE.groupLabel.fontSize,
    lineHeight: DARK_POOL_TYPE.groupLabel.lineHeight,
    fontWeight: DARK_POOL_TYPE.groupLabel.fontWeight,
  },
  subtitle: {
    ...darkPoolSectionSubtitleStyle,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
  },
  actionLabel: {
    ...darkPoolPhysicalRightText,
    fontSize: DARK_POOL_TYPE.footnote.fontSize,
    lineHeight: DARK_POOL_TYPE.footnote.lineHeight,
    fontWeight: DARK_POOL_TYPE.cardTitle.fontWeight,
  },
});
