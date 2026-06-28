import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  FlatList,
  Platform,
} from 'react-native';
import { Check, X, Users, Zap, TrendingUp, Crown, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { SUBSCRIPTION_PLANS, isSubscriptionCheckoutEnabled } from '../../services/paymentService';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.round(SCREEN_W * 0.78);
const GAP = 14;
const SNAP = CARD_W + GAP;
// RTL: נהפוך את הFlatList כדי שיגלול ימין → שמאל
const RTL = { transform: [{ scaleX: -1 }] };

// מסלולים ראשיים (ללא אד-אונים)
const PLANS = [
  SUBSCRIPTION_PLANS.free,
  SUBSCRIPTION_PLANS.monthly,
  SUBSCRIPTION_PLANS.quarterly,
  SUBSCRIPTION_PLANS.yearly,
] as const;

/**
 * פלטה מותגית אחידה (DarkPool) — ירוק כצבע מוביל, גוונים משלימים.
 * מחליף את הכחול/זהב המקוריים שלא התאימו לזהות הירוקה.
 */
const PLAN_THEME: Record<string, { color: string; icon: any }> = {
  free: { color: '#8B98A5', icon: Users },        // אפור-פלדה ניטרלי
  monthly: { color: '#00C805', icon: Zap },       // ירוק DarkPool
  quarterly: { color: '#2DD4BF', icon: TrendingUp }, // טורקיז (הכי משתלם)
  yearly: { color: '#F5B400', icon: Crown },      // זהב פרימיום
};

// תכונות לטבלת השוואה
const COMPARISON_FEATURES = [
  'מענה על שאלות',
  'יחס אישי וליווי קהילתי',
  'חדשות מתפרצות בזמן אמת',
  'חדשות כלכליות',
  'לייב מסחר יומי ביוטיוב',
  'רשימת מעקב למסחר יומי',
  'ניתוחים וסטאפים לסווינגים',
  'שיתוף תיק השקעות',
  'תמיכה בערוץ היוטיוב',
  'קבוצת השקעות 🇮🇱',
  'קורס הלוויתנים',
];

const ra = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const planColorOf = (id: string) => PLAN_THEME[id]?.color ?? '#00C805';

export default function SubscriptionPlansScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { colors, spacing, borderRadius, typography } = tokens;

  const [activePlanId, setActivePlanId] = useState<string>(PLANS[0].id);
  // useNativeDriver:false נדרש כי יש listener + interpolation על width (dots)
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const handleJoin = (planId: string) => {
    if (planId === 'free') return;
    if (!isSubscriptionCheckoutEnabled()) {
      legacyAlert(
        'תשלום בקרוב',
        'רכישת מנוי תיפתח לאחר חיבור מלא לסולק התשלומים. בינתיים ניתן לצפות במסלולים.',
        [{ text: 'הבנתי' }],
      );
      return;
    }
    navigation.navigate('CreditCardCheckout', { planId, fromRegistration: false });
  };

  /* ─── כרטיסיית מסלול ─── */
  const PlanCard = ({ plan, idx }: { plan: (typeof PLANS)[number]; idx: number }) => {
    const theme = PLAN_THEME[plan.id] ?? PLAN_THEME.monthly;
    const Icon = theme.icon;
    const color = theme.color;
    const isActive = activePlanId === plan.id;
    const isPopular = (plan as any).popular === true;

    const renderPrice = () => {
      if (plan.price === 0) return (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 38, fontWeight: '800', color: colors.text.primary, letterSpacing: -1 }}>חינם</Text>
          <Text style={{ fontSize: 13, color: colors.text.tertiary, fontWeight: '500', marginTop: 2 }}>לתמיד</Text>
        </View>
      );
      if (plan.id === 'yearly') return (
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ fontSize: 38, fontWeight: '800', color, letterSpacing: -1 }}>₪117</Text>
            <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: 7, fontWeight: '500' }}>/חודש</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 3 }}>מחויב שנתי — ₪{plan.price.toLocaleString()}</Text>
        </View>
      );
      if (plan.id === 'quarterly') return (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 38, fontWeight: '800', color, letterSpacing: -1 }}>₪{plan.price}</Text>
          <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 2, fontWeight: '500' }}>לשלושה חודשים</Text>
        </View>
      );
      // monthly
      return (
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ fontSize: 38, fontWeight: '800', color, letterSpacing: -1 }}>₪{plan.price}</Text>
            <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: 7, fontWeight: '500' }}>/חודש</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 3 }}>ללא התחייבות</Text>
        </View>
      );
    };

    return (
      <View style={{
        width: CARD_W,
        marginHorizontal: GAP / 2,
        paddingTop: 14,
        paddingBottom: 18,
      }}>
        {/* Ribbon "הכי משתלם" — מעל הכרטיס */}
        {isPopular && (
          <View style={{ position: 'absolute', top: 0, alignSelf: 'center', zIndex: 5 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: color,
              paddingHorizontal: 14, paddingVertical: 5,
              borderRadius: borderRadius.full,
              shadowColor: color, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6,
            }}>
              <Sparkles size={12} color="#04140F" strokeWidth={2.5} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#04140F', letterSpacing: 0.2 }}>הכי משתלם</Text>
            </View>
          </View>
        )}

        <UICard
          variant="glass"
          glassIntensity="medium"
          showGlassBorder={false}
          padding="none"
          pressable
          onPress={() => {
            if (activePlanId !== plan.id) void HapticFeedback.selection();
            setActivePlanId(plan.id);
          }}
          style={{
            borderRadius: borderRadius['2xl'],
            borderWidth: isActive ? 1.5 : 1,
            borderColor: isActive ? ra(color, 0.75) : colors.border.default,
            shadowColor: color,
            shadowOffset: { width: 0, height: isActive ? 14 : 4 },
            shadowOpacity: isActive ? 0.32 : 0.06,
            shadowRadius: isActive ? 24 : 8,
            elevation: isActive ? 16 : 3,
          }}
        >
          <View style={{ padding: spacing.xl, paddingTop: isPopular ? spacing.xl + 8 : spacing.xl }}>
            {/* Icon + name */}
            <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
              <View style={{
                width: 52, height: 52, borderRadius: 16,
                backgroundColor: ra(color, 0.14),
                alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <Icon size={24} color={color} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text.primary, textAlign: 'center', letterSpacing: -0.4 }}>
                {plan.name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 4, textAlign: 'center' }}>
                {plan.description}
              </Text>
            </View>

            {/* Price */}
            <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
              {renderPrice()}
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: colors.border.default, marginBottom: spacing.lg }} />

            {/* Features */}
            <View style={{ gap: 11, marginBottom: spacing.xl }}>
              {plan.features.map((f, i) => (
                <View key={`inc-${i}`} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 19, height: 19, borderRadius: 10,
                    backgroundColor: ra(color, 0.18),
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Check size={11} color={color} strokeWidth={3} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.text.secondary, textAlign: 'right', lineHeight: 18, fontWeight: '500' }}>
                    {f}
                  </Text>
                </View>
              ))}
              {((plan as any).excludedFeatures ?? []).map((f: string, i: number) => (
                <View key={`exc-${i}`} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 19, height: 19, borderRadius: 10,
                    backgroundColor: ra('#FF4444', 0.1),
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <X size={11} color={ra('#FF4444', 0.7)} strokeWidth={2.5} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.text.muted, textAlign: 'right', lineHeight: 18, fontWeight: '500', textDecorationLine: 'line-through' }}>
                    {f}
                  </Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            {plan.price === 0 ? (
              <View style={{
                paddingVertical: 14, borderRadius: borderRadius.lg,
                backgroundColor: colors.background.input, borderWidth: 1, borderColor: colors.border.default,
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.tertiary }}>מסלול נוכחי</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  void HapticFeedback.medium();
                  handleJoin(plan.id);
                }}
                activeOpacity={0.82}
                style={{ borderRadius: borderRadius.lg, overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={[color, ra(color, 0.72)]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 15, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#04140F', letterSpacing: 0.2 }}>
                    הצטרפות למסלול
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </UICard>
      </View>
    );
  };

  /* ─── טבלת השוואה ─── */
  const ComparisonTable = () => (
    <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.xl }}>
      <Text style={{ fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.text.primary, textAlign: 'center', marginBottom: 4 }}>
        מה כלול בכל מסלול?
      </Text>
      <Text style={{ fontSize: typography.fontSize.sm, color: colors.text.tertiary, textAlign: 'center', marginBottom: spacing.lg }}>
        השוואה מהירה
      </Text>

      <UICard variant="glass" glassIntensity="light" padding="none" style={{ borderRadius: borderRadius.xl, overflow: 'hidden' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row-reverse', paddingVertical: spacing.md, paddingHorizontal: spacing.md,
          borderBottomWidth: 1, borderBottomColor: colors.border.default,
          backgroundColor: ra('#ffffff', 0.03),
        }}>
          <View style={{ width: '30%' }}>
            <Text style={{ fontSize: typography.fontSize.xs, fontWeight: '600', color: colors.text.tertiary, textAlign: 'right' }}>תכונה</Text>
          </View>
          {PLANS.map(p => (
            <View key={p.id} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: planColorOf(p.id), textAlign: 'center', lineHeight: 13 }}>
                {p.id === 'yearly' ? 'שנתי' : p.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Rows */}
        {COMPARISON_FEATURES.map((feat, i) => (
          <View key={i} style={{
            flexDirection: 'row-reverse', alignItems: 'center',
            paddingVertical: 11, paddingHorizontal: spacing.md,
            borderBottomWidth: i < COMPARISON_FEATURES.length - 1 ? 1 : 0,
            borderBottomColor: colors.border.subtle,
            backgroundColor: i % 2 === 0 ? 'transparent' : ra('#ffffff', 0.015),
          }}>
            <View style={{ width: '30%' }}>
              <Text style={{ fontSize: 11, color: colors.text.secondary, textAlign: 'right', lineHeight: 16, fontWeight: '500' }}>
                {feat}
              </Text>
            </View>
            {PLANS.map(plan => {
              const has = plan.features.some(f => f.includes(feat) || feat.includes(f.replace(' 🇮🇱', '')));
              const c = planColorOf(plan.id);
              return (
                <View key={plan.id} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {has ? (
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: ra(c, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={11} color={c} strokeWidth={3} />
                    </View>
                  ) : (
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: ra('#FF4444', 0.09), alignItems: 'center', justifyContent: 'center' }}>
                      <X size={11} color={ra('#FF4444', 0.7)} strokeWidth={2.5} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </UICard>
    </View>
  );

  /* ─── כיצד זה עובד ─── */
  const HowItWorks = () => (
    <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.xl, marginBottom: spacing['3xl'] }}>
      <UICard variant="glass" glassIntensity="light" padding="lg" style={{ borderRadius: borderRadius.xl }}>
        <Text style={{ fontSize: typography.fontSize.base, fontWeight: '800', color: colors.text.primary, textAlign: 'right', marginBottom: spacing.lg }}>
          איך זה עובד?
        </Text>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
          {[
            { n: '1', title: 'בחר מסלול', sub: 'מצא את הרמה שמתאימה לך' },
            { n: '2', title: 'אשר פרטים', sub: 'מילוי קצר ותשלום מאובטח' },
            { n: '3', title: 'מתחילים!', sub: 'פותחים את כל התוכן מיד' },
          ].map(s => (
            <View key={s.n} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
              <View style={{
                width: 42, height: 42, borderRadius: 21, marginBottom: spacing.sm,
                backgroundColor: colors.primary.dim, borderWidth: 1, borderColor: colors.primary.subtle,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.primary.main }}>{s.n}</Text>
              </View>
              <Text style={{ fontSize: typography.fontSize.sm, fontWeight: '700', color: colors.text.primary, textAlign: 'center', marginBottom: 3 }}>{s.title}</Text>
              <Text style={{ fontSize: 11, color: colors.text.tertiary, textAlign: 'center', lineHeight: 15 }}>{s.sub}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border.default }}>
          <Text style={{ fontSize: 12, color: colors.text.tertiary, textAlign: 'right', lineHeight: 19 }}>
            ניתן לשנות מסלול בכל עת — שדרוג נכנס לתוקף מיידית. ביטול פשוט, ללא קנסות.
          </Text>
        </View>
      </UICard>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <RNSafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title="בחר מסלול"
          onBack={() => {
            void HapticFeedback.impactLight();
            navigation.goBack();
          }}
        />

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          overScrollMode="never"
          bounces={Platform.OS === 'ios'}
        >
          {/* ─── Header ─── */}
          <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.base, paddingHorizontal: spacing.xl }}>
            <Text style={{ fontSize: typography.fontSize['3xl'], fontWeight: '800', color: colors.text.primary, textAlign: 'center', letterSpacing: -0.8, lineHeight: 36 }}>
              בחר את המסלול שלך
            </Text>
            <Text style={{ fontSize: typography.fontSize.base, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22, maxWidth: 280 }}>
              כל סוחר מתחיל איפשהו.{'\n'}איפה אתה רוצה להתחיל?
            </Text>
          </View>

          {/* ─── Carousel ─── */}
          <View>
            <Animated.FlatList
              ref={flatListRef}
              data={PLANS as any}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: (SCREEN_W - CARD_W) / 2 }}
              style={RTL}
              snapToInterval={SNAP}
              decelerationRate={Platform.OS === 'ios' ? 0.992 : 'fast'}
              disableIntervalMomentum
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: true }
              )}
              onMomentumScrollEnd={(e: any) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP);
                if (idx >= 0 && idx < PLANS.length) {
                  const id = (PLANS as any)[idx].id;
                  if (id !== activePlanId) setActivePlanId(id);
                }
              }}
              scrollEventThrottle={16}
              removeClippedSubviews={false}
              initialNumToRender={4}
              getItemLayout={(_: any, index: number) => ({ length: SNAP, offset: SNAP * index, index })}
              renderItem={({ item, index }: any) => (
                <View style={RTL}>
                  <PlanCard plan={item} idx={index} />
                </View>
              )}
            />

            {/* Dots */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 6, gap: 6 }}>
              {PLANS.map((p, i) => {
                const inputRange = [(i - 1) * SNAP, i * SNAP, (i + 1) * SNAP];
                const dotScale = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
                const dotOp = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
                return (
                  <Animated.View
                    key={p.id}
                    style={{ width: 20, height: 7, borderRadius: 4, backgroundColor: planColorOf(p.id), opacity: dotOp, transform: [{ scaleX: dotScale }] }}
                  />
                );
              })}
            </View>
          </View>

          <ComparisonTable />
          <HowItWorks />
        </ScrollView>
      </RNSafeAreaView>
    </View>
  );
}
