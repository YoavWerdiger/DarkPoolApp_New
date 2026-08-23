import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { DesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingInput from '../../components/onboarding/OnboardingInput';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert } from '../../utils/appDialog';
import { logger } from '../../utils/logger';

/** מונע ספינר נצחי אחרי שמירת סיסמה כש-signOut / AsyncStorage נתקעים */
const CLEANUP_DEADLINE_MS = 12_000;
const STORAGE_DEADLINE_MS = 2_000;

async function raceDeadline(
  promise: Promise<unknown>,
  ms: number,
  label: string
): Promise<'ok' | 'timeout'> {
  let settled = false;
  const outcome = await Promise.race([
    promise
      .then(() => {
        settled = true;
        return 'ok' as const;
      })
      .catch((e) => {
        settled = true;
        logger.warn('ForgotPasswordNew', `${label} failed`, e);
        return 'ok' as const;
      }),
    new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), ms);
    }),
  ]);
  if (outcome === 'timeout' && !settled) {
    logger.warn('ForgotPasswordNew', `${label} timed out after ${ms}ms`);
  }
  return outcome === 'timeout' && !settled ? 'timeout' : 'ok';
}

function mapSaveError(code: string | null | undefined): string {
  if (code === 'no_session') return 'הסשן פג – בקש קוד חדש';
  if (code === 'weak_password') return 'הסיסמה חייבת להכיל לפחות 6 תווים';
  if (code === 'timeout') return 'שמירת הסיסמה ארכה יותר מדי. בדוק חיבור ונסה שוב.';
  if (code === 'invalid_email') return 'חסרה כתובת אימייל. חזור להתחברות ובקש קוד חדש.';
  if (code === 'password_not_persisted') {
    return 'הסיסמה לא נשמרה בשרת. בקש קוד איפוס חדש ונסה שוב.';
  }
  return code || 'שגיאה בשמירת הסיסמה. נסה שוב.';
}

const ForgotPasswordNewScreen = ({ navigation, route }: { navigation: any; route?: any }) => {
  const { setPasswordRecoveryMode, signOut } = useAuth();
  const emailHint = String(route?.params?.email || '')
    .trim()
    .toLowerCase();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const confirmError =
    confirmPassword.length === 0
      ? undefined
      : password !== confirmPassword
        ? 'הסיסמאות אינן תואמות'
        : undefined;
  const canContinue =
    !loading && !cancelling && password.length >= 6 && passwordsMatch;

  const goToLogin = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  /** יציאה מ-recovery תקוע בלי צורך להרוג את האפליקציה */
  const handleCancelToLogin = async () => {
    if (loading || cancelling) return;
    setCancelling(true);
    try {
      await raceDeadline(signOut(true), CLEANUP_DEADLINE_MS, 'signOut on cancel');
      await raceDeadline(setPasswordRecoveryMode(false), STORAGE_DEADLINE_MS, 'clear recovery on cancel');
      goToLogin();
    } catch (e) {
      logger.warn('ForgotPasswordNew', 'cancel to login failed', e);
      goToLogin();
    } finally {
      setCancelling(false);
    }
  };

  const handleSave = async () => {
    if (!canContinue) return;
    setError('');
    setLoading(true);
    try {
      // מחזקים recovery בזמן update+verify — מונע קפיצה ל-Main על סשן ביניים
      await setPasswordRecoveryMode(true);

      const result = await AuthService.completePasswordRecovery(password, emailHint);
      if (result.error || !result.success) {
        setError(mapSaveError(result.error));
        void HapticFeedback.error();
        return;
      }

      void HapticFeedback.success();

      // רק אחרי שהסיסמה אומתה ב-signInWithPassword — מנקים סשן ודגל, ואז Login
      await raceDeadline(signOut(true), CLEANUP_DEADLINE_MS, 'signOut after verified save');
      await raceDeadline(
        setPasswordRecoveryMode(false),
        STORAGE_DEADLINE_MS,
        'clear recovery after save'
      );
      goToLogin();
      legacyAlert('הסיסמה עודכנה', 'אפשר להתחבר עכשיו עם הסיסמה החדשה.');
    } catch (e) {
      logger.warn('ForgotPasswordNew', 'save failed', e);
      setError('שגיאה בשמירת הסיסמה. נסה שוב.');
      void HapticFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      title="סיסמה חדשה"
      subtitle="לפחות 6 תווים — ואשר אותה למטה"
      density="focused"
      showBack={false}
      showProgress={false}
      currentStep={1}
      totalSteps={1}
      exitHint="חזרה להתחברות"
      onExitHintPress={() => {
        void HapticFeedback.impactLight();
        void handleCancelToLogin();
      }}
      footer={
        <OnboardingButton
          title="שמור סיסמה"
          onPress={handleSave}
          loading={loading || cancelling}
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
            borderRadius: 14,
            padding: 13,
            marginBottom: 18,
          }}
        >
          <Ionicons name="alert-circle" size={18} color="#F85149" style={{ marginLeft: 8 }} />
          <Text
            style={{
              color: '#F85149',
              fontSize: 14,
              fontWeight: '500',
              textAlign: 'right',
              writingDirection: 'rtl',
              flex: 1,
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}

      <UICard
        variant="glass"
        glassIntensity="light"
        padding="md"
        style={{ borderRadius: DesignTokens.borderRadius.xl }}
      >
        <OnboardingInput
          label="סיסמה חדשה"
          icon="lock-closed-outline"
          placeholder="לפחות 6 תווים"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            if (error) setError('');
          }}
          secureTextEntry
          autoCapitalize="none"
          autoFocus
        />
        <OnboardingInput
          label="אימות סיסמה"
          icon="lock-closed-outline"
          placeholder="הכנס שוב את הסיסמה"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          error={confirmError}
          isLast
        />
      </UICard>
      <View style={{ flex: 1 }} />
    </OnboardingLayout>
  );
};

export default ForgotPasswordNewScreen;
