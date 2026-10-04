import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DayDividerPill } from '../ui/DayDividerPill';
import { APP_LAYOUT } from '../ui/appLayout';

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
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <DayDividerPill
            key={opt.id}
            selected={active}
            haptic
            accessibilityLabel={`${accessibilityGroupLabel}: ${opt.label}`}
            onPress={() => {
              if (active) return;
              onChange(opt.id);
            }}
          >
            {opt.label}
          </DayDividerPill>
        );
      })}
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
