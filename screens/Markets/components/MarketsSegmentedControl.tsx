import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';

export type SegmentedOption<T extends string = string> = {
  id: T;
  label: string;
  /** אייקון אופציונלי (למשל בטאבים של יומן) */
  icon?: keyof typeof Ionicons.glyphMap;
};

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** accessibility prefix for each segment, e.g. "מפת חום" */
  accessibilityGroupLabel: string;
  /** כיוון שורת המקטעים — ב־RTL אפשר `row-reverse` */
  containerDirection?: 'row' | 'row-reverse';
  /** ברירת מחדל `button` (מפת חום); ביומן מסחר `tab` */
  segmentAccessibilityRole?: 'button' | 'tab';
};

export function MarketsSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityGroupLabel,
  containerDirection = 'row',
  segmentAccessibilityRole = 'button',
}: Props<T>) {
  const tokens = useDesignTokens();

  return (
    <View style={{ flexDirection: containerDirection, padding: tokens.spacing.xs }}>
      {options.map((opt) => {
        const isActive = value === opt.id;
        const color = isActive ? tokens.colors.primary.main : tokens.colors.text.secondary;
        const fontWeight = isActive
          ? (tokens.typography.fontWeight.bold as '700')
          : (tokens.typography.fontWeight.medium as '500');
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => {
              if (!isActive) void HapticFeedback.selection();
              onChange(opt.id);
            }}
            activeOpacity={0.7}
            accessibilityRole={segmentAccessibilityRole}
            accessibilityLabel={`${accessibilityGroupLabel}: ${opt.label}`}
            accessibilityState={{ selected: isActive }}
            style={{
              flex: 1,
              minWidth: 0,
              height: 40,
              borderRadius: tokens.borderRadius['3xl'],
              backgroundColor: 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              marginHorizontal: tokens.spacing.xs / 2,
              position: 'relative',
            }}
          >
            {isActive && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: tokens.borderRadius['3xl'],
                  backgroundColor: `${tokens.colors.primary.main}18`,
                  borderWidth: 1,
                  borderColor: `${tokens.colors.primary.main}44`,
                }}
              />
            )}
            {opt.icon ? (
              <View
                style={{
                  zIndex: 1,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  maxWidth: '100%',
                  paddingHorizontal: 2,
                }}
              >
                <Ionicons name={opt.icon} size={17} color={color} />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={{
                    flexShrink: 1,
                    minWidth: 0,
                    fontSize: tokens.typography.bodySmall.size,
                    fontWeight,
                    color,
                    textAlign: 'center',
                  }}
                >
                  {opt.label}
                </Text>
              </View>
            ) : (
              <Text
                style={{
                  zIndex: 1,
                  fontSize: tokens.typography.bodySmall.size,
                  fontWeight,
                  color,
                  textAlign: 'center',
                }}
              >
                {opt.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
