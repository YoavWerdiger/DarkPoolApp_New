import { legacyAlert } from '../../utils/appDialog';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
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
  getExperienceLevelLabel,
  getTradingFocusLabel,
  getTradingPlatformLabels,
} from '../../constants/onboardingQuestionnaire';
import { Confetti } from '../../components/onboarding/Confetti';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';

const EXPERIENCE_ORDER = ['first_steps', 'beginner', 'intermediate', 'advanced'];

/** עמודה בתג הרמה — גדלה מלמטה לגובה המלא כשהיא «מתמלאת» */
function LevelBar({
  active,
  filled,
  height,
  color,
}: {
  active: boolean;
  filled: boolean;
  height: number;
  color: string;
}) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!filled) return;
    Animated.spring(grow, { toValue: 1, damping: 9, stiffness: 180, mass: 0.5, useNativeDriver: true }).start();
  }, [filled, grow]);
  return (
    <View style={{ width: 14, height, justifyContent: 'flex-end' }}>
      <View
        style={{ position: 'absolute', bottom: 0, width: 14, height, borderRadius: 7, backgroundColor: color, opacity: 0.16 }}
      />
      {active ? (
        <Animated.View
          style={{
            width: 14,
            height,
            borderRadius: 7,
            backgroundColor: color,
            transform: [
              { translateY: grow.interpolate({ inputRange: [0, 1], outputRange: [height / 2, 0] }) },
              { scaleY: grow },
            ],
          }}
        />
      ) : null}
    </View>
  );
}
import { mediaService } from '../../services/mediaService';

const RegistrationSummaryScreen = ({ navigation }: { navigation: any }) => {
  const { data, resetData } = useRegistration();
  const { setUser, signOut, user: currentUser } = useAuth();
  const tokens = useDesignTokens();
  const [loading, setLoading] = useState(false);

  const badgeScale = useRef(new Animated.Value(0.82)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // רמה לפי הניסיון שנבחר (1–4)
  const level = Math.max(1, EXPERIENCE_ORDER.indexOf(data.experienceLevel) + 1);
  const levelName = getExperienceLevelLabel(data.experienceLevel) || 'סוחר בקהילה';
  const firstName = (data.fullName || '').trim().split(/\s+/)[0] || '';
  const chips = [
    getTradingFocusLabel(data.tradingFocus),
    getTradingPlatformLabels(data.tradingPlatform),
  ].filter((c): c is string => !!c);
  const [barsFilled, setBarsFilled] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  // תג נכנס → עמודות מתמלאות אחת-אחת עם טיק → קונפטי + רטט הצלחה → טקסט
  useEffect(() => {
    Animated.spring(badgeScale, {
      toValue: 1,
      damping: 9,
      stiffness: 140,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < level; i++) {
      timers.push(
        setTimeout(() => {
          setBarsFilled(i + 1);
          void HapticFeedback.selection();
        }, 450 + i * 220),
      );
    }
    timers.push(
      setTimeout(() => {
        setCelebrate(true);
        void HapticFeedback.success();
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }, 450 + level * 220 + 120),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          title="התחל להשתמש"
          variant="primary"
          size="lg"
          onPress={() => {
            void HapticFeedback.success();
            handleFinish();
          }}
          loading={loading}
          disabled={loading}
        />
      }
    >
      <View style={styles.centered}>
        <Animated.View
          style={[
            styles.badge,
            { backgroundColor: tokens.colors.background.cardSolid, transform: [{ scale: badgeScale }] },
          ]}
        >
          <View style={styles.bars}>
            {[0, 1, 2, 3].map((i) => (
              <LevelBar
                key={i}
                active={i < level}
                filled={barsFilled > i}
                height={18 + i * 14}
                color={level === 4 ? tokens.colors.primary.main : tokens.colors.text.primary}
              />
            ))}
          </View>
          <Text style={[styles.levelNum, { color: tokens.colors.text.primary }]}>רמה {level}</Text>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: contentOpacity }]}>
          <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
            {firstName ? `ברוך הבא, ${firstName}` : 'ברוך הבא'}
          </Text>
          <Text style={[styles.levelName, { color: tokens.colors.text.secondary }]}>{levelName}</Text>
          {chips.length > 0 ? (
            <View style={styles.chips}>
              {chips.map((c) => (
                <View key={c} style={[styles.chip, { backgroundColor: tokens.colors.background.cardSolid }]}>
                  <Text style={[styles.chipText, { color: tokens.colors.text.primary }]}>{c}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Animated.View>
      </View>
      <Confetti
        fire={celebrate}
        colors={[tokens.colors.primary.main, tokens.colors.text.primary, '#FFC531', '#8E8E93', '#00E63D']}
      />
    </CashAppScreen>
  );
};

const BADGE = 168;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: APP_LAYOUT.stackGapTight,
    marginBottom: APP_LAYOUT.sectionGap / 2 + 8,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 60,
  },
  levelNum: {
    fontSize: APP_TYPE.cardTitle.fontSize,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
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
  levelName: {
    fontSize: APP_TYPE.sectionSubtitle.fontSize,
    lineHeight: APP_TYPE.sectionSubtitle.lineHeight,
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
