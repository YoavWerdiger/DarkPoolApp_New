import { legacyAlert } from '../../utils/appDialog';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useRegistration } from '../../context/RegistrationContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../../services/authService';
import { SUBSCRIPTION_PLANS } from '../../services/paymentService';
import CashAppScreen from '../../components/ui/CashAppScreen';
import CashAppButton from '../../components/ui/CashAppButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import {
  buildOnboardingIntroData,
  getTradingFocusLabel,
  getTradingPlatformLabels,
} from '../../constants/onboardingQuestionnaire';
import { Confetti } from '../../components/onboarding/Confetti';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';

const RING = 168;
const STROKE = 8;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const LOAD_MS = 3400;

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

/** שלבי ה«איסוף» המדומה — כל שלב מסומן ב-✓ כשההתקדמות עוברת את הסף שלו */
const SETUP_STEPS = [
  { at: 22, label: 'מנתחים את הפרופיל שלך' },
  { at: 48, label: 'מתאימים חדשות ודיווחי רווח' },
  { at: 74, label: 'בונים את הפיד האישי' },
  { at: 98, label: 'מכינים את יומן המסחר' },
];

function SetupStep({ label, state }: { label: string; state: 'wait' | 'active' | 'done' }) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIcon}>
        {state === 'done' ? (
          <Reanimated.View key="d" entering={ZoomIn.duration(200)}>
            <Ionicons name="checkmark-circle" size={22} color={tokens.colors.text.primary} />
          </Reanimated.View>
        ) : state === 'active' ? (
          <ActivityIndicator size="small" color={tokens.colors.text.secondary} />
        ) : (
          <Ionicons name="ellipse-outline" size={22} color={tokens.colors.text.tertiary} />
        )}
      </View>
      <Text
        style={[
          styles.stepText,
          { color: state === 'wait' ? tokens.colors.text.tertiary : tokens.colors.text.primary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
import { mediaService } from '../../services/mediaService';

const RegistrationSummaryScreen = ({ navigation }: { navigation: any }) => {
  const { data, resetData } = useRegistration();
  const { setUser, signOut, user: currentUser } = useAuth();
  const tokens = useDesignTokens();
  const [loading, setLoading] = useState(false);

  const firstName = (data.fullName || '').trim().split(/\s+/)[0] || '';
  const chips = [
    getTradingFocusLabel(data.tradingFocus),
    getTradingPlatformLabels(data.tradingPlatform),
  ].filter((c): c is string => !!c);

  // טעינה מדומה: טבעת 0→100% עם שלבים, ואז קונפטי + ברוך הבא
  const progress = useSharedValue(0);
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    progress.value = withTiming(100, { duration: LOAD_MS, easing: Easing.bezier(0.45, 0.05, 0.35, 1) });
    const t = setTimeout(() => {
      setDone(true);
      void HapticFeedback.success();
    }, LOAD_MS + 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (v, prev) => {
      if (v !== prev) runOnJS(setPct)(v);
    },
  );

  // טיק עדין בכל שלב שמסתיים
  const doneSteps = SETUP_STEPS.filter((st) => pct >= st.at).length;
  const prevDone = useRef(0);
  useEffect(() => {
    if (doneSteps > prevDone.current) void HapticFeedback.selection();
    prevDone.current = doneSteps;
  }, [doneSteps]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value / 100),
  }));

  const handleFinish = async () => {
    setLoading(true);
    try {
      const introData = buildOnboardingIntroData({
        age: data.age,
        ageRange: data.ageRange,
        experienceLevel: data.experienceLevel,
        tradingFocus: data.tradingFocus,
        tradingPlatform: data.tradingPlatform,
        portfolioSize: data.portfolioSize,
      });

      const planId = data.accountType || 'free';
      const pendingId = data.pendingAuthUserId || data.googleUserId || null;
      let user;
      let signUpError: string | null = null;

      // תמונת הרישום נשמרת מקומית עד לסיכום — מעלים לפני כתיבה ל-users.
      const remoteProfile = await mediaService.ensureRemoteMediaUrl(data.profileImage, 'image');
      if (data.profileImage && remoteProfile.error) {
        setLoading(false);
        legacyAlert('שגיאה', remoteProfile.error || 'העלאת תמונת הפרופיל נכשלה');
        return;
      }
      const profilePictureUrl = remoteProfile.url;

      const finalizeExistingUser = async (userId: string) => {
        // account_type לא נכתב מהקליינט — היא עמודת הרשאה. המסלול שנבחר כבר
        // רשום ב-payment_transactions, וה-webhook של Cardcom הוא שמעדכן את
        // המנוי אחרי תשלום מאומת.
        const { error: updateError } = await supabase
          .from('users')
          .update({
            phone: data.phone || null,
            track_id: data.trackId || '1',
            intro_data: introData,
            display_name: data.fullName || undefined,
            full_name: data.fullName || undefined,
            profile_picture: profilePictureUrl,
            registration_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) throw new Error(updateError.message);

        if (planId === 'free') {
          await AuthService.ensureFreeSubscriptionRow(userId);
        }

        return AuthService.getUserProfile(userId);
      };

      if (pendingId) {
        try {
          user = await finalizeExistingUser(pendingId);
        } catch (error: any) {
          signUpError = error.message || 'שגיאה בעדכון הפרופיל';
        }
      } else {
        try {
          await AsyncStorage.removeItem('saved_email');
          await AsyncStorage.removeItem('saved_password');
          await AsyncStorage.removeItem('remember_me');
          await AsyncStorage.setItem('explicit_logout', 'true');
        } catch {}

        if (currentUser) await signOut();

        try {
          const result = await AuthService.signUp({
            email: data.email,
            password: data.password,
            display_name: data.fullName,
            full_name: data.fullName,
            profile_picture: profilePictureUrl ?? undefined,
            phone: data.phone,
            track_id: data.trackId || '1',
            account_type: planId,
            intro_data: introData,
            registration_completed: true,
          });
          user = result.user;
          signUpError = result.error;

          if (user && planId === 'free') {
            await AuthService.ensureFreeSubscriptionRow(user.id);
          }
        } catch (authError: any) {
          signUpError = authError.message || 'Unknown error in AuthService';
        }
      }

      if (signUpError) {
        setLoading(false);
        legacyAlert('שגיאה בהרשמה', signUpError);
        return;
      }

      if (user) {
        const selectedPlan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
        const planName = selectedPlan ? selectedPlan.name : 'מסלול חינמי';
        const enteredViaGoogle = data.isGoogleSignUp || !!data.googleUserId;
        const emailAlreadyVerified = data.emailVerified === true;
        const staySignedIn =
          enteredViaGoogle || emailAlreadyVerified || (!!pendingId && !!currentUser);

        if (staySignedIn) {
          setLoading(false);
          try {
            await AsyncStorage.removeItem('explicit_logout');
          } catch {}
          const fresh = await AuthService.getUserProfile(user.id);
          setUser(fresh || { ...user, registration_completed: true });
          if (resetData) resetData();

          legacyAlert(
            'הרשמה הושלמה בהצלחה! 🎉',
            `ברוכים הבאים ל-DarkPool! החשבון שלך נוצר עם תוכנית ${planName}.`,
            [{ text: 'התחל' }]
          );
        } else {
          setLoading(false);
          try {
            await AsyncStorage.setItem('explicit_logout', 'true');
          } catch {}
          await signOut(true);
          if (resetData) resetData();

          legacyAlert(
            'נשלח מייל אימות',
            `שלחנו קישור אימות לכתובת ${data.email}. יש לאשר את המייל ורק אז להתחבר.`,
            [
              {
                text: 'שלח שוב',
                onPress: async () => {
                  const { error } = await AuthService.resendVerificationEmail(data.email || '');
                  if (error) {
                    legacyAlert('שגיאה', error);
                  } else {
                    legacyAlert('בוצע', 'מייל אימות נשלח שוב בהצלחה');
                  }
                },
              },
              {
                text: 'אישור',
                onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }),
              },
            ]
          );
        }
      } else {
        legacyAlert('שגיאה', 'לא ניתן היה ליצור את המשתמש');
      }
    } catch {
      setLoading(false);
      legacyAlert('שגיאה', 'אירעה שגיאה בעת השלמת ההרשמה');
    }
  };

  return (
    <CashAppScreen
      title=""
      subtitle=""
      currentStep={ONBOARDING_STEPS.summary}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="none"
      showBack={false}
      showClose={false}
      footer={
        <CashAppButton
          title={done ? 'הצטרף לקהילה' : 'רק רגע…'}
          variant="primary"
          size="lg"
          onPress={() => {
            void HapticFeedback.success();
            handleFinish();
          }}
          loading={loading}
          disabled={loading || !done}
        />
      }
    >
      <View style={styles.centered}>
        <View style={styles.ring}>
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={tokens.colors.border.divider}
              strokeWidth={STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={tokens.colors.text.primary}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRC} ${CIRC}`}
              animatedProps={ringProps}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          {done ? (
            <Reanimated.View key="avatar" entering={ZoomIn.springify().damping(12)} style={styles.ringInner}>
              {data.profileImage ? (
                <Image source={{ uri: data.profileImage }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tokens.colors.text.primary }]}>
                  <Ionicons name="checkmark" size={64} color={tokens.colors.text.inverse} />
                </View>
              )}
            </Reanimated.View>
          ) : (
            <Reanimated.View key="pct" exiting={FadeOut.duration(150)} style={styles.ringInner}>
              <Text style={[styles.pct, { color: tokens.colors.text.primary }]}>{pct}%</Text>
            </Reanimated.View>
          )}
        </View>

        {done ? (
          <Reanimated.View key="welcome" entering={FadeInDown.delay(150).duration(380)} style={styles.textBlock}>
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
              {firstName ? `ברוך הבא, ${firstName}` : 'ברוך הבא'}
            </Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              הכול מוכן. החשבון שלך הותאם אישית.
            </Text>
            {chips.length > 0 ? (
              <View style={styles.chips}>
                {chips.map((c) => (
                  <View key={c} style={[styles.chip, { backgroundColor: tokens.colors.background.cardSolid }]}>
                    <Text style={[styles.chipText, { color: tokens.colors.text.primary }]}>{c}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Reanimated.View>
        ) : (
          <Reanimated.View key="loading" exiting={FadeOut.duration(180)} style={styles.textBlock}>
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>מכינים את החשבון שלך</Text>
            <View style={styles.steps}>
              {SETUP_STEPS.map((st, i) => {
                const prevAt = i === 0 ? 0 : SETUP_STEPS[i - 1].at;
                const state = pct >= st.at ? 'done' : pct >= prevAt ? 'active' : 'wait';
                return (
                  <Reanimated.View key={st.label} entering={FadeIn.delay(120 + i * 90).duration(260)}>
                    <SetupStep label={st.label} state={state} />
                  </Reanimated.View>
                );
              })}
            </View>
          </Reanimated.View>
        )}
      </View>
      <Confetti
        fire={done}
        colors={[tokens.colors.primary.main, tokens.colors.text.primary, '#FFC531', '#8E8E93', '#00E63D']}
      />
    </CashAppScreen>
  );
};

const AVATAR = RING - STROKE * 2 - 12;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_LAYOUT.sectionGap,
  },
  ringInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pct: {
    fontSize: APP_TYPE.flowTitle.fontSize + 6,
    fontWeight: APP_TYPE.flowTitle.fontWeight,
    fontVariant: ['tabular-nums'],
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: APP_TYPE.sectionSubtitle.fontSize,
    lineHeight: APP_TYPE.sectionSubtitle.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  steps: {
    alignSelf: 'stretch',
    gap: APP_LAYOUT.stackGapSmall + 4,
    marginTop: APP_LAYOUT.componentGap,
  },
  stepRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  stepIcon: {
    width: 24,
    alignItems: 'center',
  },
  stepText: {
    flex: 1,
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  textBlock: {
    alignItems: 'center',
    gap: APP_LAYOUT.stackGapSmall,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  },
  title: {
    fontSize: APP_TYPE.flowTitle.fontSize,
    lineHeight: APP_TYPE.flowTitle.lineHeight,
    fontWeight: APP_TYPE.flowTitle.fontWeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  chips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: APP_LAYOUT.stackGapSmall,
    marginTop: APP_LAYOUT.stackGapSmall,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  chipText: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    writingDirection: 'rtl',
  },
});

export default RegistrationSummaryScreen;
