import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { GlassChip } from '../../../components/ui/GlassChip';
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
              marginHorizontal: tokens.spacing.xs / 2,
            }}
          >
            <GlassChip
              selected={isActive}
              disableBlur
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 40,
                height: 40,
                borderRadius: tokens.borderRadius['3xl'],
              }}
              contentContainerStyle={{
                minHeight: 40,
                height: 40,
                paddingHorizontal: 2,
              }}
            >
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
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{
                  zIndex: 1,
                  fontSize: tokens.typography.bodySmall.size,
                  fontWeight,
                  color,
                  textAlign: 'center',
                  writingDirection: 'rtl',
                  paddingHorizontal: 2,
                }}
              >
                {opt.label}
              </Text>
            )}
            </GlassChip>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
