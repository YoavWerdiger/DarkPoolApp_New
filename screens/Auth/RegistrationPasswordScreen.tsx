import React, { useLayoutEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { AuthService } from '../../services/authService';
import { DesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingInput from '../../components/onboarding/OnboardingInput';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import { safeRegistrationBack } from '../../hooks/useExitRegistration';

const RegistrationPasswordScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const [password, setPassword] = useState(data.password || '');
  const [confirmPassword, setConfirmPassword] = useState(data.password || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Remount אחרי OTP — Password הוא initialRoute בלי היסטוריה
  useLayoutEffect(() => {
    const syncBackState = () => {
      navigation.setOptions({ gestureEnabled: navigation.canGoBack() });
    };
    syncBackState();
    return navigation.addListener('state', syncBackState);
  }, [navigation]);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const confirmError =
    confirmPassword.length === 0
      ? undefined
      : password !== confirmPassword
        ? 'הסיסמאות אינן תואמות'
        : undefined;
  const canContinue = !loading && password.length >= 6 && passwordsMatch;

  const handleNext = async () => {
    if (!canContinue) return;
    setError('');
    setLoading(true);
    try {
      // אחרי אימות אימייל יש סשן — שומרים סיסמה לחשבון להתחברות בהמשך
      if (data.emailVerified || data.pendingAuthUserId) {
        const result = await AuthService.setPasswordForCurrentUser(password);
        if (result.error) {
          if (result.error === 'no_session') {
            setError('פג תוקף החיבור. חזור לאימות האימייל.');
          } else if (result.error === 'weak_password') {
            setError('הסיסמה חייבת להכיל לפחות 6 תווים');
          } else {
            setError(result.error);
          }
          void HapticFeedback.error();
          return;
        }
      }

      setData({ ...data, password });
      void HapticFeedback.success();
      navigation.navigate('RegistrationProfileImage');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    void HapticFeedback.impactLight();
    safeRegistrationBack(navigation, { fallbackRoute: 'RegistrationEmailVerification' });
  };

  return (
    <OnboardingLayout
      title="צור סיסמה"
      subtitle="לפחות 6 תווים — ואשר אותה למטה"
      density="focused"
      currentStep={ONBOARDING_STEPS.password}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      showBack
      onBack={handleBack}
      footer={
        <OnboardingButton
          title="המשך"
          onPress={handleNext}
          loading={loading}
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
          label="סיסמה"
          icon="lock-closed-outline"
          placeholder="לפחות 6 תווים"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            if (error) setError('');
          }}
          secureTextEntry
          autoCapitalize="none"
          autoFocus
          helperText="שמור סיסמה שקל לזכור לך וקשה לנחש"
        />
        <OnboardingInput
          label="אימות סיסמה"
          icon="lock-closed-outline"
          placeholder="הכנס שוב את הסיסמה"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          error={confirmError}
          isLast
        />
      </UICard>
      <View style={{ flex: 1 }} />
    </OnboardingLayout>
  );
};

export default RegistrationPasswordScreen;
