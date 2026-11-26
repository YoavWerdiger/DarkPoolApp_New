import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { EmptyState } from './EmptyState';

/**
 * שגיאת טעינה בתוך המסך עם «נסה שוב» — במקום חלון Alert שקופץ ונעלם.
 * לשגיאות של פעולה (שמירה / מחיקה) עדיין מתאים Alert / Toast.
 */
export default function ErrorState({
  onRetry,
  title = 'לא הצלחנו לטעון את המידע',
  subtitle = 'בדקו את החיבור לאינטרנט ונסו שוב.',
  compact = false,
  style,
}: {
  onRetry: () => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={title}
      subtitle={subtitle}
      actionLabel="נסה שוב"
      actionIcon="refresh"
      onAction={onRetry}
      compact={compact}
      style={style}
    />
  );
}
