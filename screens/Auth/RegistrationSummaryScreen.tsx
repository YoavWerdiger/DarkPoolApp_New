import { legacyAlert } from '../../utils/appDialog';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../../services/authService';
import { SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { DesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import { buildOnboardingIntroData } from '../../constants/onboardingQuestionnaire';
import { mediaService } from '../../services/mediaService';

const RegistrationSummaryScreen = ({ navigation }: { navigation: any }) => {
  const { data, resetData } = useRegistration();
  const { setUser, signOut, user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const badgeScale = useRef(new Animated.Value(0.82)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(badgeScale, {
        toValue: 1,
        damping: 10,
        stiffness: 150,
        mass: 0.5,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [badgeScale, contentOpacity]);

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
    <OnboardingLayout
      currentStep={ONBOARDING_STEPS.summary}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      showProgress={false}
      showClose={false}
      footer={
        <OnboardingButton
          title="התחל להשתמש"
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
        <Animated.View style={[styles.halo, { transform: [{ scale: badgeScale }] }]}>
          <View style={styles.ring}>
            <UICard
              variant="glass"
              glassIntensity="medium"
              padding="none"
              style={styles.badge}
              contentContainerStyle={styles.badgeContent}
            >
              <Ionicons
                name="checkmark"
                size={52}
                color={DesignTokens.colors.primary.main}
              />
            </UICard>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: contentOpacity }}>
          <Text style={styles.title}>הכל מוכן!</Text>
          <Text style={styles.subtitle}>
            החשבון שלך נוצר בהצלחה — הכל מחכה לך בפנים.
          </Text>
        </Animated.View>
      </View>
    </OnboardingLayout>
  );
};

const BADGE_SIZE = 96;
const RING_SIZE = 124;
const HALO_SIZE = 156;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: DesignTokens.borderRadius.full,
    backgroundColor: DesignTokens.colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DesignTokens.spacing['2xl'],
    ...DesignTokens.shadows.greenGlow,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: DesignTokens.borderRadius.full,
    backgroundColor: DesignTokens.colors.primary.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: DesignTokens.borderRadius.full,
  },
  badgeContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: DesignTokens.typography.heroTitle.size,
    lineHeight: DesignTokens.typography.heroTitle.lineHeight,
    fontWeight: DesignTokens.typography.heroTitle.weight,
    color: DesignTokens.colors.text.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: DesignTokens.spacing.md,
  },
  subtitle: {
    fontSize: DesignTokens.typography.callout.size,
    lineHeight: DesignTokens.typography.callout.lineHeight,
    color: DesignTokens.colors.text.tertiary,
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingHorizontal: DesignTokens.spacing.lg,
  },
});

export default RegistrationSummaryScreen;
