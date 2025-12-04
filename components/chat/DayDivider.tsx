import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DesignTokens } from '../ui/DesignTokens';

interface DayDividerProps {
  date: Date;
}

const DayDivider: React.FC<DayDividerProps> = memo(({ date }) => {
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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.lg,
  },
  divider: {
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.sm,
    borderRadius: DesignTokens.borderRadius['2xl'],
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: '#181818', // אפור כהה
    borderColor: '#374151', // אפור גבול
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  text: {
    color: '#E5E7EB',
    fontSize: DesignTokens.typography.fontSize.sm,
    fontWeight: DesignTokens.typography.fontWeight.medium as any,
    textAlign: 'center',
  },
});

export default DayDivider;
