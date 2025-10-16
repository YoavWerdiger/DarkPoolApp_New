import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Animated,
  Platform,
  FlatList
} from 'react-native';
import { 
  ArrowLeft,
  Check,
  X,
  Star,
  Crown,
  Zap,
  Users,
  TrendingUp,
  Calendar,
  Gift
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';
import AnimatedCard from '../../components/ui/AnimatedCard';
import AnimatedToggle from '../../components/ui/AnimatedToggle';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = Math.round(screenWidth * 0.78);
const CARD_SPACING = 16; // space between cards
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  period: string;
  features: string[];
  excludedFeatures: string[];
  role: string;
  popular: boolean;
  color: string;
}

type BillingPeriod = 'monthly' | 'quarterly' | 'yearly';

export default function SubscriptionPlansScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [scrollX] = useState(new Animated.Value(0));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tableAnimValue] = useState(new Animated.Value(0));
  const [scrollY] = useState(new Animated.Value(0));
  const flatListRef = useRef<FlatList>(null);

  // רשימת כל התכונות האפשריות
  const allFeatures = [
    'חדשות כלכליות יומיות',
    'חדשות מתפרצות בזמן אמת וציוצים',
    'גישה לקהילה הכללית',
    'חדר סווינגים והשקעות',
    'איתותי מסחר יומי',
    'איתותי Penny Stocks',
    'יומן מסחר אישי',
    'קורס הלוויתנים במתנה'
  ];

  // קבלת המסלולים לפי תקופת החיוב
  const getPlansForPeriod = (period: BillingPeriod): SubscriptionPlan[] => {
    const plans: SubscriptionPlan[] = [];
    
    // תמיד להוסיף את המסלול החינמי
    plans.push(SUBSCRIPTION_PLANS.free);
    
    if (period === 'monthly') {
      plans.push(
        SUBSCRIPTION_PLANS.gold_monthly,
        SUBSCRIPTION_PLANS.premium_monthly,
        SUBSCRIPTION_PLANS.platinum_monthly
      );
    } else if (period === 'quarterly') {
      plans.push(
        SUBSCRIPTION_PLANS.gold_quarterly,
        SUBSCRIPTION_PLANS.premium_quarterly,
        SUBSCRIPTION_PLANS.platinum_quarterly
      );
    } else if (period === 'yearly') {
      plans.push(SUBSCRIPTION_PLANS.platinum_pro_yearly);
    }
    
    return plans;
  };

  const plans = getPlansForPeriod(billingPeriod);

  // אנימציה לטבלת ההשוואה
  useEffect(() => {
    Animated.timing(tableAnimValue, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [billingPeriod]);

  const handlePlanSelection = (planId: string) => {
    if (planId === 'free') {
      // אם זה המסלול החינמי, לא צריך לעשות כלום
      return;
    }
    
    setSelectedPlan(planId);
    // מעבר למסך התשלום
    navigation.navigate('CreditCardCheckout', { 
      planId: planId,
      fromRegistration: false 
    });
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'חינמי':
        return Users;
      case 'Gold':
        return Star;
      case 'Premium':
        return Crown;
      case 'Platinum':
        return Zap;
      case 'Platinum Pro':
        return Gift;
      default:
        return Users;
    }
  };

  const getPlanGradient = (planName: string) => {
    switch (planName) {
      case 'חינמי':
        return ['#6B7280', '#9CA3AF'];
      case 'Gold':
        return ['#F59E0B', '#FCD34D'];
      case 'Premium':
        return ['#3B82F6', '#60A5FA'];
      case 'Platinum':
        return ['#8B5CF6', '#A78BFA'];
      case 'Platinum Pro':
        return ['#F59E0B', '#FCD34D'];
      default:
        return ['#6B7280', '#9CA3AF'];
    }
  };

  const getPeriodText = (period: BillingPeriod) => {
    switch (period) {
      case 'monthly':
        return 'חודשי';
      case 'quarterly':
        return 'רבעוני';
      case 'yearly':
        return 'שנתי';
      default:
        return 'חודשי';
    }
  };

  const getSavingsText = (plan: SubscriptionPlan) => {
    if (plan.features.includes('הנחה של 16%')) {
      return 'חיסכון 16%';
    } else if (plan.features.includes('הנחה של 11%')) {
      return 'חיסכון 11%';
    } else if (plan.features.includes('הנחה של 8%')) {
      return 'חיסכון 8%';
    } else if (plan.features.includes('חיסכון של ₪350')) {
      return 'חיסכון ₪350';
    }
    return null;
  };

  // קומפוננט לקלף בודד עם אפקט 3D עדין (שכנים קטנים ושקועים קלות)
  const PlanCard = ({ plan, index, scrollX }: { plan: SubscriptionPlan, index: number, scrollX: Animated.Value }) => {
    const IconComponent = getPlanIcon(plan.name);
    const gradient = getPlanGradient(plan.name);
    const savings = getSavingsText(plan);
    const isSelected = selectedPlan === plan.id;
    
    const inputRange = [
      (index - 1) * SNAP_INTERVAL,
      index * SNAP_INTERVAL,
      (index + 1) * SNAP_INTERVAL,
    ];
    
    // Scale - הקלף הנוכחי גדול, האחרים קטנים
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.88, 1, 0.88],
      extrapolate: 'clamp',
    });
    
    // Opacity - הקלף הנוכחי מלא, האחרים דהויים
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: 'clamp',
    });
    
    // TranslateY - קלפים שכנים שקועים מעט
    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [24, 0, 24],
      extrapolate: 'clamp',
    });

    // RotateY עדין לקלפים שכנים
    const rotateY = scrollX.interpolate({
      inputRange,
      outputRange: ['6deg', '0deg', '-6deg'],
      extrapolate: 'clamp',
    });
    
    return (
      <Animated.View
        style={{
          width: CARD_WIDTH,
          height: 560,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [
            { perspective: 1200 },
            { translateY },
            { scale },
            { rotateY },
          ],
          opacity,
          marginRight: CARD_SPACING,
        }}
      >
        <AnimatedCard
          onPress={() => handlePlanSelection(plan.id)}
          scaleValue={0.98}
          style={{
            width: CARD_WIDTH,
            minHeight: 520,
            backgroundColor: theme.cardBackground,
            borderRadius: 24,
            padding: 24,
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? plan.color : 'rgba(255, 255, 255, 0.1)',
            shadowColor: isSelected ? plan.color : '#000',
            shadowOffset: { width: 0, height: isSelected ? 16 : 8 },
            shadowOpacity: isSelected ? 0.3 : 0.15,
            shadowRadius: isSelected ? 24 : 16,
            elevation: isSelected ? 16 : 8,
            position: 'relative',
          }}
        >

          {/* Plan Header */}
          <View style={{ alignItems: 'center', marginBottom: 24, marginTop: plan.popular ? 12 : 0 }}>
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: plan.color + '20',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 2,
              borderColor: plan.color + '40'
            }}>
              <IconComponent size={24} color={plan.color} strokeWidth={2.5} />
            </View>
            
            <Text style={{
              fontSize: 22,
              fontWeight: '600',
              color: theme.textPrimary,
              marginBottom: 8,
              textAlign: 'center'
            }}>
              {plan.name}
            </Text>
            
            <Text style={{
              fontSize: 13,
              color: theme.textSecondary,
              textAlign: 'center',
              lineHeight: 18,
              fontWeight: '500',
              maxWidth: 200
            }}>
              {plan.description}
            </Text>
          </View>

          {/* Price */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            {plan.price === 0 ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 34,
                  fontWeight: '700',
                  color: theme.textPrimary,
                  marginBottom: 4
                }}>
                  חינם
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: theme.textSecondary,
                  fontWeight: '500'
                }}>
                  לתמיד
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', marginBottom: 8 }}>
                  <Text style={{
                    fontSize: 34,
                    fontWeight: '700',
                    color: plan.color
                  }}>
                    ₪{plan.price}
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    color: theme.textSecondary,
                    marginRight: 6,
                    fontWeight: '500'
                  }}>
                    / {getPeriodText(plan.period as BillingPeriod)}
                  </Text>
                </View>
                {savings && (
                  <View style={{
                    backgroundColor: '#05d157',
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12
                  }}>
                    <Text style={{
                      fontSize: 12,
                      color: '#ffffff',
                      fontWeight: '700'
                    }}>
                      {savings}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Features Preview */}
          <View style={{ gap: 12, marginBottom: 24 }}>
            {plan.features.slice(0, 3).map((feature, featureIndex) => (
              <View key={featureIndex} style={{ 
                flexDirection: 'row-reverse', 
                alignItems: 'center'
              }}>
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: plan.color + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 0,
                  marginRight: 14
                }}>
                  <Check size={12} color={plan.color} strokeWidth={3} />
                </View>
                <Text style={{
                  flex: 1,
                  fontSize: 15,
                  color: theme.textSecondary,
                  textAlign: 'right',
                  lineHeight: 20,
                  fontWeight: '500',
                  paddingRight: 4
                }}>
                  {feature}
                </Text>
              </View>
            ))}
            {plan.features.length > 3 && (
              <Text style={{
                fontSize: 13,
                color: theme.textTertiary,
                textAlign: 'center',
                marginTop: 4,
                fontWeight: '500'
              }}>
                +{plan.features.length - 3} תכונות נוספות
              </Text>
            )}
          </View>

          {/* CTA Button */}
          <View style={{ marginTop: 12 }}>
            <View style={{
              backgroundColor: plan.price === 0 
                ? 'rgba(255, 255, 255, 0.05)' 
                : isSelected 
                  ? plan.color 
                  : plan.color + '15',
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 16,
              alignItems: 'center',
              borderWidth: plan.price === 0 ? 0 : 2,
              borderColor: plan.price === 0 
                ? 'transparent' 
                : plan.color + '40'
            }}>
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: plan.price === 0 
                  ? theme.textSecondary 
                  : isSelected 
                    ? '#ffffff' 
                    : plan.color
              }}>
                {plan.price === 0 ? 'מסלול נוכחי' : isSelected ? '✓ נבחר' : 'בחר מסלול'}
              </Text>
            </View>
          </View>
        </AnimatedCard>
      </Animated.View>
    );
  };

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
            בחר מסלול
          </Text>
        </View>
      </SafeAreaView>

      <Animated.ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Title */}
        <Animated.View style={{ 
          paddingHorizontal: 20, 
          paddingTop: 24, 
          marginBottom: 24,
          transform: [{
            translateY: scrollY.interpolate({
              inputRange: [0, 100],
              outputRange: [0, -20],
              extrapolate: 'clamp',
            }),
          }],
        }}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{
              width: 60,
              height: 4,
              backgroundColor: '#05d157',
              borderRadius: 2,
              marginBottom: 16
            }} />
            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: theme.textPrimary,
              textAlign: 'center',
              marginBottom: 8,
              letterSpacing: -0.5
            }}>
              בחר את המסלול שלך
            </Text>
            <Text style={{
              fontSize: 15,
              color: theme.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
              maxWidth: 280
            }}>
              כל סוחר מתחיל איפשהו.{'\n'}איפה אתה רוצה להתחיל?
            </Text>
          </View>
        </Animated.View>

        {/* Billing Period Toggle */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 16,
            padding: 6,
            flexDirection: 'row',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)'
          }}>
            {(['monthly', 'quarterly', 'yearly'] as BillingPeriod[]).map((period, index) => {
              const isSelected = billingPeriod === period;
              return (
                <TouchableOpacity
                  key={period}
                  onPress={() => setBillingPeriod(period)}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: isSelected 
                      ? 'rgba(5, 209, 87, 0.15)' 
                      : 'transparent',
                    alignItems: 'center',
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: isSelected ? 'rgba(5, 209, 87, 0.3)' : 'transparent'
                  }}
                >
                  <Text style={{
                    fontSize: 14,
                    fontWeight: isSelected ? '600' : '500',
                    color: isSelected 
                      ? '#05d157' 
                      : theme.textSecondary,
                    marginBottom: 2
                  }}>
                    {getPeriodText(period)}
                  </Text>
                  {period === 'quarterly' && (
                        <Text style={{
                          fontSize: 10,
                          color: isSelected 
                            ? 'rgba(5, 209, 87, 0.8)' 
                            : theme.textTertiary,
                          fontWeight: '500'
                        }}>
                          💰 חיסכון 16%
                        </Text>
                  )}
                  {period === 'yearly' && (
                        <Text style={{
                          fontSize: 10,
                          color: isSelected 
                            ? 'rgba(5, 209, 87, 0.8)' 
                            : theme.textTertiary,
                          fontWeight: '500'
                        }}>
                          🎁 קורס חינם
                        </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Plans 3D Carousel (מרכזי) */}
        <View style={{ height: 560, marginBottom: 20 }}>
          <Animated.FlatList
            ref={flatListRef}
            data={plans}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: (screenWidth - CARD_WIDTH) / 2,
            }}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
            pagingEnabled={false}
            renderItem={({ item: plan, index }) => (
              <PlanCard plan={plan} index={index} scrollX={scrollX} />
            )}
            getItemLayout={(data, index) => ({
              length: SNAP_INTERVAL,
              offset: SNAP_INTERVAL * index,
              index,
            })}
          />
          
          {/* Page Indicators */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 20,
            gap: 8
          }}>
            {plans.map((_, index) => {
              const inputRange = [
                (index - 1) * screenWidth,
                index * screenWidth,
                (index + 1) * screenWidth,
              ];
              
              const scale = scrollX.interpolate({
                inputRange,
                outputRange: [0.8, 1.2, 0.8],
                extrapolate: 'clamp',
              });
              
              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.4, 1, 0.4],
                extrapolate: 'clamp',
              });
              
              return (
                <Animated.View
                  key={index}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#05d157',
                    transform: [{ scale }],
                    opacity,
                  }}
                />
              );
            })}
          </View>
        </View>

        {/* Detailed Comparison Table */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: theme.textPrimary,
              textAlign: 'center',
              marginBottom: 6
            }}>
              מה כלול בכל מסלול?
            </Text>
            <Text style={{
              fontSize: 13,
              color: theme.textSecondary,
              textAlign: 'center'
            }}>
              השוואה מהירה של התכונות
            </Text>
          </View>
          
          <Animated.View style={{
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.border,
            opacity: tableAnimValue,
            transform: [{
              translateY: tableAnimValue.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            }],
          }}>
            {/* Table Header */}
            <View style={{
              flexDirection: 'row-reverse',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              paddingVertical: 14,
              paddingHorizontal: 12,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255, 255, 255, 0.05)',
              alignItems: 'center'
            }}>
              {/* Feature column pinned to the right */}
              <View style={{ width: '32%', paddingLeft: 8 }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.textPrimary,
                  textAlign: 'right'
                }}>
                  תכונה
                </Text>
              </View>
              {plans.map((plan) => (
                <View key={plan.id} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: plan.color,
                    textAlign: 'center'
                  }}>
                    {plan.name}
                  </Text>
                </View>
              ))}
            </View>

            {/* Table Rows */}
            {allFeatures.map((feature, featureIndex) => (
              <View 
                key={featureIndex}
                style={{
                  flexDirection: 'row-reverse',
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderBottomWidth: featureIndex === allFeatures.length - 1 ? 0 : 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.03)',
                  backgroundColor: featureIndex % 2 === 0 
                    ? 'transparent' 
                    : 'rgba(255, 255, 255, 0.01)',
                  alignItems: 'center'
                }}
              >
                {/* Feature column pinned to the right */}
                <View style={{ width: '32%', paddingLeft: 8 }}>
                  <Text style={{
                    fontSize: 14,
                    color: theme.textSecondary,
                    textAlign: 'right',
                    lineHeight: 20,
                    fontWeight: '500'
                  }}>
                    {feature}
                  </Text>
                </View>
                {plans.map((plan) => {
                  const hasFeature = plan.features.includes(feature);
                  return (
                    <View key={plan.id} style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {hasFeature ? (
                        <View style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: `${plan.color}20`,
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Check size={12} color={plan.color} strokeWidth={2.5} />
                        </View>
                      ) : (
                        <View style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <X size={12} color={theme.textTertiary} strokeWidth={2.5} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Info Note */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.05)'
          }}>
            <Text style={{
              fontSize: 13,
              color: theme.textSecondary,
              textAlign: 'right',
              lineHeight: 20
            }}>
              💡 ניתן לשדרג או להוריד מסלול בכל עת{'\n'}השינוי ייכנס לתוקף מיידית
            </Text>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
