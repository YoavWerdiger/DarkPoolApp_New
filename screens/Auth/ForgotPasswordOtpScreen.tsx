import i18n from '../../lib/i18n';
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
  if (code === 'rate_limit') return i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s1');
  if (code === 'invalid_email') return i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s2');
  if (code === 'email_send_failed') return i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s3');
  if (code === 'timeout') return i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s4');
  return i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s5');
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

  /**
   * השרת אישר את הקוד אבל הלקוח החזיר שגיאה (למשל שמירת סשן נכשלה ונוסתה שוב) —
   * אם יש עכשיו סשן לאותו מייל, הקוד עבר. בלי זה המשתמש רואה «שגיאה», מנסה שוב
   * עם אותו קוד ומקבל «פג תוקף» (קוד חד-פעמי).
   */
  const hasRecoverySessionFor = async (email: string): Promise<boolean> => {
    try {
      const { data } = await supabase.auth.getSession();
      const sessionEmail = data?.session?.user?.email?.trim().toLowerCase();
      return !!sessionEmail && sessionEmail === email.trim().toLowerCase();
    } catch {
      return false;
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
      setError(i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s6'));
      void HapticFeedback.error();
      return;
    }
    if (!emailHint) {
      setError(i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s7'));
      void HapticFeedback.error();
      return;
    }

    verifyInFlight.current = true;
    setLoading(true);
    try {
      // await ל-AsyncStorage — אם יש remount אחרי OTP, INITIAL_SESSION ישחזר את הדגל
      await setPasswordRecoveryMode(true);

      const { verified, error: verifyError } = await AuthService.verifyRecoveryOtp(emailHint, otp);
      if ((verifyError || !verified) && (await hasRecoverySessionFor(emailHint))) {
        logger.warn('ForgotPasswordOtp', `verify reported "${verifyError}" but session exists — continuing`);
        void HapticFeedback.success();
        await setPasswordRecoveryMode(true);
        goToNewPassword();
        return;
      }
      if (verifyError || !verified) {
        logger.error('ForgotPasswordOtp', `verify failed: ${verifyError}`);
        // לא מנקים recovery אם כבר יש סשן (למשל ניסיון כפול אחרי הצלחה)
        await clearRecoveryIfNoSession();
        if (verifyError === 'invalid_otp') setError(i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s8'));
        else if (verifyError === 'expired_otp') setError(i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s9'));
        else if (verifyError === 'too_many_attempts') setError(i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s10'));
        else if (verifyError === 'timeout') setError(i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s11'));
        else setError(i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s12'));
        void HapticFeedback.error();
        setOtp('');
        return;
      }

      void HapticFeedback.success();
      // מחזקים את הדגל שוב לפני ניווט (מרוץ מול onAuthStateChange / SIGNED_IN)
      await setPasswordRecoveryMode(true);
      goToNewPassword();
    } catch (e) {
      logger.error('ForgotPasswordOtp', 'verify threw', e);
      if (await hasRecoverySessionFor(emailHint)) {
        await setPasswordRecoveryMode(true);
        goToNewPassword();
        return;
      }
      await clearRecoveryIfNoSession();
      setError(i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s12'));
      void HapticFeedback.error();
    } finally {
      verifyInFlight.current = false;
      setLoading(false);
    }
  };

  const canContinue = !loading && !sending && otp.length === 6;

  return (
    <OnboardingLayout
      title={i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s13')}
      subtitle={
        sending
          ? i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s14')
          : emailHint
            ? i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s15', { v0: emailHint })
            : i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s16')
      }
      density="focused"
      // גלילה כמו במסכי הרישום — מקלדת פתוחה במסך קטן לא דוחפת תוכן מתחת לכפתור
      scrollable
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
          title={i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s17')}
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
        hint={sending ? i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s18') : i18n.t('auto.screens__Auth__ForgotPasswordOtpScreen.s19')}
        canResend={canResend}
        countdown={resendCountdown}
        onResend={() => void resend()}
        sending={sending}
        disabled={loading}
      />
    </OnboardingLayout>
  );
};

export default ForgotPasswordOtpScreen;
