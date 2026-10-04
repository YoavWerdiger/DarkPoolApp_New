import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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

/** מה כלול בכל מסלול — מוצג כשהכרטיס נפתח */
const FREE_FEATURES = [
  'יומן מסחר (לתקופה מוגבלת)',
  'חדשות',
  'ציוצים',
  'דיווחי רווח',
  'יומן כלכלי',
  'רשימת מעקב',
  'מפת חום',
];
const PREMIUM_FEATURES = [
  'כל מה שיש במנוי החינמי',
  'גישה לחדרי הקהילה',
  'לייב מסחר',
  'יומן מסחר',
  'אינסיידרים',
  'תג חבר פרימיום',
];
const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  free: FREE_FEATURES,
  monthly: PREMIUM_FEATURES,
  quarterly: PREMIUM_FEATURES,
  yearly: PREMIUM_FEATURES,
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
      highlights: PLAN_HIGHLIGHTS[plan.id] ?? plan.features,
    }));

  return plans.sort((a, b) => {
    if (a.id === 'free') return -1;
    if (b.id === 'free') return 1;
    return a.price - b.price;
  });
}

const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

const EXPAND_MS = 300;
const EXPAND_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * פתיחה/סגירה חלקה של היתרונות: גובה מונפש מ-0 לגובה הנמדד + דהייה.
 * התוכן תמיד מרונדר (למדידה) — בלי layout animations שקופצות.
 */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const measured = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);
  React.useEffect(() => {
    // פתיחה בקפיץ (קצת «מושן»), סגירה מהירה וחלקה
    progress.value = open
      ? withSpring(1, { damping: 15, stiffness: 150, mass: 0.8 })
      : withTiming(0, { duration: EXPAND_MS - 80, easing: EXPAND_EASE });
  }, [open, progress]);
  const style = useAnimatedStyle(() => ({
    height: measured.value * Math.max(0, progress.value),
    opacity: Math.min(1, Math.max(0, progress.value)),
  }));
  return (
    <Animated.View style={[{ overflow: 'hidden' }, style]}>
      <View
        style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
        onLayout={(e) => {
          measured.value = e.nativeEvent.layout.height;
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/** מחיר חודשי שווה-ערך (לרבעוני/שנתי) — המחיר הבולט בכרטיס */
export function monthlyEquivalent(price: number, period: string): number {
  const months = PERIOD_MONTHS[period] ?? 1;
  return Math.round(price / months);
}

/** «חסוך 47% ברבעון» → «חיסכון 47%» */
function savingsLabel(description: string): string | null {
  const m = description.match(/(\d+)%/);
  return m ? `חיסכון ${m[1]}%` : null;
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

          const perMonth = monthlyEquivalent(item.price, item.period);
          const multiMonth = item.price > 0 && item.period !== 'monthly';
          const savings = multiMonth ? savingsLabel(item.description) : null;

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                if (selectedPlanId !== item.id) void HapticFeedback.selection();
                onSelect(item.id);
              }}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              style={[
                styles.card,
                {
                  backgroundColor: tokens.colors.background.cardSolid,
                  borderColor: isSelected ? tokens.colors.text.primary : 'transparent',
                },
              ]}
            >
              {item.popular ? (
                <View style={[styles.ribbon, { backgroundColor: tokens.colors.primary.main }]}>
                  <Text style={[styles.ribbonText, { color: tokens.colors.text.inverse }]}>הכי פופולרי</Text>
                </View>
              ) : null}

              <View style={styles.headerRow}>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: isSelected ? tokens.colors.text.primary : tokens.colors.text.tertiary,
                      backgroundColor: isSelected ? tokens.colors.text.primary : 'transparent',
                    },
                  ]}
                >
                  {isSelected ? (
                    <Ionicons name="checkmark" size={14} color={tokens.colors.text.inverse} />
                  ) : null}
                </View>

                <View style={styles.titleBlock}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.planName, { color: tokens.colors.text.primary }]}>{item.name}</Text>
                    {savings ? (
                      <View style={[styles.savePill, { backgroundColor: tokens.colors.background.tertiary }]}>
                        <Text style={[styles.saveText, { color: tokens.colors.primary.main }]}>{savings}</Text>
                      </View>
                    ) : null}
                    {isCurrent ? (
                      <View style={[styles.savePill, { backgroundColor: tokens.colors.background.navChrome }]}>
                        <Text style={[styles.saveText, { color: tokens.colors.text.primary }]}>המסלול שלך</Text>
                      </View>
                    ) : null}
                  </View>
                  {isTestPrice ? (
                    <Text style={[styles.testHint, { color: tokens.colors.warning.main }]}>מחיר בדיקה</Text>
                  ) : multiMonth ? (
                    <Text style={[styles.desc, { color: tokens.colors.text.secondary }]}>
                      ₪{item.price.toLocaleString('he-IL')} {formatPlanPeriod(item.period).replace('/', 'ל')}
                    </Text>
                  ) : item.description ? (
                    <Text style={[styles.desc, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.priceCol}>
                  <Text style={[styles.price, { color: tokens.colors.text.primary }]}>
                    {item.price === 0 ? 'חינם' : `₪${perMonth}`}
                  </Text>
                  {item.price > 0 ? (
                    <Text style={[styles.period, { color: tokens.colors.text.secondary }]}>לחודש</Text>
                  ) : null}
                </View>
              </View>

              <Collapse open={isSelected}>
                {/* key מתחלף בפתיחה — השורות נכנסות מחדש אחת-אחת */}
                <View
                  key={isSelected ? 'open' : 'closed'}
                  style={[styles.highlights, { borderTopColor: tokens.colors.border.divider }]}
                >
                  {item.highlights.map((feature, fi) => (
                    <Animated.View
                      key={feature}
                      entering={isSelected ? FadeInDown.delay(90 + fi * 70).duration(320) : undefined}
                      style={styles.highlightRow}
                    >
                      <Ionicons name="checkmark" size={16} color={tokens.colors.primary.main} />
                      <Text style={[styles.highlightText, { color: tokens.colors.text.primary }]}>{feature}</Text>
                    </Animated.View>
                  ))}
                </View>
              </Collapse>
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
      {selectedPlanId && selectedPlanId !== 'free' ? (
        <View style={styles.trustRow}>
          <Ionicons name="lock-closed" size={13} color={tokens.colors.text.tertiary} />
          <Text style={[styles.trustText, { color: tokens.colors.text.tertiary }]}>
            תשלום מאובטח · ביטול בכל עת
          </Text>
        </View>
      ) : null}
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
  list: { gap: APP_LAYOUT.cardStackGap, marginBottom: APP_LAYOUT.componentGap + 4 },
  card: {
    borderRadius: UI_CARD_RADIUS,
    borderWidth: 2,
    padding: APP_LAYOUT.cardPadding,
    overflow: 'hidden',
  },
  ribbon: {
    alignSelf: 'flex-end',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: APP_LAYOUT.stackGapSmall,
  },
  ribbonText: {
    ...appCaptionStyle,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  headerRow: {
    // row-reverse: רדיו בקצה הימני, שם המסלול, מחיר בקצה השמאלי
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: APP_LAYOUT.stackGapTight,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'flex-end',
  },
  nameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  planName: {
    ...appCardTitleStyle,
    width: undefined,
  },
  savePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  saveText: {
    ...appCaptionStyle,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  priceCol: {
    alignItems: 'flex-start',
    minWidth: 72,
  },
  price: {
    ...APP_TYPE.cardMetricValueSecondary,
    writingDirection: 'ltr',
  },
  period: {
    ...appCaptionStyle,
  },
  desc: {
    ...appCardSubtitleStyle,
    width: undefined,
    marginTop: APP_LAYOUT.titleSubtitleGap,
  },
  testHint: {
    ...appCaptionStyle,
    marginTop: APP_LAYOUT.titleSubtitleGap,
    textAlign: 'right',
  },
  highlights: {
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: APP_LAYOUT.cardTitleToBodyGap,
  },
  highlightRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  highlightText: {
    ...appCardSubtitleStyle,
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    width: undefined,
    marginTop: 0,
    flex: 1,
  },
  trustRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: APP_LAYOUT.stackGapTight,
  },
  trustText: {
    ...appCaptionStyle,
    writingDirection: 'rtl',
  },
  cta: {
    marginTop: 4,
  },
});
