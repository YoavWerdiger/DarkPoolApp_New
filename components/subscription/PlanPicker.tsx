import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import UIButton from '../ui/UIButton';
import { SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import {
  APP_TYPE,
  appCaptionStyle,
  appCardSubtitleStyle,
  appCardTitleStyle,
  appPhysicalRightText,
} from '../ui/appType';

export type PlanPickerMode = 'registration' | 'upgrade';

type PlanConfig = (typeof SUBSCRIPTION_PLANS)[keyof typeof SUBSCRIPTION_PLANS];

export type DisplayPlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  period: string;
  popular: boolean;
  highlights: string[];
};

/** נקודות קצרות לתצוגה — עד 3 לכל מסלול */
const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  free: ['חדשות כלכליות', 'לייב מסחר יומי', 'קבוצת השקעות ישראל'],
  monthly: ['גישה מלאה לקהילה', 'חדשות מתפרצות', 'מענה על שאלות וליווי'],
  quarterly: ['כל מה שבחודשי', 'חיסכון של 47%', 'גישה להלווייתנים'],
  yearly: ['כל מה שבחודשי', 'חיסכון של 53%', '₪117 / חודש בממוצע'],
};

export function getSelectablePlans(mode: PlanPickerMode): DisplayPlan[] {
  const plans = (Object.values(SUBSCRIPTION_PLANS) as PlanConfig[])
    .filter((plan) => !('isAddon' in plan && plan.isAddon) && !('isOneTime' in plan && plan.isOneTime))
    .filter((plan) => (mode === 'registration' ? true : plan.id !== 'free'))
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      period: plan.period,
      popular: !!plan.popular,
      highlights: (PLAN_HIGHLIGHTS[plan.id] ?? plan.features.slice(0, 3)).slice(0, 3),
    }));

  return plans.sort((a, b) => {
    if (a.id === 'free') return -1;
    if (b.id === 'free') return 1;
    return a.price - b.price;
  });
}

export function formatPlanPeriod(period: string): string {
  switch (period) {
    case 'monthly':
      return '/חודש';
    case 'quarterly':
      return '/רבעון';
    case 'yearly':
      return '/שנה';
    default:
      return '';
  }
}

export function resolveContinueLabel(
  mode: PlanPickerMode,
  selectedPlanId: string | null,
  currentPlanId?: string | null,
): string {
  if (!selectedPlanId) return mode === 'upgrade' ? 'בחר מסלול לשדרוג' : 'בחר מסלול';
  if (mode === 'registration') {
    return selectedPlanId === 'free' ? 'התחל בחינם' : 'המשך לתשלום';
  }
  if (selectedPlanId === currentPlanId) return 'מסלול נוכחי';
  return 'המשך לתשלום';
}

export type PlanPickerProps = {
  mode: PlanPickerMode;
  selectedPlanId: string | null;
  currentPlanId?: string | null;
  onSelect: (planId: string) => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  /** הודעת עזרה מעל הרשימה */
  intro?: string;
  /** באנר אזהרה עדין (למשל checkout לא מוכן) */
  banner?: string | null;
};

