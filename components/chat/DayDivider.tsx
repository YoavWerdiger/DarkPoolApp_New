import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { DayDividerPill } from '../ui/DayDividerPill';

export {
  DayDividerPill,
  DAY_DIVIDER_CARD,
  DAY_DIVIDER_SELECTED_INTENSITY,
} from '../ui/DayDividerPill';
export type { DayDividerPillProps } from '../ui/DayDividerPill';

interface DayDividerProps {
  date: Date;
}

const DayDivider: React.FC<DayDividerProps> = memo(({ date }) => {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const getDayText = (date: Date): string => {
    // קבלת התאריך הנוכחי
    const now = new Date();

    // השוואה פשוטה לפי יום, חודש ושנה (UTC time to avoid timezone issues)
    const isToday = date.getUTCFullYear() === now.getUTCFullYear() &&
      date.getUTCMonth() === now.getUTCMonth() &&
      date.getUTCDate() === now.getUTCDate();

    // חישוב אתמול
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const isYesterday = date.getUTCFullYear() === yesterday.getUTCFullYear() &&
      date.getUTCMonth() === yesterday.getUTCMonth() &&
      date.getUTCDate() === yesterday.getUTCDate();

    if (isToday) {
      return 'היום';
    }
    if (isYesterday) {
      return 'אתמול';
    }

    if (date.getUTCFullYear() === now.getUTCFullYear()) {
      const months = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      return `${date.getUTCDate()} ב${months[date.getUTCMonth()]}`;
    }

    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return `${date.getUTCDate()} ב${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  };

  return (
    <View style={styles.container}>
      <DayDividerPill style={styles.dateMinWidth}>{getDayText(date)}</DayDividerPill>
    </View>
  );
});

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      marginVertical: tokens.spacing.lg,
      paddingHorizontal: tokens.spacing.lg,
    },
    dateMinWidth: {
      minWidth: 112,
    },
  });

export default DayDivider;
