import React, { useState } from 'react';
import { checkPassword, isPasswordValid, PASSWORD_MIN_LENGTH } from '../../utils/passwordPolicy';
import OnboardingErrorBanner from '../../components/onboarding/OnboardingErrorBanner';
import { PasswordStrength } from '../../components/onboarding/RegistrationLive';
import { AuthService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
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
  if (code === 'weak_password') return 'הסיסמה חייבת להכיל לפחות 8 תווים, אות ומספר';
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const canContinue = !loading && !cancelling && isPasswordValid(password, emailHint);

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
      subtitle="לפחות 8 תווים, עם אות ומספר"
      density="focused"
      // גלילה כמו בסיסמת הרישום — באנדרואיד המקלדת מקטינה את האזור והתוכן (חוזק + כללים)
      // חרג ממנו ונצבע מתחת לכפתור «שמור סיסמה»
      scrollable
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
      <OnboardingErrorBanner message={error} />

      <OnboardingInput
        label="סיסמה חדשה"
        placeholder={`לפחות ${PASSWORD_MIN_LENGTH} תווים`}
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (error) setError('');
        }}
        secureTextEntry
        autoCapitalize="none"
        autoFocus
        isLast
      />
      {/* אותה מדיניות ותצוגה כמו ברישום */}
      <PasswordStrength password={password} checks={checkPassword(password, emailHint)} />
    </OnboardingLayout>
  );
};

export default ForgotPasswordNewScreen;
