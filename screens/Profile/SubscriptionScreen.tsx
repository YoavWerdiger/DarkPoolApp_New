import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert,
  TouchableOpacity
} from 'react-native';
import { 
  Crown, 
  CreditCard, 
  Check,
  X
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  popular: boolean;
}

export default function SubscriptionScreen({ navigation }: any) {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const currentSubscription = await paymentService.getCurrentSubscription(user.id);
      setCurrentPlan(currentSubscription);

      const availablePlans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        period: plan.period,
        features: plan.features,
        popular: plan.popular
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
      Alert.alert('שגיאה', 'נדרש להתחבר');
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
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#666', fontSize: 16 }}>טוען...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      {/* Header */}
      <View style={{
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1E1E1E',
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <View style={{ width: 24 }} />
        
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 18, 
          fontWeight: '600',
          writingDirection: 'rtl'
        }}>
          מסלול ותשלום
        </Text>
        
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={24} color="#666" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          {/* Current Plan */}
          {currentPlan ? (
            <View style={{
              marginBottom: 32,
              padding: 20,
              borderRadius: 16,
              backgroundColor: '#1A1A1A',
              borderWidth: 2,
              borderColor: '#00E654'
            }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center',
                marginBottom: 12
              }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: '#00E654',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 12
                }}>
                  <Crown size={20} color="#000" strokeWidth={2} />
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    color: '#FFFFFF', 
                    fontSize: 18, 
                    fontWeight: '600'
                  }}>
                    {currentPlan.name}
                  </Text>
                  <Text style={{ 
                    color: '#00E654', 
                    fontSize: 14
                  }}>
                    מנוי פעיל
                  </Text>
                </View>
              </View>

              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: '#2A2A2A'
              }}>
                <View>
                  <Text style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                    חיוב הבא
                  </Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                    {currentPlan.price}₪
                  </Text>
                </View>
                <View>
                  <Text style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                    תאריך חידוש
                  </Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                    {currentPlan.nextBilling}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{
              marginBottom: 32,
              padding: 40,
              alignItems: 'center',
              backgroundColor: '#1A1A1A',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#2A2A2A'
            }}>
              <CreditCard size={40} color="#666" style={{ marginBottom: 12 }} />
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 16, 
                fontWeight: '600',
                marginBottom: 4
              }}>
                אין מנוי פעיל
              </Text>
              <Text style={{ 
                color: '#666', 
                fontSize: 14,
                textAlign: 'center'
              }}>
                בחר תוכנית מנוי כדי להתחיל
              </Text>
            </View>
          )}

          {/* Plans */}
          <Text style={{ 
            color: '#999', 
            fontSize: 14, 
            fontWeight: '600', 
            marginBottom: 16,
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}>
            תוכניות מנוי
          </Text>

          {plans.map((plan, index) => (
            <TouchableOpacity
              key={plan.id}
              onPress={() => handlePlanSelection(plan.id)}
              style={{
                marginBottom: 16,
                padding: 20,
                borderRadius: 16,
                backgroundColor: '#1A1A1A',
                borderWidth: plan.popular ? 2 : 1,
                borderColor: plan.popular ? '#00E654' : '#2A2A2A',
                position: 'relative'
              }}
            >
              {plan.popular && (
                <View style={{
                  position: 'absolute',
                  top: -10,
                  left: 20,
                  backgroundColor: '#00E654',
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 8
                }}>
                  <Text style={{ 
                    color: '#000', 
                    fontSize: 11, 
                    fontWeight: '600'
                  }}>
                    מומלץ
                  </Text>
                </View>
              )}

              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center',
                marginBottom: 16
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    color: '#FFFFFF', 
                    fontSize: 18, 
                    fontWeight: '600',
                    marginBottom: 4
                  }}>
                    {plan.name}
                  </Text>
                  <Text style={{ 
                    color: '#666', 
                    fontSize: 14
                  }}>
                    {plan.period}
                  </Text>
                </View>
                
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ 
                    color: '#00E654', 
                    fontSize: 24, 
                    fontWeight: '700' 
                  }}>
                    {plan.price}₪
                  </Text>
                  <Text style={{ 
                    color: '#666', 
                    fontSize: 12
                  }}>
                    {plan.period}
                  </Text>
                </View>
              </View>

              {/* Features */}
              <View style={{ 
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: '#2A2A2A'
              }}>
                {plan.features.map((feature, featureIndex) => (
                  <View key={featureIndex} style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    marginBottom: 8
                  }}>
                    <Check size={14} color="#00E654" style={{ marginLeft: 8 }} strokeWidth={2.5} />
                    <Text style={{ 
                      color: '#FFFFFF', 
                      fontSize: 14
                    }}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Action Button */}
              <View style={{
                marginTop: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: plan.popular ? '#00E654' : '#252525',
                alignItems: 'center'
              }}>
                <Text style={{ 
                  color: plan.popular ? '#000' : '#00E654', 
                  fontSize: 15, 
                  fontWeight: '600'
                }}>
                  {currentPlan && plan.id === currentPlan.plan_id ? 'מנוי נוכחי' : 'בחר תוכנית'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Cancel Subscription */}
          {currentPlan && (
            <TouchableOpacity
              style={{
                marginTop: 24,
                paddingVertical: 16,
                borderRadius: 12,
                backgroundColor: '#1A1A1A',
                borderWidth: 1,
                borderColor: '#DC2626',
                alignItems: 'center'
              }}
            >
              <Text style={{ 
                color: '#DC2626', 
                fontSize: 15, 
                fontWeight: '500'
              }}>
                בטל מנוי
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
