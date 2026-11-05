import i18n from '../../lib/i18n';
import React, { useState } from 'react';
import { View } from 'react-native';
import { APP_LAYOUT } from '../../components/ui/appLayout';
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
  if (code === 'no_session') return i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s1');
  if (code === 'weak_password') return i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s2');
  if (code === 'timeout') return i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s3');
  if (code === 'invalid_email') return i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s4');
  if (code === 'password_not_persisted') {
    return i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s5');
  }
  return code || i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s6');
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
      legacyAlert(i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s7'), i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s8'));
    } catch (e) {
      logger.warn('ForgotPasswordNew', 'save failed', e);
      setError(i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s6'));
      void HapticFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      title={i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s9')}
      subtitle={i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s10')}
      density="focused"
      // גלילה כמו בסיסמת הרישום — באנדרואיד המקלדת מקטינה את האזור והתוכן (חוזק + כללים)
      // חרג ממנו ונצבע מתחת לכפתור «שמור סיסמה»
      scrollable
      showBack={false}
      showProgress={false}
      currentStep={1}
      totalSteps={1}
      exitHint={i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s11')}
      onExitHintPress={() => {
        void HapticFeedback.impactLight();
        void handleCancelToLogin();
      }}
      footer={
        <OnboardingButton
          title={i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s12')}
          onPress={handleSave}
          loading={loading || cancelling}
          disabled={!canContinue}
        />
      }
    >
      <OnboardingErrorBanner message={error} />

      <OnboardingInput
        label={i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s9')}
        placeholder={i18n.t('auto.screens__Auth__ForgotPasswordNewScreen.s13', { v0: PASSWORD_MIN_LENGTH })}
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
      {/* אותה מדיניות ותצוגה כמו ברישום. למד יש marginTop שלילי (נבנה לרווח gap של הרישום) —
          כאן אין gap, ולכן הוא נצמד לשדה; מוסיפים את אותו רווח (20 − 8 = 12 כמו ברישום) */}
      <View style={{ marginTop: APP_LAYOUT.stackGapSmall + 12 }}>
        <PasswordStrength password={password} checks={checkPassword(password, emailHint)} />
      </View>
    </OnboardingLayout>
  );
};

export default ForgotPasswordNewScreen;