export default function PlanPicker({
  mode,
  selectedPlanId,
  currentPlanId,
  onSelect,
  onContinue,
  continueLabel,
  continueDisabled,
  intro,
  banner,
}: PlanPickerProps) {
  const tokens = useDesignTokens();
  const plans = useMemo(() => getSelectablePlans(mode), [mode]);

  const ctaText =
    continueLabel ?? resolveContinueLabel(mode, selectedPlanId, currentPlanId);

  const isDisabled =
    continueDisabled ??
    (!selectedPlanId ||
      (mode === 'upgrade' &&
        (!!selectedPlanId &&
          (selectedPlanId === currentPlanId || selectedPlanId === 'free'))));

  return (
    <View style={styles.root}>
      {intro ? (
        <Text style={[styles.intro, { color: tokens.colors.text.secondary }]}>{intro}</Text>
      ) : null}

      {banner ? (
        <View style={[styles.banner, { backgroundColor: tokens.colors.background.tertiary }]}>
          <Text style={[styles.bannerText, { color: tokens.colors.warning.main }]}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {plans.map((item) => {
          const isSelected = selectedPlanId === item.id;
          const isCurrent = mode === 'upgrade' && currentPlanId === item.id;
          const isTestPrice = item.id === 'monthly' && item.price === 1;

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                if (selectedPlanId !== item.id) void HapticFeedback.selection();
                onSelect(item.id);
              }}
              activeOpacity={0.85}
              style={styles.cardTouch}
            >
              <UICard
                variant="soft"
                padding="none"
                style={{
                  borderRadius: UI_CARD_RADIUS,
                  overflow: 'hidden',
                  backgroundColor: isSelected
                    ? tokens.colors.background.tertiary
                    : tokens.colors.background.cardSolid,
                }}
              >
                <View style={styles.cardInner}>
                  <View style={styles.badgesRow}>
                    {item.popular ? (
                      <View style={[styles.popularBadge, { backgroundColor: tokens.colors.primary.main }]}>
                        <Text style={[styles.popularText, { color: tokens.colors.text.inverse }]}>פופולרי</Text>
                      </View>
                    ) : null}
                    {isCurrent ? (
                      <View style={[styles.currentBadge, { backgroundColor: tokens.colors.background.navChrome }]}>
                        <Text style={[styles.currentText, { color: tokens.colors.text.primary }]}>המסלול שלך</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.headerRow}>
                    <View
                      style={[
                        styles.check,
                        {
                          backgroundColor: isSelected
                            ? tokens.colors.primary.main
                            : tokens.colors.background.navChrome,
                        },
                      ]}
                    >
                      {isSelected ? (
                        <Ionicons name="checkmark" size={15} color={tokens.colors.text.inverse} />
                      ) : null}
                    </View>

                    <View style={styles.titleBlock}>
                      <Text style={[styles.planName, { color: tokens.colors.text.primary }]}>{item.name}</Text>
                      <View style={styles.priceRow}>
                        <Text style={[styles.price, { color: tokens.colors.text.primary }]}>
                          {item.price === 0 ? 'חינם' : `₪${item.price}`}
                        </Text>
                        {item.price > 0 ? (
                          <Text style={[styles.period, { color: tokens.colors.text.secondary }]}>
                            {formatPlanPeriod(item.period)}
                          </Text>
                        ) : null}
                      </View>
                      {isTestPrice ? (
                        <Text style={[styles.testHint, { color: tokens.colors.warning.main }]}>מחיר בדיקה</Text>
                      ) : item.description ? (
                        <Text style={[styles.desc, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={[styles.highlights, { borderTopColor: tokens.colors.border.divider }]}>
                    {item.highlights.map((feature) => (
                      <View key={feature} style={styles.highlightRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color={tokens.colors.text.secondary}
                        />
                        <Text style={[styles.highlightText, { color: tokens.colors.text.secondary }]}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </UICard>
            </TouchableOpacity>
          );
        })}
      </View>

      <UIButton
        title={ctaText}
        variant="primary"
        fullWidth
        disabled={isDisabled}
        onPress={onContinue}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1 },
  intro: {
    ...appPhysicalRightText,
    ...APP_TYPE.sectionSubtitle,
    marginBottom: 14,
  },
  banner: {
    borderRadius: UI_CARD_RADIUS,
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: 10,
    marginBottom: 14,
  },
  bannerText: {
    ...appCaptionStyle,
    fontWeight: '700',
  },
  list: { gap: APP_LAYOUT.cardStackGap, marginBottom: 18 },
  cardTouch: {},
  cardInner: { padding: APP_LAYOUT.cardPadding },
  badgesRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    minHeight: 22,
  },
  popularBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  popularText: {
    ...APP_TYPE.caption2,
    fontWeight: '700',
  },
  currentBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  currentText: {
    ...APP_TYPE.caption2,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 10,
  },
  planName: {
    ...appCardTitleStyle,
    width: undefined,
    marginBottom: APP_LAYOUT.titleSubtitleGap,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    ...APP_TYPE.cardMetricValueSecondary,
  },
  period: {
    ...appCardSubtitleStyle,
    width: undefined,
    marginTop: 0,
  },
  desc: {
    ...appCaptionStyle,
    marginTop: APP_LAYOUT.titleSubtitleGap,
  },
  testHint: {
    ...APP_TYPE.caption2,
    fontWeight: '600',
    marginTop: APP_LAYOUT.titleSubtitleGap,
    textAlign: 'right',
  },
  highlights: {
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    gap: 6,
    borderTopWidth: 1,
    paddingTop: APP_LAYOUT.cardTitleToBodyGap,
  },
  highlightRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
  },
  highlightText: {
    ...appCardSubtitleStyle,
    width: undefined,
    marginTop: 0,
    flex: 1,
  },
  cta: {
    marginTop: 4,
  },
});
