/**
 * כותרת קומפקטית לפיד — כמו "LATEST TRADES" ב-Insider Wave (אותיות קטנות, ללא אייקון).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
} from '../darkPoolLayout';

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
      direction: 'rtl',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: APP_LAYOUT.groupLabelToContent,
      marginTop: 0,
    },
    label: {
      ...darkPoolPhysicalRightText,
      flex: 1,
      fontSize: DARK_POOL_TYPE.groupLabel.fontSize,
      lineHeight: DARK_POOL_TYPE.groupLabel.lineHeight,
      fontWeight: DARK_POOL_TYPE.groupLabel.fontWeight,
      color: tokens.colors.text.secondary,
    },
    count: {
      fontSize: DARK_POOL_TYPE.caption2.fontSize,
      lineHeight: DARK_POOL_TYPE.caption2.lineHeight,
      fontWeight: DARK_POOL_TYPE.caption2.fontWeight,
      color: tokens.colors.text.tertiary,
      writingDirection: 'ltr',
    },
  });
}
