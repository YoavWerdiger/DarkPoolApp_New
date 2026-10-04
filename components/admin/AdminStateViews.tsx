import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import UIButton from '../ui/UIButton';
import { APP_LAYOUT } from '../ui/appLayout';
import { AdminSurface } from './AdminSurface';
import {
  adminBody,
  adminCaption,
  adminCardSubtitle,
  adminCardTitle,
  adminHebrewText,
} from './adminType';

export function AdminLoadingState({ label = 'טוען...' }: { label?: string }) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={tokens.colors.text.secondary} />
      <Text style={[styles.msg, { color: tokens.colors.text.secondary }]}>{label}</Text>
    </View>
  );
}

export function AdminEmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const tokens = useDesignTokens();
  return (
    <AdminSurface padding="lg" style={styles.emptyCard}>
      <Text style={[styles.emptyTitle, { color: tokens.colors.text.primary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.emptySub, { color: tokens.colors.text.secondary }]}>{subtitle}</Text>
      ) : null}
    </AdminSurface>
  );
}

export function AdminErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const tokens = useDesignTokens();
  return (
    <AdminSurface padding="md">
      <Text style={[styles.errorTitle, { color: tokens.colors.text.danger }]}>שגיאה</Text>
      <Text style={[styles.errorMsg, { color: tokens.colors.text.secondary }]}>{message}</Text>
      {onRetry ? (
        <View style={styles.retryWrap}>
          <UIButton title="נסה שוב" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </AdminSurface>
  );
}

export function AdminDeniedState() {
  const tokens = useDesignTokens();
  return (
    <View style={styles.center}>
      <Text style={[styles.emptyTitle, { color: tokens.colors.text.primary }]}>אין הרשאת מנהל</Text>
      <Text style={[styles.emptySub, { color: tokens.colors.text.secondary }]}>
        המסך זמין רק למשתמשים עם הרשאות מנהל
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  },
  msg: {
    ...adminHebrewText,
    ...adminBody,
    marginTop: APP_LAYOUT.componentGap,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    marginTop: APP_LAYOUT.sectionHeaderToContent,
  },
  emptyTitle: {
    ...adminHebrewText,
    ...adminCardTitle,
    textAlign: 'center',
  },
  emptySub: {
    ...adminHebrewText,
    ...adminCardSubtitle,
    textAlign: 'center',
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  errorTitle: {
    ...adminHebrewText,
    ...adminCardTitle,
    marginBottom: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  errorMsg: {
    ...adminHebrewText,
    ...adminCaption,
  },
  retryWrap: {
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    alignSelf: 'flex-start',
  },
});
