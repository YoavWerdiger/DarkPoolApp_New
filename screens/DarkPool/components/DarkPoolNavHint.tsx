/**
 * הסבר קצר על הניווט — מופיע בפיד ובגילוי.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
} from '../darkPoolLayout';

interface Props {
  variant?: 'feed' | 'explore';
}

export function DarkPoolNavHint({ variant = 'feed' }: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const lines =
    variant === 'feed'
      ? [
          'תמונה / שם → פרופיל המשקיע',
          'שורת המניה → עסקאות Form 4 באותו טיקר',
        ]
      : ['חפשו או בחרו משקיע → עקבו → הפעילות תופיע ב«מעקב»'];

  return (
    <UICard variant="glass" glassIntensity="subtle" padding="none" style={styles.wrap}>
      <View style={styles.inner}>
        <Ionicons name="information-circle-outline" size={18} color={tokens.colors.text.tertiary} />
        <View style={styles.textCol}>
          {lines.map((line) => (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
          ))}
        </View>
      </View>
    </UICard>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      marginHorizontal: tokens.layout.screenPadding,
      marginBottom: tokens.spacing.md,
      borderRadius: tokens.borderRadius.lg,
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    inner: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    textCol: { flex: 1, gap: 2, alignItems: 'stretch' },
    line: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      lineHeight: 18,
      color: tokens.colors.text.tertiary,
    },
  });
}
