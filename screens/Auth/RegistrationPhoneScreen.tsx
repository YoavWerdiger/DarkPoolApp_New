import { TEXT_START } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
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

import { logger } from '../../utils/logger';
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
      setError(i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s1'));
      return;
    }

    setLoading(true);
    try {
      // שמירה בפורמט של ה-DB: ספרות בלבד, 05XXXXXXXX (CHECK ^[0-9]{10,15}$ ב-users.phone)
      const localPhone = `0${e164.slice(4)}`;
      const { exists, error: phoneError } = await AuthService.checkPhoneExists(localPhone);
      if (phoneError) {
        // בדיקה טכנית שנכשלה לא חוסמת רישום — UNIQUE(phone) ב-DB עדיין מונע כפילות
        logger.error('RegistrationPhone', `checkPhoneExists failed: ${phoneError}`);
      }
      if (exists) {
        setError(i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s2'));
        return;
      }

      // PHONE_VERIFICATION_ENABLED (constants/onboardingFlow.ts) — כבוי עד אישור Twilio.
      // ביום ההשקה: true שם בלבד (אחרי Twilio + Phone provider ב-Supabase).
      if (PHONE_VERIFICATION_ENABLED) {
        const otpResult = await AuthService.sendPhoneOtp(phone.trim());
        if (otpResult.error) {
          if (otpResult.error === 'rate_limit') {
            setError(i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s3'));
          } else if (otpResult.error === 'invalid_phone') {
            setError(i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s4'));
          } else if (
            otpResult.error === 'sms_provider_error' ||
            otpResult.error === 'phone_auth_not_configured'
          ) {
            setError(i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s5'));
          } else {
            setError(i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s6'));
          }
          void HapticFeedback.error();
          return;
        }

        setData({
          ...data,
          phone: localPhone,
          phoneOtpSentAt: Date.now(),
        });
        void HapticFeedback.success();
        navigation.navigate('RegistrationPhoneVerification');
        return;
      }

      setData({ ...data, phone: localPhone });
      void HapticFeedback.success();
      navigation.navigate('RegistrationEmail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CashAppScreen
      title={i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s7')}
      subtitle={i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s8')}
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
          title={i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s9')}
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
              textAlign: TEXT_START,
              writingDirection: TEXT_DIR,
              flex: 1,
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}

      <CashAppInput
        label={i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s10')}
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
        helperText={i18n.t('auto.screens__Auth__RegistrationPhoneScreen.s11')}
      />
      <View style={{ flex: 1 }} />
    </CashAppScreen>
  );
};

export default RegistrationPhoneScreen;
