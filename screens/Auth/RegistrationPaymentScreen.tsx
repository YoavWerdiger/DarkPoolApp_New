import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ImageBackground, Alert, Linking } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { SUPABASE_URL } from '../../config/publicEnv';

const RegistrationPaymentScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('monthly');

  // המרת תוכניות המנוי לפורמט המתאים לתצוגה
  const plans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
    id: plan.id,
    name: plan.name,
    price: plan.price === 0 ? '₪0' : `₪${plan.price}`,
    period: 'לחודש',
    features: plan.features,
    popular: plan.popular
  }));

  const handlePayment = async () => {
    // במהלך הרישום, המשתמש עדיין לא מחובר, אז נדלג על הבדיקה הזו
    // if (!user) {
    //   Alert.alert('שגיאה', 'נדרש להתחבר למערכת');
    //   return;
    // }

    setLoading(true);
    
    try {
      // עדכון סוג החשבון ב-Context
      setData(prev => ({
        ...prev,
        accountType: selectedPlan
      }));

      const selectedPlanData = SUBSCRIPTION_PLANS[selectedPlan as keyof typeof SUBSCRIPTION_PLANS];
      
      if (!selectedPlanData) {
        throw new Error('תוכנית מנוי לא נמצאה');
      }

      // כל התוכניות הן בתשלום - אין תוכנית חינמית

      // עבור למסך הצ'קאאוט עם פרטי אשראי
      navigation.navigate('CreditCardCheckout', { 
        planId: selectedPlan,
        fromRegistration: true 
      });
      
    } catch (error) {
      Alert.alert(
        'שגיאה בתשלום', 
        error instanceof Error ? error.message : 'אירעה שגיאה בעיבוד התשלום. אנא נסה שוב.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPayment = () => {
    // עדכון סוג החשבון ל-free ב-Context
    setData(prev => ({
      ...prev,
      accountType: 'free'
    }));
    navigation.navigate('RegistrationSummary');
  };

  const { width, height } = Dimensions.get('window');

  // Create subtle background pattern
  const createBackgroundPattern = () => {
    const patterns = [];
    for (let i = 0; i < 15; i++) {
      patterns.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.05 + 0.02
      });
    }
    return patterns;
  };

  const backgroundPattern = createBackgroundPattern();

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={['#000000', '#0d1b0d', '#1a2d1a', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        >
          {/* Subtle Background Pattern */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {backgroundPattern.map((dot, index) => (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  left: dot.x,
                  top: dot.y,
                  width: dot.size,
                  height: dot.size,
                  backgroundColor: DesignTokens.colors.primary.main,
                  opacity: dot.opacity,
                  borderRadius: dot.size / 2
                }}
              />
            ))}
          </View>

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Transparent Background Image - Center */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: 0.15
          }}>
            <ImageBackground
              source={{ uri: `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png` }}
              style={{
                width: width,
                height: height
              }}
              imageStyle={{
                opacity: 0.3,
                resizeMode: 'contain'
              }}
            />
          </View>

          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
            {/* Header Section */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              {/* Main Title */}
              <Text style={{ 
                fontSize: 32, 
                fontWeight: '800', 
                color: DesignTokens.colors.text.primary, 
                marginBottom: 8,
                letterSpacing: -0.8,
                textAlign: 'center',
                writingDirection: 'rtl'
              }}>
                בחר תוכנית
              </Text>
              
              {/* Subtitle */}
              <Text style={{ 
                fontSize: 16, 
                color: DesignTokens.colors.text.secondary, 
                fontWeight: '400',
                letterSpacing: 0.3,
                textAlign: 'center',
                lineHeight: 22,
                writingDirection: 'rtl'
              }}>
                בחר את התוכנית המתאימה לך
              </Text>
              
              {/* Decorative Line */}
              <View style={{
                width: 60,
                height: 2,
                backgroundColor: DesignTokens.colors.primary.main,
                marginTop: 16,
                borderRadius: 1
              }} />
            </View>

            {/* Plans Section */}
            <View style={{ gap: 16, marginBottom: 40 }}>
              {plans.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  onPress={() => setSelectedPlan(plan.id)}
                  style={{
                    backgroundColor: selectedPlan === plan.id ? 'rgba(0, 230, 84, 0.1)' : '#181818',
                    borderRadius: 16,
                    padding: 20,
                    position: 'relative'
                  }}
                >
                  {plan.popular && (
                    <View style={{
                      position: 'absolute',
                      top: -10,
                      right: 20,
                      backgroundColor: DesignTokens.colors.primary.main,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 12
                    }}>
                      <Text style={{ color: DesignTokens.colors.background.primary, fontSize: 12, fontWeight: '700' }}>
                        מומלץ
                      </Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View>
                      <Text style={{ 
                        color: DesignTokens.colors.text.primary, 
                        fontSize: 20, 
                        fontWeight: '700',
                        writingDirection: 'rtl'
                      }}>
                        {plan.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text style={{ 
                          color: DesignTokens.colors.primary.main, 
                          fontSize: 24, 
                          fontWeight: '800',
                          writingDirection: 'rtl'
                        }}>
                          {plan.price}
                        </Text>
                        <Text style={{ 
                          color: DesignTokens.colors.text.secondary, 
                          fontSize: 14, 
                          marginLeft: 4,
                          writingDirection: 'rtl'
                        }}>
                          {plan.period}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: selectedPlan === plan.id ? '#00C805' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {selectedPlan === plan.id && (
                        <Ionicons name="checkmark" size={16} color="#000000" />
                      )}
                    </View>
                  </View>

                  <View style={{ gap: 8 }}>
                    {plan.features.map((feature, index) => (
                      <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle" size={16} color={DesignTokens.colors.primary.main} style={{ marginLeft: 8 }} />
                        <Text style={{ 
                          color: DesignTokens.colors.text.secondary, 
                          fontSize: 14,
                          writingDirection: 'rtl',
                          flex: 1
                        }}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={{ gap: 16 }}>
              {/* Payment Button */}
              {selectedPlan !== 'free' ? (
                <LinearGradient
                  colors={['#00C805', '#00A004', '#008F03']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 14,
                    shadowColor: DesignTokens.colors.primary.main,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 8
                  }}
                >
                  <TouchableOpacity
                    onPress={handlePayment}
                    disabled={loading}
                    style={{
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: loading ? 0.7 : 1
                    }}
        >
          {loading ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="card" size={20} color="#000000" style={{ marginLeft: 8 }} />
                        <Text style={{ 
                          color: DesignTokens.colors.background.primary, 
                          fontSize: 16, 
                          fontWeight: '700',
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          writingDirection: 'rtl'
                        }}>
                          שלם עכשיו
                        </Text>
                      </View>
          )}
        </TouchableOpacity>
                </LinearGradient>
              ) : (
                <LinearGradient
                  colors={['#00C805', '#00A004', '#008F03']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 14,
                    shadowColor: DesignTokens.colors.primary.main,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 8
                  }}
                >
                  <TouchableOpacity
                    onPress={handleSkipPayment}
                    style={{
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Text style={{ 
                      color: DesignTokens.colors.background.primary, 
                      fontSize: 16, 
                      fontWeight: '700',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      writingDirection: 'rtl'
                    }}>
                      המשך בחינם
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              )}

              {/* Skip Payment Button */}
              {selectedPlan !== 'free' && (
                <TouchableOpacity
                  onPress={handleSkipPayment}
                  style={{
                    backgroundColor: '#141F14',
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Text style={{ 
                    color: DesignTokens.colors.text.secondary, 
                    fontSize: 16, 
                    fontWeight: '600',
                    letterSpacing: 0.3,
                    writingDirection: 'rtl'
                  }}>
                    דלג על התשלום
                  </Text>
                </TouchableOpacity>
              )}
            </View>
    </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default RegistrationPaymentScreen; 