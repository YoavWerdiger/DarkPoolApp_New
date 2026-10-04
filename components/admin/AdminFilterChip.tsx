import React from 'react';
import { DayDividerPill } from '../ui/DayDividerPill';

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
};

/** אותו צ'יפ כמו בפיד, בחקור וביומן. */
export function AdminFilterChip({ label, active, onPress }: Props) {
  return (
    <DayDividerPill selected={active} onPress={onPress} haptic accessibilityLabel={label}>
      {label}
    </DayDividerPill>
  );
}
