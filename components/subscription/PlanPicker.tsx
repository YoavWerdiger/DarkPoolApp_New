import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
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

/** מחיר חודשי שווה-ערך (לרבעוני/שנתי) — המחיר הבולט בכרטיס */
export function monthlyEquivalent(price: number, period: string): number {
  const months = PERIOD_MONTHS[period] ?? 1;
  return Math.round(price / months);
}

/** «חסוך 40% · …» → «חיסכון 40%» */
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
  const freePlan = plans.find((p) => p.id === 'free') ?? null;
  // מסלולי פרימיום לפי תקופה — טאבים פנימיים בכרטיס אחד (כמו מחירון ChatGPT)
  const premiumPlans = useMemo(
    () =>
      plans
        .filter((p) => p.id !== 'free')
        .sort((a, b) => (PERIOD_MONTHS[a.period] ?? 1) - (PERIOD_MONTHS[b.period] ?? 1)),
    [plans],
  );

  const [premiumTab, setPremiumTab] = React.useState<string>(() => {
    if (selectedPlanId && selectedPlanId !== 'free') return selectedPlanId;
    return premiumPlans.find((p) => p.popular)?.id ?? premiumPlans[0]?.id ?? 'monthly';
  });
  React.useEffect(() => {
    if (selectedPlanId && selectedPlanId !== 'free') setPremiumTab(selectedPlanId);
  }, [selectedPlanId]);

  const activePremium = premiumPlans.find((p) => p.id === premiumTab) ?? premiumPlans[0];
  const premiumSelected = !!selectedPlanId && selectedPlanId !== 'free';
  const freeSelected = selectedPlanId === 'free';

  const ctaText =
    continueLabel ?? resolveContinueLabel(mode, selectedPlanId, currentPlanId);

  const isDisabled =
    continueDisabled ??
    (!selectedPlanId ||
      (mode === 'upgrade' &&
        (!!selectedPlanId &&
          (selectedPlanId === currentPlanId || selectedPlanId === 'free'))));

  const selectPlan = (id: string) => {
    if (selectedPlanId !== id) void HapticFeedback.selection();
    onSelect(id);
  };

  const cardStyle = (selected: boolean) => [
    styles.card,
    {
      backgroundColor: tokens.colors.background.cardSolid,
      borderColor: selected ? tokens.colors.text.primary : 'transparent',
    },
  ];

  const features = (items: string[]) => (
    <View style={[styles.highlights, { borderTopColor: tokens.colors.border.divider }]}>
      {items.map((feature) => (
        <View key={feature} style={styles.highlightRow}>
          <Ionicons name="checkmark" size={17} color={tokens.colors.text.secondary} />
          <Text style={[styles.highlightText, { color: tokens.colors.text.primary }]}>{feature}</Text>
        </View>
      ))}
    </View>
  );


  const perMonth = activePremium ? monthlyEquivalent(activePremium.price, activePremium.period) : 0;
  const multiMonth = !!activePremium && activePremium.period !== 'monthly';

  // ── קרוסלה ──
  const CARD_GAP = 12;
  const [carouselW, setCarouselW] = React.useState(0);
  const carouselRef = React.useRef<ScrollView>(null);
  const cardW = Math.max(0, carouselW - 36);
  const sidePad = (carouselW - cardW) / 2;
  // סדר LTR: חינמי משמאל, פרימיום מימין (הראשון בקריאה מימין לשמאל) — פותחים על פרימיום
  const pages: ('free' | 'premium')[] = [
    ...(freePlan ? (['free'] as const) : []),
    ...(activePremium ? (['premium'] as const) : []),
  ];
  const initialPage = Math.max(0, pages.indexOf(freeSelected ? 'free' : 'premium'));
  const [page, setPage] = React.useState(initialPage);

  const premiumCard = activePremium ? (
          <TouchableOpacity
            onPress={() => selectPlan(activePremium.id)}
            activeOpacity={0.92}
            accessibilityRole="radio"
            accessibilityState={{ checked: premiumSelected }}
            style={cardStyle(premiumSelected)}
          >
            <View style={[styles.tabs, { backgroundColor: tokens.colors.background.tertiary }]}>
              {premiumPlans.map((p) => {
                const active = p.id === activePremium.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      if (!active) void HapticFeedback.selection();
                      setPremiumTab(p.id);
                      onSelect(p.id);
                    }}
                    style={[styles.tab, active && { backgroundColor: tokens.colors.background.cardSolid }]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.tabText, { color: active ? tokens.colors.text.primary : tokens.colors.text.secondary }]}>
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.planHead}>
              <Text style={[styles.planName, { color: tokens.colors.text.primary }]}>פרימיום</Text>
              {savingsLabel(activePremium.description) && activePremium.period !== 'monthly' ? (
                <View style={[styles.savePill, { backgroundColor: `${tokens.colors.primary.main}22` }]}>
                  <Text style={[styles.saveText, { color: tokens.colors.primary.main }]}>
                    {savingsLabel(activePremium.description)}
                  </Text>
                </View>
              ) : null}
              {mode === 'upgrade' && currentPlanId === activePremium.id ? (
                <View style={[styles.savePill, { backgroundColor: tokens.colors.background.tertiary }]}>
                  <Text style={[styles.saveText, { color: tokens.colors.text.primary }]}>המסלול שלך</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.priceRow}>
              <Text style={[styles.priceBig, { color: tokens.colors.text.primary }]}>₪{perMonth}</Text>
              <Text style={[styles.priceUnit, { color: tokens.colors.text.secondary }]}>/ לחודש</Text>
            </View>
            <Text style={[styles.priceNote, { color: tokens.colors.text.secondary }]}>
              {multiMonth
                ? `₪${activePremium.price.toLocaleString('he-IL')} ל-${PERIOD_MONTHS[activePremium.period]} חודשים · בתשלומים חודשיים`
                : 'ללא התחייבות · ביטול בכל עת'}
            </Text>

            {features(activePremium.highlights)}
          </TouchableOpacity>
  ) : null;

  const freeCard = freePlan ? (
    <TouchableOpacity
      onPress={() => selectPlan(freePlan.id)}
      activeOpacity={0.92}
      accessibilityRole="radio"
      accessibilityState={{ checked: freeSelected }}
      style={cardStyle(freeSelected)}
    >
      <View style={styles.planHead}>
        <Text style={[styles.planName, { color: tokens.colors.text.primary }]}>{freePlan.name}</Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={[styles.priceBig, { color: tokens.colors.text.primary }]}>₪0</Text>
        <Text style={[styles.priceUnit, { color: tokens.colors.text.secondary }]}>/ לחודש</Text>
      </View>
      <Text style={[styles.priceNote, { color: tokens.colors.text.secondary }]}>להתחיל בלי התחייבות</Text>
      {features(freePlan.highlights)}
    </TouchableOpacity>
  ) : null;

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

      {/* קרוסלה אופקית — כרטיס לכל מסלול, השכן מציץ מהצד; הכרטיס שבמרכז נבחר */}
      <View
        style={styles.carouselWrap}
        onLayout={(e) => setCarouselW(e.nativeEvent.layout.width)}
      >
        {carouselW > 0 ? (
          <ScrollView
            ref={carouselRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={cardW + CARD_GAP}
            snapToAlignment="start"
            disableIntervalMomentum
            contentContainerStyle={{ paddingHorizontal: sidePad, gap: CARD_GAP }}
            contentOffset={{ x: initialPage * (cardW + CARD_GAP), y: 0 }}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / (cardW + CARD_GAP));
              const key = pages[page];
              if (!key) return;
              setPage(page);
              const id = key === 'premium' ? activePremium?.id : freePlan?.id;
              if (id && id !== selectedPlanId) selectPlan(id);
            }}
            style={{ direction: 'ltr' }}
          >
            {pages.map((key) => (
              <View key={key} style={{ width: cardW }}>
                {key === 'premium' ? premiumCard : freeCard}
              </View>
            ))}
          </ScrollView>
        ) : null}
        {pages.length > 1 ? (
          <View style={styles.dots}>
            {pages.map((key, i) => (
              <View
                key={key}
                style={[
                  styles.dot,
                  { backgroundColor: i === page ? tokens.colors.text.primary : tokens.colors.border.divider },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>

      <UIButton
        title={ctaText}
        variant="primary"
        fullWidth
        disabled={isDisabled}
        onPress={onContinue}
        style={styles.cta}
      />
      {premiumSelected ? (
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
  carouselWrap: {
    // הקרוסלה מגיעה עד קצות המסך (מבטלת את ריפוד הדף) כדי שהכרטיס השכן יציץ
    marginHorizontal: -APP_LAYOUT.screenPaddingHorizontal,
    marginBottom: APP_LAYOUT.componentGap + 4,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: APP_LAYOUT.componentGap,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
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
    marginTop: APP_LAYOUT.componentGap + 2,
    gap: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: APP_LAYOUT.componentGap + 2,
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
  tabs: {
    flexDirection: 'row-reverse',
    borderRadius: 999,
    padding: 4,
    marginBottom: APP_LAYOUT.componentGap + 2,
  },
  planHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  priceRow: {
    // מחיר גדול + «/ לחודש» — המחיר הוא הדבר הבולט בכרטיס
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 6,
    marginTop: APP_LAYOUT.stackGapSmall,
  },
  // הסקאלה הגדולה ביותר של הטופו (pageTitle) — בלי fontSize מקומי
  priceBig: {
    ...APP_TYPE.pageTitle,
    fontVariant: ['tabular-nums'],
    writingDirection: 'ltr',
  },
  priceUnit: {
    fontSize: APP_TYPE.cardBody.fontSize,
    fontWeight: APP_TYPE.cardBody.fontWeight,
    writingDirection: 'rtl',
  },
  priceNote: {
    ...appCardSubtitleStyle,
    width: undefined,
    marginTop: 2,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabText: {
    fontSize: APP_TYPE.cardBody.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: 'rtl',
  },
  tabSave: {
    ...appCaptionStyle,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: 'ltr',
  },
});
