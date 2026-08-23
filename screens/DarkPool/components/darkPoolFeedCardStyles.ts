import { StyleSheet } from 'react-native';
import type { useDesignTokens } from '../../../components/ui/DesignTokens';

export type DarkPoolFeedCardTokens = ReturnType<typeof useDesignTokens>;

/** סגנון משותף לכרטיסי פיד Dark Pool (כמו InsiderTradeCard). */
export function createDarkPoolFeedCardStyles(tokens: DarkPoolFeedCardTokens) {
  return StyleSheet.create({
    wrap: {
      paddingVertical: tokens.spacing.md,
    },
    wrapDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.subtle,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: tokens.spacing.sm,
    },
    topText: {
      flex: 1,
      minWidth: 0,
    },
    headline: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    headlineMeta: {
      fontSize: 13,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
    },
    summary: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 21,
      color: tokens.colors.text.secondary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    summaryEm: {
      fontWeight: '800',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    scorePill: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 48,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: tokens.borderRadius.xl,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.subtle,
    },
    scoreValue: {
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: -0.5,
      writingDirection: 'ltr',
    },
    scoreLabel: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '700',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    typeBadge: {
      alignSelf: 'flex-start',
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      writingDirection: 'rtl',
    },
    metricPanel: {
      marginTop: tokens.spacing.sm,
      marginRight: 48,
      padding: tokens.spacing.sm,
      borderRadius: tokens.borderRadius.xl,
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.08)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: tokens.spacing.sm,
    },
    metricPanelAccent: {
      borderColor: tokens.colors.border.accent,
      backgroundColor: 'rgba(0, 200, 5, 0.06)',
    },
    metricLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    metricLabels: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
    },
    metricTicker: {
      fontSize: 15,
      fontWeight: '900',
      color: tokens.colors.text.primary,
      letterSpacing: -0.4,
      writingDirection: 'ltr',
    },
    metricSub: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    metricRight: {
      alignItems: 'flex-start',
      flexShrink: 0,
    },
    metricCaption: {
      fontSize: 10,
      fontWeight: '600',
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    metricValue: {
      marginTop: 2,
      fontSize: 17,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      letterSpacing: -0.3,
      writingDirection: 'ltr',
    },
    metricHint: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    reason: {
      marginTop: tokens.spacing.sm,
      marginRight: 48,
      fontSize: 13,
      lineHeight: 20,
      color: tokens.colors.text.secondary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
  });
}
