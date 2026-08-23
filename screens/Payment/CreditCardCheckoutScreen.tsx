import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, RefreshCw } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { BUYER_PAYMENT_ERROR_HE, paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { AuthService } from '../../services/authService';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { appQueryKeys } from '../../lib/appQueryKeys';

/**
 * reCAPTCHA / "אני לא רובוט" נשבר ב-RN WebView כשה-UA כולל `; wv`
 * (ברירת מחדל באנדרואיד) או כשעוגיות צד-ג' חסומות.
 * UA דפדפן רגיל + shared/thirdParty cookies מאפשרים ל-google.com/recaptcha לעבוד.
 */
const CARDCOM_WEBVIEW_USER_AGENT = Platform.select({
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  default:
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
});

function parseSmartActionOutcome(url: string): { isSuccess: boolean; transactionId: string } | null {
  try {
    if (!/smart-action/i.test(url)) return null;
    const u = new URL(url);
    const dp = u.searchParams.get('dp');
    const responseCode =
      u.searchParams.get('ResponseCode') ?? u.searchParams.get('responsecode') ?? '';
    const transactionId =
      u.searchParams.get('TranzactionId') ??
      u.searchParams.get('TransactionId') ??
      u.searchParams.get('ReturnValue') ??
      '';
    const isSuccess =
      dp === 'ok' || (dp !== 'fail' && (responseCode === '0' || responseCode === ''));
    return { isSuccess, transactionId };
  } catch {
    return null;
  }
}

interface CreditCardCheckoutScreenProps {
  navigation: any;
  route: {
    params: {
      planId: string;
      fromRegistration?: boolean;
    };
  };
}

type CheckoutPhase = 'preparing' | 'webview' | 'error' | 'completing';
type WebSource = { uri: string } | { html: string; baseUrl?: string };

/**
 * מעטפת תשלום CardCom — בלי טופס פרטים אישיים.
 * הפרטים מגיעים מ-RegistrationContext (רישום) או מפרופיל המשתמש (מנוי קיים).
 */
export default function CreditCardCheckoutScreen({ navigation, route }: CreditCardCheckoutScreenProps) {
  const tokens = useDesignTokens();
  const { colors } = tokens;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: registrationData, setData: setRegistrationData } = useRegistration();
  const { planId, fromRegistration = false } = route.params;

  const selectedPlan = planId || 'monthly';
  const plan = SUBSCRIPTION_PLANS[selectedPlan as keyof typeof SUBSCRIPTION_PLANS];

  const [phase, setPhase] = useState<CheckoutPhase>('preparing');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [webSource, setWebSource] = useState<WebSource | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const startingRef = useRef(false);
  const startedOnceRef = useRef(false);
  const paymentOutcomeHandledRef = useRef(false);

  const resolveBuyerDetails = useCallback(() => {
    if (fromRegistration) {
      return {
        email: (registrationData.email || '').trim(),
        name: (registrationData.fullName || '').trim(),
        phone: (registrationData.phone || '').trim(),
      };
    }
    return {
      email: (user?.email || '').trim(),
      name: (user?.display_name || user?.full_name || '').trim(),
      phone: (user?.phone || '').trim(),
    };
  }, [fromRegistration, registrationData, user]);

  /** יוצר Auth user לפני Cardcom כדי ש-webhook יקבל userId אמיתי */
  const resolveCheckoutUserId = async (): Promise<string> => {
    if (!fromRegistration) {
      if (!user?.id) throw new Error('נדרש להתחבר למערכת');
      return user.id;
    }

    const existingId =
      registrationData.pendingAuthUserId ||
      registrationData.googleUserId ||
      user?.id ||
      null;

    if (existingId) {
      if (!registrationData.pendingAuthUserId) {
        setRegistrationData((prev) => ({ ...prev, pendingAuthUserId: existingId }));
      }
      return existingId;
    }

    if (!registrationData.email || !registrationData.password || !registrationData.fullName) {
      throw new Error('חסרים פרטי הרשמה לפני תשלום');
    }

    const { userId, error } = await AuthService.ensurePendingAuthUser({
      email: registrationData.email,
      password: registrationData.password,
      fullName: registrationData.fullName,
      phone: registrationData.phone,
      profileImage: registrationData.profileImage,
      accountType: selectedPlan,
      trackId: registrationData.trackId || '1',
    });

    if (error || !userId) {
      throw new Error(error || 'שגיאה ביצירת חשבון לפני תשלום');
    }

    setRegistrationData((prev) => ({
      ...prev,
      pendingAuthUserId: userId,
      accountType: selectedPlan,
    }));

    return userId;
  };

  const startCheckout = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setPhase('preparing');
    setErrorMessage('');
    setPaymentUrl('');
    setWebSource(null);
    paymentOutcomeHandledRef.current = false;

    try {
      if (!plan) {
        throw new Error('תוכנית מנוי לא נמצאה');
      }

      const buyer = resolveBuyerDetails();
      if (!buyer.email || !buyer.name) {
        throw new Error(
          fromRegistration
            ? 'חסרים שם או אימייל מההרשמה. חזרו לשלב הפרטים האישיים.'
            : 'חסרים פרטי פרופיל (שם / אימייל). עדכנו בפרופיל ונסו שוב.'
        );
      }

      if (fromRegistration) {
        const canPay =
          registrationData.password ||
          registrationData.isGoogleSignUp ||
          registrationData.pendingAuthUserId ||
          registrationData.googleUserId ||
          user?.id;
        if (!canPay) {
          throw new Error('חסרים פרטי התחברות לפני תשלום');
        }
      } else if (!user?.id) {
        throw new Error('נדרש להתחבר למערכת');
      }

      const checkoutUserId = await resolveCheckoutUserId();

      const paymentResponse = await paymentService.createPaymentRequest({
        amount: plan.price,
        currency: 'ILS',
        description: `מנוי ${plan.name} - ${buyer.name}`,
        userId: checkoutUserId,
        planId: selectedPlan,
        userEmail: buyer.email,
        userName: buyer.name,
        userPhone: buyer.phone || undefined,
        isRecurring: plan.period !== 'one_time',
      });

      if (paymentResponse.success && paymentResponse.paymentUrl) {
        setPaymentUrl(paymentResponse.paymentUrl);
        setWebSource({ uri: paymentResponse.paymentUrl });
        setPhase('webview');
      } else {
        // אל תציג Description של CardCom לקונה
        throw new Error(paymentResponse.error || BUYER_PAYMENT_ERROR_HE);
      }
    } catch (error) {
      void HapticFeedback.error();
      const raw = error instanceof Error ? error.message : BUYER_PAYMENT_ERROR_HE;
      // הגנה: אם דלפה הודעת ספק (למשל "חברה חסומה") — מציגים הודעה כללית
      const looksLikeProviderBlock =
        /חסומ|cardcom|terminal|api|blocked|ResponseCode/i.test(raw);
      setErrorMessage(looksLikeProviderBlock ? BUYER_PAYMENT_ERROR_HE : raw);
      setPhase('error');
    } finally {
      startingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveCheckoutUserId closes over latest registration/user
  }, [
    plan,
    selectedPlan,
    fromRegistration,
    registrationData,
    user,
    resolveBuyerDetails,
  ]);

  useEffect(() => {
    if (startedOnceRef.current) return;
    startedOnceRef.current = true;
    void startCheckout();
  }, [startCheckout]);

  const handlePaymentOutcome = useCallback(
    (type: 'payment_success' | 'payment_failed' | 'payment_cancelled', message?: string) => {
      if (type === 'payment_cancelled') {
        navigation.goBack();
        return;
      }
      if (paymentOutcomeHandledRef.current) return;
      paymentOutcomeHandledRef.current = true;

      // סגירת WebView מיד — בלי דף HTML מכוער
      setWebSource(null);
      setPaymentUrl('');

      if (type === 'payment_success') {
        setPhase('completing');
        void HapticFeedback.success();
        if (user?.id) {
          void queryClient.invalidateQueries({
            queryKey: appQueryKeys.userSubscription(user.id),
          });
        }

        if (fromRegistration) {
          setRegistrationData((prev) => ({
            ...prev,
            accountType: selectedPlan,
          }));
          navigation.replace('RegistrationSummary');
          return;
        }

        navigation.replace('SubscriptionWelcome', {
          planId: selectedPlan,
          planName: plan?.name,
        });
        return;
      }

      void HapticFeedback.error();
      setPhase('error');
      setErrorMessage(message || 'התשלום נכשל או בוטל. אפשר לנסות שוב.');
      paymentOutcomeHandledRef.current = false;
    },
    [
      fromRegistration,
      navigation,
      plan?.name,
      queryClient,
      selectedPlan,
      setRegistrationData,
      user?.id,
    ]
  );

  /** תופס redirect להצלחה/כישלון — לא טוען את HTML של smart-action */
  const interceptRedirectUrl = useCallback(
    (url: string): boolean => {
      if (!url) return false;

      if (url.startsWith('darkpoolapp://payment/success')) {
        handlePaymentOutcome('payment_success');
        return true;
      }
      if (url.startsWith('darkpoolapp://payment/error')) {
        handlePaymentOutcome('payment_failed');
        return true;
      }

      const outcome = parseSmartActionOutcome(url);
      if (outcome) {
        handlePaymentOutcome(
          outcome.isSuccess ? 'payment_success' : 'payment_failed'
        );
        return true;
      }

      return false;
    },
    [handlePaymentOutcome]
  );

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (
        data.type === 'payment_success' ||
        data.type === 'payment_failed' ||
        data.type === 'payment_cancelled'
      ) {
        handlePaymentOutcome(data.type, data.message);
      }
    } catch {
      // הודעות לא-JSON מ-WebView — מתעלמים
    }
  };

  if (phase === 'webview' && webSource) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
          <ChatSubScreenHeader title="השלמת תשלום" onBack={() => navigation.goBack()} />
          <WebView
            source={webSource}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            onMessage={handleWebViewMessage}
            onNavigationStateChange={(navState) => {
              interceptRedirectUrl(navState.url || '');
            }}
            // reCAPTCHA needs JS, storage, 3rd-party cookies, and non-WebView UA
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            originWhitelist={['*']}
            mixedContentMode="always"
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            userAgent={CARDCOM_WEBVIEW_USER_AGENT}
            onShouldStartLoadWithRequest={(req: ShouldStartLoadRequest) => {
              const url = req.url || '';

              if (interceptRedirectUrl(url)) {
                return false;
              }

              if (
                url.startsWith('about:') ||
                url.startsWith('data:') ||
                url.startsWith('blob:')
              ) {
                return true;
              }
              if (!/^https?:\/\//i.test(url)) {
                return false;
              }
              return true;
            }}
            startInLoadingState
            renderLoading={() => (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: colors.background.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator color={colors.primary.main} size="large" />
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: 16,
                    marginTop: 16,
                    writingDirection: 'rtl',
                  }}
                >
                  טוען דף תשלום...
                </Text>
              </View>
            )}
          />
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'error') {
    const leaveCheckout = () => {
      if (fromRegistration) {
        navigation.goBack();
        return;
      }
      navigation.reset({
        index: 1,
        routes: [{ name: 'ProfileMain' }, { name: 'Billing' }],
      });
    };

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <ChatSubScreenHeader title="תשלום" onBack={leaveCheckout} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
          }}
        >
          <Text
            style={{
              color: colors.text.primary,
              fontSize: 18,
              fontWeight: '700',
              textAlign: 'center',
              writingDirection: 'rtl',
              marginBottom: 12,
            }}
          >
            {errorMessage.includes('נכשל') || errorMessage.includes('בוטל')
              ? 'התשלום לא הושלם'
              : 'לא הצלחנו לפתוח את דף התשלום'}
          </Text>
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: 14,
              textAlign: 'center',
              writingDirection: 'rtl',
              lineHeight: 22,
              marginBottom: 28,
            }}
          >
            {errorMessage || BUYER_PAYMENT_ERROR_HE}
          </Text>
          <TouchableOpacity
            onPress={() => {
              void HapticFeedback.medium();
              startedOnceRef.current = false;
              void startCheckout();
            }}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              backgroundColor: colors.primary.main,
              paddingHorizontal: 22,
              paddingVertical: 14,
              borderRadius: 28,
              marginBottom: 14,
            }}
          >
            <RefreshCw size={18} color="#000" style={{ marginLeft: 8 }} />
            <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>נסה שוב</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={leaveCheckout} activeOpacity={0.75}>
            <Text style={{ color: colors.text.tertiary, fontSize: 14 }}>
              {fromRegistration ? 'חזרה' : 'חזרה למנוי שלי'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isCompleting = phase === 'completing';

  // preparing / completing (מעבר קצר לפני Welcome)
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
      <ChatSubScreenHeader
        title={isCompleting ? 'תשלום הושלם' : 'תשלום מאובטח'}
        onBack={isCompleting ? () => undefined : () => navigation.goBack()}
      />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.primary.dim,
            borderWidth: 1,
            borderColor: colors.primary.subtle,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <Lock size={28} color={colors.primary.main} />
        </View>
        <ActivityIndicator color={colors.primary.main} size="large" />
        <Text
          style={{
            color: colors.text.primary,
            fontSize: 18,
            fontWeight: '700',
            marginTop: 24,
            textAlign: 'center',
            writingDirection: 'rtl',
          }}
        >
          {isCompleting ? 'מפעיל את המנוי...' : 'מכין את דף התשלום המאובטח...'}
        </Text>
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: 14,
            marginTop: 10,
            textAlign: 'center',
            writingDirection: 'rtl',
            lineHeight: 20,
          }}
        >
          {isCompleting
            ? 'רגע אחד — מעבירים למסך הברכה'
            : fromRegistration
              ? 'יוצר חשבון ומעביר לדף תשלום מאובטח של CardCom'
              : 'מעביר לדף תשלום מאובטח של CardCom'}
        </Text>
      </View>
    </SafeAreaView>
  );
}
