import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';

export type SegmentedOption<T extends string = string> = { id: T; label: string };

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  /** accessibility prefix for each segment, e.g. "מפת חום" */
  accessibilityGroupLabel: string;
};

export function MarketsSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityGroupLabel,
}: Props<T>) {
  const tokens = useDesignTokens();

  return (
    <View style={{ flexDirection: 'row', padding: tokens.spacing.xs }}>
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onChange(opt.id)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${accessibilityGroupLabel}: ${opt.label}`}
            accessibilityState={{ selected: isActive }}
            style={{
              flex: 1,
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
                  backgroundColor: tokens.colors.background.cardSolid,
                }}
              />
            )}
            <Text
              style={{
                fontSize: tokens.typography.bodySmall.size,
                fontWeight: isActive
                  ? (tokens.typography.fontWeight.bold as '700')
                  : (tokens.typography.fontWeight.medium as '500'),
                color: isActive ? tokens.colors.primary.main : tokens.colors.text.secondary,
                textAlign: 'center',
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
