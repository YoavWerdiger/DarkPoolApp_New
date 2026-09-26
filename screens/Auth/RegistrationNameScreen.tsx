import React, { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import CashAppScreen from '../../components/ui/CashAppScreen';
import CashAppInput from '../../components/ui/CashAppInput';
import CashAppButton from '../../components/ui/CashAppButton';
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
    <CashAppScreen
      title="איך קוראים לך?"
      subtitle="השם יופיע בפרופיל ובקהילה"
      currentStep={ONBOARDING_STEPS.name}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="dots"
      showBack={stackCanGoBack || !!exitRegistration}
      onBack={handleBack}
      footer={
        <CashAppButton
          title="המשך"
          variant="primary"
          size="lg"
          onPress={handleNext}
          disabled={!canContinue}
        />
      }
    >
      <CashAppInput
        label="שם מלא"
        placeholder="הכנס את שמך המלא"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoCorrect={false}
        autoFocus
        helperText="לפחות שני תווים"
      />
      <View style={{ flex: 1 }} />
    </CashAppScreen>
  );
};

export default RegistrationNameScreen;
