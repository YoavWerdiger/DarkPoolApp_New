import i18n from '../../lib/i18n';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { AuthService } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { logger } from '../../utils/logger';
import CashAppScreen from '../../components/ui/CashAppScreen';
import CashAppButton from '../../components/ui/CashAppButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { OtpBody } from '../../components/onboarding/OtpBody';
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
  if (code === 'rate_limit') return i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s1');
  if (code === 'invalid_email') return i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s2');
  if (code === 'email_send_failed') {
    return i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s3');
  }
  return i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s4');
}

const RegistrationEmailVerificationScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const exitRegistration = useRegistrationExitOptional();
  const tokens = useDesignTokens();
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
        setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s5'));
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
      setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s5'));
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

  const currentSessionUserFor = async (email: string): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData?.session?.user;
      const e = u?.email?.trim().toLowerCase();
      return u && e && e === (email || '').trim().toLowerCase() ? u.id : null;
    } catch {
      return null;
    }
  };

  const handleVerify = async () => {
    setError('');
    if (otp.length !== 6) {
      setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s6'));
      void HapticFeedback.error();
      return;
    }

    setLoading(true);
    try {
      let { verified, userId, error: verifyError } = await AuthService.verifyEmailOtp(
        emailHint,
        otp
      );

      // השרת אישר את הקוד אבל הלקוח החזיר שגיאה (למשל שמירת סשן נכשלה ב-Android) —
      // אם יש עכשיו סשן לאותו מייל, הקוד עבר. אחרת ניסיון חוזר עם אותו קוד = «פג תוקף».
      if (verifyError || !verified || !userId) {
        const sessionUser = await currentSessionUserFor(emailHint);
        if (sessionUser) {
          logger.warn('RegistrationEmailVerification', `verify reported "${verifyError}" but session exists — continuing`);
          verified = true;
          userId = sessionUser;
          verifyError = null;
        } else if (verifyError) {
          logger.error('RegistrationEmailVerification', `verify failed: ${verifyError}`);
        }
      }

      if (verifyError) {
        if (verifyError === 'invalid_otp') {
          setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s7'));
        } else if (verifyError === 'expired_otp') {
          setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s8'));
        } else if (verifyError === 'too_many_attempts') {
          setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s9'));
        } else if (verifyError === 'network_error') {
          setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s10'));
        } else if (verifyError === 'invalid_email') {
          setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s2'));
        } else {
          setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s11'));
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
        setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s12'));
        void HapticFeedback.error();
      }
    } catch {
      setError(i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s11'));
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
    <CashAppScreen
      title={i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s13')}
      subtitle={
        emailHint
          ? sending
            ? i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s14', { v0: emailHint })
            : i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s15', { v0: emailHint })
          : i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s16')
      }
      currentStep={ONBOARDING_STEPS.emailVerification}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="dots"
      showBack
      onBack={() => {
        void HapticFeedback.impactLight();
        safeRegistrationBack(navigation, {
          exit: exitRegistration,
          fallbackRoute: 'RegistrationEmail',
        });
      }}
      footer={
        <CashAppButton
          title={i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s17')}
          variant="primary"
          size="lg"
          onPress={handleVerify}
          loading={loading}
          disabled={!canContinue}
        />
      }
    >
      <OtpBody
        value={otp}
        onChangeText={(text) => {
          setOtp(text);
          if (error) setError('');
        }}
        error={error}
        hint={sending ? i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s18') : i18n.t('auto.screens__Auth__RegistrationEmailVerificationScreen.s19')}
        canResend={canResend}
        countdown={resendCountdown}
        onResend={handleResend}
        sending={sending}
        disabled={loading}
      />

      <View style={{ flex: 1 }} />
    </CashAppScreen>
  );
};

export default RegistrationEmailVerificationScreen;
