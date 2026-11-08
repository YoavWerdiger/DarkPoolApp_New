/**
 * פיתוח בלבד — השוואת סגנונות תוויות (סבב 2, על בסיס C): פונט, תווית בתוך השדה, תווית קטנה.
 * לא נרשם בבילד פרודקשן (App.tsx: רק ב-__DEV__).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Assistant_500Medium, Assistant_600SemiBold, Assistant_700Bold } from '@expo-google-fonts/assistant';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { appPhysicalRightText } from '../../components/ui/appType';

type Variant = {
  key: string;
  name: string;
  section: TextStyle;
  group: TextStyle;
  field: TextStyle;
  /** תווית בתוך השדה (מעל הערך) במקום מעליו */
  inside?: boolean;
};

export default function LabelLabScreen() {
  const t = useDesignTokens();
  const c = t.colors;
  useFonts({ Assistant_500Medium, Assistant_600SemiBold, Assistant_700Bold });
  const sec: TextStyle = { fontSize: 20, fontWeight: '600', lineHeight: 26, color: c.text.primary };
  const variants: Variant[] = [
    {
      key: 'C',
      name: 'C · בסיס',
      section: sec,
      group: { fontSize: 14, fontWeight: '600', lineHeight: 18, color: c.text.primary },
      field: { fontSize: 14, fontWeight: '500', lineHeight: 18, color: c.text.primary },
    },
    {
      key: 'D',
      name: 'D · C בפונט Assistant',
      section: { fontFamily: 'Assistant_700Bold', fontSize: 22, lineHeight: 28, color: c.text.primary },
      group: { fontFamily: 'Assistant_600SemiBold', fontSize: 15, lineHeight: 20, color: c.text.primary },
      field: { fontFamily: 'Assistant_600SemiBold', fontSize: 15, lineHeight: 20, color: c.text.primary },
    },
    {
      key: 'E',
      name: 'E · תווית בתוך השדה',
      section: sec,
      group: { fontSize: 14, fontWeight: '600', lineHeight: 18, color: c.text.primary },
      field: { fontSize: 12, fontWeight: '500', lineHeight: 16, color: c.text.secondary },
      inside: true,
    },
    {
      key: 'F',
      name: 'F · קטנה ומהודקת',
      section: sec,
      group: { fontSize: 13, fontWeight: '600', lineHeight: 18, letterSpacing: 0.2, color: c.text.secondary },
      field: { fontSize: 13, fontWeight: '600', lineHeight: 18, letterSpacing: 0.2, color: c.text.secondary },
    },
  ];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background.primary }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 26 }}>
        {[variants[0], variants[3], variants[2], variants[1]].map((v) => (
          <View key={v.key}>
            <Text style={[styles.tag, { color: c.text.tertiary }]}>{v.name}</Text>
            <Text style={[appPhysicalRightText, v.section, { marginBottom: 12 }]}>חלוקת נכסים</Text>
            <Text style={[appPhysicalRightText, v.group, { marginBottom: 8, paddingHorizontal: 16 }]}>מראה</Text>
            <View style={[styles.card, { backgroundColor: c.background.cardSolid }]}>
              <Text style={[appPhysicalRightText, styles.rowText, { color: c.text.primary }]}>מצב כהה</Text>
            </View>
            {v.inside ? (
              <View style={[styles.inputInside, { backgroundColor: c.background.cardSolid, marginTop: 16 }]}>
                <Text style={[appPhysicalRightText, v.field]}>שם תצוגה</Text>
                <Text style={[appPhysicalRightText, styles.rowText, { color: c.text.primary, marginTop: 2 }]}>יואב ורדיגר</Text>
              </View>
            ) : (
              <>
                <Text style={[appPhysicalRightText, v.field, { marginTop: 16, marginBottom: 6, paddingHorizontal: 18 }]}>שם תצוגה</Text>
                <View style={[styles.input, { backgroundColor: c.background.cardSolid }]}>
                  <Text style={[appPhysicalRightText, styles.rowText, { color: c.text.primary }]}>יואב ורדיגר</Text>
                </View>
              </>
            )}
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
  inputInside: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, minHeight: 60, justifyContent: 'center' },
  rowText: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
});
