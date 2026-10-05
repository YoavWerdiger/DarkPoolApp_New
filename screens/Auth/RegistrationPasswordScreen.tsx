import React, { useLayoutEffect, useState } from 'react';
import { checkPassword, isPasswordValid, passwordErrorMessage } from '../../utils/passwordPolicy';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { AuthService } from '../../services/authService';
import CashAppScreen from '../../components/ui/CashAppScreen';
import CashAppInput from '../../components/ui/CashAppInput';
import CashAppButton from '../../components/ui/CashAppButton';
import { PasswordStrength } from '../../components/onboarding/RegistrationLive';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import { safeRegistrationBack } from '../../hooks/useExitRegistration';

const RegistrationPasswordScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const tokens = useDesignTokens();
  const [password, setPassword] = useState(data.password || '');
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

  // מדיניות אחידה (utils/passwordPolicy): 8+ תווים, אות ומספר, לא נפוצה/האימייל
  const checks = checkPassword(password, data.email);
  const canContinue = !loading && isPasswordValid(password, data.email);

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
            setError(passwordErrorMessage(password, data.email) || 'הסיסמה חלשה מדי');
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
    <CashAppScreen
      title="צור סיסמה"
      subtitle="לפחות 8 תווים, עם אות ומספר"
      currentStep={ONBOARDING_STEPS.password}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="dots"
      scrollable
      showBack
      onBack={handleBack}
      footer={
        <CashAppButton
          title="המשך"
          variant="primary"
          size="lg"
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
            borderRadius: 12,
            padding: 16,
            marginBottom: tokens.spacing.lg,
          }}
        >
          <Ionicons name="alert-circle" size={20} color="#F85149" style={{ marginLeft: 8 }} />
          <Text
            style={{
              color: '#F85149',
              fontSize: 15,
              fontWeight: '600',
              textAlign: 'right',
              writingDirection: 'rtl',
              flex: 1,
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: tokens.spacing.lg }}>
        <CashAppInput
          label="סיסמה"
          placeholder="לפחות 8 תווים"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            if (error) setError('');
          }}
          secureTextEntry
          autoCapitalize="none"
          autoFocus
        />
        {/* שתי הדרישות בלבד + מד חוזק */}
        <PasswordStrength password={password} checks={checks} />
      </View>
    </CashAppScreen>
  );
};

export default RegistrationPasswordScreen;
