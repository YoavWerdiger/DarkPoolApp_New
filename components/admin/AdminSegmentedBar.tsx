import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DayDividerPill, DayDividerSlidingLayer } from '../ui/DayDividerPill';
import { APP_LAYOUT } from '../ui/appLayout';
import { useSlidingIndicator } from '../ui/SlidingIndicator';

export type AdminSegment<T extends string> = {
  id: T;
  label: string;
};

/** שורת צ'יפים — אותו DayDividerPill כמו בשאר המוצר. */
export function AdminSegmentedBar<T extends string>({
  options,
  value,
  onChange,
  accessibilityGroupLabel,
}: {
  options: AdminSegment<T>[];
  value: T;
  onChange: (id: T) => void;
  accessibilityGroupLabel: string;
}) {
  const indicator = useSlidingIndicator(value);
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <View key={opt.id} onLayout={indicator.onItemLayout(opt.id)}>
            <DayDividerPill
              selected={indicator.visualSelected === opt.id}
                  instantSelection
              haptic
              accessibilityLabel={`${accessibilityGroupLabel}: ${opt.label}`}
              onPress={() => {
                if (active) return;
                onChange(opt.id);
              }}
            >
              {opt.label}
            </DayDividerPill>
          </View>
        );
      })}
      <DayDividerSlidingLayer
        indicator={indicator}
        labelOf={(id) => options.find((o) => o.id === id)?.label ?? ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: APP_LAYOUT.stackGapSmall,
  },
});
