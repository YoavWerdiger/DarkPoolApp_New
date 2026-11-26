import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useDesignTokens } from '../components/ui/DesignTokens';
import { HapticFeedback } from '../utils/hapticFeedback';
import { TEXT_DIR } from '../lib/i18n/language';

const KEY = 'first_run_tips_done_v1';

/** כל טיפ מצביע על טאב (אינדקס מימין, כמו בסרגל RTL) או על התפריט */
const TIPS: { title: string; body: string; tab: number | 'menu' }[] = [
  { title: 'בית', body: 'מצב השוק, המדדים, רשימת המעקב שלך והשיעור הבא — הכל במבט אחד.', tab: 0 },
  { title: 'קהילה', body: 'הקבוצות, ההכרזות של הצוות והפוסטים של חברי הקהילה.', tab: 1 },
  { title: 'שווקים', body: 'רשימת המעקב שלך, חדשות, יומן כלכלי ודוחות.', tab: 2 },
  { title: 'דארק פול', body: 'עסקאות גדולות של מוסדות, בכירים וחברי קונגרס — מי קונה ומה.', tab: 3 },
  { title: 'עוד בתפריט ☰', body: 'קורסים, התיקים שלך ומפת החום — בכפתור התפריט בראש המסך.', tab: 'menu' },
];

/** סיור קצר בפתיחה הראשונה — מעל ה-Tab Bar. מוצג פעם אחת. */
export default function FirstRunTips({ bottomOffset }: { bottomOffset: number }) {
  const tokens = useDesignTokens();
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v !== '1') setTimeout(() => setStep(0), 1200);
      })
      .catch(() => {});
  }, []);

  if (step == null) return null;
  const tip = TIPS[step];
  const last = step === TIPS.length - 1;
  const finish = () => {
    setStep(null);
    void AsyncStorage.setItem(KEY, '1').catch(() => {});
  };
  const c = tokens.colors;
  // מיקום החץ: 5 טאבים, RTL — טאב 0 בצד ימין
  const arrowRight = typeof tip.tab === 'number' ? `${(tip.tab * 20 + 10).toFixed(0)}%` : undefined;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[styles.wrap, { bottom: bottomOffset + 10 }]}
      pointerEvents="box-none"
    >
      <View style={[styles.card, { backgroundColor: c.text.primary }]}>
        <Text style={[styles.title, { color: c.background.primary }]}>{tip.title}</Text>
        <Text style={[styles.body, { color: c.background.primary }]}>{tip.body}</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              void HapticFeedback.selection();
              if (last) finish();
              else setStep(step + 1);
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={[styles.next, { color: c.background.primary }]}>{last ? 'הבנתי' : `הבא (${step + 1}/${TIPS.length})`}</Text>
          </Pressable>
          {!last ? (
            <Pressable onPress={finish} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.skip, { color: c.background.primary }]}>דילוג</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {arrowRight ? <View style={[styles.arrow, { right: arrowRight as any, borderTopColor: c.text.primary }]} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  card: { borderRadius: 16, padding: 16, gap: 6 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'right', writingDirection: TEXT_DIR },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'right', writingDirection: TEXT_DIR, opacity: 0.9 },
  actions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 8 },
  next: { fontSize: 14, fontWeight: '700' },
  skip: { fontSize: 14, opacity: 0.7 },
  arrow: {
    position: 'absolute',
    bottom: -8,
    marginRight: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
