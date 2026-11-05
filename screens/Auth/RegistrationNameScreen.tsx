import i18n from '../../lib/i18n';
import React, { useLayoutEffect, useState } from 'react';
import { View } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import CashAppScreen from '../../components/ui/CashAppScreen';
import CashAppInput from '../../components/ui/CashAppInput';
import CashAppButton from '../../components/ui/CashAppButton';
import { NameGreeting } from '../../components/onboarding/RegistrationLive';
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
      title={i18n.t('auto.screens__Auth__RegistrationNameScreen.s1')}
      subtitle={i18n.t('auto.screens__Auth__RegistrationNameScreen.s2')}
      currentStep={ONBOARDING_STEPS.name}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="dots"
      showBack={stackCanGoBack || !!exitRegistration}
      onBack={handleBack}
      footer={
        <CashAppButton
          title={i18n.t('auto.screens__Auth__RegistrationNameScreen.s3')}
          variant="primary"
          size="lg"
          onPress={handleNext}
          disabled={!canContinue}
        />
      }
    >
      <CashAppInput
        label={i18n.t('auto.screens__Auth__RegistrationNameScreen.s4')}
        placeholder={i18n.t('auto.screens__Auth__RegistrationNameScreen.s5')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoCorrect={false}
        autoFocus
      />
      <NameGreeting name={name} />
      <View style={{ flex: 1 }} />
    </CashAppScreen>
  );
};

export default RegistrationNameScreen;
