import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet
} from 'react-native';
import { 
  Crown, 
  Star, 
  CreditCard, 
  Calendar, 
  Check,
  ArrowRight,
  Zap,
  Users
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';

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
  const { theme } = useTheme();
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
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
      console.error('Error loading subscription data:', error);
      setLoading(false);
    }
  };

  const handlePlanSelection = (planId: string) => {
    if (!user) {
      Alert.alert('שגיאה', 'נדרש להתחבר למערכת');
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

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
          locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
            <Text style={{ color: DesignTokens.colors.text.secondary, fontSize: 16, marginTop: 16 }}>טוען נתוני מנוי...</Text>
          </View>
        </RNSafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* רקע עם גרדיאנט ירוק כהה-שחור אנכי */}
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header עם blur */}
        <View style={{ paddingTop: 0 + DesignTokens.spacing.md, paddingHorizontal: DesignTokens.spacing.lg }}>
          <UICard 
            variant="blur"
            padding="sm"
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: DesignTokens.spacing.md,
              minHeight: 44,
            }}>
              <Text style={{
                flex: 1,
                textAlign: 'center',
                fontSize: DesignTokens.typography.fontSize.lg,
                fontWeight: DesignTokens.typography.fontWeight.bold as any,
                color: DesignTokens.colors.text.primary,
                marginLeft: 36
              }}>
                מנוי ומסלול
              </Text>

              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
                style={{
                  width: 36,
                  height: 36,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 18,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }}
              >
                <ArrowRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </UICard>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Current Plan */}
          {currentPlan && (
            <View style={{ paddingHorizontal: DesignTokens.spacing.lg, paddingTop: DesignTokens.spacing.lg, marginBottom: DesignTokens.spacing['2xl'] }}>
              <Text style={{
                fontSize: DesignTokens.typography.fontSize.xs,
                fontWeight: DesignTokens.typography.fontWeight.bold as any,
                color: DesignTokens.colors.text.tertiary,
                marginBottom: DesignTokens.spacing.sm,
                marginRight: 4,
                textAlign: 'right',
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}>
                המנוי הנוכחי
              </Text>
              
              <UICard 
                variant="blur"
                padding="lg"
              >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: DesignTokens.spacing.lg }}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize['2xl'],
                    fontWeight: DesignTokens.typography.fontWeight.bold as any,
                    color: DesignTokens.colors.text.primary,
                    marginBottom: DesignTokens.spacing.xs
                  }}>
                    {currentPlan.plan_name || 'מנוי פעיל'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{
                      fontSize: DesignTokens.typography.fontSize.sm,
                      color: DesignTokens.colors.text.secondary,
                      marginLeft: DesignTokens.spacing.xs
                    }}>
                      {new Date(currentPlan.end_date).toLocaleDateString('he-IL')}
                    </Text>
                    <Calendar size={14} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                  </View>
                </View>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: `${DesignTokens.colors.primary.main}20`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: DesignTokens.spacing.md
                }}>
                  <Crown size={28} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                </View>
              </View>

              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${DesignTokens.colors.primary.main}20`,
                paddingVertical: DesignTokens.spacing.sm,
                paddingHorizontal: DesignTokens.spacing.md,
                borderRadius: DesignTokens.borderRadius.lg,
                borderWidth: 1,
                borderColor: `${DesignTokens.colors.primary.main}40`
              }}>
                <Text style={{
                  fontSize: DesignTokens.typography.fontSize.sm,
                  fontWeight: DesignTokens.typography.fontWeight.bold as any,
                  color: DesignTokens.colors.primary.main
                }}>
                  מנוי פעיל
                </Text>
                <Check size={18} color={DesignTokens.colors.primary.main} strokeWidth={2.5} style={{ marginRight: DesignTokens.spacing.xs }} />
              </View>
              </UICard>
            </View>
          )}

          {/* Available Plans */}
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg }}>
            <Text style={{
              fontSize: DesignTokens.typography.fontSize.xs,
              fontWeight: DesignTokens.typography.fontWeight.bold as any,
              color: DesignTokens.colors.text.tertiary,
              marginBottom: DesignTokens.spacing.sm,
              marginRight: 4,
              textAlign: 'right',
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}>
              מסלולים זמינים
            </Text>

            {plans.map((plan, index) => {
              const isCurrentPlan = currentPlan && plan.id === currentPlan.plan_id;
              
              return (
                <TouchableOpacity
                  key={plan.id}
                  onPress={() => handlePlanSelection(plan.id)}
                  disabled={isCurrentPlan}
                  style={{ marginBottom: DesignTokens.spacing.md, opacity: isCurrentPlan ? 0.6 : 1 }}
                >
                  <UICard 
                    variant="blur"
                    padding="lg"
                  >
                {plan.popular && (
                  <View style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    backgroundColor: DesignTokens.colors.primary.main,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: DesignTokens.colors.text.primary
                    }}>
                      מומלץ ביותר
                    </Text>
                    <Star size={14} color={DesignTokens.colors.text.primary} strokeWidth={2.5} style={{ marginRight: 6 }} />
                  </View>
                )}

                <View style={{ alignItems: 'flex-end', marginBottom: DesignTokens.spacing.lg, marginTop: plan.popular ? DesignTokens.spacing['2xl'] : 0 }}>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize['2xl'],
                    fontWeight: DesignTokens.typography.fontWeight.bold as any,
                    color: DesignTokens.colors.text.primary,
                    marginBottom: DesignTokens.spacing.xs
                  }}>
                    {plan.name}
                  </Text>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.sm,
                    color: DesignTokens.colors.text.secondary,
                    marginBottom: DesignTokens.spacing.md,
                    textAlign: 'right',
                    lineHeight: 20
                  }}>
                    {plan.description}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{
                      fontSize: DesignTokens.typography.fontSize.base,
                      color: DesignTokens.colors.text.secondary,
                      marginLeft: DesignTokens.spacing.xs
                    }}>
                      / {plan.period}
                    </Text>
                    <Text style={{
                      fontSize: DesignTokens.typography.fontSize['3xl'],
                      fontWeight: DesignTokens.typography.fontWeight.bold as any,
                      color: DesignTokens.colors.primary.main
                    }}>
                      ₪{plan.price}
                    </Text>
                  </View>
                </View>

                {/* Features */}
                <View style={{ gap: DesignTokens.spacing.sm }}>
                  {plan.features.map((feature, featureIndex) => (
                    <View key={featureIndex} style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center',
                      paddingVertical: DesignTokens.spacing.xs
                    }}>
                      <Text style={{
                        flex: 1,
                        fontSize: DesignTokens.typography.fontSize.sm,
                        color: DesignTokens.colors.text.secondary,
                        textAlign: 'right',
                        lineHeight: 20
                      }}>
                        {feature}
                      </Text>
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: `${DesignTokens.colors.primary.main}20`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: DesignTokens.spacing.sm
                      }}>
                        <Check size={12} color={DesignTokens.colors.primary.main} strokeWidth={3} />
                      </View>
                    </View>
                  ))}
                </View>

                {isCurrentPlan && (
                  <View style={{
                    marginTop: DesignTokens.spacing.lg,
                    paddingTop: DesignTokens.spacing.lg,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(255, 255, 255, 0.1)',
                    alignItems: 'center'
                  }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: `${DesignTokens.colors.primary.main}20`,
                      paddingVertical: DesignTokens.spacing.xs,
                      paddingHorizontal: DesignTokens.spacing.md,
                      borderRadius: DesignTokens.borderRadius.full,
                      borderWidth: 1,
                      borderColor: `${DesignTokens.colors.primary.main}40`
                    }}>
                      <Text style={{
                        fontSize: DesignTokens.typography.fontSize.xs,
                        color: DesignTokens.colors.primary.main,
                        fontWeight: DesignTokens.typography.fontWeight.bold as any
                      }}>
                        המסלול הנוכחי שלך
                      </Text>
                      <Check size={16} color={DesignTokens.colors.primary.main} strokeWidth={2.5} style={{ marginRight: DesignTokens.spacing.xs }} />
                    </View>
                  </View>
                )}

                {!isCurrentPlan && (
                  <View style={{
                    marginTop: DesignTokens.spacing.lg,
                    paddingTop: DesignTokens.spacing.lg,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(255, 255, 255, 0.1)'
                  }}>
                    <TouchableOpacity
                      onPress={() => handlePlanSelection(plan.id)}
                      style={{
                        backgroundColor: DesignTokens.colors.primary.main,
                        paddingVertical: DesignTokens.spacing.md,
                        paddingHorizontal: DesignTokens.spacing.lg,
                        borderRadius: DesignTokens.borderRadius.lg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...DesignTokens.shadows.md
                      }}
                    >
                      <Text style={{
                        fontSize: DesignTokens.typography.fontSize.base,
                        fontWeight: DesignTokens.typography.fontWeight.bold as any,
                        color: DesignTokens.colors.text.primary
                      }}>
                        בחר מסלול זה
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                  </UICard>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Info Note */}
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginTop: DesignTokens.spacing.md }}>
            <UICard 
              variant="blur"
              padding="md"
            >
              <Text style={{
                fontSize: DesignTokens.typography.fontSize.sm,
                color: DesignTokens.colors.text.secondary,
                textAlign: 'right',
                lineHeight: 20
              }}>
                💡 ניתן לשדרג או להוריד מסלול בכל עת. השינוי ייכנס לתוקף מיידית.
              </Text>
            </UICard>
          </View>
        </ScrollView>
      </RNSafeAreaView>
    </View>
  );
}
