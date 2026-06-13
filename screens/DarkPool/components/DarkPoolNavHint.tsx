/**
 * הסבר קצר על הניווט — מופיע בפיד ובגילוי.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';

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
    <View style={styles.wrap}>
      <Ionicons name="information-circle-outline" size={18} color={tokens.colors.text.tertiary} />
      <View style={styles.textCol}>
        {lines.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginHorizontal: tokens.layout.screenPadding,
      marginBottom: tokens.spacing.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: tokens.borderRadius.lg,
      borderWidth: 1,
      borderColor: tokens.colors.border.subtle,
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
    textCol: { flex: 1, gap: 2 },
    line: {
      fontSize: 12,
      lineHeight: 18,
      color: tokens.colors.text.tertiary,
      textAlign: 'left',
      writingDirection: 'rtl',
    },
  });
}
