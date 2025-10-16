import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { 
  Crown, 
  Star, 
  CreditCard, 
  Calendar, 
  Check,
  ArrowLeft,
  Zap,
  Users
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';

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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00E654" />
          <Text style={{ color: theme.textSecondary, fontSize: 16, marginTop: 16 }}>טוען נתוני מנוי...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ backgroundColor: theme.cardBackground }}>
        {/* Header */}
        <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: theme.cardBackground,
        borderBottomWidth: 1,
        borderBottomColor: theme.border
      }}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={{
            width: 36,
            height: 36,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 18,
            backgroundColor: theme.isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'
          }}
        >
          <ArrowLeft size={20} color={theme.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        
        <Text style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 20,
          fontWeight: '700',
          color: theme.textPrimary,
          marginRight: 36
        }}>
          מנוי ומסלול
        </Text>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Current Plan */}
        {currentPlan && (
          <View style={{ paddingHorizontal: 20, paddingTop: 24, marginBottom: 32 }}>
            <Text style={{
              fontSize: 13,
              fontWeight: '700',
              color: theme.textSecondary,
              marginBottom: 12,
              marginRight: 4,
              textAlign: 'right',
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}>
              המנוי הנוכחי
            </Text>
            
            <View style={{
              backgroundColor: theme.cardBackground,
              borderRadius: 16,
              padding: 24
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: theme.textPrimary,
                    marginBottom: 6
                  }}>
                    {currentPlan.plan_name || 'מנוי פעיל'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{
                      fontSize: 14,
                      color: theme.textSecondary,
                      marginLeft: 6
                    }}>
                      {new Date(currentPlan.end_date).toLocaleDateString('he-IL')}
                    </Text>
                    <Calendar size={14} color={theme.textTertiary} strokeWidth={2} />
                  </View>
                </View>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: 'rgba(5, 209, 87, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 16
                }}>
                  <Crown size={28} color="#00E654" strokeWidth={2} />
                </View>
              </View>

              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(5, 209, 87, 0.15)',
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 10
              }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: '#00E654'
                }}>
                  מנוי פעיל
                </Text>
                <Check size={18} color="#00E654" strokeWidth={2.5} style={{ marginRight: 8 }} />
              </View>
            </View>
          </View>
        )}

        {/* Available Plans */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{
            fontSize: 13,
            fontWeight: '700',
            color: theme.textSecondary,
            marginBottom: 12,
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
                style={{
                  backgroundColor: theme.cardBackground,
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 16,
                  opacity: isCurrentPlan ? 0.6 : 1
                }}
              >
                {plan.popular && (
                  <View style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    backgroundColor: '#00E654',
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: '#ffffff'
                    }}>
                      מומלץ ביותר
                    </Text>
                    <Star size={14} color="#ffffff" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  </View>
                )}

                <View style={{ alignItems: 'flex-end', marginBottom: 20, marginTop: plan.popular ? 24 : 0 }}>
                  <Text style={{
                    fontSize: 22,
                    fontWeight: '700',
                    color: theme.textPrimary,
                    marginBottom: 6
                  }}>
                    {plan.name}
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: theme.textSecondary,
                    marginBottom: 12,
                    textAlign: 'right'
                  }}>
                    {plan.description}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <Text style={{
                      fontSize: 15,
                      color: theme.textSecondary,
                      marginLeft: 6
                    }}>
                      / {plan.period}
                    </Text>
                    <Text style={{
                      fontSize: 32,
                      fontWeight: '700',
                      color: '#00E654'
                    }}>
                      ₪{plan.price}
                    </Text>
                  </View>
                </View>

                {/* Features */}
                <View style={{ gap: 10 }}>
                  {plan.features.map((feature, featureIndex) => (
                    <View key={featureIndex} style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center'
                    }}>
                      <Text style={{
                        flex: 1,
                        fontSize: 14,
                        color: theme.textSecondary,
                        textAlign: 'right',
                        lineHeight: 20
                      }}>
                        {feature}
                      </Text>
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: 'rgba(5, 209, 87, 0.15)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 12
                      }}>
                        <Check size={14} color="#00E654" strokeWidth={3} />
                      </View>
                    </View>
                  ))}
                </View>

                {isCurrentPlan && (
                  <View style={{
                    marginTop: 20,
                    paddingTop: 20,
                    borderTopWidth: 1,
                    borderTopColor: '#2a2a2a',
                    alignItems: 'center'
                  }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(5, 209, 87, 0.1)',
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      borderRadius: 20
                    }}>
                      <Text style={{
                        fontSize: 13,
                        color: '#00E654',
                        fontWeight: '700'
                      }}>
                        המסלול הנוכחי שלך
                      </Text>
                      <Check size={16} color="#00E654" strokeWidth={2.5} style={{ marginRight: 6 }} />
                    </View>
                  </View>
                )}

                {!isCurrentPlan && (
                  <View style={{
                    marginTop: 20,
                    paddingTop: 20,
                    borderTopWidth: 1,
                    borderTopColor: '#2a2a2a'
                  }}>
                    <View style={{
                      backgroundColor: 'rgba(5, 209, 87, 0.1)',
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      borderRadius: 10,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(5, 209, 87, 0.3)'
                    }}>
                      <Text style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: '#00E654'
                      }}>
                        בחר מסלול זה
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info Note */}
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)'
          }}>
            <Text style={{
              fontSize: 13,
              color: theme.textSecondary,
              textAlign: 'right',
              lineHeight: 20
            }}>
              💡 ניתן לשדרג או להוריד מסלול בכל עת. השינוי ייכנס לתוקף מיידית.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
