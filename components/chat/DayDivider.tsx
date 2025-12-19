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
    console.log('🔍 DayDivider: Processing date:', date);
    console.log('🔍 DayDivider: Date type:', typeof date);
    console.log('🔍 DayDivider: Date value:', date);

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

    console.log('🔍 DayDivider: Date parts:', {
      messageDate: `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`,
      todayDate: `${now.getUTCDate()}/${now.getUTCMonth() + 1}/${now.getUTCFullYear()}`,
      yesterdayDate: `${yesterday.getUTCDate()}/${yesterday.getUTCMonth() + 1}/${yesterday.getUTCFullYear()}`,
      isToday,
      isYesterday
    });

    // החזרת הטקסט המתאים
    if (isToday) {
      console.log('🔍 DayDivider: Returning היום');
      return 'היום';
    }
    if (isYesterday) {
      console.log('🔍 DayDivider: Returning אתמול');
      return 'אתמול';
    }

    // אם זה השנה הנוכחית
    if (date.getUTCFullYear() === now.getUTCFullYear()) {
      const months = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      const result = `${date.getUTCDate()} ב${months[date.getUTCMonth()]}`;
      console.log('🔍 DayDivider: Returning same year:', result);
      return result;
    }

    // אם זה שנה אחרת
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    const result = `${date.getUTCDate()} ב${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    console.log('🔍 DayDivider: Returning different year:', result);
    return result;
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
    marginVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  divider: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.borderRadius['2xl'],
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 0, // ללא borders לפי הזיכרון
    backgroundColor: tokens.colors.background.secondary,
  },
  text: {
    color: tokens.colors.text.primary,
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium as any,
    textAlign: 'center',
  },
});

export default DayDivider;
