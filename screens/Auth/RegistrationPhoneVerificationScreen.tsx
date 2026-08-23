import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
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

const RegistrationPhoneVerificationScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const exitRegistration = useRegistrationExitOptional();
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
    <OnboardingLayout
      title="אמת את מספר הטלפון שלך"
      subtitle={`שלחנו קוד SMS ל-*****${lastFourDigits}`}
      density="focused"
      currentStep={ONBOARDING_STEPS.phoneVerification}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      showBack
      onBack={() => {
        void HapticFeedback.impactLight();
        safeRegistrationBack(navigation, {
          exit: exitRegistration,
          fallbackRoute: 'RegistrationPhone',
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
          הזן את הקוד בן 6 הספרות
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

        {/* כפתור "שלח שוב" */}
        <Pressable
          onPress={handleResend}
          disabled={!canResend || loading}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: DesignTokens.borderRadius.md,
            backgroundColor: canResend
              ? 'rgba(0,200,5,0.12)'
              : 'rgba(255,255,255,0.05)',
            opacity: canResend ? 1 : 0.5,
          }}
        >
          <Text
            style={{
              color: canResend ? DesignTokens.colors.primary.main : DesignTokens.colors.text.tertiary,
              fontSize: 15,
              fontWeight: '600',
              textAlign: 'center',
              writingDirection: 'rtl',
            }}
          >
            {canResend ? 'שלח קוד שוב' : `שלח שוב בעוד ${resendCountdown} שניות`}
          </Text>
        </Pressable>
      </UICard>

      <View style={{ flex: 1 }} />
    </OnboardingLayout>
  );
};

export default RegistrationPhoneVerificationScreen;
