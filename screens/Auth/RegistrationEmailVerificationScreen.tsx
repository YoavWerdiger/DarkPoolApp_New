import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { AuthService } from '../../services/authService';
import { DesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import OnboardingErrorBanner from '../../components/onboarding/OnboardingErrorBanner';
import OtpInput from '../../components/onboarding/OtpInput';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import {
  safeRegistrationBack,
  useRegistrationExitOptional,
} from '../../hooks/useExitRegistration';

const RESEND_COOLDOWN_SEC = 60;
/** לא שולחים מחדש אוטומטית אם כבר נשלח לאחרונה (חזרה אחורה וכו') */
const RECENT_SEND_MS = 50_000;

function mapSendError(code: string | null | undefined): string {
  if (code === 'rate_limit') return 'יותר מדי בקשות. המתן כמה דקות.';
  if (code === 'invalid_email') return 'כתובת האימייל לא תקינה. חזור אחורה ובדוק.';
  if (code === 'email_send_failed') {
    return 'שליחת המייל נכשלה (SMTP/Resend). ודאו שדומיין השולח מאומת ב-Resend, או נסו שוב.';
  }
  return 'שגיאה בשליחת הקוד. נסה שוב.';
}

const RegistrationEmailVerificationScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const exitRegistration = useRegistrationExitOptional();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const sendInFlight = useRef(false);
  const autoSentForEmail = useRef<string | null>(null);

  const emailHint = (data.email || '').trim().toLowerCase();

  const startCooldown = useCallback((seconds = RESEND_COOLDOWN_SEC) => {
    setResendCountdown(seconds);
    setCanResend(false);
  }, []);

  const sendOtp = useCallback(
    async (opts?: { isResend?: boolean }) => {
      if (!emailHint) {
        setError('חסרה כתובת אימייל. חזור אחורה והזן אותה שוב.');
        return false;
      }
      if (sendInFlight.current) return false;
      sendInFlight.current = true;
      setSending(true);
      setError('');
      try {
        const { success, error: sendError } = opts?.isResend
          ? await AuthService.resendEmailOtp(emailHint)
          : await AuthService.sendEmailOtp(emailHint);

        if (sendError || !success) {
          setError(mapSendError(sendError));
          void HapticFeedback.error();
          setCanResend(true);
          setResendCountdown(0);
          return false;
        }

        setData((prev) => ({ ...prev, emailOtpSentAt: Date.now(), email: emailHint }));
        startCooldown();
        if (opts?.isResend) void HapticFeedback.success();
        return true;
      } catch {
        setError(mapSendError('email_send_failed'));
        void HapticFeedback.error();
        setCanResend(true);
        setResendCountdown(0);
        return false;
      } finally {
        sendInFlight.current = false;
        setSending(false);
      }
    },
    [emailHint, setData, startCooldown]
  );

  // שליחה אוטומטית בכניסה למסך (או כשחסרה שליחה עדכנית לאותו מייל)
  useEffect(() => {
    if (!emailHint) {
      setError('חסרה כתובת אימייל. חזור אחורה והזן אותה שוב.');
      return;
    }

    const recentlySent =
      data.email?.toLowerCase() === emailHint &&
      !!data.emailOtpSentAt &&
      Date.now() - data.emailOtpSentAt < RECENT_SEND_MS;

    if (recentlySent) {
      const remaining = Math.max(
        1,
        Math.ceil((RECENT_SEND_MS - (Date.now() - (data.emailOtpSentAt || 0))) / 1000)
      );
      startCooldown(Math.min(RESEND_COOLDOWN_SEC, remaining));
      autoSentForEmail.current = emailHint;
      return;
    }

    if (autoSentForEmail.current === emailHint) return;
    autoSentForEmail.current = emailHint;
    void sendOtp();
  }, [emailHint, data.email, data.emailOtpSentAt, sendOtp, startCooldown]);

  useEffect(() => {
    if (resendCountdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleVerify = async () => {
    setError('');
    if (otp.length !== 6) {
      setError('אנא הזן קוד בן 6 ספרות');
      void HapticFeedback.error();
      return;
    }

    setLoading(true);
    try {
      const { verified, userId, error: verifyError } = await AuthService.verifyEmailOtp(
        emailHint,
        otp
      );

      if (verifyError) {
        if (verifyError === 'invalid_otp') {
          setError('הקוד שגוי. נסה שוב.');
        } else if (verifyError === 'expired_otp') {
          setError('הקוד פג תוקף. אנא שלח קוד חדש.');
        } else if (verifyError === 'too_many_attempts') {
          setError('יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.');
        } else if (verifyError === 'network_error') {
          setError('בעיית רשת. בדוק חיבור ונסה שוב.');
        } else if (verifyError === 'invalid_email') {
          setError('כתובת האימייל לא תקינה. חזור אחורה ובדוק.');
        } else {
          setError('שגיאה באימות. נסה שוב.');
        }
        void HapticFeedback.error();
        setOtp('');
        return;
      }

      if (verified && userId) {
        // לפני ש-AuthContext מעדכן user ומרנדר מחדש את עץ הניווט —
        // מסמנים בקונטקסט כדי ש-Onboarding יפתח בסיסמה ולא בהתחלה.
        setData((prev) => ({
          ...prev,
          emailVerified: true,
          pendingAuthUserId: userId,
          email: (prev.email || emailHint || '').trim().toLowerCase(),
        }));

        try {
          await AuthService.updateProfile({
            id: userId,
            full_name: data.fullName || undefined,
            display_name: data.fullName || undefined,
            phone: data.phone || undefined,
            registration_completed: false,
          });
        } catch {
          // לא חוסם — הסיכום ישלים
        }

        void HapticFeedback.success();
        navigation.navigate('RegistrationPassword');
      } else {
        setError('האימות נכשל. נסה שוב.');
        void HapticFeedback.error();
      }
    } catch {
      setError('שגיאה באימות. נסה שוב.');
      void HapticFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || loading || sending) return;
    setOtp('');
    await sendOtp({ isResend: true });
  };

  const canContinue = !loading && !sending && otp.length === 6;

  return (
    <OnboardingLayout
      title="אמת את האימייל שלך"
      subtitle={
        emailHint
          ? sending
            ? `שולחים קוד ל-${emailHint}...`
            : `שלחנו קוד ל-${emailHint}`
          : 'שלחנו קוד לאימייל שהזנת'
      }
      density="focused"
      currentStep={ONBOARDING_STEPS.emailVerification}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      showBack
      onBack={() => {
        void HapticFeedback.impactLight();
        safeRegistrationBack(navigation, {
          exit: exitRegistration,
          fallbackRoute: 'RegistrationEmail',
        });
      }}
      footer={
        <OnboardingButton
          title="אמת והמשך"
          onPress={handleVerify}
          loading={loading}
          disabled={!canContinue}
        />
      }
    >
      {sending ? (
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <ActivityIndicator color={DesignTokens.colors.primary.main} />
          <Text
            style={{
              color: DesignTokens.colors.text.secondary,
              fontSize: 14,
              marginTop: 10,
              writingDirection: 'rtl',
            }}
          >
            שולחים קוד אימות...
          </Text>
        </View>
      ) : null}

      {error ? <OnboardingErrorBanner message={error} /> : null}

      <UICard
        variant="glass"
        glassIntensity="light"
        padding="lg"
        style={{ borderRadius: DesignTokens.borderRadius.xl, alignItems: 'center' }}
      >
        <Text
          style={{
            color: DesignTokens.colors.text.secondary,
            fontSize: 15,
            fontWeight: '500',
            textAlign: 'center',
            marginBottom: 24,
            writingDirection: 'rtl',
          }}
        >
          הזן את הקוד בן 6 הספרות מהמייל
        </Text>

        <OtpInput
          value={otp}
          onChangeText={(text) => {
            setOtp(text);
            if (error) setError('');
          }}
          autoFocus
          error={!!error}
        />

        <View style={{ height: 32 }} />

        <Pressable
          onPress={handleResend}
          disabled={!canResend || loading || sending}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: DesignTokens.borderRadius.md,
            backgroundColor: canResend && !sending
              ? 'rgba(0,200,5,0.12)'
              : 'rgba(255,255,255,0.05)',
            opacity: canResend && !sending ? 1 : 0.5,
          }}
        >
          <Text
            style={{
              color:
                canResend && !sending
                  ? DesignTokens.colors.primary.main
                  : DesignTokens.colors.text.tertiary,
              fontSize: 15,
              fontWeight: '600',
              textAlign: 'center',
              writingDirection: 'rtl',
            }}
          >
            {sending
              ? 'שולחים...'
              : canResend
              ? 'שלח קוד שוב'
              : `שלח שוב בעוד ${resendCountdown} שניות`}
          </Text>
        </Pressable>
      </UICard>

      <View style={{ flex: 1 }} />
    </OnboardingLayout>
  );
};

export default RegistrationEmailVerificationScreen;
