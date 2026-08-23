import React, { useState } from 'react';
import { Text, View } from 'react-native';
import {
  useRegistration,
  type RegistrationData,
} from '../../context/RegistrationContext';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import OnboardingChoiceRow, {
  OnboardingChoiceGroup,
} from '../../components/onboarding/OnboardingChoiceRow';
import OnboardingSwipeCards from '../../components/onboarding/OnboardingSwipeCards';
import { HapticFeedback } from '../../utils/hapticFeedback';
import type { OnboardingStepKey } from '../../constants/onboardingFlow';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import {
  safeRegistrationBack,
  useRegistrationExitOptional,
} from '../../hooks/useExitRegistration';

type IntroField =
  | 'ageRange'
  | 'experienceLevel'
  | 'tradingFocus'
  | 'tradingPlatform'
  | 'portfolioSize';

export type IntroQuestionConfig = {
  field: IntroField;
  stepKey: OnboardingStepKey;
  title: string;
  subtitle: string;
  options: { label: string; value: string; emoji?: string }[];
  nextRoute: string;
  /** Optional questions stay continuable without a selection */
  optional?: boolean;
  allowDeselect?: boolean;
  /** Display mode: 'list' (default) or 'swipe' */
  displayMode?: 'list' | 'swipe';
  /** Multi-select question — the answer is stored as an array of values */
  multiple?: boolean;
};

/** Registration state holds either a single value or an array, depending on the question. */
const toValueArray = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string' && v !== '');
  }
  return typeof raw === 'string' && raw !== '' ? [raw] : [];
};

type Props = {
  navigation: any;
  config: IntroQuestionConfig;
};

/**
 * One-question intro step (Revolut logic: title = question, glass radio list, single CTA).
 * Supports two display modes: 'list' (default) and 'swipe'.
 */
const RegistrationIntroQuestionScreen = ({ navigation, config }: Props) => {
  const { data, setData } = useRegistration();
  const exitRegistration = useRegistrationExitOptional();
  const isMulti = !!config.multiple;
  const [selected, setSelected] = useState<string[]>(() => toValueArray(data[config.field]));

  const canContinue = config.optional ? true : selected.length > 0;
  const displayMode = config.displayMode || 'list';

  const handleNext = () => {
    if (!canContinue) return;
    setData({
      ...data,
      [config.field]: isMulti ? selected : selected[0] ?? '',
      accountType: data.accountType || 'free',
    } as RegistrationData);
    navigation.navigate(config.nextRoute);
  };

  const handleValueChange = (newValue: string) => {
    setSelected(newValue ? [newValue] : []);
  };

  const handleOptionPress = (optionValue: string) => {
    setSelected((prev) => {
      if (isMulti) {
        return prev.includes(optionValue)
          ? prev.filter((v) => v !== optionValue)
          : [...prev, optionValue];
      }
      if (prev[0] === optionValue) {
        return config.allowDeselect ? [] : prev;
      }
      return [optionValue];
    });
  };

  return (
    <OnboardingLayout
      title={config.title}
      subtitle={displayMode === 'swipe' ? undefined : config.subtitle}
      density="focused"
      currentStep={ONBOARDING_STEPS[config.stepKey]}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      showBack
      onBack={() => {
        void HapticFeedback.impactLight();
        safeRegistrationBack(navigation, { exit: exitRegistration });
      }}
      footer={
        <View>
          {config.optional ? (
            <Text
              style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: 13,
                textAlign: 'center',
                marginBottom: 10,
                writingDirection: 'rtl',
              }}
            >
              אפשר לדלג ולהמשיך בלי לבחור
            </Text>
          ) : null}
          <OnboardingButton
            title={displayMode === 'swipe' ? 'בחר את זה' : 'המשך'}
            onPress={handleNext}
            disabled={!canContinue}
          />
        </View>
      }
    >
      {displayMode === 'swipe' ? (
        <OnboardingSwipeCards
          options={config.options}
          currentValue={selected[0] ?? ''}
          onValueChange={handleValueChange}
        />
      ) : (
        <>
          <OnboardingChoiceGroup>
            {config.options.map((opt) => (
              <OnboardingChoiceRow
                key={opt.value}
                label={opt.label}
                selected={selected.includes(opt.value)}
                allowDeselect={!!config.allowDeselect}
                multiple={isMulti}
                onPress={() => handleOptionPress(opt.value)}
              />
            ))}
          </OnboardingChoiceGroup>
          <View style={{ flex: 1 }} />
        </>
      )}
    </OnboardingLayout>
  );
};

export default RegistrationIntroQuestionScreen;
