import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Crown, Star, Calendar, Check, Users } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { SettingsGlassCard, SettingsSectionTitle } from '../../components/profile/ProfileSettingsUI';
import {
  settingsHebrewText,
  settingsRowType,
  settingsBodyType,
  settingsMetaType,
  settingsCaptionType,
  settingsButtonLabelStyle,
} from '../../components/profile/settingsType';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import UIButton from '../../components/ui/UIButton';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  period: string;
  features: string[];
  popular: boolean;
  icon: any;
}

export default function SubscriptionScreen({ navigation }: any) {
  const { user } = useAuth();
  const tokens = useDesignTokens();
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSubscriptionData();
    }
  }, [user]);

  const loadSubscriptionData = async () => {
    try {
      if (!user) {
        setLoading(false);
        return;
      }

      const subscription = await paymentService.getCurrentSubscription(user.id);
      setCurrentPlan(subscription);

      const availablePlans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        period: plan.period,
        features: plan.features,
        popular: plan.popular,
        icon: plan.id === 'monthly' ? Crown :
          plan.id === 'quarterly' ? Star : Users
      }));
      setPlans(availablePlans);

      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const handlePlanSelection = (planId: string) => {
    if (!user) {
      legacyAlert('שגיאה', 'נדרש להתחבר למערכת');
      return;
    }

    if (currentPlan && planId === currentPlan.plan_id) {
      return;
    }

    navigation.navigate('CreditCardCheckout', {
      planId: planId,
      fromRegistration: false
    });
  };

  const canvas = { backgroundColor: tokens.colors.background.primary };

  if (loading) {
    return (
      <View style={[styles.center, canvas]}>
        <ActivityIndicator size="large" color={tokens.colors.primary.main} />
        <Text style={[styles.loadingText, { color: tokens.colors.text.secondary }]}>
          טוען נתוני מנוי...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, canvas]}>
      <RNSafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title="מנוי ומסלול"
          onBack={() => {
            void HapticFeedback.impactLight();
            navigation.goBack();
          }}
        />

        <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
          <View style={styles.scroll}>
            {currentPlan ? (
              <View>
                <SettingsSectionTitle title="המנוי הנוכחי" />
                <SettingsGlassCard style={styles.cardPad}>
                  <View style={styles.heroRow}>
                    <View style={styles.heroCopy}>
                      <Text style={[styles.planName, { color: tokens.colors.text.primary }]}>
                        {currentPlan.plan_name || 'מנוי פעיל'}
                      </Text>
                      <View style={styles.dateRow}>
                        <Text style={[styles.meta, { color: tokens.colors.text.secondary }]}>
                          {new Date(currentPlan.end_date).toLocaleDateString('he-IL')}
                        </Text>
                        <Calendar size={14} color={tokens.colors.text.tertiary} strokeWidth={2} />
                      </View>
                    </View>
                    <View style={[styles.iconWell, { backgroundColor: tokens.colors.background.navChrome }]}>
                      <Crown size={24} color={tokens.colors.text.primary} strokeWidth={2} />
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: tokens.colors.background.navChrome }]}>
                    <Text style={[styles.caption, { color: tokens.colors.text.primary }]}>מנוי פעיל</Text>
                    <Check size={16} color={tokens.colors.text.primary} strokeWidth={2.5} />
                  </View>
                </SettingsGlassCard>
              </View>
            ) : null}

            <SettingsSectionTitle title="מסלולים זמינים" />
            {plans.map((plan) => {
              const isCurrentPlan = currentPlan && plan.id === currentPlan.plan_id;
              return (
                <View key={plan.id} style={{ opacity: isCurrentPlan ? 0.72 : 1 }}>
                  <SettingsGlassCard style={styles.cardPad}>
                    {plan.popular ? (
                      <View style={[styles.popular, { backgroundColor: tokens.colors.primary.main }]}>
                        <Text style={[styles.caption, { color: tokens.colors.text.inverse }]}>מומלץ ביותר</Text>
                        <Star size={14} color={tokens.colors.text.inverse} strokeWidth={2.5} />
                      </View>
                    ) : null}

                    <Text style={[styles.planName, { color: tokens.colors.text.primary, marginTop: plan.popular ? 28 : 0 }]}>
                      {plan.name}
                    </Text>
                    <Text style={[styles.body, { color: tokens.colors.text.secondary }]}>
                      {plan.description}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={[styles.meta, { color: tokens.colors.text.secondary }]}>/ {plan.period}</Text>
                      <Text style={[styles.price, { color: tokens.colors.text.primary }]}>₪{plan.price}</Text>
                    </View>

                    <View style={styles.features}>
                      {plan.features.map((feature) => (
                        <View key={feature} style={styles.featureRow}>
                          <Text style={[styles.body, { color: tokens.colors.text.secondary, flex: 1 }]}>
                            {feature}
                          </Text>
                          <Check size={16} color={tokens.colors.text.secondary} strokeWidth={2.5} />
                        </View>
                      ))}
                    </View>

                    <View style={[styles.footerRule, { borderTopColor: tokens.colors.border.divider }]}>
                      {isCurrentPlan ? (
                        <Text style={[styles.caption, { color: tokens.colors.text.secondary, textAlign: 'center' }]}>
                          המסלול הנוכחי שלך
                        </Text>
                      ) : (
                        <UIButton
                          title="בחר מסלול זה"
                          variant="primary"
                          fullWidth
                          onPress={() => {
                            void HapticFeedback.medium();
                            handlePlanSelection(plan.id);
                          }}
                        />
                      )}
                    </View>
                  </SettingsGlassCard>
                </View>
              );
            })}

            <SettingsGlassCard style={styles.cardPad}>
              <Text style={[styles.body, { color: tokens.colors.text.secondary }]}>
                ניתן לשדרג או להוריד מסלול בכל עת. השינוי ייכנס לתוקף מיידית.
              </Text>
            </SettingsGlassCard>
          </View>
        </ScrollView>
      </RNSafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...settingsHebrewText,
    ...settingsBodyType,
    marginTop: APP_LAYOUT.componentGap,
  },
  scroll: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: APP_LAYOUT.sectionHeaderToContent,
    paddingBottom: 48,
  },
  cardPad: {
    padding: APP_LAYOUT.cardPadding,
    borderRadius: UI_CARD_RADIUS,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    alignItems: 'flex-end',
  },
  planName: {
    ...settingsHebrewText,
    ...settingsRowType,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: APP_LAYOUT.titleSubtitleGap,
  },
  meta: {
    ...settingsHebrewText,
    ...settingsMetaType,
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  statusPill: {
    marginTop: APP_LAYOUT.cardStackGap,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  caption: {
    ...settingsCaptionType,
    fontWeight: settingsButtonLabelStyle.fontWeight,
  },
  popular: {
    position: 'absolute',
    top: 16,
    left: 16,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  body: {
    ...settingsHebrewText,
    ...settingsBodyType,
    marginTop: APP_LAYOUT.titleSubtitleGap,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: APP_LAYOUT.cardStackGap,
  },
  price: {
    ...APP_TYPE.cardMetricValueSecondary,
  },
  features: {
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerRule: {
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    paddingTop: APP_LAYOUT.cardTitleToBodyGap,
    borderTopWidth: 1,
  },
});
