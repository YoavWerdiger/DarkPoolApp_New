import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { AuthService } from '../../services/authService';
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

const RegistrationPhoneVerificationScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const exitRegistration = useRegistrationExitOptional();
  const tokens = useDesignTokens();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer ל-resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCountdown]);

  const lastFourDigits = (data.phone || '').replace(/[^\d]/g, '').slice(-4) || '****';

  const handleVerify = async () => {
    setError('');
    if (otp.length !== 6) {
      setError('אנא הזן קוד בן 6 ספרות');
      void HapticFeedback.error();
      return;
    }

    setLoading(true);
    try {
      const { verified, error: verifyError } = await AuthService.verifyPhoneOtp(
        data.phone,
        otp
      );

      if (verifyError) {
        if (verifyError === 'invalid_otp') {
          setError('הקוד שגוי. נסה שוב.');
        } else if (verifyError === 'expired_otp') {
          setError('הקוד פג תוקף. אנא שלח קוד חדש.');
        } else if (verifyError === 'too_many_attempts') {
          setError('יותר מדי ניסיונות. נסה שוב בעוד 5 דקות.');
        } else if (verifyError === 'network_error') {
          setError('בעיית רשת. בדוק חיבור ונסה שוב.');
        } else if (verifyError === 'invalid_phone') {
          setError('מספר הטלפון לא תקין. חזור אחורה ובדוק.');
        } else {
          setError('שגיאה באימות. נסה שוב.');
        }
        void HapticFeedback.error();
        setOtp('');
        return;
      }

      if (verified) {
        void HapticFeedback.success();
        setData({ ...data, phoneVerified: true });
        navigation.navigate('RegistrationEmail');
      } else {
        setError('האימות נכשל. נסה שוב.');
        void HapticFeedback.error();
      }
    } catch (err: any) {
      setError('שגיאה באימות. נסה שוב.');
      void HapticFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || loading) return;

    setError('');
    setLoading(true);
    setOtp('');

    try {
      const { success, error: resendError } = await AuthService.resendPhoneOtp(data.phone);
      if (resendError) {
        if (resendError === 'rate_limit') {
          setError('יותר מדי בקשות. המתן 5 דקות.');
        } else if (resendError === 'invalid_phone') {
          setError('מספר הטלפון לא תקין. חזור אחורה ובדוק.');
        } else {
          setError('שגיאה בשליחת הקוד. נסה שוב.');
        }
        void HapticFeedback.error();
      } else if (success) {
        void HapticFeedback.success();
        setResendCountdown(60);
        setCanResend(false);
        setData({ ...data, phoneOtpSentAt: Date.now() });
      }
    } catch (err: any) {
      setError('שגיאה בשליחת הקוד. נסה שוב.');
      void HapticFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  const canContinue = !loading && otp.length === 6;

  return (
    <CashAppScreen
      title="אמת את מספר הטלפון שלך"
      subtitle={`שלחנו קוד SMS ל-*****${lastFourDigits}`}
      currentStep={ONBOARDING_STEPS.phoneVerification}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="dots"
      showBack
      onBack={() => {
        void HapticFeedback.impactLight();
        safeRegistrationBack(navigation, {
          exit: exitRegistration,
          fallbackRoute: 'RegistrationPhone',
        });
      }}
      footer={
        <CashAppButton
          title="אמת והמשך"
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
        hint="הזן את הקוד בן 6 הספרות שנשלח אליך ב-SMS"
        canResend={canResend}
        countdown={resendCountdown}
        onResend={handleResend}
        disabled={loading}
      />

      <View style={{ flex: 1 }} />
    </CashAppScreen>
  );
};

export default RegistrationPhoneVerificationScreen;
