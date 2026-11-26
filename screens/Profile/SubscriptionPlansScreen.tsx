import i18n from '../../lib/i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import PlanPicker, { getSelectablePlans } from '../../components/subscription/PlanPicker';
import { isSubscriptionCheckoutEnabled } from '../../services/paymentService';
import { useSubscription } from '../../hooks/useSubscription';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { settingsButtonLabelStyle, settingsHebrewText } from '../../components/profile/settingsType';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { IAP_ENABLED } from '../../lib/iapProducts';
import { restorePurchases } from '../../services/iapService';

function resolveCurrentPlanId(
  planId: string | null,
  planName: string | null,
  isPremium: boolean,
): string {
  const paidIds = getSelectablePlans('upgrade').map((p) => p.id);
  if (planId && (planId === 'free' || paidIds.includes(planId))) return planId;
  if (planName) {
    const all = getSelectablePlans('registration');
    const byName = all.find(
      (p) => p.name === planName || planName.includes(p.name) || p.name.includes(planName),
    );
    if (byName) return byName.id;
  }
  return isPremium ? 'monthly' : 'free';
}

export default function SubscriptionPlansScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { planId, planName, isPremium, isLoading: subLoading } = useSubscription();
  const checkoutReady = isSubscriptionCheckoutEnabled();

  const currentPlanId = useMemo(
    () => resolveCurrentPlanId(planId, planName, isPremium),
    [planId, planName, isPremium],
  );

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    currentPlanId === 'free' ? null : currentPlanId,
  );

  useEffect(() => {
    if (subLoading) return;
    setSelectedPlanId(currentPlanId === 'free' ? null : currentPlanId);
  }, [subLoading, currentPlanId]);

  const handleContinue = () => {
    if (!selectedPlanId || selectedPlanId === 'free') return;
    if (selectedPlanId === currentPlanId) return;
    if (!checkoutReady) {
      legacyAlert(
        i18n.t('auto.screens__Profile__SubscriptionPlansScreen.s1'),
        i18n.t('auto.screens__Profile__SubscriptionPlansScreen.s2'),
        [{ text: i18n.t('auto.screens__Profile__SubscriptionPlansScreen.s3') }],
      );
      return;
    }
    navigation.navigate('CreditCardCheckout', {
      planId: selectedPlanId,
      fromRegistration: false,
    });
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: tokens.colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <ChatSubScreenHeader
        title={i18n.t('auto.screens__Profile__SubscriptionPlansScreen.s4')}
        onBack={() => {
          void HapticFeedback.impactLight();
          navigation.goBack();
        }}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PlanPicker
          mode="upgrade"
          selectedPlanId={selectedPlanId}
          currentPlanId={currentPlanId === 'free' ? undefined : currentPlanId}
          onSelect={setSelectedPlanId}
          onContinue={handleContinue}
          intro={
            planName
              ? i18n.t('auto.screens__Profile__SubscriptionPlansScreen.s5', { v0: planName })
              : i18n.t('auto.screens__Profile__SubscriptionPlansScreen.s6')
          }
          banner={
            checkoutReady
              ? null
              : i18n.t('auto.screens__Profile__SubscriptionPlansScreen.s7')
          }
        />
        {IAP_ENABLED ? (
          <>
            <Text style={[settingsHebrewText, styles.terms, { color: tokens.colors.text.secondary }]}>
              המנוי מתחדש אוטומטית בסוף כל תקופה באותו מחיר, אלא אם מבטלים לפחות 24 שעות לפני החידוש. החיוב מתבצע
              דרך חשבון {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} שלך, והביטול נעשה בהגדרות המנויים של החנות.
            </Text>
            <Text style={[settingsHebrewText, styles.terms, { color: tokens.colors.text.secondary }]}>
              <Text style={styles.link} onPress={() => void Linking.openURL('https://darkpool.site/terms')}>תנאי שימוש</Text>
              {'  ·  '}
              <Text style={styles.link} onPress={() => void Linking.openURL('https://darkpool.site/privacy')}>מדיניות פרטיות</Text>
            </Text>
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.impactLight();
                void restorePurchases().then(({ restored, error }) => {
                  if (error) legacyAlert('שחזור רכישות', error);
                  else if (restored > 0) legacyAlert('שחזור רכישות', 'הרכישות שוחזרו והמנוי פעיל.');
                  else legacyAlert('שחזור רכישות', 'לא נמצאו רכישות פעילות בחשבון החנות.');
                });
              }}
              activeOpacity={0.8}
              style={styles.billingLink}
            >
              <Text style={[settingsHebrewText, settingsButtonLabelStyle, { color: tokens.colors.text.primary }]}>
                שחזור רכישות
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
        <TouchableOpacity
          onPress={() => {
            void HapticFeedback.impactLight();
            navigation.navigate('Billing');
          }}
          activeOpacity={0.8}
          style={styles.billingLink}
        >
          <Text
            style={[
              settingsHebrewText,
              settingsButtonLabelStyle,
              { color: tokens.colors.text.primary },
            ]}
          >{i18n.t('auto.screens__Profile__SubscriptionPlansScreen.s8')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: APP_LAYOUT.sectionHeaderToContent,
    paddingBottom: 28,
    flexGrow: 1,
  },
  terms: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 18,
  },
  link: {
    textDecorationLine: 'underline',
  },
  billingLink: {
    marginTop: 20,
    paddingVertical: 14,
  },
});