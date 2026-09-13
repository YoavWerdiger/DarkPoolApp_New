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
import { buildOnboardingIntroData } from '../../constants/onboardingQuestionnaire';
import { mediaService } from '../../services/mediaService';

const RegistrationSummaryScreen = ({ navigation }: { navigation: any }) => {
  const { data, resetData } = useRegistration();
  const { setUser, signOut, user: currentUser } = useAuth();
  const tokens = useDesignTokens();
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
        <Animated.View style={[styles.halo, { transform: [{ scale: badgeScale }] }]}>
          <View style={[styles.ring, { backgroundColor: tokens.cashAppStyle.colors.inputFocus }]}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: tokens.cashAppStyle.colors.screen,
                  borderRadius: tokens.cashAppStyle.borderRadius.full,
                },
              ]}
            >
              <View style={styles.badgeContent}>
                <Ionicons
                  name="checkmark"
                  size={52}
                  color={tokens.cashAppStyle.colors.headline}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: contentOpacity }}>
          <Text
            style={[
              styles.title,
              {
                color: tokens.cashAppStyle.colors.headline,
                fontSize: tokens.cashAppStyle.typography.headline.fontSize,
                fontWeight: tokens.cashAppStyle.typography.headline.fontWeight,
              },
            ]}
          >
            הכל מוכן!
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: tokens.cashAppStyle.colors.body,
                fontSize: tokens.cashAppStyle.typography.subheadline.fontSize,
              },
            ]}
          >
            החשבון שלך נוצר בהצלחה — הכל מחכה לך בפנים.
          </Text>
        </Animated.View>
      </View>
    </CashAppScreen>
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
    borderRadius: 999,
    backgroundColor: 'rgba(0,200,5,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#00C805',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingHorizontal: 24,
    lineHeight: 22,
  },
});

export default RegistrationSummaryScreen;
