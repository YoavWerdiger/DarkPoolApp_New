/**
 * פיתוח בלבד — השוואת סגנונות תוויות (כותרת סקשן · תווית קבוצה מעל כרטיס · תווית מעל שדה)
 * עם הפונט, הצבעים והמרווחים האמיתיים. לא נרשם בבילד פרודקשן (App.tsx: רק ב-__DEV__).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { appPhysicalRightText } from '../../components/ui/appType';

type Variant = {
  key: string;
  name: string;
  section: TextStyle;
  group: TextStyle & { gapBelow: number };
  field: TextStyle & { gapBelow: number };
  /** הזחת התווית מהקצה — מיושרת לטקסט שבתוך הכרטיס / השדה */
  inset?: boolean;
};

export default function LabelLabScreen() {
  const t = useDesignTokens();
  const c = t.colors;
  const variants: Variant[] = [
    {
      key: 'A',
      name: 'A · היום',
      section: { fontSize: 22, fontWeight: '700', lineHeight: 28, letterSpacing: -0.42, color: c.text.primary },
      group: { fontSize: 15, fontWeight: '500', lineHeight: 20, color: c.text.secondary, gapBelow: 12 },
      field: { fontSize: 15, fontWeight: '500', lineHeight: 20, color: c.text.secondary, gapBelow: 8 },
    },
    {
      key: 'B',
      name: 'B · שקט (iOS) + מיושר',
      inset: true,
      section: { fontSize: 20, fontWeight: '600', lineHeight: 26, letterSpacing: 0, color: c.text.primary },
      group: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: c.text.secondary, gapBelow: 8 },
      field: { fontSize: 13, fontWeight: '500', lineHeight: 18, color: c.text.secondary, gapBelow: 6 },
    },
    {
      key: 'C',
      name: 'C · ברור + מיושר',
      inset: true,
      section: { fontSize: 20, fontWeight: '600', lineHeight: 26, letterSpacing: 0, color: c.text.primary },
      group: { fontSize: 14, fontWeight: '600', lineHeight: 18, color: c.text.primary, gapBelow: 8 },
      field: { fontSize: 14, fontWeight: '500', lineHeight: 18, color: c.text.primary, gapBelow: 6 },
    },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background.primary }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 28 }}>
        {variants.map((v) => (
          <View key={v.key} style={{ gap: 0 }}>
            <Text style={[styles.tag, { color: c.text.tertiary }]}>{v.name}</Text>
            <Text style={[appPhysicalRightText, v.section, { marginBottom: 12 }]}>חלוקת נכסים</Text>
            <Text style={[appPhysicalRightText, v.group, { marginBottom: v.group.gapBelow, paddingHorizontal: v.inset ? 16 : 0 }]}>מראה</Text>
            <View style={[styles.card, { backgroundColor: c.background.cardSolid }]}>
              <Text style={[appPhysicalRightText, styles.rowText, { color: c.text.primary }]}>מצב כהה</Text>
            </View>
            <Text style={[appPhysicalRightText, v.field, { marginTop: 16, marginBottom: v.field.gapBelow, paddingHorizontal: v.inset ? 18 : 0 }]}>שם תצוגה</Text>
            <View style={[styles.input, { backgroundColor: c.background.cardSolid }]}>
              <Text style={[appPhysicalRightText, styles.rowText, { color: c.text.primary }]}>יואב ורדיגר</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tag: { fontSize: 11, fontWeight: '600', marginBottom: 8, textAlign: 'left' },
  card: { borderRadius: 26, paddingHorizontal: 16, height: 56, justifyContent: 'center' },
  input: { borderRadius: 999, paddingHorizontal: 18, height: 52, justifyContent: 'center' },
  rowText: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
});
