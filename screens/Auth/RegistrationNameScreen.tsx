import React, { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { DesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingInput from '../../components/onboarding/OnboardingInput';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import {
  safeRegistrationBack,
  useRegistrationExitOptional,
} from '../../hooks/useExitRegistration';

const RegistrationNameScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const exitRegistration = useRegistrationExitOptional();
  const [name, setName] = useState(data.fullName || '');
  const [stackCanGoBack, setStackCanGoBack] = useState(() => navigation.canGoBack());
  const canContinue = name.trim().length >= 2;

  useLayoutEffect(() => {
    const sync = () => {
      const can = navigation.canGoBack();
      setStackCanGoBack(can);
      navigation.setOptions({ gestureEnabled: can });
    };
    sync();
    return navigation.addListener('state', sync);
  }, [navigation]);

  const handleNext = () => {
    if (!canContinue) return;
    setData({ ...data, fullName: name.trim() });
    navigation.navigate('RegistrationPhone');
  };

  const handleBack = () => {
    void HapticFeedback.impactLight();
    safeRegistrationBack(navigation, { exit: exitRegistration });
  };

  return (
    <OnboardingLayout
      title="איך קוראים לך?"
      subtitle="השם יופיע בפרופיל ובקהילה"
      density="focused"
      currentStep={ONBOARDING_STEPS.name}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      showBack={stackCanGoBack || !!exitRegistration}
      onBack={handleBack}
      footer={
        <OnboardingButton title="המשך" onPress={handleNext} disabled={!canContinue} />
      }
    >
      <UICard
        variant="glass"
        glassIntensity="light"
        padding="md"
        style={{ borderRadius: DesignTokens.borderRadius.xl }}
      >
        <OnboardingInput
          label="שם מלא"
          icon="person-outline"
          placeholder="הכנס את שמך המלא"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
          isLast
          helperText="לפחות שני תווים"
        />
      </UICard>
      <View style={{ flex: 1 }} />
    </OnboardingLayout>
  );
};

export default RegistrationNameScreen;
