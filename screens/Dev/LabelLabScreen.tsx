/**
 * פיתוח בלבד — סבב 3: תוויות מעל כרטיסים / כפתורים, באותו עיקרון כמו התווית הצפה (התווית חלק מהמיכל).
 * G: התווית בתוך הכרטיס · H: בלי תווית · I: קבוצת כפתורים בתוך מיכל עם תווית — מול המצב הנוכחי.
 * לא נרשם בבילד פרודקשן (App.tsx: רק ב-__DEV__).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { appPhysicalRightText } from '../../components/ui/appType';
import { FieldGroupLabel } from '../../components/ui/FloatingLabelField';

export default function LabelLabScreen() {
  const t = useDesignTokens();
  const c = t.colors;
  const [gender, setGender] = useState<'m' | 'f'>('m');
  const card = [styles.card, { backgroundColor: c.background.cardSolid }];
  const row = (icon: keyof typeof Ionicons.glyphMap, label: string) => (
    <View style={styles.row}>
      <Text style={[appPhysicalRightText, styles.rowText, { color: c.text.primary, flex: 1 }]}>{label}</Text>
      <Ionicons name={icon} size={20} color={c.text.primary} />
    </View>
  );
  const inLabel = (label: string) => (
    <Text style={[appPhysicalRightText, styles.inLabel, { color: c.text.secondary }]}>{label}</Text>
  );
  const tag = (s: string) => <Text style={[styles.tag, { color: c.text.tertiary }]}>{s}</Text>;
  const genderPills = (inside: boolean) => (
    <View style={[styles.pills, inside && { gap: 6 }]}>
      {(['f', 'm'] as const).map((g) => {
        const on = gender === g;
        return (
          <Pressable
            key={g}
            onPress={() => setGender(g)}
            style={[
              styles.pill,
              inside && styles.pillInside,
              { backgroundColor: on ? c.text.primary : inside ? c.background.primary : c.background.cardSolid },
            ]}
          >
            <Text style={[styles.rowText, { color: on ? c.text.inverse : c.text.primary }]}>{g === 'f' ? 'נקבה' : 'זכר'}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background.primary }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {tag('היום (F) · תווית מעל הכרטיס')}
        <FieldGroupLabel>מראה</FieldGroupLabel>
        <View style={card}>{row('moon-outline', 'מצב כהה')}</View>

        <View style={{ height: 22 }} />
        {tag('G · התווית בתוך הכרטיס')}
        <View style={[card, { paddingTop: 12 }]}>
          {inLabel('מראה')}
          {row('moon-outline', 'מצב כהה')}
        </View>

        <View style={{ height: 22 }} />
        {tag('H · בלי תווית — רווח מפריד בין קבוצות')}
        <View style={card}>{row('moon-outline', 'מצב כהה')}</View>
        <View style={{ height: 12 }} />
        <View style={card}>{row('language-outline', 'שפת ממשק · עברית')}</View>

        <View style={{ height: 30 }} />
        {tag('היום · תווית מעל כפתורים')}
        <FieldGroupLabel>מגדר</FieldGroupLabel>
        {genderPills(false)}

        <View style={{ height: 22 }} />
        {tag('I · הכפתורים בתוך מיכל עם תווית (כמו שדה)')}
        <View style={[styles.shell, { backgroundColor: c.background.cardSolid }]}>
          {inLabel('מגדר')}
          {genderPills(true)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tag: { fontSize: 11, fontWeight: '600', marginBottom: 8, textAlign: 'left' },
  card: { borderRadius: 26, overflow: 'hidden' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 56 },
  rowText: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  // כמו התווית הצפה במצב «למעלה» — 12 · אפור
  inLabel: { fontSize: 12, lineHeight: 16, fontWeight: '500', paddingHorizontal: 16, marginBottom: -6 },
  pills: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  pillInside: { height: 44 },
  shell: { borderRadius: 26, paddingTop: 12, paddingBottom: 8, paddingHorizontal: 8, gap: 14 },
});
