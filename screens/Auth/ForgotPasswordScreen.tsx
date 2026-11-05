import i18n from '../../lib/i18n';
import React, { useState } from 'react';
import OnboardingErrorBanner from '../../components/onboarding/OnboardingErrorBanner';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingInput from '../../components/onboarding/OnboardingInput';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import { HapticFeedback } from '../../utils/hapticFeedback';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordScreen = ({ navigation, route }: { navigation: any; route?: any }) => {
  const initialEmail = (route?.params?.email as string | undefined) || '';
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');

  const formatOk = EMAIL_RE.test(email.trim());
  const canContinue = formatOk;

  const handleContinue = () => {
    setError('');
    if (!formatOk) {
      setError(i18n.t('auto.screens__Auth__ForgotPasswordScreen.s1'));
      void HapticFeedback.error();
      return;
    }

    const normalized = email.trim().toLowerCase();
    void HapticFeedback.impactLight();
    // ניווט מיידי — השליחה ברשת רצה במסך ה-OTP (לא חוסמת את המעבר)
    navigation.navigate('ForgotPasswordOtp', {
      email: normalized,
      autoSend: true,
    });
  };

  return (
    <OnboardingLayout
      title={i18n.t('auto.screens__Auth__ForgotPasswordScreen.s2')}
      subtitle={i18n.t('auto.screens__Auth__ForgotPasswordScreen.s3')}
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
          title={i18n.t('auto.screens__Auth__ForgotPasswordScreen.s4')}
          onPress={handleContinue}
          disabled={!canContinue}
        />
      }
    >
      <OnboardingErrorBanner message={error} />

      <OnboardingInput
        label={i18n.t('auto.screens__Auth__ForgotPasswordScreen.s5')}
        placeholder="name@example.com"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (error) setError('');
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        isLast
        helperText={i18n.t('auto.screens__Auth__ForgotPasswordScreen.s6')}
      />
    </OnboardingLayout>
  );
};

export default ForgotPasswordScreen;
