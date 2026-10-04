import React, { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { AuthService } from '../../services/authService';
import CashAppScreen from '../../components/ui/CashAppScreen';
import CashAppInput from '../../components/ui/CashAppInput';
import CashAppButton from '../../components/ui/CashAppButton';
import { EmailDomainChips } from '../../components/onboarding/RegistrationLive';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import {
  safeRegistrationBack,
  useRegistrationExitOptional,
} from '../../hooks/useExitRegistration';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RegistrationEmailScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const exitRegistration = useRegistrationExitOptional();
  const tokens = useDesignTokens();
  const [email, setEmail] = useState(data.email || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const formatOk = EMAIL_RE.test(email.trim());
  const canContinue =
    !loading && !checkingEmail && formatOk && error.length === 0 && email.trim().length > 0;

  // בדיקת מייל עם debounce
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!formatOk || email.trim().length === 0) {
      setCheckingEmail(false);
      return;
    }

    setCheckingEmail(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const { exists, error: emailError } = await AuthService.checkEmailExists(email.trim());

        if (emailError) {
          setError('שגיאה בבדיקת המייל');
        } else if (exists === true) {
          const normalized = email.trim().toLowerCase();
          const resumeSame =
            data.email?.toLowerCase() === normalized &&
            (!!data.emailOtpSentAt || !!data.pendingAuthUserId || data.emailVerified);
          if (resumeSame) {
            setError('');
          } else {
            setError('המייל כבר רשום במערכת');
          }
        } else {
          setError('');
        }
      } catch {
        setError('שגיאה בבדיקת המייל');
      } finally {
        setCheckingEmail(false);
      }
    }, 800);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [email, formatOk, data.email, data.emailOtpSentAt, data.pendingAuthUserId, data.emailVerified]);

  const handleNext = async () => {
    if (!canContinue) return;

    setError('');

    if (!formatOk) {
      setError('אנא הכנס כתובת אימייל תקינה');
      return;
    }

    if (email.trim().length === 0) {
      setError('אנא הכנס כתובת אימייל');
      return;
    }

    setLoading(true);
    try {
      const normalized = email.trim().toLowerCase();
      // אם כבר אומת באותה זרימה — לא שולחים OTP מחדש
      if (data.emailVerified && data.email?.toLowerCase() === normalized && data.pendingAuthUserId) {
        setData({ ...data, email: normalized });
        navigation.navigate('RegistrationPassword');
        return;
      }

      const { exists, error: emailError } = await AuthService.checkEmailExists(normalized);

      if (emailError) {
        setError('שגיאה בבדיקת המייל - אנא נסה שוב');
        return;
      }
      if (exists === true) {
        // signInWithOtp יוצר auth/users כבר בשליחה — אותו מייל באותה זרימה מותר להמשיך לאימות
        const resumeSame =
          data.email?.toLowerCase() === normalized &&
          (!!data.emailOtpSentAt || !!data.pendingAuthUserId || data.emailVerified);
        if (!resumeSame) {
          setError('המייל כבר רשום במערכת');
          return;
        }
      }

      // ניווט תמיד למסך OTP — השליחה עצמה קורית שם (עם הצגת שגיאות / Resend)
      const emailChanged = data.email?.toLowerCase() !== normalized;
      setData({
        ...data,
        email: normalized,
        emailVerified: false,
        // אם החליפו מייל — מכריחים שליחה מחדש במסך האימות
        emailOtpSentAt: emailChanged ? null : data.emailOtpSentAt,
      });
      void HapticFeedback.success();
      navigation.navigate('RegistrationEmailVerification');
    } catch (err) {
      console.error('[RegistrationEmailScreen] חריגה ב-handleNext:', err);
      setError('שגיאה בבדיקת המייל - אנא נסה שוב');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CashAppScreen
      title="מה האימייל שלך?"
      subtitle="ישמש להתחברות ולהתראות חשובות"
      currentStep={ONBOARDING_STEPS.email}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="dots"
      showBack
      onBack={() => {
        void HapticFeedback.impactLight();
        safeRegistrationBack(navigation, {
          exit: exitRegistration,
          fallbackRoute: 'RegistrationPhone',
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
        label="כתובת אימייל"
        placeholder="you@example.com"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (error) setError('');
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        helperText={
          checkingEmail
            ? 'בודק זמינות...'
            : error
            ? undefined
            : 'בשלב הבא נשלח אליך קוד אימות למייל'
        }
      />
      <EmailDomainChips
        email={email}
        onPick={(full) => {
          setEmail(full);
          if (error) setError('');
        }}
      />
      <View style={{ flex: 1 }} />
    </CashAppScreen>
  );
};

export default RegistrationEmailScreen;
