import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { AuthService } from '../../services/authService';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { DesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import OnboardingErrorBanner from '../../components/onboarding/OnboardingErrorBanner';
import { OtpBody } from '../../components/onboarding/OtpBody';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { logger } from '../../utils/logger';

const RESEND_COOLDOWN_SEC = 60;

function mapSendError(code: string | null | undefined): string {
  if (code === 'rate_limit') return 'יותר מדי בקשות. המתן כמה דקות.';
  if (code === 'invalid_email') return 'כתובת האימייל לא תקינה.';
  if (code === 'email_send_failed') return 'שליחת המייל נכשלה. נסה שוב.';
  if (code === 'timeout') return 'שליחת הקוד ארכה יותר מדי. נסה שוב.';
  return 'שגיאה בשליחת הקוד. נסה שוב.';
}

const ForgotPasswordOtpScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const emailHint = String(route?.params?.email || '')
    .trim()
    .toLowerCase();
  const shouldAutoSend = route?.params?.autoSend !== false;
  const { setPasswordRecoveryMode } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const sendInFlight = useRef(false);
  /** מונע אימות כפול — ניסיון שני עם אותו קוד נכשל ומנקה recovery → קופץ ל-Main */
  const verifyInFlight = useRef(false);
  const autoSentForEmail = useRef<string | null>(null);
  const navigatedAfterVerify = useRef(false);

  useEffect(() => {
    if (resendCountdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const resend = useCallback(async () => {
    if (!emailHint || sendInFlight.current) return false;
    sendInFlight.current = true;
    setSending(true);
    setError('');
    try {
      logger.debug('ForgotPasswordOtp', 'sending recovery email', { email: emailHint });
      const { success, error: sendError } = await AuthService.resetPasswordForEmail(emailHint);
      if (!success) {
        setError(mapSendError(sendError));
        void HapticFeedback.error();
        setCanResend(true);
        setResendCountdown(0);
        return false;
      }
      setResendCountdown(RESEND_COOLDOWN_SEC);
      setCanResend(false);
      void HapticFeedback.success();
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
  }, [emailHint]);

  // שליחה בכניסה למסך — המסך מוצג מיד, הרשת לא חוסמת ניווט מהמסך הקודם
  useEffect(() => {
    if (!emailHint || !shouldAutoSend) return;
    if (autoSentForEmail.current === emailHint) return;
    autoSentForEmail.current = emailHint;
    void resend();
  }, [emailHint, shouldAutoSend, resend]);

  const clearRecoveryIfNoSession = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        await setPasswordRecoveryMode(false);
      }
    } catch {
      await setPasswordRecoveryMode(false);
    }
  };

  const goToNewPassword = useCallback(() => {
    if (navigatedAfterVerify.current) return;
    navigatedAfterVerify.current = true;
    logger.debug('ForgotPasswordOtp', 'navigating to ForgotPasswordNew');
    navigation.reset({
      index: 0,
      routes: [{ name: 'ForgotPasswordNew', params: { email: emailHint } }],
    });
  }, [navigation, emailHint]);

  const handleVerify = async () => {
    if (verifyInFlight.current || loading || navigatedAfterVerify.current) return;

    setError('');
    if (otp.length !== 6) {
      setError('אנא הזן קוד בן 6 ספרות');
      void HapticFeedback.error();
      return;
    }
    if (!emailHint) {
      setError('חסרה כתובת אימייל. חזור אחורה.');
      void HapticFeedback.error();
      return;
    }

    verifyInFlight.current = true;
    setLoading(true);
    try {
      // await ל-AsyncStorage — אם יש remount אחרי OTP, INITIAL_SESSION ישחזר את הדגל
      await setPasswordRecoveryMode(true);

      const { verified, error: verifyError } = await AuthService.verifyRecoveryOtp(emailHint, otp);
      if (verifyError || !verified) {
        // לא מנקים recovery אם כבר יש סשן (למשל ניסיון כפול אחרי הצלחה)
        await clearRecoveryIfNoSession();
        if (verifyError === 'invalid_otp') setError('הקוד שגוי. נסה שוב.');
        else if (verifyError === 'expired_otp') setError('הקוד פג תוקף. שלח קוד חדש.');
        else if (verifyError === 'too_many_attempts') setError('יותר מדי ניסיונות. נסה מאוחר יותר.');
        else if (verifyError === 'timeout') setError('האימות ארך יותר מדי. בדוק חיבור ונסה שוב.');
        else setError('שגיאה באימות. נסה שוב.');
        void HapticFeedback.error();
        setOtp('');
        return;
      }

      void HapticFeedback.success();
      // מחזקים את הדגל שוב לפני ניווט (מרוץ מול onAuthStateChange / SIGNED_IN)
      await setPasswordRecoveryMode(true);
      goToNewPassword();
    } catch {
      await clearRecoveryIfNoSession();
      setError('שגיאה באימות. נסה שוב.');
      void HapticFeedback.error();
    } finally {
      verifyInFlight.current = false;
      setLoading(false);
    }
  };

  const canContinue = !loading && !sending && otp.length === 6;

  return (
    <OnboardingLayout
      title="אמת את הקוד"
      subtitle={
        sending
          ? 'שולחים קוד איפוס למייל שלך…'
          : emailHint
            ? `שלחנו קוד איפוס ל-${emailHint}`
            : 'הזן את הקוד מהמייל'
      }
      density="focused"
      showBack
      showProgress={false}
      currentStep={1}
      totalSteps={1}
      onBack={() => {
        void HapticFeedback.impactLight();
        navigation.goBack();
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
      <OtpBody
        value={otp}
        onChangeText={(text) => {
          setOtp(text);
          if (error) setError('');
        }}
        error={error}
        hint={sending ? 'שולחים את הקוד…' : 'הזן את הקוד בן 6 הספרות מהמייל'}
        canResend={canResend}
        countdown={resendCountdown}
        onResend={() => void resend()}
        sending={sending}
        disabled={loading}
      />
      <View style={{ flex: 1 }} />
    </OnboardingLayout>
  );
};

export default ForgotPasswordOtpScreen;
