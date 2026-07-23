import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface DayDividerProps {
  date: Date;
}

const DayDivider: React.FC<DayDividerProps> = memo(({ date }) => {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);
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
      <View style={styles.divider}>
        <Text style={styles.text}>{getDayText(date)}</Text>
      </View>
    </View>
  );
});

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
  },
  divider: {
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.sm + 2,
    borderRadius: tokens.borderRadius.xl,
    minWidth: 112,
    alignItems: 'center',
    borderWidth: 0,
    backgroundColor: tokens.colors.background.cardSolid,
  },
  text: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium as any,
    textAlign: 'center',
  },
});

export default DayDivider;
