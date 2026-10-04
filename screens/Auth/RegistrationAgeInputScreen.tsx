import React, { useLayoutEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { WheelPicker } from '../../components/onboarding/WheelPicker';
import { appCaptionStyle } from '../../components/ui/appType';

const AGES = Array.from({ length: 100 - 16 + 1 }, (_, i) => 16 + i);
const DEFAULT_AGE = 28;
import { useRegistration } from '../../context/RegistrationContext';
import CashAppScreen from '../../components/ui/CashAppScreen';
import CashAppButton from '../../components/ui/CashAppButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import { useDesignTokens } from '../../components/ui/DesignTokens';
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
  const tokens = useDesignTokens();
  const existingAge = data.age ? String(data.age) : String(DEFAULT_AGE);
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
    <CashAppScreen
      title="מה הגיל שלך?"
      subtitle="עוזר לנו להתאים את החוויה"
      currentStep={ONBOARDING_STEPS.age}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="dots"
      showBack={showBack}
      onBack={handleBack}
      footer={
        <View>
          {error ? (
            <Text style={[appCaptionStyle, styles.errorText, { color: tokens.colors.danger.main }]}>
              {error}
            </Text>
          ) : null}
          <CashAppButton
            title="המשך"
            variant="primary"
            size="lg"
            onPress={handleNext}
            disabled={!canContinue}
          />
        </View>
      }
    >
      <View style={styles.container}>
        <WheelPicker
          values={AGES}
          value={parseInt(value, 10) || DEFAULT_AGE}
          onChange={(v) => handleChangeText(String(v))}
        />
      </View>
      <View style={{ flex: 1 }} />
    </CashAppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingTop: 12,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 12,
    writingDirection: 'rtl',
  },
});

export default RegistrationAgeInputScreen;
