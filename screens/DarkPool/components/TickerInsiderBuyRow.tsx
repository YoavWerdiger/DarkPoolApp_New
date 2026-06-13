import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { InsiderAvatar } from './InsiderAvatar';
import { formatRelativeTime, formatUsdCompact } from '../utils/darkPoolFormat';
import type { InsiderBuyRow } from '../../../types/darkpool.types';

interface Props {
  item: InsiderBuyRow;
}

export function TickerInsiderBuyRow({ item }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const isBuy = item.transaction_type === 'P';
  const txnLabel = isBuy ? 'רכישה' : item.transaction_type === 'S' ? 'מכירה' : 'עסקה';

  return (
    <UICard variant="glass" glassIntensity="light" padding="md" style={styles.card}>
      <View style={styles.row}>
        <InsiderAvatar
          name={item.insider_name}
          logoUrl={item.insider_logo_url}
          size={40}
        />
        <View style={styles.main}>
          <Text style={styles.name} numberOfLines={1}>
            {item.insider_name?.trim() || 'בכיר'}
          </Text>
          {item.insider_role?.trim() ? (
            <Text style={styles.role} numberOfLines={1}>
              {item.insider_role.trim()}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View
              style={[
                styles.txnBadge,
                {
                  backgroundColor: isBuy
                    ? tokens.colors.primary.dim
                    : 'rgba(239,68,68,0.12)',
                },
              ]}
            >
              <Ionicons
                name={isBuy ? 'arrow-up' : 'arrow-down'}
                size={11}
                color={isBuy ? tokens.colors.primary.main : tokens.colors.text.danger}
              />
              <Text
                style={[
                  styles.txnBadgeText,
                  {
                    color: isBuy
                      ? tokens.colors.primary.main
                      : tokens.colors.text.danger,
                  },
                ]}
              >
                {txnLabel}
              </Text>
            </View>
            <Text style={styles.date}>
              {formatRelativeTime(item.transaction_date || item.filed_at)}
            </Text>
          </View>
        </View>
        <View style={styles.valueCol}>
          <Text style={styles.value}>{formatUsdCompact(item.value)}</Text>
          {item.shares > 0 ? (
            <Text style={styles.shares}>
              {item.shares.toLocaleString('en-US')} מניות
            </Text>
          ) : null}
        </View>
      </View>
    </UICard>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      marginBottom: 8,
      borderRadius: tokens.borderRadius.lg,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    main: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-start',
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: tokens.colors.text.primary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    role: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    metaRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    txnBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    txnBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      writingDirection: 'rtl',
    },
    date: {
      fontSize: 12,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
    valueCol: {
      alignItems: 'flex-end',
      minWidth: 72,
    },
    value: {
      fontSize: 15,
      fontWeight: '800',
      color: tokens.colors.text.primary,
      writingDirection: 'ltr',
    },
    shares: {
      marginTop: 3,
      fontSize: 11,
      fontWeight: '500',
      color: tokens.colors.text.tertiary,
      writingDirection: 'rtl',
    },
  });
}
