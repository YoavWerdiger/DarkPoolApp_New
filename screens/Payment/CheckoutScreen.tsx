import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Linking, RefreshControl } from 'react-native';
import {
  CreditCard,
  Shield,
  Check,
  Crown,
  Star,
  Zap,
  Clock,
  Users,
  TrendingUp,
  Lock,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { HapticFeedback } from '../../utils/hapticFeedback';

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
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
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
      legacyAlert('שגיאה', 'נדרש להתחבר למערכת');
      return;
    }

    if (!plan) {
      legacyAlert('שגיאה', 'תוכנית מנוי לא נמצאה');
      return;
    }

    setLoading(true);
    
    try {
      // אם התוכנית חינמית
      if (selectedPlan === 'free') {
        void HapticFeedback.success();
        legacyAlert(
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
        userEmail: user?.email || '',
        userName: user?.display_name || user?.email || 'משתמש'
      };

      const paymentResponse = await paymentService.createPaymentRequest(paymentRequest);

      if (paymentResponse.success && paymentResponse.paymentUrl) {
        // פתיחת דף התשלום בדפדפן
        const supported = await Linking.canOpenURL(paymentResponse.paymentUrl);
        
        if (supported) {
          await Linking.openURL(paymentResponse.paymentUrl);
          void HapticFeedback.impactLight();
          legacyAlert(
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
      void HapticFeedback.error();
      legacyAlert(
        'שגיאה בתשלום', 
        error instanceof Error ? error.message : 'אירעה שגיאה בעיבוד התשלום. אנא נסה שוב.'
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // כאן ניתן להוסיף רענון נתונים
      await new Promise<void>((r) => setTimeout(r, 1000));
    } finally {
      setRefreshing(false);
      void HapticFeedback.impactLight();
    }
  };

  const renderPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free':
        return <Users size={24} color="#B0B0B0" />;
      case 'premium':
        return <Crown size={24} color={DesignTokens.colors.primary.main} />;
      case 'pro':
        return <Star size={24} color="#FFD700" />;
      default:
        return <CreditCard size={24} color={DesignTokens.colors.primary.main} />;
    }
  };

  const renderPlanCard = () => {
    if (!plan) return null;

    return (
      <UICard
        variant="inputGlass"
        padding="lg"
        style={{
          marginBottom: DesignTokens.spacing.lg,
          borderRadius: DesignTokens.borderRadius.lg,
        }}
      >
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center',
          marginBottom: 20
        }}>
          <View style={{
            width: 50,
            height: 50,
            borderRadius: 15,
            backgroundColor: selectedPlan === 'premium' ? DesignTokens.colors.primary.main : 'rgba(255, 255, 255, 0.05)',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 16
          }}>
            {renderPlanIcon(selectedPlan)}
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: DesignTokens.colors.text.primary, 
              fontSize: 24, 
              fontWeight: '700',
              writingDirection: 'rtl'
            }}>
              {plan.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ 
                color: DesignTokens.colors.primary.main, 
                fontSize: 28, 
                fontWeight: '800',
                writingDirection: 'rtl'
              }}>
                {plan.price === 0 ? 'חינם' : `₪${plan.price}`}
              </Text>
              <Text style={{ 
                color: DesignTokens.colors.text.secondary, 
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
              backgroundColor: DesignTokens.colors.primary.main,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12
            }}>
              <Text style={{
                color: DesignTokens.colors.text.inverse,
                fontSize: 12,
                fontWeight: '600',
              }}>
                מומלץ
              </Text>
            </View>
          )}
        </View>

        {/* Features */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ 
            color: DesignTokens.colors.text.primary, 
            fontSize: 18, 
            fontWeight: '600', 
            marginBottom: 12,
            writingDirection: 'rtl'
          }}>
            מה כלול בתוכנית:
          </Text>
          
          {plan.features.map((feature, index) => (
            <View key={index} style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              marginBottom: 8
            }}>
              <Check size={16} color={DesignTokens.colors.primary.main} style={{ marginLeft: 8 }} />
              <Text style={{ 
                color: DesignTokens.colors.text.primary, 
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
      </UICard>
    );
  };

  const renderSecurityFeatures = () => (
    <UICard
      variant="inputGlass"
      padding="lg"
      style={{
        marginBottom: DesignTokens.spacing.lg,
        borderRadius: DesignTokens.borderRadius.lg,
      }}
    >
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center',
        marginBottom: 16
      }}>
        <Shield size={20} color={DesignTokens.colors.primary.main} style={{ marginLeft: 8 }} />
        <Text style={{ 
          color: DesignTokens.colors.text.primary, 
          fontSize: 16, 
          fontWeight: '600',
          writingDirection: 'rtl'
        }}>
          אבטחה מלאה
        </Text>
      </View>
      
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Lock size={14} color={DesignTokens.colors.primary.main} style={{ marginLeft: 8 }} />
          <Text style={{ 
            color: DesignTokens.colors.text.secondary, 
            fontSize: 12,
            writingDirection: 'rtl'
          }}>
            תשלום מאובטח עם CardCom
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Shield size={14} color={DesignTokens.colors.primary.main} style={{ marginLeft: 8 }} />
          <Text style={{ 
            color: DesignTokens.colors.text.secondary, 
            fontSize: 12,
            writingDirection: 'rtl'
          }}>
            הצפנת SSL 256-bit
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Check size={14} color={DesignTokens.colors.primary.main} style={{ marginLeft: 8 }} />
          <Text style={{ 
            color: DesignTokens.colors.text.secondary, 
            fontSize: 12,
            writingDirection: 'rtl'
          }}>
            ביטול מנוי בכל עת
          </Text>
        </View>
      </View>
    </UICard>
  );

  const renderPaymentSummary = () => (
    <UICard
      variant="inputGlass"
      padding="lg"
      style={{
        marginBottom: DesignTokens.spacing.lg,
        borderRadius: DesignTokens.borderRadius.lg,
      }}
    >
      <Text style={{ 
        color: DesignTokens.colors.text.primary, 
        fontSize: 18, 
        fontWeight: '600', 
        marginBottom: 16,
        writingDirection: 'rtl'
      }}>
        סיכום התשלום
      </Text>
      
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        marginBottom: 8
      }}>
        <Text style={{ 
          color: DesignTokens.colors.text.secondary, 
          fontSize: 14,
          writingDirection: 'rtl'
        }}>
          {plan?.name}
        </Text>
        <Text style={{ 
          color: DesignTokens.colors.text.primary, 
          fontSize: 14,
          fontWeight: '600'
        }}>
          {plan?.price === 0 ? 'חינם' : `₪${plan?.price}`}
        </Text>
      </View>
      
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        marginBottom: 8
      }}>
        <Text style={{ 
          color: DesignTokens.colors.text.secondary, 
          fontSize: 14,
          writingDirection: 'rtl'
        }}>
          מע"מ
        </Text>
        <Text style={{ 
          color: DesignTokens.colors.text.primary, 
          fontSize: 14,
          fontWeight: '600'
        }}>
          {plan?.price === 0 ? '₪0' : `₪${Math.round((plan?.price || 0) * 0.17)}`}
        </Text>
      </View>
      
      <View style={{ 
        height: 1, 
        backgroundColor: DesignTokens.colors.background.elevated, 
        marginVertical: 12 
      }} />
      
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between'
      }}>
        <Text style={{ 
          color: DesignTokens.colors.text.primary, 
          fontSize: 18,
          fontWeight: '700',
          writingDirection: 'rtl'
        }}>
          סה"כ
        </Text>
        <Text style={{ 
          color: DesignTokens.colors.primary.main, 
          fontSize: 18,
          fontWeight: '700'
        }}>
          {plan?.price === 0 ? 'חינם' : `₪${Math.round((plan?.price || 0) * 1.17)}`}
        </Text>
      </View>
    </UICard>
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <ChatSubScreenHeader title="צ'קאאוט" onBack={() => navigation.goBack()} />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00C805"
          />
        }
      >
        <View style={{ paddingHorizontal: DesignTokens.spacing.lg, paddingTop: DesignTokens.spacing.lg }}>
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
              backgroundColor: DesignTokens.colors.primary.main,
              borderRadius: DesignTokens.borderRadius.lg,
              padding: 18,
              alignItems: 'center',
              shadowColor: DesignTokens.colors.primary.main,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <ActivityIndicator color={DesignTokens.colors.text.inverse} size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <CreditCard size={20} color={DesignTokens.colors.text.inverse} style={{ marginLeft: 8 }} />
                <Text style={{
                  color: DesignTokens.colors.text.inverse,
                  fontSize: 18,
                  fontWeight: '700',
                  writingDirection: 'rtl',
                }}>
                  {plan?.price === 0 ? 'המשך בחינם' : 'שלם עכשיו'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Terms */}
          <Text style={{ 
            color: DesignTokens.colors.text.tertiary, 
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
      </RNSafeAreaView>
    </View>
  );
}
