import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';

export type UnderlineTabOption<T extends string = string> = {
  id: T;
  label: string;
  color?: string;
};

type Props<T extends string> = {
  options: UnderlineTabOption<T>[];
  value: T;
  onChange: (id: T) => void;
  accessibilityGroupLabel: string;
};

/**
 * סרגל טאבים בסגנון "underline" עם הדגשה צבעונית לכל טאב — תואם לעיצוב
 * שבמסך הקורסים (אקדמיה). מתחת לטאב הפעיל מופיע פס דק עם זוהר רך
 * בצבע הייעודי של הטאב.
 */
export function MarketsUnderlineTabs<T extends string>({
  options,
  value,
  onChange,
  accessibilityGroupLabel,
}: Props<T>) {
  const tokens = useDesignTokens();

  const defaultAccent = tokens.colors.primary.main;

  return (
    <View
      style={[
        styles.tabsRow,
        {
          borderBottomColor: tokens.colors.border.subtle,
        },
      ]}
    >
      {options.map((opt) => {
        const isActive = value === opt.id;
        const accent = opt.color ?? defaultAccent;
        return (
          <TouchableOpacity
            key={opt.id}
            style={styles.tab}
            onPress={() => {
              void HapticFeedback.selection();
              onChange(opt.id);
            }}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="tab"
            accessibilityLabel={`${accessibilityGroupLabel}: ${opt.label}`}
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.tabText,
                { color: tokens.colors.text.tertiary },
                isActive && { color: tokens.colors.text.primary, fontWeight: '800' },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
            {isActive && (
              <View
                style={[
                  styles.activeIndicator,
                  { backgroundColor: accent, shadowColor: accent },
                ]}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: 'row-reverse' as any,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: 'row-reverse' as any,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    position: 'relative' as any,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700' as any,
    letterSpacing: 0.2,
  },
  activeIndicator: {
    position: 'absolute' as any,
    bottom: -StyleSheet.hairlineWidth,
    left: '15%',
    right: '15%',
    height: 3,
    borderRadius: 2,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    elevation: 0,
  },
});
