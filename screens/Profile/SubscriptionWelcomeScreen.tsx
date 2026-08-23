import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { DesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import { SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { HapticFeedback } from '../../utils/hapticFeedback';

type PlanKey = keyof typeof SUBSCRIPTION_PLANS;

interface SubscriptionWelcomeScreenProps {
  navigation: any;
  route: {
    params?: {
      planId?: string;
      planName?: string;
    };
  };
}

function resolvePlanName(planId?: string, planName?: string): string {
  if (planName?.trim()) return planName.trim();
  if (planId && planId in SUBSCRIPTION_PLANS) {
    return SUBSCRIPTION_PLANS[planId as PlanKey].name;
  }
  return 'הפרימיום';
}

/**
 * מסך חגיגי אחרי תשלום/שדרוג מוצלח — בסגנון "הכל מוכן!" מההרשמה.
 * CTA יחיד → Billing (מנוי וחיובים), בלי חזרה ל-PlanPicker.
 */
export default function SubscriptionWelcomeScreen({
  navigation,
  route,
}: SubscriptionWelcomeScreenProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const planId = route.params?.planId;
  const planName = resolvePlanName(planId, route.params?.planName);

  const badgeScale = useRef(new Animated.Value(0.82)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void HapticFeedback.success();
    if (user?.id) {
      void queryClient.invalidateQueries({
        queryKey: appQueryKeys.userSubscription(user.id),
      });
    }
  }, [queryClient, user?.id]);

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

  const goToBilling = useCallback(() => {
    void HapticFeedback.medium();
    navigation.reset({
      index: 1,
      routes: [{ name: 'ProfileMain' }, { name: 'Billing' }],
    });
  }, [navigation]);

  // חסימת back ל-Plans/Checkout — רק דרך ה-CTA
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goToBilling();
        return true;
      });
      return () => sub.remove();
    }, [goToBilling])
  );

  return (
    <OnboardingLayout
      currentStep={1}
      totalSteps={1}
      showProgress={false}
      showClose={false}
      showBack={false}
      footer={
        <OnboardingButton title="למנוי שלי" onPress={goToBilling} />
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
          <Text style={styles.title}>{`ברוך הבא למסלול ${planName}!`}</Text>
          <Text style={styles.subtitle}>
            המנוי שלך פעיל — אפשר להתחיל להשתמש בכל התכונות.
          </Text>
        </Animated.View>
      </View>
    </OnboardingLayout>
  );
}

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
    paddingHorizontal: DesignTokens.spacing.md,
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
