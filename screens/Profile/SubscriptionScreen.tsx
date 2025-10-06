import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert,
  Animated,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Crown, 
  Star, 
  Zap, 
  CreditCard, 
  Calendar, 
  Check,
  ChevronRight,
  ArrowUpRight,
  Shield,
  Clock,
  TrendingUp,
  Users
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';

const { width } = Dimensions.get('window');

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  period: string;
  features: string[];
  color: string;
  popular: boolean;
  icon: any;
  glow: string[];
}

interface PaymentHistory {
  id: string;
  amount: number;
  date: string;
  status: 'success' | 'pending' | 'failed';
  description: string;
}

export default function SubscriptionScreen({ navigation }: any) {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    // טעינת נתונים אמיתיים מהשרת
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // טעינת המנוי הנוכחי
      const currentSubscription = await paymentService.getCurrentSubscription(user.id);
      setCurrentPlan(currentSubscription);

      // המרת תוכניות המנוי לפורמט המתאים לתצוגה
      const availablePlans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.id === 'monthly' ? 'מסלול חיים חודשי עם גישה מלאה' : 
                    plan.id === 'quarterly' ? 'מסלול חיים רבעוני עם הנחה' : 
                    'מסלול חיים שנתי עם הנחה מקסימלית',
        price: plan.price,
        period: plan.period,
        features: plan.features,
        color: plan.id === 'monthly' ? '#00E654' : 
               plan.id === 'quarterly' ? '#FFD700' : '#FF6B35',
        popular: plan.popular,
        icon: plan.id === 'monthly' ? Crown : 
              plan.id === 'quarterly' ? Star : Users,
        glow: plan.id === 'monthly' ? ['#00E65430', '#00E65420', '#00E65410'] : 
              plan.id === 'quarterly' ? ['#FFD70030', '#FFD70020', '#FFD70010'] : 
              ['#FF6B3530', '#FF6B3520', '#FF6B3510']
      }));
      setPlans(availablePlans);

      // טעינת היסטוריית התשלומים
      const history = await paymentService.getPaymentHistory(user.id);
      setPaymentHistory(history.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        date: new Date(payment.created_at).toLocaleDateString('he-IL'),
        status: payment.status as 'success' | 'pending' | 'failed',
        description: `מנוי ${payment.plan_id}`
      })));
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading subscription data:', error);
      setLoading(false);
    }
  };

  const renderCurrentPlanCard = () => {
    if (loading) {
      return (
        <View style={{ 
          padding: 40, 
          alignItems: 'center',
          backgroundColor: '#1A1A1A',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#333333',
          marginBottom: 30
        }}>
          <Text style={{ color: '#B0B0B0', fontSize: 16, writingDirection: 'rtl' }}>
            טוען נתוני מנוי...
          </Text>
        </View>
      );
    }

    if (!currentPlan) {
      return (
        <View style={{ 
          padding: 40, 
          alignItems: 'center',
          backgroundColor: '#1A1A1A',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: '#333333',
          marginBottom: 30
        }}>
          <CreditCard size={48} color="#666666" style={{ marginBottom: 16 }} />
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 18, 
            fontWeight: '600',
            marginBottom: 8,
            writingDirection: 'rtl'
          }}>
            אין מנוי פעיל
          </Text>
          <Text style={{ 
            color: '#B0B0B0', 
            fontSize: 14,
            textAlign: 'center',
            writingDirection: 'rtl'
          }}>
            בחר תוכנית מנוי כדי להתחיל
          </Text>
        </View>
      );
    }

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          marginBottom: 30
        }}
      >
        <LinearGradient
          colors={['#00E65430', '#00E65420', '#00E65410', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            padding: 24,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: 'rgba(0, 230, 84, 0.5)',
            shadowColor: '#00E654',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8
          }}
        >
          {/* Header */}
          <View style={{ 
            flexDirection: 'row-reverse', 
            alignItems: 'center',
            marginBottom: 20
          }}>
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 15,
              backgroundColor: '#00E654',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 16,
              shadowColor: '#00E654',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 4
            }}>
              <Crown size={24} color="#000000" strokeWidth={2} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 24, 
                fontWeight: '700',
                writingDirection: 'rtl'
              }}>
                {currentPlan.name} - פעיל
              </Text>
              <Text style={{ 
                color: '#00E654', 
                fontSize: 16, 
                fontWeight: '500',
                writingDirection: 'rtl'
              }}>
                {currentPlan.price}₪ / {currentPlan.period}
              </Text>
            </View>
            
            <View style={{
              backgroundColor: '#00E654',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12
            }}>
              <Text style={{ 
                color: '#000000', 
                fontSize: 12, 
                fontWeight: '600' 
              }}>
                פעיל
              </Text>
            </View>
          </View>

          {/* פרטי החיוב */}
          <View style={{ 
            flexDirection: 'row-reverse', 
            justifyContent: 'space-between',
            marginBottom: 20
          }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>
                {currentPlan.price}₪
              </Text>
              <Text style={{ color: '#B0B0B0', fontSize: 12, fontWeight: '400' }}>
                חיוב הבא
              </Text>
            </View>
            
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>
                {currentPlan.nextBilling}
              </Text>
              <Text style={{ color: '#B0B0B0', fontSize: 12, fontWeight: '400' }}>
                תאריך חידוש
              </Text>
            </View>
            
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#00E654', fontSize: 18, fontWeight: '600' }}>
                ₪₪₪
              </Text>
              <Text style={{ color: '#B0B0B0', fontSize: 12, fontWeight: '400' }}>
                אמצעי תשלום
              </Text>
            </View>
          </View>

          {/* כפתורי פעולה */}
          <View style={{ 
            flexDirection: 'row-reverse', 
            justifyContent: 'space-between' 
          }}>
            <TouchableOpacity style={{ flex: 1, marginLeft: 8 }}>
              <LinearGradient
                colors={['#00E654', '#00D04B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  alignItems: 'center'
                }}
              >
                <Text style={{ 
                  color: '#000000', 
                  fontSize: 14, 
                  fontWeight: '600',
                  writingDirection: 'rtl'
                }}>
                  שדרוג
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity style={{ flex: 1, marginRight: 8 }}>
              <LinearGradient
                colors={['#333333', '#2A2A2A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#00E654'
                }}
              >
                <Text style={{ 
                  color: '#00E654', 
                  fontSize: 14, 
                  fontWeight: '600',
                  writingDirection: 'rtl'
                }}>
                  ניהול תשלום
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderPlanCard = (plan: SubscriptionPlan, index: number) => (
    <Animated.View
      key={plan.id}
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        marginBottom: 16
      }}
    >
      <TouchableOpacity
        style={{
          shadowColor: plan.color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4
        }}
      >
          <LinearGradient
            colors={plan.popular ? [plan.glow[0], plan.glow[1], plan.glow[2]] : ['#252525', '#1E1E1E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              padding: 20,
              borderRadius: 20,
              borderWidth: plan.popular ? 2 : 1,
              borderColor: plan.popular ? plan.color : '#333333',
              position: 'relative'
            }}
        >
          {/* תג פופולרי */}
          {plan.popular && (
            <View style={{
              position: 'absolute',
              top: -8,
              right: 20,
              backgroundColor: plan.color,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 12,
              shadowColor: plan.color,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 4,
              elevation: 4
            }}>
              <Text style={{ 
                color: '#000000', 
                fontSize: 12, 
                fontWeight: '600' 
              }}>
                הכי פופולרי
              </Text>
            </View>
          )}

          {/* Header */}
          <View style={{ 
            flexDirection: 'row-reverse', 
            alignItems: 'center',
            marginBottom: 16
          }}>
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: plan.color,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 16
            }}>
              <plan.icon size={20} color="#FFFFFF" strokeWidth={2} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 20, 
                fontWeight: '600',
                writingDirection: 'rtl'
              }}>
                {plan.name}
              </Text>
              <Text style={{ 
                color: '#B0B0B0', 
                fontSize: 14, 
                fontWeight: '400',
                writingDirection: 'rtl'
              }}>
                {plan.description}
              </Text>
            </View>
            
            <View style={{ alignItems: 'center' }}>
              <Text style={{ 
                color: plan.color, 
                fontSize: 24, 
                fontWeight: '700' 
              }}>
                {plan.price === 0 ? 'חינם' : `${plan.price}₪`}
              </Text>
              <Text style={{ 
                color: '#B0B0B0', 
                fontSize: 12, 
                fontWeight: '400' 
              }}>
                {plan.period}
              </Text>
            </View>
          </View>

          {/* תכונות */}
          <View style={{ marginBottom: 16 }}>
            {plan.features.map((feature, featureIndex) => (
              <View key={featureIndex} style={{ 
                flexDirection: 'row-reverse', 
                alignItems: 'center',
                marginBottom: 8
              }}>
                <Check size={16} color={plan.color} style={{ marginLeft: 8 }} />
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontSize: 14, 
                  fontWeight: '400',
                  writingDirection: 'rtl'
                }}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          {/* כפתור בחירה */}
          <TouchableOpacity onPress={() => handlePlanSelection(plan.id)}>
            <LinearGradient
              colors={plan.popular ? [plan.color, plan.color] : ['#333333', '#2A2A2A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                padding: 12,
                borderRadius: 12,
                alignItems: 'center',
                borderWidth: plan.popular ? 0 : 1,
                borderColor: plan.color
              }}
            >
              <Text style={{ 
                color: plan.popular ? '#000000' : plan.color, 
                fontSize: 16, 
                fontWeight: '600',
                writingDirection: 'rtl'
              }}>
                {currentPlan && plan.id === currentPlan.plan_id ? 'מנוי נוכחי' : 
                 plan.price === 0 ? 'התחל עכשיו' : 'בחר תוכנית'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const handlePlanSelection = (planId: string) => {
    if (!user) {
      Alert.alert('שגיאה', 'נדרש להתחבר למערכת');
      return;
    }

    // אם זה המנוי הנוכחי, לא צריך לעשות כלום
    if (currentPlan && planId === currentPlan.plan_id) {
      return;
    }

    // כל התוכניות הן בתשלום - אין תוכנית חינמית

    // עבור תוכניות בתשלום, עבור לדף הצ'קאאוט עם פרטי אשראי
    navigation.navigate('CreditCardCheckout', { 
      planId: planId,
      fromRegistration: false 
    });
  };

  const renderPaymentHistory = () => {
    if (paymentHistory.length === 0) return null;

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          marginTop: 20
        }}
      >
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 20, 
          fontWeight: '600', 
          marginBottom: 16,
          writingDirection: 'rtl'
        }}>
          היסטוריית תשלומים
        </Text>
        
        <View style={{
          backgroundColor: '#1A1A1A',
          borderRadius: 20,
          padding: 4,
          borderWidth: 1,
          borderColor: '#2A2A2A'
        }}>
          {paymentHistory.slice(0, 3).map((payment, index) => (
            <View key={payment.id} style={{
              padding: 16,
              borderBottomWidth: index < 2 ? 1 : 0,
              borderBottomColor: '#333333',
              flexDirection: 'row-reverse',
              alignItems: 'center'
            }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: payment.status === 'success' ? '#00E654' : 
                                payment.status === 'pending' ? '#F59E0B' : '#DC2626',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 16
              }}>
                <CreditCard size={18} color="#FFFFFF" strokeWidth={2} />
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontSize: 16, 
                  fontWeight: '500',
                  writingDirection: 'rtl'
                }}>
                  {payment.description}
                </Text>
                <Text style={{ 
                  color: '#B0B0B0', 
                  fontSize: 14, 
                  fontWeight: '400',
                  writingDirection: 'rtl'
                }}>
                  {payment.date}
                </Text>
              </View>
              
              <View style={{ alignItems: 'center' }}>
                <Text style={{ 
                  color: payment.status === 'success' ? '#00E654' : 
                         payment.status === 'pending' ? '#F59E0B' : '#DC2626',
                  fontSize: 16, 
                  fontWeight: '600' 
                }}>
                  {payment.amount}₪
                </Text>
                <Text style={{ 
                  color: payment.status === 'success' ? '#00E654' : 
                         payment.status === 'pending' ? '#F59E0B' : '#DC2626',
                  fontSize: 12, 
                  fontWeight: '400' 
                }}>
                  {payment.status === 'success' ? 'הושלם' : 
                   payment.status === 'pending' ? 'ממתין' : 'נכשל'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <LinearGradient
          colors={['#00E65420', '#00E65410', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 60,
            paddingBottom: 30,
            paddingHorizontal: 24,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0, 230, 84, 0.2)'
          }}
        >
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 24, 
            fontWeight: '700',
            writingDirection: 'rtl'
          }}>
            מסלול ותשלום
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: 24, paddingTop: 30 }}>
          {/* כרטיס מנוי נוכחי */}
          {renderCurrentPlanCard()}

          {/* תוכניות מנוי */}
          {plans.length > 0 && (
            <>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 22, 
                fontWeight: '600', 
                marginBottom: 20,
                writingDirection: 'rtl'
              }}>
                תוכניות מנוי
              </Text>
              
              {plans.map((plan, index) => renderPlanCard(plan, index))}
            </>
          )}

          {/* היסטוריית תשלומים */}
          {renderPaymentHistory()}

          {/* כפתור ביטול מנוי */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              marginTop: 30
            }}
          >
            <TouchableOpacity
              style={{
                shadowColor: '#DC2626',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 3
              }}
            >
              <LinearGradient
                colors={['#2A1A1A', '#1A0A0A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#DC2626'
                }}
              >
                <Text style={{ 
                  color: '#DC2626', 
                  fontSize: 16, 
                  fontWeight: '600',
                  writingDirection: 'rtl'
                }}>
                  בטל מנוי
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}