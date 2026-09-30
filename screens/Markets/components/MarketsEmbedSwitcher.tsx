import React from 'react';
import { StyleSheet } from 'react-native';
import UICard from '../../../components/ui/UICard';
import { UI_CARD_RADIUS } from '../marketsLayout';
import {
  MarketsSegmentedControl,
  type SegmentedOption,
} from './MarketsSegmentedControl';

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  accessibilityGroupLabel: string;
};

/**
 * סרגל מקטעים אחיד (זכוכית + SegmentedControl) —
 * שווקים, אקדמיה, יומן מסחר וכו'.
 */
export function MarketsEmbedSwitcher<T extends string>({
  options,
  value,
  onChange,
  accessibilityGroupLabel,
}: Props<T>) {
  return (
    <UICard
      variant="soft"
      glassIntensity="light"
      padding="none"
      style={[styles.shell, { borderRadius: UI_CARD_RADIUS }]}
    >
      <MarketsSegmentedControl
        options={options}
        value={value}
        onChange={onChange}
        accessibilityGroupLabel={accessibilityGroupLabel}
        containerDirection="row-reverse"
        segmentAccessibilityRole="tab"
      />
    </UICard>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
  },
});
