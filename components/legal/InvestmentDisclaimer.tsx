import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { TEXT_DIR } from '../../lib/i18n/language';

export const INVESTMENT_DISCLAIMER_HE =
  'המידע באפליקציה נועד ללימוד ולמידע כללי בלבד. הוא אינו ייעוץ השקעות, שיווק השקעות או המלצה לקנות או למכור ניירות ערך, ' +
  'ואינו מותאם לנתונים ולצרכים האישיים שלך. מסחר בשוק ההון כרוך בסיכון, כולל אובדן הכסף שהושקע. כל החלטת השקעה היא באחריותך בלבד.';

/** דיסקליימר «אינו ייעוץ השקעות» — בכל מסך עם תיק, עסקה או פוזיציה, בהרשמה ובהגדרות. */
export default function InvestmentDisclaimer({ style, compact = false }: { style?: StyleProp<ViewStyle>; compact?: boolean }) {
  const tokens = useDesignTokens();
  return (
    <View style={[styles.wrap, style]} accessibilityRole="text">
      <Text style={[styles.text, { color: tokens.colors.text.tertiary }]} numberOfLines={compact ? 3 : undefined}>
        {INVESTMENT_DISCLAIMER_HE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  text: { fontSize: 11, lineHeight: 16, textAlign: 'center', writingDirection: TEXT_DIR },
});
