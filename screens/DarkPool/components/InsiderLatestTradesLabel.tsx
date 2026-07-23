/**
 * כותרת קומפקטית לפיד — כמו "LATEST TRADES" ב-Insider Wave (אותיות קטנות, ללא אייקון).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';

interface Props {
  count?: number;
  title?: string;
}

export function InsiderLatestTradesLabel({ count, title = 'עסקאות אחרונות' }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{title}</Text>
      {count != null && count > 0 ? (
        <Text style={styles.count}>{count}</Text>
      ) : null}
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: tokens.spacing.sm,
      marginTop: tokens.spacing.xs,
    },
    label: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    count: {
      fontSize: 11,
      fontWeight: '700',
      color: tokens.colors.text.tertiary,
      writingDirection: 'ltr',
    },
  });
}
