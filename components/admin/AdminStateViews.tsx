import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import DesignTokens, { useDesignTokens } from '../ui/DesignTokens';
import { chatPalette } from '../chat/chatDesignTokens';
import UICard from '../ui/UICard';

export function AdminLoadingState({ label = 'טוען...' }: { label?: string }) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={tokens.colors.primary.main} />
      <Text style={[styles.msg, { color: tokens.colors.text.secondary, marginTop: tokens.spacing.md }]}>
        {label}
      </Text>
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
    <UICard
      variant="glass"
      glassIntensity="light"
      padding="lg"
      style={{
        borderRadius: tokens.borderRadius.xl,
        borderWidth: 1,
        borderColor: chatPalette.glassBorder,
        alignItems: 'center',
        marginTop: 24,
      }}
    >
      <Text style={[styles.emptyTitle, { color: tokens.colors.text.primary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.emptySub, { color: tokens.colors.text.tertiary }]}>{subtitle}</Text>
      ) : null}
    </UICard>
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
    <UICard
      variant="glass"
      glassIntensity="light"
      padding="md"
      style={{
        borderRadius: tokens.borderRadius.xl,
        borderWidth: 1,
        borderColor: `${tokens.colors.danger.main}44`,
        marginBottom: tokens.spacing.md,
      }}
    >
      <Text style={[styles.errorTitle, { color: tokens.colors.danger.main }]}>שגיאה</Text>
      <Text style={[styles.errorMsg, { color: tokens.colors.text.secondary }]}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.75}
          style={[
            styles.retryBtn,
            {
              backgroundColor: tokens.colors.primary.dim,
              borderColor: `${tokens.colors.primary.main}44`,
            },
          ]}
        >
          <Text style={{ color: tokens.colors.primary.main, fontWeight: '700', fontSize: 13 }}>
            נסה שוב
          </Text>
        </TouchableOpacity>
      ) : null}
    </UICard>
  );
}

export function AdminDeniedState() {
  const tokens = useDesignTokens();
  return (
    <View style={styles.center}>
      <Text style={[styles.emptyTitle, { color: tokens.colors.text.primary }]}>אין הרשאת מנהל</Text>
      <Text style={[styles.emptySub, { color: tokens.colors.text.tertiary }]}>
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
    paddingHorizontal: 32,
  },
  msg: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 6,
    lineHeight: 18,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '800',
    ...DesignTokens.rtlText,
    marginBottom: 4,
  },
  errorMsg: {
    fontSize: 13,
    ...DesignTokens.rtlText,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: DesignTokens.borderRadius.button,
    borderWidth: 1,
  },
});
