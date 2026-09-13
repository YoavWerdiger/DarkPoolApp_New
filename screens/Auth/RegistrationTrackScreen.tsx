import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import CashAppScreen from '../../components/ui/CashAppScreen';
import PlanPicker, { getSelectablePlans } from '../../components/subscription/PlanPicker';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import {
  safeRegistrationBack,
  useRegistrationExitOptional,
} from '../../hooks/useExitRegistration';

const RegistrationTrackScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const exitRegistration = useRegistrationExitOptional();
  const plans = getSelectablePlans('registration');
  const initial =
    data.accountType && plans.some((p) => p.id === data.accountType)
      ? data.accountType
      : null;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initial);

  const handleContinue = () => {
    if (!selectedPlanId) return;
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return;

    // trackId נשמר ל-DB כשדה legacy; התצוגה משתמשת ב-trackName / accountType
    if (selectedPlanId === 'free') {
      setData({
        ...data,
        trackId: data.trackId || '1',
        trackName: plan.name,
        trackPrice: 0,
        accountType: 'free',
      });
      navigation.navigate('RegistrationSummary');
      return;
    }

    setData({
      ...data,
      trackId: data.trackId || '1',
      trackName: plan.name,
      trackPrice: plan.price,
      accountType: selectedPlanId,
    });
    navigation.navigate('CreditCardCheckout', {
      planId: selectedPlanId,
      trackName: plan.name,
      trackPrice: plan.price,
      fromRegistration: true,
    });
  };

  return (
    <CashAppScreen
      title="בחר מסלול"
      subtitle="בחר את המסלול שמתאים לך — אפשר לשדרג בכל עת"
      currentStep={ONBOARDING_STEPS.track}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="dots"
      showBack
      onBack={() => {
        void HapticFeedback.impactLight();
        safeRegistrationBack(navigation, {
          exit: exitRegistration,
          fallbackRoute: 'RegistrationPortfolio',
        });
      }}
      footer={undefined}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <PlanPicker
          mode="registration"
          selectedPlanId={selectedPlanId}
          onSelect={setSelectedPlanId}
          onContinue={handleContinue}
        />
      </ScrollView>
    </CashAppScreen>
  );
};

export default RegistrationTrackScreen;
