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
import { Check, X, Users, Zap, TrendingUp, Crown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { SUBSCRIPTION_PLANS, isSubscriptionCheckoutEnabled } from '../../services/paymentService';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.round(SCREEN_W * 0.76);
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

const PLAN_ICONS = {
  free: Users,
  monthly: Zap,
  quarterly: TrendingUp,
  yearly: Crown,
} as const;

export default function SubscriptionPlansScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { colors, spacing, borderRadius, typography, shadows } = tokens;

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
    const Icon = PLAN_ICONS[plan.id as keyof typeof PLAN_ICONS] ?? Users;
    const color = plan.color;
    const isActive = activePlanId === plan.id;

    const inputRange = [(idx - 1) * SNAP, idx * SNAP, (idx + 1) * SNAP];
    const cardScale = scrollX.interpolate({ inputRange, outputRange: [0.91, 1, 0.91], extrapolate: 'clamp' });
    const cardOpacity = scrollX.interpolate({ inputRange, outputRange: [0.62, 1, 0.62], extrapolate: 'clamp' });
    const cardTranslateY = scrollX.interpolate({ inputRange, outputRange: [10, 0, 10], extrapolate: 'clamp' });

    const renderPrice = () => {
      if (plan.price === 0) return (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 36, fontWeight: '800', color: colors.text.primary, letterSpacing: -1 }}>חינם</Text>
          <Text style={{ fontSize: 13, color: colors.text.tertiary, fontWeight: '500', marginTop: 2 }}>לתמיד</Text>
        </View>
      );
      if (plan.id === 'yearly') return (
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color, letterSpacing: -1 }}>₪117</Text>
            <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: 6, fontWeight: '500' }}>/חודש</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>(מחויב שנתי — ₪{plan.price.toLocaleString()})</Text>
        </View>
      );
      if (plan.id === 'quarterly') return (
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color, letterSpacing: -1 }}>₪{plan.price}</Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 3, fontWeight: '500' }}>לשלושה חודשים</Text>
          <View style={{ marginTop: 8, backgroundColor: ra(color, 0.18), paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: ra(color, 0.4) }}>
            <Text style={{ fontSize: 11, color, fontWeight: '700' }}>חסוך 47% ברבעון</Text>
          </View>
        </View>
      );
      // monthly
      return (
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ fontSize: 36, fontWeight: '800', color, letterSpacing: -1 }}>₪{plan.price}</Text>
            <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: 6, fontWeight: '500' }}>/חודש</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>ללא התחייבות</Text>
        </View>
      );
    };

    return (
      <Animated.View style={{
        width: CARD_W,
        marginHorizontal: GAP / 2,
        transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
        opacity: cardOpacity,
        paddingBottom: 16,
      }}>
        <UICard
          variant="glass"
          glassIntensity="medium"
          padding="none"
          pressable
          onPress={() => {
            if (activePlanId !== plan.id) void HapticFeedback.selection();
            setActivePlanId(plan.id);
          }}
          style={{
            borderRadius: borderRadius['2xl'],
            borderWidth: isActive ? 1.5 : 1,
            borderColor: isActive ? ra(color, 0.7) : colors.border.subtle,
            shadowColor: color,
            shadowOffset: { width: 0, height: isActive ? 12 : 4 },
            shadowOpacity: isActive ? 0.28 : 0.08,
            shadowRadius: isActive ? 20 : 8,
            elevation: isActive ? 14 : 4,
          }}
        >
          {/* Glow top strip */}
          {isActive && (
            <LinearGradient
              colors={[ra(color, 0.22), 'transparent']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, borderTopLeftRadius: borderRadius['2xl'], borderTopRightRadius: borderRadius['2xl'] }}
            />
          )}

          <View style={{ padding: spacing.xl }}>
            {/* Badge */}
            {plan.badge && (
              <View style={{ position: 'absolute', top: -1, right: -1, backgroundColor: color, paddingHorizontal: 10, paddingVertical: 4, borderTopRightRadius: borderRadius['2xl'], borderBottomLeftRadius: borderRadius.md, zIndex: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: plan.id === 'quarterly' ? '#fff' : '#000' }}>{plan.badge}</Text>
              </View>
            )}

            {/* Icon + name */}
            <View style={{ alignItems: 'center', marginBottom: spacing.xl, marginTop: plan.badge ? spacing.base : 0 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: ra(color, 0.15),
                borderWidth: 1.5, borderColor: ra(color, 0.35),
                alignItems: 'center', justifyContent: 'center', marginBottom: 14,
              }}>
                <Icon size={24} color={color} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text.primary, textAlign: 'center', letterSpacing: -0.3 }}>
                {plan.name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 4, textAlign: 'center' }}>
                {plan.description}
              </Text>
            </View>

            {/* Price */}
            <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
              {renderPrice()}
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: colors.border.subtle, marginBottom: spacing.lg }} />

            {/* Features */}
            <View style={{ gap: 10, marginBottom: spacing.xl }}>
              {plan.features.map((f, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 18, height: 18, borderRadius: 9,
                    backgroundColor: ra(color, 0.18),
                    borderWidth: 1, borderColor: ra(color, 0.4),
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Check size={10} color={color} strokeWidth={3} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: colors.text.secondary, textAlign: 'right', lineHeight: 18, fontWeight: '500' }}>
                    {f}
                  </Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            {plan.price === 0 ? (
              <View style={{
                paddingVertical: 13, borderRadius: borderRadius.lg,
                backgroundColor: ra(color, 0.1), borderWidth: 1, borderColor: ra(color, 0.2),
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
                  colors={[color, ra(color, 0.75)]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 }}>
                    הצטרפות למסלול
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </UICard>
      </Animated.View>
    );
  };

  /* ─── טבלת השוואה ─── */
  const ComparisonTable = () => (
    <View style={{ paddingHorizontal: spacing.base, marginTop: spacing['2xl'] }}>
      <Text style={{ fontSize: typography.fontSize.lg, fontWeight: '700', color: colors.text.primary, textAlign: 'center', marginBottom: 4 }}>
        מה כלול בכל מסלול?
      </Text>
      <Text style={{ fontSize: typography.fontSize.sm, color: colors.text.tertiary, textAlign: 'center', marginBottom: spacing.lg }}>
        השוואה מהירה
      </Text>

      <UICard variant="glass" glassIntensity="light" padding="none" style={{ borderRadius: borderRadius.xl, overflow: 'hidden' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', paddingVertical: spacing.md, paddingHorizontal: spacing.md,
          borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
          backgroundColor: ra('#ffffff', 0.03),
        }}>
          <View style={{ width: '30%' }}>
            <Text style={{ fontSize: typography.fontSize.xs, fontWeight: '600', color: colors.text.tertiary, textAlign: 'right' }}>תכונה</Text>
          </View>
          {PLANS.map(p => (
            <View key={p.id} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: p.color, textAlign: 'center', lineHeight: 13 }}>
                {p.id === 'yearly' ? 'שנתי' : p.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Rows */}
        {COMPARISON_FEATURES.map((feat, i) => (
          <View key={i} style={{
            flexDirection: 'row', alignItems: 'center',
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
              return (
                <View key={plan.id} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {has ? (
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: ra(plan.color, 0.18), borderWidth: 1, borderColor: ra(plan.color, 0.45), alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={11} color={plan.color} strokeWidth={3} />
                    </View>
                  ) : (
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: ra('#FF4444', 0.1), borderWidth: 1, borderColor: ra('#FF4444', 0.35), alignItems: 'center', justifyContent: 'center' }}>
                      <X size={11} color="#FF4444" strokeWidth={2.5} />
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
    <View style={{ paddingHorizontal: spacing.base, marginTop: spacing['2xl'], marginBottom: spacing['3xl'] }}>
      <UICard variant="glass" glassIntensity="light" padding="lg" style={{ borderRadius: borderRadius.xl }}>
        <Text style={{ fontSize: typography.fontSize.base, fontWeight: '700', color: colors.text.primary, textAlign: 'right', marginBottom: spacing.lg }}>
          איך זה עובד?
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[
            { n: '1', title: 'בחר מסלול', sub: 'מצא את הרמה שמתאימה לך' },
            { n: '2', title: 'אשר פרטים', sub: 'מילוי קצר ותשלום מאובטח' },
            { n: '3', title: 'מתחילים!', sub: 'פותחים את כל התוכן מיד' },
          ].map(s => (
            <View key={s.n} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20, marginBottom: spacing.sm,
                backgroundColor: colors.primary.dim, borderWidth: 1, borderColor: colors.primary.subtle,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.primary.main }}>{s.n}</Text>
              </View>
              <Text style={{ fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.text.primary, textAlign: 'center', marginBottom: 3 }}>{s.title}</Text>
              <Text style={{ fontSize: 11, color: colors.text.tertiary, textAlign: 'center', lineHeight: 15 }}>{s.sub}</Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
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
          <View style={{ alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.lg, paddingHorizontal: spacing.xl }}>
            {/* Accent glow */}
            <View style={{
              position: 'absolute', top: 0, left: SCREEN_W * 0.2, right: SCREEN_W * 0.2, height: 120,
              borderRadius: 60, backgroundColor: colors.primary.glow,
              opacity: 0.18,
              // blur workaround
              ...(Platform.OS === 'ios' ? {} : {}),
            }} />
            <View style={{ width: 48, height: 3, backgroundColor: colors.primary.main, borderRadius: 2, marginBottom: spacing.md }} />
            <Text style={{ fontSize: typography.fontSize['3xl'], fontWeight: '800', color: colors.text.primary, textAlign: 'center', letterSpacing: -0.8, lineHeight: 36 }}>
              בחר את המסלול שלך
            </Text>
            <Text style={{ fontSize: typography.fontSize.base, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22, maxWidth: 260 }}>
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
                {
                  useNativeDriver: false,
                  listener: (e: any) => {
                    const x = e.nativeEvent.contentOffset.x;
                    const idx = Math.round(x / SNAP);
                    if (idx >= 0 && idx < PLANS.length) {
                      const id = (PLANS as any)[idx].id;
                      if (id !== activePlanId) setActivePlanId(id);
                    }
                  },
                }
              )}
              onMomentumScrollEnd={(e: any) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP);
                if (idx >= 0 && idx < PLANS.length) setActivePlanId((PLANS as any)[idx].id);
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
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 6 }}>
              {PLANS.map((p, i) => {
                const inputRange = [(i - 1) * SNAP, i * SNAP, (i + 1) * SNAP];
                const dotW = scrollX.interpolate({ inputRange, outputRange: [7, 18, 7], extrapolate: 'clamp' });
                const dotOp = scrollX.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
                return (
                  <Animated.View
                    key={p.id}
                    style={{ width: dotW, height: 7, borderRadius: 4, backgroundColor: p.color, opacity: dotOp }}
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
