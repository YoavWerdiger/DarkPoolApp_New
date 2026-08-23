import React, { useLayoutEffect, useState } from 'react';
import { Text, View, TextInput, StyleSheet } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import { DesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import {
  safeRegistrationBack,
  useRegistrationExitOptional,
} from '../../hooks/useExitRegistration';

type Props = {
  navigation: any;
};

/**
 * מסך הזנת גיל מספרי (במקום בחירה מרשימה).
 * עיצוב: כותרת + input גדול במרכז + Continue למטה.
 */
const RegistrationAgeInputScreen = ({ navigation }: Props) => {
  const { data, setData } = useRegistration();
  const exitRegistration = useRegistrationExitOptional();
  const existingAge = data.age ? String(data.age) : '';
  const [value, setValue] = useState(existingAge);
  const [error, setError] = useState('');
  const isGoogleFlow = data.isGoogleSignUp || !!data.googleUserId;
  const [stackCanGoBack, setStackCanGoBack] = useState(() => navigation.canGoBack());

  // אחרי OTP / Google ה-App מרכיב מחדש את Onboarding עם Age כ-initial — אין היסטוריה.
  // goBack()/מחווה בלי stack קודם → GO_BACK לא מטופל וקורס.
  useLayoutEffect(() => {
    const syncBackState = () => {
      const can = navigation.canGoBack();
      setStackCanGoBack(can);
      navigation.setOptions({ gestureEnabled: can });
    };
    syncBackState();
    return navigation.addListener('state', syncBackState);
  }, [navigation]);

  const validateAge = (text: string): boolean => {
    if (!text.trim()) {
      setError('נא להזין גיל');
      return false;
    }
    const num = parseInt(text, 10);
    if (isNaN(num) || num < 16 || num > 100) {
      setError('נא להזין גיל בין 16 ל-100');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (!validateAge(value)) return;
    const age = parseInt(value, 10);
    setData({
      ...data,
      age,
      accountType: data.accountType || 'free',
    });
    navigation.navigate('RegistrationExperience');
  };

  const handleBack = () => {
    void HapticFeedback.impactLight();
    safeRegistrationBack(navigation, {
      exit: exitRegistration,
      fallbackRoute: isGoogleFlow ? undefined : 'RegistrationProfileImage',
    });
  };

  const handleChangeText = (text: string) => {
    const filtered = text.replace(/[^0-9]/g, '');
    setValue(filtered);
    if (error && filtered) {
      setError('');
    }
  };

  const canContinue = !!value.trim();
  const showBack = stackCanGoBack || !isGoogleFlow || !!exitRegistration;

  return (
    <OnboardingLayout
      title="מה הגיל שלך?"
      subtitle="עוזר לנו להתאים את החוויה"
      density="focused"
      currentStep={ONBOARDING_STEPS.age}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      showBack={showBack}
      onBack={handleBack}
      footer={
        <View>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}
          <OnboardingButton
            title="המשך"
            onPress={handleNext}
            disabled={!canContinue}
          />
        </View>
      }
    >
      <View style={styles.container}>
        <UICard variant="glass" style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={handleChangeText}
            keyboardType="number-pad"
            placeholder="28"
            placeholderTextColor="rgba(255,255,255,0.2)"
            maxLength={3}
            autoFocus
            textAlign="center"
            selectionColor={DesignTokens.colors.primary.main}
          />
        </UICard>
      </View>
      <View style={{ flex: 1 }} />
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  inputCard: {
    padding: 24,
    alignItems: 'center',
    minWidth: 200,
  },
  input: {
    fontSize: 80,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -2,
  },
  errorText: {
    color: '#F85149',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
    writingDirection: 'rtl',
  },
});

export default RegistrationAgeInputScreen;
