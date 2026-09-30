/**
 * הסבר קצר על הניווט — מופיע בפיד ובגילוי.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../../components/ui/appLayout';
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
    <UICard variant="soft" glassIntensity="subtle" padding="none" style={styles.wrap}>
      <View style={styles.inner}>
        <View style={styles.leadingIcon}>
          <Ionicons name="information-circle-outline" size={18} color={tokens.colors.text.primary} />
        </View>
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
      borderRadius: UI_CARD_RADIUS,
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    inner: {
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingVertical: 15,
    },
    leadingIcon: { marginLeft: 12 },
    textCol: { flex: 1, gap: 2, alignItems: 'stretch' },
    line: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      fontSize: DARK_POOL_TYPE.caption.fontSize,
      lineHeight: DARK_POOL_TYPE.caption.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption.fontWeight,
      color: tokens.colors.text.tertiary,
    },
  });
}
