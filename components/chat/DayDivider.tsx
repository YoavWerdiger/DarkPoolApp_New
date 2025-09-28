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
    
    // יצירת תאריכים פשוטים לפי שנה, חודש ויום
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    console.log('🔍 DayDivider: Now:', now);
    console.log('🔍 DayDivider: Today (normalized):', today);
    console.log('🔍 DayDivider: Yesterday (normalized):', yesterday);
    console.log('🔍 DayDivider: MessageDate (original):', date);
    console.log('🔍 DayDivider: MessageDate (normalized):', messageDate);
    console.log('🔍 DayDivider: MessageDate parts:', {
      year: date.getFullYear(),
      month: date.getMonth(),
      date: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes()
    });
    
    // השוואה מדויקת של תאריכים
    if (messageDate.getTime() === today.getTime()) {
      console.log('🔍 DayDivider: Returning היום');
      return 'היום';
    }
    if (messageDate.getTime() === yesterday.getTime()) {
      console.log('🔍 DayDivider: Returning אתמול');
      return 'אתמול';
    }
    
    // אם זה השנה הנוכחית
    if (date.getFullYear() === now.getFullYear()) {
      const months = [
        'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      const result = `${date.getDate()} ב${months[date.getMonth()]}`;
      console.log('🔍 DayDivider: Returning same year:', result);
      return result;
    }
    
    // אם זה שנה אחרת
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    const result = `${date.getDate()} ב${months[date.getMonth()]} ${date.getFullYear()}`;
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
    fontWeight: DesignTokens.typography.fontWeight.medium,
    textAlign: 'center',
  },
});

export default DayDivider;
