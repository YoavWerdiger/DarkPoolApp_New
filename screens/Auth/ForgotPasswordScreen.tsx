import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
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
      setError('הזן כתובת אימייל תקינה');
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
      title="איפוס סיסמה"
      subtitle="נשלח קוד בן 6 ספרות לאימייל שלך"
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
          title="המשך"
          onPress={handleContinue}
          disabled={!canContinue}
        />
      }
    >
      {error ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(248,81,73,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(248,81,73,0.35)',
            borderRadius: 14,
            padding: 13,
            marginBottom: 18,
          }}
        >
          <Ionicons name="alert-circle" size={18} color="#F85149" style={{ marginLeft: 8 }} />
          <Text
            style={{
              color: '#F85149',
              fontSize: 14,
              fontWeight: '500',
              textAlign: 'right',
              writingDirection: 'rtl',
              flex: 1,
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}

      <UICard
        variant="glass"
        glassIntensity="light"
        padding="md"
        style={{ borderRadius: DesignTokens.borderRadius.xl }}
      >
        <OnboardingInput
          label="אימייל"
          icon="mail-outline"
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
          helperText="אם קיים חשבון עם המייל הזה — יישלח אליו קוד"
        />
      </UICard>
      <View style={{ flex: 1 }} />
    </OnboardingLayout>
  );
};

export default ForgotPasswordScreen;
