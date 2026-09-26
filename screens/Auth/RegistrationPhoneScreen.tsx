import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { AuthService, toE164IsraeliPhone } from '../../services/authService';
import CashAppScreen from '../../components/ui/CashAppScreen';
import CashAppInput from '../../components/ui/CashAppInput';
import CashAppButton from '../../components/ui/CashAppButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
  PHONE_VERIFICATION_ENABLED,
} from '../../constants/onboardingFlow';
import {
  safeRegistrationBack,
  useRegistrationExitOptional,
} from '../../hooks/useExitRegistration';

const RegistrationPhoneScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const exitRegistration = useRegistrationExitOptional();
  const tokens = useDesignTokens();
  const [phone, setPhone] = useState(data.phone || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const e164 = toE164IsraeliPhone(phone);
  const canContinue = !loading && !!e164;

  const handleNext = async () => {
    setError('');
    if (!e164) {
      setError('אנא הכנס מספר נייד ישראלי תקין (למשל 0541234567)');
      return;
    }

    setLoading(true);
    try {
      const { exists, error: phoneError } = await AuthService.checkPhoneExists(phone.trim());
      if (phoneError) {
        setError('שגיאה בבדיקת הטלפון');
        return;
      }
      if (exists) {
        setError('מספר הטלפון כבר קיים במערכת');
        return;
      }

      // PHONE_VERIFICATION_ENABLED (constants/onboardingFlow.ts) — כבוי עד אישור Twilio.
      // ביום ההשקה: true שם בלבד (אחרי Twilio + Phone provider ב-Supabase).
      if (PHONE_VERIFICATION_ENABLED) {
        const otpResult = await AuthService.sendPhoneOtp(phone.trim());
        if (otpResult.error) {
          if (otpResult.error === 'rate_limit') {
            setError('יותר מדי בקשות. נסה שוב בעוד כמה דקות.');
          } else if (otpResult.error === 'invalid_phone') {
            setError('מספר הטלפון לא תקין');
          } else if (
            otpResult.error === 'sms_provider_error' ||
            otpResult.error === 'phone_auth_not_configured'
          ) {
            setError('שליחת SMS אינה זמינה כרגע. נסה שוב מאוחר יותר.');
          } else {
            setError('שגיאה בשליחת קוד האימות. נסה שוב.');
          }
          void HapticFeedback.error();
          return;
        }

        setData({
          ...data,
          phone: phone.trim(),
          phoneOtpSentAt: Date.now(),
        });
        void HapticFeedback.success();
        navigation.navigate('RegistrationPhoneVerification');
        return;
      }

      setData({ ...data, phone: phone.trim() });
      void HapticFeedback.success();
      navigation.navigate('RegistrationEmail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CashAppScreen
      title="מה מספר הטלפון שלך?"
      subtitle="נשתמש בו ליצירת קשר ולהתראות חשובות"
      currentStep={ONBOARDING_STEPS.phone}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="dots"
      showBack
      onBack={() => {
        void HapticFeedback.impactLight();
        safeRegistrationBack(navigation, {
          exit: exitRegistration,
          fallbackRoute: 'RegistrationName',
        });
      }}
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

      <CashAppInput
        label="מספר טלפון"
        placeholder="054-000-0000"
        autoFormat="phone"
        value={phone}
        onChangeText={(t) => {
          setPhone(t.replace(/[^0-9]/g, ''));
          if (error) setError('');
        }}
        keyboardType="phone-pad"
        maxLength={15}
        autoFocus
        helperText="נייד ישראלי (למשל 054-123-4567)"
      />
      <View style={{ flex: 1 }} />
    </CashAppScreen>
  );
};

export default RegistrationPhoneScreen;
