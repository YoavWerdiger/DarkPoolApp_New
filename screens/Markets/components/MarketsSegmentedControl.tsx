import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { MARKETS_TYPE } from '../marketsLayout';
import { GlassChip } from '../../../components/ui/GlassChip';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import {
  SlidingIndicatorLayer,
  useSlidingIndicator,
} from '../../../components/ui/SlidingIndicator';

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
  const indicator = useSlidingIndicator<T>(value);

  const chipStyle = {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    height: 40,
    borderRadius: tokens.borderRadius['3xl'],
  };
  const chipContentStyle = {
    minHeight: 40,
    height: 40,
    paddingHorizontal: 2,
  };

  const renderLabel = (opt: SegmentedOption<T>, isActive: boolean) => {
    const color = isActive ? tokens.colors.primary.main : tokens.colors.text.secondary;
    const fontWeight = isActive
      ? MARKETS_TYPE.cardTitle.fontWeight
      : MARKETS_TYPE.groupLabel.fontWeight;
    return opt.icon ? (
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
            fontSize: MARKETS_TYPE.cardSubtitle.fontSize,
            lineHeight: MARKETS_TYPE.cardSubtitle.lineHeight,
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
          fontSize: MARKETS_TYPE.cardSubtitle.fontSize,
          lineHeight: MARKETS_TYPE.cardSubtitle.lineHeight,
          fontWeight,
          color,
          textAlign: 'center',
          writingDirection: 'rtl',
          paddingHorizontal: 2,
        }}
      >
        {opt.label}
      </Text>
    );
  };

  return (
    <View style={{ flexDirection: containerDirection, padding: tokens.spacing.xs }}>
      {options.map((opt) => {
        const isActive = value === opt.id;
        const isShownActive = indicator.visualSelected === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onLayout={indicator.onItemLayout(opt.id)}
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
              selected={isShownActive}
              disableBlur
              style={chipStyle}
              contentContainerStyle={chipContentStyle}
            >
              {renderLabel(opt, isShownActive)}
            </GlassChip>
          </TouchableOpacity>
        );
      })}
      <SlidingIndicatorLayer
        indicator={indicator}
        renderFace={(content) => (
          <GlassChip selected disableBlur style={chipStyle} contentContainerStyle={chipContentStyle}>
            {content}
          </GlassChip>
        )}
        renderLabel={(id) => {
          const opt = options.find((o) => o.id === id);
          return opt ? renderLabel(opt, true) : null;
        }}
      />
    </View>
  );
}
