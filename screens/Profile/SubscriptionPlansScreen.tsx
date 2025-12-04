import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { useDesignTokens } from '../../components/ui/DesignTokens';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = Math.round(screenWidth * 0.78);
const CARD_SPACING = 16; // space between cards
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;
const RTL_FLIP = { transform: [{ scaleX: -1 }] };

const CROSS_COLOR = '#FF0000';

const hexToRgba = (hex: string, alpha = 1) => {
  try {
    const sanitized = hex.replace('#', '');
    const isShort = sanitized.length === 3;
    const normalized = isShort
      ? sanitized.split('').map((char) => char + char).join('')
      : sanitized;
    const value = parseInt(normalized || '000000', 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch (error) {
    console.warn('hexToRgba: failed to parse color', hex);
    return hex;
  }
};

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

type BillingPeriod = 'monthly' | 'yearly';
const BILLING_TABS: BillingPeriod[] = ['yearly', 'monthly'];

export default function SubscriptionPlansScreen({ navigation }: any) {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [scrollX] = useState(new Animated.Value(0));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tableAnimValue] = useState(new Animated.Value(1));
  const [scrollY] = useState(new Animated.Value(0));
  const flatListRef = useRef<FlatList>(null);

  // רשימת כל התכונות האפשריות
  const allFeatures = [
    'חדשות כלכליות',
    'הכרזות רשמיות של ברוך ודוד אריאל',
    'קבוצה חינמית של מאות סוחרים ומשקיעים',
    'לייב שבועי ביוטיוב',
    'חדשות מתפרצות בזמן אמת',
    'דיווחי תוצאות של חברות',
    'גישה לחדר מקהילת הפרימיום של "השקעות וסווינגים"',
    'יומן מסחר',
    'גישה לקהילת הפרימיום',
    'קורס הלוויתנים במתנה'
  ];

  // קבלת המסלולים לפי תקופת החיוב
  const getPlansForPeriod = (period: BillingPeriod): SubscriptionPlan[] => {
    if (period === 'monthly') {
      return [
        SUBSCRIPTION_PLANS.free,
        SUBSCRIPTION_PLANS.plus_monthly,
        SUBSCRIPTION_PLANS.premium_monthly,
      ];
    }
    
    return [SUBSCRIPTION_PLANS.elite_yearly];
  };

  const plans = getPlansForPeriod(billingPeriod);
  const comparisonPlans = useMemo(
    () => [
      SUBSCRIPTION_PLANS.free,
      SUBSCRIPTION_PLANS.plus_monthly,
      SUBSCRIPTION_PLANS.premium_monthly,
      SUBSCRIPTION_PLANS.elite_yearly,
    ],
    []
  );

  // בחירת הכרטיסיה הראשונה בהתחלה או כשמשנים תקופת חיוב
  useEffect(() => {
    if (plans.length > 0) {
      // בוחרים את המסלול הראשון (יכול להיות חינמי או אחר)
      const firstPlan = plans[0];
      setSelectedPlan(firstPlan.id);
      const firstIndex = 0;
      setCurrentIndex(firstIndex);
      // גלילה לכרטיסיה הראשונה
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({ index: firstIndex, animated: false });
        } catch (error) {
          // אם scrollToIndex נכשל, נשתמש ב-scrollToOffset
          flatListRef.current?.scrollToOffset({ offset: firstIndex * SNAP_INTERVAL, animated: false });
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingPeriod]);

  // אנימציה לטבלת ההשוואה (הטבלה תמיד גלויה, האנימציה רק כשמשנים תקופת חיוב)
  useEffect(() => {
    // מאפסים את האנימציה ואז מריצים אותה מחדש
    tableAnimValue.setValue(0);
    Animated.timing(tableAnimValue, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [billingPeriod]);

  const handlePlanSelection = (planId: string) => {
    // מאפשרים בחירה בכל מסלול, כולל החינמי
    setSelectedPlan(planId);
    // לא נכנס ישר לדף הרשמה - רק כשלוחצים על "הצטרפות למסלול"
  };

  // עדכון הכרטיסיה הנבחרת לפי הגרירה
  const handleScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    // חישוב האינדקס - כל כרטיסיה תופסת SNAP_INTERVAL
    const index = Math.round(offsetX / SNAP_INTERVAL);
    
    if (index >= 0 && index < plans.length) {
      const selectedPlanId = plans[index].id;
      setSelectedPlan(selectedPlanId);
      setCurrentIndex(index);
    }
  };

  const handleJoinPlan = (planId: string) => {
    if (planId === 'free') {
      return;
    }
    
    // מעבר למסך התשלום רק כשלוחצים על "הצטרפות למסלול"
    navigation.navigate('CreditCardCheckout', { 
      planId: planId,
      fromRegistration: false 
    });
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'חינמי':
        return Users;
      case 'מסלול פלוס+':
        return Star;
      case 'מסלול פרימיום':
        return Crown;
      case 'מסלול עלית':
        return Gift;
      default:
        return Users;
    }
  };

  const getPeriodText = (period: BillingPeriod) => {
    switch (period) {
      case 'monthly':
        return 'חודשי';
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
    const savings = getSavingsText(plan);
    const isSelected = selectedPlan === plan.id;
    const cardBackground = isDarkMode ? '#2A2A2A' : '#FFFFFF';
    const accentColor = plan.color;
    const borderColor = isSelected
      ? plan.color
      : isDarkMode
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.1)';
    const textColor = theme.textPrimary;
    const secondaryTextColor = theme.textSecondary;
    const tertiaryTextColor = theme.textTertiary;
    const buttonTextColor = plan.price === 0
      ? theme.textSecondary
      : DesignTokens.colors.text.primary;
    
    const inputRange = [
      (index - 1) * SNAP_INTERVAL,
      index * SNAP_INTERVAL,
      (index + 1) * SNAP_INTERVAL,
    ];
    
    // Scale - הקלף הנוכחי גדול, האחרים קטנים מעט
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.92, 1, 0.92],
      extrapolate: 'clamp',
    });
    
    // Opacity - הקלף הנוכחי מלא, האחרים דהויים מעט
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.7, 1, 0.7],
      extrapolate: 'clamp',
    });
    
    // TranslateY - קלפים שכנים שקועים מעט מאוד
    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [12, 0, 12],
      extrapolate: 'clamp',
    });

    // RotateY עדין מאוד לקלפים שכנים - פחות מוטות
    const rotateY = scrollX.interpolate({
      inputRange,
      outputRange: ['2deg', '0deg', '-2deg'],
      extrapolate: 'clamp',
    });
    
    return (
      <Animated.View
        style={{
          width: CARD_WIDTH,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [
            { perspective: 1200 },
            { translateY },
            { scale },
            { rotateY },
          ],
          opacity,
          marginHorizontal: CARD_SPACING / 2,
          paddingBottom: 20,
        }}
      >
        <AnimatedCard
          onPress={() => handlePlanSelection(plan.id)}
          scaleValue={0.98}
          style={{
            width: CARD_WIDTH,
            backgroundColor: cardBackground,
            borderRadius: 24,
            padding: 24,
            paddingBottom: 28,
            borderWidth: isSelected ? 2 : 1,
            borderColor,
            shadowColor: accentColor,
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
              backgroundColor: hexToRgba(accentColor, 0.2),
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 2,
              borderColor: hexToRgba(accentColor, 0.4)
            }}>
              <IconComponent size={24} color={accentColor} strokeWidth={2.5} />
            </View>
            
            <Text style={{
              fontSize: 22,
              fontWeight: '600',
              color: textColor,
              marginBottom: 8,
              textAlign: 'center'
            }}>
              {plan.name}
            </Text>
            
            <Text style={{
              fontSize: 13,
              color: secondaryTextColor,
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
                  color: textColor,
                  marginBottom: 4
                }}>
                  חינם
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: secondaryTextColor,
                  fontWeight: '500'
                }}>
                  לתמיד
                </Text>
              </View>
            ) : plan.period === 'yearly' && plan.id === 'elite_yearly' ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', marginBottom: 4 }}>
                  <Text style={{
                    fontSize: 34,
                    fontWeight: '700',
                    color: accentColor
                  }}>
                    ₪117
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    color: secondaryTextColor,
                    marginRight: 6,
                    fontWeight: '500'
                  }}>
                    / לחודש
                  </Text>
                </View>
                <Text style={{
                  fontSize: 12,
                  color: tertiaryTextColor,
                  fontWeight: '500',
                  marginBottom: 4
                }}>
                  (מחויב מדי שנה)
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: secondaryTextColor,
                  fontWeight: '500'
                }}>
                  ₪{plan.price} לשנה
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', marginBottom: 8 }}>
                  <Text style={{
                    fontSize: 34,
                    fontWeight: '700',
                    color: accentColor
                  }}>
                    ₪{plan.price}
                  </Text>
                  <Text style={{
                    fontSize: 16,
                    color: secondaryTextColor,
                    marginRight: 6,
                    fontWeight: '500'
                  }}>
                    / {getPeriodText(plan.period as BillingPeriod)}
                  </Text>
                </View>
                {savings && (
                  <View style={{
                    backgroundColor: hexToRgba(accentColor, 0.2),
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: hexToRgba(accentColor, 0.45)
                  }}>
                    <Text style={{
                      fontSize: 12,
                      color: accentColor,
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
            {(plan.price === 0 ? plan.features : plan.features.slice(0, 3)).map((feature, featureIndex) => (
              <View key={featureIndex} style={{ 
                flexDirection: 'row-reverse', 
                alignItems: 'center'
              }}>
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: hexToRgba(accentColor, 0.2),
                  borderWidth: 1,
                  borderColor: hexToRgba(accentColor, 0.5),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 0,
                  marginRight: 14
                }}>
                  <Check size={12} color={accentColor} strokeWidth={3} />
                </View>
                <Text style={{
                  flex: 1,
                  fontSize: 15,
                  color: secondaryTextColor,
                  textAlign: 'right',
                  lineHeight: 20,
                  fontWeight: '500',
                  paddingRight: 4
                }}>
                  {feature}
                </Text>
              </View>
            ))}
            {plan.price !== 0 && plan.features.length > 3 && (
              <Text style={{
                fontSize: 13,
                color: tertiaryTextColor,
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
            <TouchableOpacity
              onPress={() => plan.price > 0 && handleJoinPlan(plan.id)}
              disabled={plan.price === 0}
              style={{
                backgroundColor: plan.price === 0 
                  ? hexToRgba(accentColor, 0.18) 
                  : accentColor,
                paddingVertical: 14,
                paddingHorizontal: 24,
                borderRadius: 16,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: hexToRgba(accentColor, 0.5),
                opacity: plan.price === 0 ? 0.85 : 1
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: buttonTextColor
              }}>
                {plan.price === 0 ? 'מסלול נוכחי' : 'הצטרפות למסלול'}
              </Text>
            </TouchableOpacity>
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
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'
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
            flexDirection: 'row',
            backgroundColor: DesignTokens.colors.background.secondary,
            borderRadius: 30,
            padding: 4,
            alignSelf: 'center',
            width: '100%',
            maxWidth: 400
          }}>
            {BILLING_TABS.map((period) => {
              const isSelected = billingPeriod === period;
              return (
                <TouchableOpacity
                  key={period}
                  onPress={() => setBillingPeriod(period)}
                  activeOpacity={1}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 26,
                    backgroundColor: 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    marginHorizontal: 2
                  }}
                >
                  {isSelected && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: 26,
                        backgroundColor: `${DesignTokens.colors.primary.main}14`,
                      }}
                    />
                  )}
                  <View style={{ alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: isSelected ? '700' : '600',
                      color: isSelected 
                        ? DesignTokens.colors.primary.main
                        : DesignTokens.colors.text.secondary,
                      textAlign: 'center',
                      writingDirection: 'rtl'
                    }}>
                      {getPeriodText(period)}
                    </Text>
                    {period === 'yearly' && (
                      <Text style={{
                        fontSize: 10,
                        color: isSelected 
                          ? DesignTokens.colors.primary.main
                          : DesignTokens.colors.text.tertiary,
                        fontWeight: '500',
                        marginTop: 2
                      }}>
                        🎁 קורס חינם
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Plans 3D Carousel (מרכזי) */}
        <View style={{ marginBottom: 20 }}>
          <Animated.FlatList
            ref={flatListRef}
            data={plans}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: (screenWidth - CARD_WIDTH) / 2,
            }}
            style={RTL_FLIP}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { 
                useNativeDriver: false,
                listener: (event: any) => {
                  // עדכון בזמן אמת במהלך הגרירה
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / SNAP_INTERVAL);
                  
                  if (index >= 0 && index < plans.length) {
                    const selectedPlanId = plans[index].id;
                    if (selectedPlanId !== selectedPlan) {
                      setSelectedPlan(selectedPlanId);
                      setCurrentIndex(index);
                    }
                  }
                }
              }
            )}
            onMomentumScrollEnd={handleScrollEnd}
            onScrollEndDrag={handleScrollEnd}
            scrollEventThrottle={16}
            pagingEnabled={false}
            renderItem={({ item: plan, index }) => (
              <View style={RTL_FLIP}>
                <PlanCard plan={plan} index={index} scrollX={scrollX} />
              </View>
            )}
            getItemLayout={(data, index) => ({
              length: SNAP_INTERVAL,
              offset: SNAP_INTERVAL * index,
              index,
            })}
          />
          
          {/* Page Indicators */}
          <View style={{
            flexDirection: 'row-reverse',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 20,
            gap: 8
          }}>
            {plans.map((_, index) => {
              const inputRange = [
                (index - 1) * SNAP_INTERVAL,
                index * SNAP_INTERVAL,
                (index + 1) * SNAP_INTERVAL,
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
          
          <View style={{
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.border,
          }}>
            {/* Table Header */}
            <View style={{
              flexDirection: 'row-reverse',
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
              paddingVertical: 14,
              paddingHorizontal: 12,
              borderBottomWidth: 1,
              borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)',
              alignItems: 'center'
            }}>
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
              {comparisonPlans.map((plan) => (
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
                  borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.08)',
                  backgroundColor: featureIndex % 2 === 0 
                    ? 'transparent' 
                    : isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.02)',
                  alignItems: 'center'
                }}
              >
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
                {comparisonPlans.map((plan) => {
                  const featureMapping: Record<string, string[]> = {
                    'גישה לקהילת הפרימיום': ['גישה לקהילת הפרימיום', 'גישה לקהילה הפרימיום', 'קהילת הפרימיום', 'קהילה פרימיום'],
                    'גישה לחדר מקהילת הפרימיום של "השקעות וסווינגים"': ['גישה לחדר מקהילת הפרימיום של "השקעות וסווינגים"', 'חדר סווינגים והשקעות', 'חדר השקעות וסווינגים'],
                    'קורס הלוויתנים במתנה': ['קורס הלוויתנים במתנה', 'קורס הלוויתנים']
                  };
                  
                  const mappedFeatures = featureMapping[feature] || [feature];
                  const hasFeature = plan.features.some((f: string) => 
                    mappedFeatures.some(mapped => f.includes(mapped) || mapped.includes(f))
                  );
                  
                  const mappedExcluded = featureMapping[feature] || [feature];
                  const isExcluded = plan.excludedFeatures && plan.excludedFeatures.some((excluded: string) => 
                    mappedExcluded.some(mapped => excluded.includes(mapped) || mapped.includes(excluded))
                  );
                  
                  const featureExists = hasFeature && !isExcluded;
                  const accentColor = plan.color;
                  
                  return (
                    <View key={plan.id} style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {featureExists ? (
                        <View style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: hexToRgba(accentColor, isDarkMode ? 0.32 : 0.22),
                          borderWidth: 1,
                          borderColor: hexToRgba(accentColor, 0.6),
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Check size={14} color={accentColor} strokeWidth={2.5} />
                        </View>
                      ) : (
                        <View style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: hexToRgba(CROSS_COLOR, isDarkMode ? 0.28 : 0.2),
                          borderWidth: 1,
                          borderColor: CROSS_COLOR,
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <X size={14} color={CROSS_COLOR} strokeWidth={2.5} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* How It Works */}
        <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
          <View style={{
            backgroundColor: theme.cardBackground,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDarkMode ? 0.2 : 0.08,
            shadowRadius: 16,
            elevation: 6
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: theme.textPrimary,
              textAlign: 'right',
              marginBottom: 16
            }}>
              איך זה עובד?
            </Text>
            <View style={{
              flexDirection: 'row-reverse',
              justifyContent: 'space-between',
              gap: 12
            }}>
              {[
                { title: 'בחר מסלול', subtitle: 'מצא את הרמה שמתאימה לך' },
                { title: 'אשר פרטים', subtitle: 'מילוי קצר והמשך לתשלום' },
                { title: 'מתחילים ללמוד', subtitle: 'פותחים את כל התוכן בלחיצה' }
              ].map((step, index) => (
                <View key={step.title} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: 'rgba(5, 209, 87, 0.12)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 12
                  }}>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: '#05d157'
                    }}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: theme.textPrimary,
                    textAlign: 'center',
                    marginBottom: 4
                  }}>
                    {step.title}
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: theme.textSecondary,
                    textAlign: 'center',
                    lineHeight: 18
                  }}>
                    {step.subtitle}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 20 }}>
              <Text style={{
                fontSize: 13,
                color: theme.textSecondary,
                textAlign: 'right',
                lineHeight: 20
              }}>
                ניתן לעבור בין המסלולים בכל רגע – שדרוג או הורדה נכנסים לתוקף מידית, החיוב מתעדכן אוטומטית ואנחנו שומרים על כל ההטבות שכבר קיבלת. הכל מנוהל בצורה מאובטחת ושקופה, כדי שתוכל למקד את הזמן בלמידה ולא בבירוקרטיה.
              </Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
