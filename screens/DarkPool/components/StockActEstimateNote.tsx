/**
 * כרטיס / קישור כנות בסגנון InsiderWave — בלי לטעון שאנחנו משחזרים תיק.
 * גוף ארוך רק ב-HelpSheet, לא כפסקה פתוחה במסך.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import UICard from '../../../components/ui/UICard';
import { HelpSheet } from '../../../components/ui/HelpSheet';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
} from '../darkPoolLayout';
import {
  STOCK_ACT_ESTIMATE_BODY,
  STOCK_ACT_ESTIMATE_GOT_IT,
  STOCK_ACT_ESTIMATE_LINK,
  STOCK_ACT_ESTIMATE_TITLE,
} from '../utils/stockActEstimateCopy';

type Props = {
  /** card = כותרת קצרה + קישור. link = טקסט בלבד. שניהם פותחים שיט. */
  variant?: 'card' | 'link';
};

export function StockActEstimateNote({ variant = 'card' }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [helpOpen, setHelpOpen] = useState(false);

  const sheet = (
    <HelpSheet
      visible={helpOpen}
      onClose={() => setHelpOpen(false)}
      title={STOCK_ACT_ESTIMATE_TITLE}
      body={STOCK_ACT_ESTIMATE_BODY}
      gotItLabel={STOCK_ACT_ESTIMATE_GOT_IT}
    />
  );

  if (variant === 'link') {
    return (
      <>
        <Pressable
          onPress={() => setHelpOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={STOCK_ACT_ESTIMATE_TITLE}
          hitSlop={6}
          style={styles.linkHit}
        >
          <Text style={styles.link}>{STOCK_ACT_ESTIMATE_LINK}</Text>
        </Pressable>
        {sheet}
      </>
    );
  }

  return (
    <>
      <UICard variant="glass" glassIntensity="light" padding="md" style={styles.card}>
        <Text style={styles.title}>{STOCK_ACT_ESTIMATE_TITLE}</Text>
        <Pressable
          onPress={() => setHelpOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={STOCK_ACT_ESTIMATE_TITLE}
          style={styles.linkHit}
        >
          <Text style={styles.link}>{STOCK_ACT_ESTIMATE_LINK}</Text>
        </Pressable>
      </UICard>
      {sheet}
    </>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      direction: 'rtl',
      width: '100%',
      alignSelf: 'stretch',
      marginBottom: tokens.spacing.md,
    },
    title: {
      ...darkPoolPhysicalRightText,
      fontSize: DARK_POOL_TYPE.body.fontSize,
      lineHeight: 20,
      fontWeight: '800',
      color: tokens.colors.text.primary,
    },
    linkHit: {
      alignSelf: 'stretch',
      paddingVertical: 4,
    },
    link: {
      ...darkPoolPhysicalRightText,
      marginTop: 6,
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      fontWeight: '700',
      color: tokens.colors.primary.main,
    },
  });
}
