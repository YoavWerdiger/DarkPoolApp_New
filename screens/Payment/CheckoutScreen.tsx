import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Dimensions,
  Linking,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  CreditCard, 
  Shield, 
  Check, 
  ArrowLeft, 
  Crown,
  Star,
  Zap,
  Clock,
  Users,
  TrendingUp,
  Lock
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';

const { width } = Dimensions.get('window');

interface CheckoutScreenProps {
  navigation: any;
  route: {
    params: {
      planId: string;
      fromRegistration?: boolean;
    };
  };
}

export default function CheckoutScreen({ navigation, route }: CheckoutScreenProps) {
  const { user } = useAuth();
  const { planId, fromRegistration = false } = route.params;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(planId || 'premium');

  const plan = SUBSCRIPTION_PLANS[selectedPlan as keyof typeof SUBSCRIPTION_PLANS];

  useEffect(() => {
    if (planId) {
      setSelectedPlan(planId);
    }
  }, [planId]);

  const handlePayment = async () => {
    if (!user) {
      Alert.alert('שגיאה', 'נדרש להתחבר למערכת');
      return;
    }

    if (!plan) {
      Alert.alert('שגיאה', 'תוכנית מנוי לא נמצאה');
      return;
    }

    setLoading(true);
    
    try {
      // אם התוכנית חינמית
      if (selectedPlan === 'free') {
        Alert.alert(
          'הרשמה הושלמה!',
          'החשבון החינמי שלך נוצר בהצלחה.',
          [
            {
              text: 'אישור',
              onPress: () => {
                if (fromRegistration) {
                  navigation.navigate('RegistrationSummary');
                } else {
                  navigation.goBack();
                }
              }
            }
          ]
        );
        return;
      }

      // יצירת בקשת תשלום ל-CardCom
      const paymentRequest = {
        amount: plan.price,
        currency: 'ILS',
        description: `מנוי ${plan.name} - ${user.email}`,
        userId: user.id,
        planId: selectedPlan,
        userEmail: user.email || '',
        userName: user.display_name || user.email || 'משתמש'
      };

      console.log('🔄 יצירת בקשת תשלום:', paymentRequest);

      const paymentResponse = await paymentService.createPaymentRequest(paymentRequest);

      if (paymentResponse.success && paymentResponse.paymentUrl) {
        // פתיחת דף התשלום בדפדפן
        const supported = await Linking.canOpenURL(paymentResponse.paymentUrl);
        
        if (supported) {
          await Linking.openURL(paymentResponse.paymentUrl);
          
          Alert.alert(
            'העברה לדף התשלום',
            'אנא השלם את התשלום בדף שנפתח. לאחר השלמת התשלום, תועבר חזרה לאפליקציה.',
            [
              {
                text: 'אישור',
                onPress: () => {
                  if (fromRegistration) {
                    navigation.navigate('RegistrationSummary');
                  } else {
                    navigation.goBack();
                  }
                }
              }
            ]
          );
        } else {
          throw new Error('לא ניתן לפתוח את דף התשלום');
        }
      } else {
        throw new Error(paymentResponse.error || 'שגיאה ביצירת בקשת התשלום');
      }
      
    } catch (error) {
      console.error('❌ שגיאה בתשלום:', error);
      Alert.alert(
        'שגיאה בתשלום', 
        error instanceof Error ? error.message : 'אירעה שגיאה בעיבוד התשלום. אנא נסה שוב.'
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // כאן ניתן להוסיף רענון נתונים
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free':
        return <Users size={24} color="#B0B0B0" />;
      case 'premium':
        return <Crown size={24} color="#00E654" />;
      case 'pro':
        return <Star size={24} color="#FFD700" />;
      default:
        return <CreditCard size={24} color="#00E654" />;
    }
  };

  const renderPlanCard = () => {
    if (!plan) return null;

    return (
      <View style={{
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 24,
        borderWidth: 2,
        borderColor: selectedPlan === 'premium' ? '#00E654' : '#333333',
        marginBottom: 24,
        shadowColor: selectedPlan === 'premium' ? '#00E654' : '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
      }}>
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
            backgroundColor: selectedPlan === 'premium' ? '#00E654' : '#333333',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 16
          }}>
            {renderPlanIcon(selectedPlan)}
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 24, 
              fontWeight: '700',
              writingDirection: 'rtl'
            }}>
              {plan.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ 
                color: '#00E654', 
                fontSize: 28, 
                fontWeight: '800',
                writingDirection: 'rtl'
              }}>
                {plan.price === 0 ? 'חינם' : `₪${plan.price}`}
              </Text>
              <Text style={{ 
                color: '#B0B0B0', 
                fontSize: 16, 
                marginLeft: 8,
                writingDirection: 'rtl'
              }}>
                לחודש
              </Text>
            </View>
          </View>
          
          {plan.popular && (
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
                מומלץ
              </Text>
            </View>
          )}
        </View>

        {/* Features */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 18, 
            fontWeight: '600', 
            marginBottom: 12,
            writingDirection: 'rtl'
          }}>
            מה כלול בתוכנית:
          </Text>
          
          {plan.features.map((feature, index) => (
            <View key={index} style={{ 
              flexDirection: 'row-reverse', 
              alignItems: 'center',
              marginBottom: 8
            }}>
              <Check size={16} color="#00E654" style={{ marginLeft: 8 }} />
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 14, 
                fontWeight: '400',
                writingDirection: 'rtl',
                flex: 1
              }}>
                {feature}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderSecurityFeatures = () => (
    <View style={{
      backgroundColor: '#1A1A1A',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: '#333333'
    }}>
      <View style={{ 
        flexDirection: 'row-reverse', 
        alignItems: 'center',
        marginBottom: 16
      }}>
        <Shield size={20} color="#00E654" style={{ marginLeft: 8 }} />
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 16, 
          fontWeight: '600',
          writingDirection: 'rtl'
        }}>
          אבטחה מלאה
        </Text>
      </View>
      
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
          <Lock size={14} color="#00E654" style={{ marginLeft: 8 }} />
          <Text style={{ 
            color: '#B0B0B0', 
            fontSize: 12,
            writingDirection: 'rtl'
          }}>
            תשלום מאובטח עם CardCom
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
          <Shield size={14} color="#00E654" style={{ marginLeft: 8 }} />
          <Text style={{ 
            color: '#B0B0B0', 
            fontSize: 12,
            writingDirection: 'rtl'
          }}>
            הצפנת SSL 256-bit
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
          <Check size={14} color="#00E654" style={{ marginLeft: 8 }} />
          <Text style={{ 
            color: '#B0B0B0', 
            fontSize: 12,
            writingDirection: 'rtl'
          }}>
            ביטול מנוי בכל עת
          </Text>
        </View>
      </View>
    </View>
  );

  const renderPaymentSummary = () => (
    <View style={{
      backgroundColor: '#1A1A1A',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: '#333333'
    }}>
      <Text style={{ 
        color: '#FFFFFF', 
        fontSize: 18, 
        fontWeight: '600', 
        marginBottom: 16,
        writingDirection: 'rtl'
      }}>
        סיכום התשלום
      </Text>
      
      <View style={{ 
        flexDirection: 'row-reverse', 
        justifyContent: 'space-between',
        marginBottom: 8
      }}>
        <Text style={{ 
          color: '#B0B0B0', 
          fontSize: 14,
          writingDirection: 'rtl'
        }}>
          {plan?.name}
        </Text>
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 14,
          fontWeight: '600'
        }}>
          {plan?.price === 0 ? 'חינם' : `₪${plan?.price}`}
        </Text>
      </View>
      
      <View style={{ 
        flexDirection: 'row-reverse', 
        justifyContent: 'space-between',
        marginBottom: 8
      }}>
        <Text style={{ 
          color: '#B0B0B0', 
          fontSize: 14,
          writingDirection: 'rtl'
        }}>
          מע"מ
        </Text>
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 14,
          fontWeight: '600'
        }}>
          {plan?.price === 0 ? '₪0' : `₪${Math.round((plan?.price || 0) * 0.17)}`}
        </Text>
      </View>
      
      <View style={{ 
        height: 1, 
        backgroundColor: '#333333', 
        marginVertical: 12 
      }} />
      
      <View style={{ 
        flexDirection: 'row-reverse', 
        justifyContent: 'space-between'
      }}>
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 18,
          fontWeight: '700',
          writingDirection: 'rtl'
        }}>
          סה"כ
        </Text>
        <Text style={{ 
          color: '#00E654', 
          fontSize: 18,
          fontWeight: '700'
        }}>
          {plan?.price === 0 ? 'חינם' : `₪${Math.round((plan?.price || 0) * 1.17)}`}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      {/* Header */}
      <LinearGradient
        colors={['#00E65420', '#00E65410', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: 60,
          paddingBottom: 20,
          paddingHorizontal: 24,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0, 230, 84, 0.2)'
        }}
      >
        <View style={{ 
          flexDirection: 'row-reverse', 
          alignItems: 'center',
          marginBottom: 16
        }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 16
            }}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 24, 
            fontWeight: '700',
            writingDirection: 'rtl',
            flex: 1
          }}>
            צ'קאאוט
          </Text>
        </View>
      </LinearGradient>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E654"
          />
        }
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          {/* Plan Card */}
          {renderPlanCard()}

          {/* Security Features */}
          {renderSecurityFeatures()}

          {/* Payment Summary */}
          {renderPaymentSummary()}

          {/* Payment Button */}
          <TouchableOpacity
            onPress={handlePayment}
            disabled={loading}
            style={{
              opacity: loading ? 0.7 : 1
            }}
          >
            <LinearGradient
              colors={['#00E654', '#00B84A', '#008F3A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 16,
                padding: 18,
                alignItems: 'center',
                shadowColor: '#00E654',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8
              }}
            >
              {loading ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <CreditCard size={20} color="#000000" style={{ marginLeft: 8 }} />
                  <Text style={{ 
                    color: '#000000', 
                    fontSize: 18, 
                    fontWeight: '700',
                    writingDirection: 'rtl'
                  }}>
                    {plan?.price === 0 ? 'המשך בחינם' : 'שלם עכשיו'}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={{ 
            color: '#666666', 
            fontSize: 12, 
            textAlign: 'center',
            marginTop: 16,
            lineHeight: 18,
            writingDirection: 'rtl'
          }}>
            בלחיצה על "שלם עכשיו" אתה מסכים לתנאי השימוש ומדיניות הפרטיות שלנו
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
