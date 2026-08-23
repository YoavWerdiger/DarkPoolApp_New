import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import { SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { HapticFeedback } from '../../utils/hapticFeedback';

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
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {plans.map((item) => {
          const isSelected = selectedPlanId === item.id;
          const isCurrent = mode === 'upgrade' && currentPlanId === item.id;
          const isFree = item.id === 'free';
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
                variant="glass"
                glassIntensity={isSelected || isCurrent ? 'medium' : 'light'}
                padding="none"
                style={{
                  borderRadius: 18,
                  overflow: 'hidden',
                  borderWidth: isSelected || isCurrent ? 1.5 : 1,
                  borderColor: isSelected
                    ? DesignTokens.colors.primary.main
                    : isCurrent
                      ? 'rgba(0,230,84,0.45)'
                      : 'rgba(255,255,255,0.08)',
                }}
              >
                <LinearGradient
                  colors={
                    isSelected
                      ? ['rgba(0,230,84,0.14)', 'rgba(0,230,84,0.03)']
                      : ['rgba(255,255,255,0.04)', 'transparent']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardInner}
                >
                  <View style={styles.badgesRow}>
                    {item.popular ? (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularText}>פופולרי</Text>
                      </View>
                    ) : null}
                    {isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentText}>המסלול שלך</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.headerRow}>
                    <View
                      style={[
                        styles.check,
                        isSelected && styles.checkSelected,
                      ]}
                    >
                      {isSelected ? (
                        <Ionicons name="checkmark" size={15} color="#000" />
                      ) : null}
                    </View>

                    <View style={styles.titleBlock}>
                      <Text style={styles.planName}>{item.name}</Text>
                      <View style={styles.priceRow}>
                        <Text
                          style={[
                            styles.price,
                            isFree && { color: DesignTokens.colors.primary.main },
                          ]}
                        >
                          {item.price === 0 ? 'חינם' : `₪${item.price}`}
                        </Text>
                        {item.price > 0 ? (
                          <Text style={styles.period}>{formatPlanPeriod(item.period)}</Text>
                        ) : null}
                      </View>
                      {isTestPrice ? (
                        <Text style={styles.testHint}>מחיר בדיקה</Text>
                      ) : item.description ? (
                        <Text style={styles.desc} numberOfLines={1}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.highlights}>
                    {item.highlights.map((feature) => (
                      <View key={feature} style={styles.highlightRow}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color={DesignTokens.colors.primary.main}
                        />
                        <Text style={styles.highlightText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>
              </UICard>
            </TouchableOpacity>
          );
        })}
      </View>

      <LinearGradient
        colors={
          !isDisabled
            ? ['#00C805', '#00A004', '#008F03']
            : ['#2A2A2A', '#2A2A2A']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.cta,
          !isDisabled && {
            shadowColor: DesignTokens.colors.primary.main,
            shadowOpacity: 0.35,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            void HapticFeedback.medium();
            onContinue();
          }}
          disabled={isDisabled}
          activeOpacity={0.85}
          style={styles.ctaBtn}
        >
          <Text
            style={[
              styles.ctaText,
              { color: !isDisabled ? '#000' : 'rgba(255,255,255,0.25)' },
            ]}
          >
            {ctaText}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexGrow: 1 },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'right',
    writingDirection: 'rtl',
    fontWeight: '500',
    marginBottom: 14,
  },
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,180,0,0.35)',
    backgroundColor: 'rgba(245,180,0,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  bannerText: {
    color: '#F5B400',
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  list: { gap: 12, marginBottom: 18 },
  cardTouch: {},
  cardInner: { padding: 16 },
  badgesRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    minHeight: 22,
  },
  popularBadge: {
    backgroundColor: DesignTokens.colors.primary.main,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  popularText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
  currentBadge: {
    backgroundColor: 'rgba(0,230,84,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0,230,84,0.4)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  currentText: {
    color: DesignTokens.colors.primary.main,
    fontSize: 11,
    fontWeight: '800',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkSelected: {
    backgroundColor: DesignTokens.colors.primary.main,
    borderWidth: 0,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 10,
  },
  planName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
    textAlign: 'right',
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 22,
  },
  period: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '500',
  },
  desc: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  testHint: {
    color: 'rgba(245,180,0,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'right',
  },
  highlights: {
    marginTop: 12,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
  },
  highlightRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
  },
  highlightText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
    flex: 1,
  },
  cta: {
    borderRadius: 16,
    marginTop: 4,
  },
  ctaBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
