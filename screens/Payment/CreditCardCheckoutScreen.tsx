import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Shield,
  Users,
  Zap,
  TrendingUp,
  Crown,
  Lock,
  User,
  Mail,
  Phone,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { HapticFeedback } from '../../utils/hapticFeedback';

/** הופך hex ל-rgba עם אלפא — תואם ל-SubscriptionPlansScreen */
const ra = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** פלטה מותגית אחידה — תואמת ל-SubscriptionPlansScreen */
const PLAN_THEME: Record<string, { color: string; icon: any }> = {
  free: { color: '#8B98A5', icon: Users },
  monthly: { color: '#00C805', icon: Zap },
  quarterly: { color: '#2DD4BF', icon: TrendingUp },
  yearly: { color: '#F5B400', icon: Crown },
};

interface CreditCardCheckoutScreenProps {
  navigation: any;
  route: {
    params: {
      planId: string;
      fromRegistration?: boolean;
    };
  };
}

export default function CreditCardCheckoutScreen({ navigation, route }: CreditCardCheckoutScreenProps) {
  const tokens = useDesignTokens();
  const { colors, spacing, borderRadius } = tokens;
  const { user } = useAuth();
  const { data: registrationData } = useRegistration();
  const { planId, fromRegistration = false } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(planId || 'monthly');
  const [showIframe, setShowIframe] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // User Details Form State (כבר לא צריך פרטי כרטיס - LowProfile iframe)
  const [cardholderName, setCardholderName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const plan = SUBSCRIPTION_PLANS[selectedPlan as keyof typeof SUBSCRIPTION_PLANS];
  const planTheme = PLAN_THEME[selectedPlan] ?? { color: plan?.color || colors.primary.main, icon: Crown };
  const planColor = planTheme.color;
  const PlanIcon = planTheme.icon;

  useEffect(() => {
    if (planId) {
      setSelectedPlan(planId);
    }
    if (user) {
      setEmail(user.email || '');
      setCardholderName(user.display_name || '');
    } else if (fromRegistration && registrationData) {
      // במהלך הרישום, נטען פרטים מהרישום
      setEmail(registrationData.email || '');
      setCardholderName(registrationData.fullName || '');
      setPhone(registrationData.phone || '');
    }
  }, [planId, user, fromRegistration, registrationData]);

  // אם זה רישום והפרטים קיימים - עובר ישירות ל-Cardcom
  useEffect(() => {
    if (fromRegistration && registrationData && plan && !showIframe && !loading) {
      const hasAllData = registrationData.email &&
                        registrationData.fullName &&
                        registrationData.phone;

      if (hasAllData) {
        // עובר ישירות ל-Cardcom ללא הצגת טופס
        handlePaymentDirect();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // רק פעם אחת כשהקומפוננטה נטענת

  const handlePaymentDirect = async () => {
    if (!plan || !registrationData) return;

    setLoading(true);

    try {
      // יצירת בקשת תשלום ל-CardCom LowProfile
      const paymentResponse = await paymentService.createPaymentRequest({
        amount: plan.price,
        currency: 'ILS',
        description: `מנוי ${plan.name} - ${registrationData.fullName}`,
        userId: null, // במהלך רישום עדיין אין userId
        planId: selectedPlan,
        userEmail: registrationData.email,
        userName: registrationData.fullName,
        userPhone: registrationData.phone
      });

      if (paymentResponse.success && paymentResponse.paymentUrl) {
        setPaymentUrl(paymentResponse.paymentUrl);
        setShowIframe(true);
      } else {
        throw new Error(paymentResponse.error || 'שגיאה ביצירת בקשת התשלום');
      }

    } catch (error) {
      void HapticFeedback.error();
      legacyAlert(
        'שגיאה בתשלום',
        error instanceof Error ? error.message : 'אירעה שגיאה בעיבוד התשלום. אנא נסה שוב.'
      );
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!cardholderName.trim()) {
      legacyAlert('שגיאה', 'אנא הכנס שם מלא');
      return false;
    }
    if (!email.trim()) {
      legacyAlert('שגיאה', 'אנא הכנס כתובת אימייל');
      return false;
    }
    if (!phone.trim()) {
      legacyAlert('שגיאה', 'אנא הכנס מספר טלפון');
      return false;
    }
    return true;
  };

  // טיפול בהודעות מ-iframe
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'payment_success') {
        void HapticFeedback.success();
        legacyAlert(
          'תשלום הושלם בהצלחה!',
          'המנוי שלך הופעל בהצלחה. תוכל להתחיל להשתמש בכל התכונות.',
          [
            {
              text: 'אישור',
              onPress: () => {
                setShowIframe(false);
                if (fromRegistration) {
                  navigation.navigate('RegistrationSummary');
                } else {
                  navigation.goBack();
                }
              }
            }
          ]
        );
      } else if (data.type === 'payment_failed') {
        void HapticFeedback.error();
        legacyAlert(
          'תשלום נכשל',
          data.message || 'התשלום נכשל. אנא נסה שוב.',
          [
            {
              text: 'אישור',
              onPress: () => setShowIframe(false)
            }
          ]
        );
      } else if (data.type === 'payment_cancelled') {
        setShowIframe(false);
      }
    } catch (error) {
    }
  };

  const handlePayment = async () => {
    // אם זה במהלך הרישום, המשתמש עדיין לא מחובר
    if (!fromRegistration && !user) {
      legacyAlert('שגיאה', 'נדרש להתחבר למערכת');
      return;
    }

    if (!plan) {
      legacyAlert('שגיאה', 'תוכנית מנוי לא נמצאה');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const userId = fromRegistration ? null : (user?.id || null);

      // יצירת בקשת תשלום ל-CardCom LowProfile - יעביר למילוי פרטי כרטיס ב-iframe
      const paymentResponse = await paymentService.createPaymentRequest({
        amount: plan.price,
        currency: 'ILS',
        description: `מנוי ${plan.name} - ${cardholderName}`,
        userId: userId,
        planId: selectedPlan,
        userEmail: email,
        userName: cardholderName,
        userPhone: phone
      });

      if (paymentResponse.success && paymentResponse.paymentUrl) {
        // הצגת iframe תשלום של CardCom בתוך האפליקציה
        setPaymentUrl(paymentResponse.paymentUrl);
        setShowIframe(true);
      } else {
        throw new Error(paymentResponse.error || 'שגיאה ביצירת בקשת התשלום');
      }

    } catch (error) {
      void HapticFeedback.error();
      legacyAlert(
        'שגיאה בתשלום',
        error instanceof Error ? error.message : 'אירעה שגיאה בעיבוד התשלום. אנא נסה שוב.'
      );
    } finally {
      setLoading(false);
    }
  };

  /** מחיר ראשי + תיאור תקופה לפי סוג המסלול */
  const renderPlanPrice = () => {
    if (!plan) return null;
    if (plan.price === 0) {
      return <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 }}>חינם</Text>;
    }
    if (plan.period === 'yearly') {
      return (
        <View style={{ alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: planColor, letterSpacing: -0.5 }}>₪117</Text>
            <Text style={{ fontSize: 13, color: colors.text.secondary, marginBottom: 4, fontWeight: '500' }}>/חודש</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.text.tertiary, marginTop: 2 }}>מחויב שנתי — ₪{plan.price.toLocaleString()}</Text>
        </View>
      );
    }
    const periodLabel =
      plan.period === 'quarterly' ? 'ל-3 חודשים' :
      plan.period === 'one_time' ? 'תשלום חד פעמי' :
      '/חודש';
    return (
      <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: planColor, letterSpacing: -0.5 }}>₪{plan.price.toLocaleString()}</Text>
        <Text style={{ fontSize: 13, color: colors.text.secondary, marginBottom: 4, fontWeight: '500' }}>{periodLabel}</Text>
      </View>
    );
  };

  const renderPlanCard = () => {
    if (!plan) return null;

    return (
      <UICard
        variant="glass"
        glassIntensity="medium"
        padding="none"
        style={{
          marginBottom: spacing.lg,
          borderRadius: borderRadius['2xl'],
          borderWidth: 1,
          borderColor: ra(planColor, 0.4),
          overflow: 'hidden',
          shadowColor: planColor,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        <LinearGradient
          colors={[ra(planColor, 0.18), 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90 }}
        />
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', padding: spacing.lg }}>
          <View style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: ra(planColor, 0.15),
            borderWidth: 1.5,
            borderColor: ra(planColor, 0.35),
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: spacing.base,
          }}>
            <PlanIcon size={24} color={planColor} strokeWidth={2} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{
              color: colors.text.primary,
              fontSize: 19,
              fontWeight: '700',
              textAlign: 'right',
              letterSpacing: -0.3,
            }}>
              {plan.name}
            </Text>
            <Text style={{ color: colors.text.tertiary, fontSize: 12, textAlign: 'right', marginTop: 2, marginBottom: 8 }}>
              {plan.description}
            </Text>
            {renderPlanPrice()}
          </View>
        </View>
      </UICard>
    );
  };

  const renderInputField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    fieldKey: string,
    keyboardType: any = 'default',
    icon?: any,
  ) => {
    const isFocused = focusedField === fieldKey;
    return (
      <View style={{ marginBottom: spacing.base }}>
        <Text style={{
          color: colors.text.secondary,
          fontSize: 13,
          fontWeight: '600',
          marginBottom: 8,
          textAlign: 'right',
        }}>
          {label}
        </Text>
        <View style={{
          backgroundColor: colors.background.input,
          borderRadius: borderRadius.md,
          borderWidth: 1.5,
          borderColor: isFocused ? ra(planColor, 0.55) : colors.border.default,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 14,
        }}>
          {icon && (
            <View style={{ marginLeft: 10 }}>
              {icon}
            </View>
          )}
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocusedField(fieldKey)}
            onBlur={() => setFocusedField(null)}
            placeholder={placeholder}
            placeholderTextColor={colors.text.muted}
            style={{
              flex: 1,
              color: colors.text.primary,
              fontSize: 16,
              paddingVertical: 14,
              fontWeight: '500',
              textAlign: 'right',
            }}
            keyboardType={keyboardType}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>
    );
  };

  // אם מציגים iframe תשלום
  if (showIframe) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
          <ChatSubScreenHeader title="השלמת תשלום" onBack={() => setShowIframe(false)} />

          <WebView
            source={{ uri: paymentUrl }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            onMessage={handleWebViewMessage}
            onNavigationStateChange={(navState) => {
              const url = navState.url;
              if (url.includes('smart-action') || url.includes('rapid-responder')) {
                // Webhook יטפל בזה
              }
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: ra(colors.background.primary, 0.92),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ActivityIndicator color={colors.primary.main} size="large" />
                <Text style={{ color: colors.text.primary, fontSize: 16, marginTop: 16, writingDirection: 'rtl' }}>
                  טוען דף תשלום...
                </Text>
              </View>
            )}
          />
        </SafeAreaView>
      </View>
    );
  }

  // אם זה רישום - מציג מסך טעינה לפני שמופיע ה-iframe
  if (fromRegistration && (loading || showIframe)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: colors.primary.dim,
            borderWidth: 1, borderColor: colors.primary.subtle,
            alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <Lock size={28} color={colors.primary.main} />
          </View>
          <ActivityIndicator color={colors.primary.main} size="large" />
          <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '700', marginTop: 24, textAlign: 'center', writingDirection: 'rtl' }}>
            מכין את דף התשלום המאובטח...
          </Text>
          <Text style={{ color: colors.text.secondary, fontSize: 14, marginTop: 10, textAlign: 'center', writingDirection: 'rtl', lineHeight: 20 }}>
            תועבר לדף תשלום מאובטח של CardCom
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        <ChatSubScreenHeader title="פרטי התשלום" onBack={() => navigation.goBack()} />

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.base }}>
            {/* Plan Card */}
            {renderPlanCard()}

            {/* Personal Details Section */}
            <UICard
              variant="glass"
              glassIntensity="light"
              padding="lg"
              style={{ marginBottom: spacing.lg, borderRadius: borderRadius.xl }}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: spacing.lg }}>
                <User size={18} color={colors.primary.main} style={{ marginLeft: 8 }} />
                <Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '700', writingDirection: 'rtl' }}>
                  פרטים אישיים
                </Text>
              </View>

              {renderInputField(
                'שם מלא',
                cardholderName,
                setCardholderName,
                'שם מלא',
                'name',
                'default',
                <User size={16} color={colors.text.tertiary} />,
              )}

              {renderInputField(
                'כתובת אימייל',
                email,
                setEmail,
                'example@email.com',
                'email',
                'email-address',
                <Mail size={16} color={colors.text.tertiary} />,
              )}

              {renderInputField(
                'מספר טלפון',
                phone,
                setPhone,
                '050-1234567',
                'phone',
                'phone-pad',
                <Phone size={16} color={colors.text.tertiary} />,
              )}
            </UICard>

            {/* Security Notice */}
            <View style={{
              flexDirection: 'row-reverse',
              alignItems: 'flex-start',
              backgroundColor: colors.primary.dim,
              borderRadius: borderRadius.lg,
              borderWidth: 1,
              borderColor: colors.primary.subtle,
              padding: spacing.base,
              marginBottom: spacing.lg,
            }}>
              <Shield size={18} color={colors.primary.main} style={{ marginTop: 1, marginLeft: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary.main, fontSize: 13, fontWeight: '700', textAlign: 'right', marginBottom: 4 }}>
                  תשלום מאובטח עם CardCom
                </Text>
                <Text style={{ color: colors.text.secondary, fontSize: 12, lineHeight: 18, textAlign: 'right' }}>
                  תועבר לדף תשלום מאובטח למילוי פרטי כרטיס האשראי. כל הפרטים מוצפנים ב-SSL 256-bit בתקן PCI DSS.
                </Text>
              </View>
            </View>

            {/* Payment Summary */}
            <UICard
              variant="glass"
              glassIntensity="light"
              padding="lg"
              style={{ marginBottom: spacing.lg, borderRadius: borderRadius.xl }}
            >
              <Text style={{ color: colors.text.primary, fontSize: 17, fontWeight: '700', marginBottom: spacing.base, textAlign: 'right' }}>
                סיכום התשלום
              </Text>

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ color: colors.text.secondary, fontSize: 14, textAlign: 'right' }}>
                  {plan?.name}
                </Text>
                <Text style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>
                  {plan?.price === 0 ? 'חינם' : `₪${plan?.price.toLocaleString()}`}
                </Text>
              </View>

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <Text style={{ color: colors.text.tertiary, fontSize: 12, textAlign: 'right' }}>
                  המחיר כולל מע"מ
                </Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>
                  {plan?.period === 'one_time' ? 'תשלום חד פעמי' : plan?.period === 'yearly' ? 'חיוב שנתי' : plan?.period === 'quarterly' ? 'חיוב רבעוני' : 'חיוב חודשי'}
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: colors.border.default, marginBottom: spacing.md }} />

              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '800', textAlign: 'right' }}>
                  סה"כ לתשלום
                </Text>
                <Text style={{ color: planColor, fontSize: 22, fontWeight: '800' }}>
                  {plan?.price === 0 ? 'חינם' : `₪${plan?.price.toLocaleString()}`}
                </Text>
              </View>
            </UICard>

            {/* Payment Button */}
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.medium();
                handlePayment();
              }}
              disabled={loading}
              activeOpacity={0.85}
              style={{ borderRadius: borderRadius.lg, overflow: 'hidden', opacity: loading ? 0.7 : 1 }}
            >
              <LinearGradient
                colors={[planColor, ra(planColor, 0.78)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 17, alignItems: 'center', justifyContent: 'center' }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                    <Lock size={18} color="#fff" style={{ marginLeft: 8 }} />
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', writingDirection: 'rtl', letterSpacing: 0.2 }}>
                      המשך לתשלום מאובטח
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Terms */}
            <Text style={{ color: colors.text.tertiary, fontSize: 12, textAlign: 'center', marginTop: spacing.base, lineHeight: 18, writingDirection: 'rtl' }}>
              בלחיצה על "המשך לתשלום מאובטח" אתה מסכים לתנאי השימוש ומדיניות הפרטיות שלנו
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
