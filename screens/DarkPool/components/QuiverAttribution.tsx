/**
 * ייחוס שקט ל-Quiver — קישור בלבד, בלי כותרות «עדכון נתונים» / «לא בזמן אמת».
 * כנות על טריות נתונים נשארת מאחורי `?` בפרטי עסקה.
 */

import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  DARK_POOL_TYPE,
  darkPoolPhysicalRightText,
} from '../darkPoolLayout';

const QUIVER_URL = 'https://www.quiverquant.com/';

export type DataFreshnessScope =
  | 'all'
  | 'congress'
  | 'insiders'
  | 'explore'
  | 'politician'
  | 'fund';

type Props = {
  /** הצג רק כשהנתונים רלוונטיים למסך */
  visible?: boolean;
  /** נשמר לתאימות קריאה — לא מציג יותר הסבר טריות גלוי */
  scope?: DataFreshnessScope | 'link-only';
};

export function QuiverAttribution({
  visible = true,
}: Props) {
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  if (!visible) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Pressable
        onPress={() => {
          void Linking.openURL(QUIVER_URL);
        }}
        accessibilityRole="link"
        accessibilityLabel="Data provided by the Quiver API"
        hitSlop={6}
      >
        <Text style={styles.link}>Data provided by the Quiver API</Text>
      </Pressable>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      direction: 'rtl',
      alignSelf: 'stretch',
      paddingVertical: 8,
      paddingHorizontal: 2,
      gap: 4,
    },
    link: {
      ...darkPoolPhysicalRightText,
      width: '100%',
      marginTop: 2,
      fontSize: DARK_POOL_TYPE.caption2.fontSize,
      color: tokens.colors.text.secondary,
      textDecorationLine: 'underline',
      opacity: 0.85,
    },
  });
}
