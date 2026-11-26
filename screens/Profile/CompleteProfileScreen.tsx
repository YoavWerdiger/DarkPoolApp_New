import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import UIButton from '../../components/ui/UIButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { useAuth } from '../../context/AuthContext';
import {
  AGE_RANGE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  PORTFOLIO_SIZE_OPTIONS,
  TRADING_FOCUS_OPTIONS,
  TRADING_PLATFORM_OPTIONS,
  buildOnboardingIntroData,
  toTradingPlatformArray,
} from '../../constants/onboardingQuestionnaire';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { showAppAlert } from '../../utils/appDialog';
import { TEXT_DIR } from '../../lib/i18n/language';

type Opt = { label: string; value: string };

/**
 * «השלם פרופיל» — שאלות ההרשמה שיצאו מהזרימה הקצרה (פריט 25), בעמוד אחד ולא חובה.
 * נשמר ב-users.intro_data (כמו בהרשמה הישנה).
 */
export default function CompleteProfileScreen({ navigation }: { navigation: any }) {
  const tokens = useDesignTokens();
  const c = tokens.colors;
  const { user, updateProfile } = useAuth();
  const prev = (user?.intro_data ?? {}) as Record<string, unknown>;
  const [ageRange, setAgeRange] = useState<string | null>((prev.age_range as string) || null);
  const [experience, setExperience] = useState<string | null>((prev.experience_level as string) || null);
  const [focus, setFocus] = useState<string | null>((prev.trading_focus as string) || null);
  const [platforms, setPlatforms] = useState<string[]>(toTradingPlatformArray(prev.trading_platform));
  const [portfolio, setPortfolio] = useState<string | null>((prev.portfolio_size as string) || null);
  const [saving, setSaving] = useState(false);

  const Section = ({
    title,
    options,
    selected,
    onToggle,
  }: {
    title: string;
    options: Opt[];
    selected: (v: string) => boolean;
    onToggle: (v: string) => void;
  }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.text.primary }]}>{title}</Text>
      <View style={styles.chips}>
        {options.map((o) => {
          const on = selected(o.value);
          return (
            <Pressable
              key={o.value}
              onPress={() => {
                void HapticFeedback.selection();
                onToggle(o.value);
              }}
              style={[
                styles.chip,
                { backgroundColor: on ? c.text.primary : c.background.cardSolid, borderColor: on ? c.text.primary : c.border.divider },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, { color: on ? c.background.primary : c.text.primary }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    const intro = buildOnboardingIntroData({
      age: typeof prev.age === 'number' ? (prev.age as number) : null,
      ageRange,
      experienceLevel: experience,
      tradingFocus: focus,
      tradingPlatform: platforms,
      portfolioSize: portfolio,
    });
    const { error } = await updateProfile({ id: user.id, intro_data: intro });
    setSaving(false);
    if (error) {
      void HapticFeedback.error();
      showAppAlert('השמירה נכשלה', 'נסו שוב בעוד רגע.', 'error');
      return;
    }
    void HapticFeedback.success();
    navigation.goBack();
  };

  const single = (val: string | null, set: (v: string | null) => void) => ({
    selected: (v: string) => v === val,
    onToggle: (v: string) => set(v === val ? null : v),
  });

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title="השלמת פרופיל" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.intro, { color: c.text.secondary }]}>
          עוזר לנו להתאים לך תוכן, קורסים והתראות. כל השאלות לא חובה.
        </Text>
        <Section title="גיל" options={AGE_RANGE_OPTIONS} {...single(ageRange, setAgeRange)} />
        <Section title="ניסיון במסחר" options={EXPERIENCE_LEVEL_OPTIONS} {...single(experience, setExperience)} />
        <Section title="סגנון מסחר" options={TRADING_FOCUS_OPTIONS} {...single(focus, setFocus)} />
        <Section
          title="איפה אתה סוחר (אפשר כמה)"
          options={TRADING_PLATFORM_OPTIONS}
          selected={(v) => platforms.includes(v)}
          onToggle={(v) => setPlatforms((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
        />
        <Section title="גודל תיק" options={PORTFOLIO_SIZE_OPTIONS} {...single(portfolio, setPortfolio)} />
        <UIButton title="שמירה" variant="primary" size="lg" fullWidth loading={saving} onPress={() => void save()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, paddingBottom: 32, gap: 8 },
  intro: { ...APP_TYPE.body, textAlign: 'right', writingDirection: TEXT_DIR, marginBottom: 8 },
  section: { marginBottom: 16 },
  sectionTitle: { ...APP_TYPE.cardTitle, textAlign: 'right', writingDirection: TEXT_DIR, marginBottom: 10 },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 14, fontWeight: '500' },
});
