import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  Shield,
  Crown,
  Star,
  Users,
  User,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { useDesignTokens, DesignTokens as StaticDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { HapticFeedback } from '../../utils/hapticFeedback';

const { width } = Dimensions.get('window');

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
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const { data: registrationData } = useRegistration();
  const { planId, fromRegistration = false } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(planId || 'monthly');
  const [showIframe, setShowIframe] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');

  // User Details Form State (כבר לא צריך פרטי כרטיס - LowProfile iframe)
  const [cardholderName, setCardholderName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const plan = SUBSCRIPTION_PLANS[selectedPlan as keyof typeof SUBSCRIPTION_PLANS];

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

  const renderPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free':
        return <Users size={24} color="#B0B0B0" />;
      case 'premium':
      case 'monthly':
        return <Crown size={24} color={DesignTokens.colors.primary.main} />;
      case 'pro':
      case 'yearly':
        return <Star size={24} color="#FFD700" />;
      case 'quarterly':
        return <Shield size={24} color="#FFD700" />;
      default:
        return <Crown size={24} color={DesignTokens.colors.primary.main} />;
    }
  };

  const renderPlanCard = () => {
    if (!plan) return null;

    return (
      <UICard
        variant="inputGlass"
        padding="lg"
        style={{
          marginBottom: DesignTokens.spacing.lg,
          borderRadius: DesignTokens.borderRadius.lg,
        }}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <View style={{
            width: 50,
            height: 50,
            borderRadius: 15,
            backgroundColor: selectedPlan === 'premium' ? DesignTokens.colors.primary.main : 'rgba(255, 255, 255, 0.08)',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 16
          }}>
            {renderPlanIcon(selectedPlan)}
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: DesignTokens.colors.text.primary, 
              fontSize: 20, 
              fontWeight: '700',
              writingDirection: 'rtl'
            }}>
              {plan.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ 
                color: DesignTokens.colors.primary.main, 
                fontSize: 24, 
                fontWeight: '800',
                writingDirection: 'rtl'
              }}>
                {plan.price === 0 ? 'חינם' : `₪${plan.price}`}
              </Text>
              <Text style={{ 
                color: DesignTokens.colors.text.secondary, 
                fontSize: 14, 
                marginLeft: 8,
                writingDirection: 'rtl'
              }}>
                לחודש
              </Text>
            </View>
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
    keyboardType: any = 'default',
    maxLength?: number,
    icon?: any,
    secureTextEntry: boolean = false
  ) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ 
        color: DesignTokens.colors.text.primary, 
        fontSize: 14, 
        fontWeight: '600', 
        marginBottom: 8,
        writingDirection: 'rtl'
      }}>
        {label}
      </Text>
      <View style={{
        ...StaticDesignTokens.onboardingInputSurface,
        borderRadius: DesignTokens.borderRadius.md,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
      }}>
        {icon && (
          <View style={{ marginLeft: 12 }}>
            {icon}
          </View>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#888888"
          style={{
            flex: 1,
            color: DesignTokens.colors.text.primary,
            fontSize: 16,
            paddingVertical: 16,
            fontWeight: '500',
            textAlign: 'right'
          }}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCorrect={false}
          autoCapitalize="none"
          secureTextEntry={secureTextEntry}
        />
      </View>
    </View>
  );

  // אם מציגים iframe תשלום
  if (showIframe) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
          <ChatSubScreenHeader title="השלמת תשלום" onBack={() => setShowIframe(false)} />

        {/* WebView */}
        <WebView
          source={{ uri: paymentUrl }}
          style={{ flex: 1 }}
          onMessage={handleWebViewMessage}
          onNavigationStateChange={(navState) => {
            // בדיקה אם זה redirect מ-Cardcom
            const url = navState.url;
            // אם זה redirect ל-success או failed URL
            if (url.includes('smart-action') || url.includes('rapid-responder')) {
              // Webhook יטפל בזה, אבל נוכל לבדוק את התוצאה
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
              backgroundColor: 'rgba(10, 14, 10, 0.92)',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ActivityIndicator color={DesignTokens.colors.primary.main} size="large" />
              <Text style={{
                color: DesignTokens.colors.text.primary,
                fontSize: 16,
                marginTop: 16,
                writingDirection: 'rtl'
              }}>
                טוען דף תשלום...
              </Text>
            </View>
          )}
        />
        </SafeAreaView>
      </View>
    );
  }

  // אם זה רישום - מציג מסך טעינה או WebView
  if (fromRegistration && (loading || showIframe)) {
    // WebView כש־showIframe מוצג מטופל בבלוק `if (showIframe)` למעלה (לפני הבלוק הזה ברינדור הבא)

    // מסך טעינה לרישום לפני שמופיע ה־iframe
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <View style={{ 
          flex: 1, 
          alignItems: 'center', 
          justifyContent: 'center',
          paddingHorizontal: 24
        }}>
          <ActivityIndicator color={DesignTokens.colors.primary.main} size="large" />
          <Text style={{
            color: DesignTokens.colors.text.primary,
            fontSize: 18,
            marginTop: 24,
            textAlign: 'center',
            writingDirection: 'rtl'
          }}>
            מכין את דף התשלום המאובטח...
          </Text>
          <Text style={{
            color: DesignTokens.colors.text.secondary,
            fontSize: 14,
            marginTop: 12,
            textAlign: 'center',
            writingDirection: 'rtl'
          }}>
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        <ChatSubScreenHeader title="פרטי התשלום" onBack={() => navigation.goBack()} />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: DesignTokens.spacing.lg, paddingTop: DesignTokens.spacing.lg }}>
          {/* Plan Card */}
          {renderPlanCard()}

          {/* Personal Details Section */}
          <UICard
            variant="inputGlass"
            padding="lg"
            style={{
              marginBottom: DesignTokens.spacing.lg,
              borderRadius: DesignTokens.borderRadius.lg,
            }}
          >
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              marginBottom: 20
            }}>
              <User size={20} color={DesignTokens.colors.primary.main} style={{ marginLeft: 8 }} />
              <Text style={{ 
                color: DesignTokens.colors.text.primary, 
                fontSize: 18, 
                fontWeight: '600',
                writingDirection: 'rtl'
              }}>
                פרטים אישיים
              </Text>
            </View>

            {/* Cardholder Name */}
            {renderInputField(
              'שם מלא',
              cardholderName,
              setCardholderName,
              'שם מלא',
              'default',
              undefined,
              <User size={16} color={DesignTokens.colors.text.tertiary} />
            )}

            {/* Email */}
            {renderInputField(
              'כתובת אימייל',
              email,
              setEmail,
              'example@email.com',
              'email-address'
            )}

            {/* Phone */}
            {renderInputField(
              'מספר טלפון',
              phone,
              setPhone,
              '050-1234567',
              'phone-pad'
            )}
          </UICard>

          {/* Security Notice */}
          <UICard
            variant="inputGlass"
            padding="md"
            style={{
              marginBottom: DesignTokens.spacing.lg,
              borderRadius: DesignTokens.borderRadius.lg,
            }}
          >
          <View style={{
            backgroundColor: 'rgba(0, 230, 84, 0.08)',
            borderRadius: DesignTokens.borderRadius.md,
            padding: DesignTokens.spacing.md,
          }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              marginBottom: 8
            }}>
              <Shield size={16} color={DesignTokens.colors.primary.main} style={{ marginLeft: 8 }} />
              <Text style={{ 
                color: DesignTokens.colors.primary.main, 
                fontSize: 14, 
                fontWeight: '600',
                writingDirection: 'rtl'
              }}>
                תשלום מאובטח עם CardCom
              </Text>
            </View>
            <Text style={{ 
              color: DesignTokens.colors.text.secondary, 
              fontSize: 12,
              lineHeight: 18,
              writingDirection: 'rtl'
            }}>
              תועבר לדף תשלום מאובטח של CardCom למילוי פרטי כרטיס האשראי. כל הפרטים מוצפנים עם SSL 256-bit והמערכת עומדת בתקן PCI DSS.
            </Text>
          </View>
          </UICard>

          {/* Payment Summary */}
          <UICard
            variant="inputGlass"
            padding="lg"
            style={{
              marginBottom: DesignTokens.spacing.lg,
              borderRadius: DesignTokens.borderRadius.lg,
            }}
          >
            <Text style={{ 
              color: DesignTokens.colors.text.primary, 
              fontSize: 18, 
              fontWeight: '600', 
              marginBottom: 16,
              writingDirection: 'rtl'
            }}>
              סיכום התשלום
            </Text>
            
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between',
              marginBottom: 8
            }}>
              <Text style={{ 
                color: DesignTokens.colors.text.secondary, 
                fontSize: 14,
                writingDirection: 'rtl'
              }}>
                {plan?.name}
              </Text>
              <Text style={{ 
                color: DesignTokens.colors.text.primary, 
                fontSize: 14,
                fontWeight: '600'
              }}>
                {plan?.price === 0 ? 'חינם' : `₪${plan?.price}`}
              </Text>
            </View>
            
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between',
              marginBottom: 8
            }}>
              <Text style={{ 
                color: DesignTokens.colors.text.secondary, 
                fontSize: 14,
                writingDirection: 'rtl'
              }}>
                מע"מ
              </Text>
              <Text style={{ 
                color: DesignTokens.colors.text.primary, 
                fontSize: 14,
                fontWeight: '600'
              }}>
                {plan?.price === 0 ? '₪0' : `₪${Math.round((plan?.price || 0) * 0.17)}`}
              </Text>
            </View>
            
            <View style={{ 
              height: 1, 
              backgroundColor: DesignTokens.colors.background.elevated, 
              marginVertical: 12 
            }} />
            
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between'
            }}>
              <Text style={{ 
                color: DesignTokens.colors.text.primary, 
                fontSize: 18,
                fontWeight: '700',
                writingDirection: 'rtl'
              }}>
                סה"כ
              </Text>
              <Text style={{ 
                color: DesignTokens.colors.primary.main, 
                fontSize: 18,
                fontWeight: '700'
              }}>
                {plan?.price === 0 ? 'חינם' : `₪${Math.round((plan?.price || 0) * 1.17)}`}
              </Text>
            </View>
          </UICard>

          {/* Payment Button */}
          <TouchableOpacity
            onPress={handlePayment}
            disabled={loading}
            style={{
              opacity: loading ? 0.7 : 1,
              backgroundColor: DesignTokens.colors.primary.main,
              borderRadius: DesignTokens.borderRadius.lg,
              padding: 18,
              alignItems: 'center',
              shadowColor: DesignTokens.colors.primary.main,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
              {loading ? (
                <ActivityIndicator color={DesignTokens.colors.text.inverse} size="small" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Shield size={20} color={DesignTokens.colors.text.inverse} style={{ marginLeft: 8 }} />
                  <Text style={{
                    color: DesignTokens.colors.text.inverse,
                    fontSize: 18,
                    fontWeight: '700',
                    writingDirection: 'rtl',
                  }}>
                    המשך לתשלום מאובטח
                  </Text>
                </View>
              )}
          </TouchableOpacity>

          {/* Terms */}
          <Text style={{ 
            color: DesignTokens.colors.text.tertiary, 
            fontSize: 12, 
            textAlign: 'center',
            marginTop: 16,
            lineHeight: 18,
            writingDirection: 'rtl'
          }}>
            בלחיצה על "המשך לתשלום מאובטח" אתה מסכים לתנאי השימוש ומדיניות הפרטיות שלנו
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
