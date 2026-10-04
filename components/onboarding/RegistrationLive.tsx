/**
 * רכיבים «חיים» למסכי ההקלדה ברישום — שלא יהיו רק תיבות טקסט:
 * ברכה עם אווטאר לשם, השלמת דומיין לאימייל, מד חוזק + צ׳קליסט לסיסמה.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

/* ─────────────── שם: ברכה חיה ─────────────── */

const AVATAR = 72;

export function NameGreeting({ name }: { name: string }) {
  const tokens = useDesignTokens();
  const first = name.trim().split(/\s+/)[0] ?? '';
  const ready = first.length >= 2;
  const initial = first.charAt(0).toUpperCase();

  return (
    <View style={styles.greetWrap}>
      <View
        style={[
          styles.greetAvatar,
          {
            backgroundColor: ready ? tokens.colors.text.primary : tokens.colors.background.cardSolid,
          },
        ]}
      >
        {initial ? (
          <Reanimated.Text
            key={initial}
            entering={ZoomIn.duration(220)}
            style={[styles.greetInitial, { color: ready ? tokens.colors.text.inverse : tokens.colors.text.tertiary }]}
          >
            {initial}
          </Reanimated.Text>
        ) : (
          <Ionicons name="person" size={32} color={tokens.colors.text.tertiary} />
        )}
      </View>
      {ready ? (
        <Reanimated.Text
          entering={FadeInDown.duration(260)}
          exiting={FadeOut.duration(150)}
          style={[styles.greetText, { color: tokens.colors.text.primary }]}
          numberOfLines={1}
        >
          נעים להכיר, {first}
        </Reanimated.Text>
      ) : (
        <Text style={[styles.greetHint, { color: tokens.colors.text.tertiary }]}>
          ככה יכירו אותך בקהילה
        </Text>
      )}
    </View>
  );
}

/* ─────────────── אימייל: השלמת דומיין ─────────────── */

const DOMAINS = ['gmail.com', 'icloud.com', 'outlook.com', 'hotmail.com', 'yahoo.com'];

export function EmailDomainChips({
  email,
  onPick,
}: {
  email: string;
  onPick: (full: string) => void;
}) {
  const tokens = useDesignTokens();
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  const local = at >= 0 ? trimmed.slice(0, at) : trimmed;
  const typedDomain = at >= 0 ? trimmed.slice(at + 1).toLowerCase() : '';
  if (!local || /\s/.test(local)) return null;
  const options = DOMAINS.filter((d) => d.startsWith(typedDomain) && d !== typedDomain);
  if (options.length === 0) return null;

  return (
    <Reanimated.View entering={FadeIn.duration(180)} style={styles.chipsRow}>
      {options.slice(0, 4).map((d) => (
        <Pressable
          key={d}
          onPress={() => {
            void HapticFeedback.selection();
            onPick(`${local}@${d}`);
          }}
          style={[styles.chip, { backgroundColor: tokens.colors.background.cardSolid }]}
          accessibilityRole="button"
          accessibilityLabel={`השלם ל-${local}@${d}`}
        >
          <Text style={[styles.chipText, { color: tokens.colors.text.primary }]}>@{d}</Text>
        </Pressable>
      ))}
    </Reanimated.View>
  );
}

/* ─────────────── סיסמה: מד חוזק + צ׳קליסט ─────────────── */

type Rule = { key: string; label: string; test: (p: string) => boolean };

const RULES: Rule[] = [
  { key: 'len6', label: 'לפחות 6 תווים', test: (p) => p.length >= 6 },
  { key: 'len8', label: '8 תווים ומעלה', test: (p) => p.length >= 8 },
  { key: 'mix', label: 'אותיות ומספרים', test: (p) => /[A-Za-z֐-׿]/.test(p) && /\d/.test(p) },
  { key: 'sym', label: 'סימן מיוחד (!@#…)', test: (p) => /[^A-Za-z0-9֐-׿\s]/.test(p) },
];

const STRENGTH_LABELS = ['', 'חלשה', 'סבירה', 'טובה', 'חזקה'];

export function PasswordStrength({ password }: { password: string }) {
  const tokens = useDesignTokens();
  const passed = RULES.map((r) => r.test(password));
  const score = password ? passed.filter(Boolean).length : 0;
  const fill = useRef(new Animated.Value(0)).current;
  const prevScore = useRef(score);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: score / RULES.length,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    if (score > prevScore.current) void HapticFeedback.selection();
    prevScore.current = score;
  }, [score, fill]);

  const color =
    score <= 1
      ? tokens.colors.danger.main
      : score === 2
        ? tokens.colors.text.warning
        : tokens.colors.primary.main;

  return (
    <View style={styles.pwWrap}>
      <View style={styles.pwHeader}>
        <Text style={[styles.pwTitle, { color: tokens.colors.text.secondary }]}>חוזק הסיסמה</Text>
        {score > 0 ? (
          <Reanimated.Text key={score} entering={FadeIn.duration(160)} style={[styles.pwLevel, { color }]}>
            {STRENGTH_LABELS[score]}
          </Reanimated.Text>
        ) : null}
      </View>
      <View style={[styles.pwTrack, { backgroundColor: tokens.colors.border.divider }]}>
        <Animated.View
          style={[
            styles.pwFill,
            {
              backgroundColor: color,
              width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <View style={styles.rules}>
        {RULES.map((r, i) => (
          <View key={r.key} style={styles.ruleRow}>
            {passed[i] ? (
              <Reanimated.View key="on" entering={ZoomIn.duration(200)}>
                <Ionicons name="checkmark-circle" size={18} color={tokens.colors.primary.main} />
              </Reanimated.View>
            ) : (
              <Ionicons name="ellipse-outline" size={18} color={tokens.colors.text.tertiary} />
            )}
            <Text
              style={[
                styles.ruleText,
                { color: passed[i] ? tokens.colors.text.primary : tokens.colors.text.tertiary },
              ]}
            >
              {r.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  greetWrap: {
    alignItems: 'center',
    marginTop: APP_LAYOUT.sectionGap / 2 + 4,
    gap: APP_LAYOUT.stackGapTight,
  },
  greetAvatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetInitial: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  greetText: {
    fontSize: APP_TYPE.sectionTitle.fontSize,
    lineHeight: APP_TYPE.sectionTitle.lineHeight,
    fontWeight: APP_TYPE.sectionTitle.fontWeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  greetHint: {
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  chipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: APP_LAYOUT.stackGapSmall,
    marginTop: -APP_LAYOUT.stackGapSmall,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: {
    fontSize: APP_TYPE.cardSubtitle.fontSize + 1,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: 'ltr',
  },
  pwWrap: {
    marginTop: APP_LAYOUT.componentGap,
    padding: APP_LAYOUT.cardPadding,
    borderRadius: UI_CARD_RADIUS,
    gap: APP_LAYOUT.stackGapTight,
  },
  pwHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pwTitle: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  pwLevel: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: 'rtl',
  },
  pwTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row-reverse',
  },
  pwFill: {
    height: '100%',
    borderRadius: 3,
  },
  rules: {
    gap: 8,
  },
  ruleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  ruleText: {
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    writingDirection: 'rtl',
  },
});
