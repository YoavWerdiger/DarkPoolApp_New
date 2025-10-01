import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeft, Crown, CreditCard, Gift, TrendingUp, Star, Check, Settings, History, Receipt, ChevronLeft } from 'lucide-react-native';

interface SubscriptionScreenProps {
  navigation: any;
}

export default function SubscriptionScreen({ navigation }: SubscriptionScreenProps) {
  const [selectedPlan, setSelectedPlan] = useState('premium');
  const [isLoading, setIsLoading] = useState(false);

  const subscriptionPlans = [
    {
      id: 'basic',
      name: 'בסיסי',
      price: '₪0',
      period: 'לחודש',
      description: 'מסלול התחלתי',
      features: [
        'גישה בסיסית לפלטפורמה',
        'עד 3 מסלולי למידה',
        'תמיכה בסיסית',
        'תוכן מוגבל'
      ],
      color: '#666',
      popular: false
    },
    {
      id: 'premium',
      name: 'פרימיום',
      price: '₪49',
      period: 'לחודש',
      description: 'המסלול המומלץ',
      features: [
        'גישה לכל המסלולים',
        'תוכן בלעדי',
        'תמיכה עדיפות',
        'תכונות מתקדמות',
        'מעקב התקדמות',
        'תעודות סיום'
      ],
      color: '#00E654',
      popular: true
    },
    {
      id: 'pro',
      name: 'מקצועי',
      price: '₪99',
      period: 'לחודש',
      description: 'למשתמשים מקצועיים',
      features: [
        'כל תכונות הפרימיום',
        'גישה למסלולים בלעדיים',
        'תמיכה 24/7',
        'מנטורינג אישי',
        'דוחות מפורטים',
        'הטבות מיוחדות'
      ],
      color: '#F59E0B',
      popular: false
    }
  ];

  const paymentMethods = [
    {
      id: 'credit',
      name: 'כרטיס אשראי',
      icon: 'card-outline',
      description: 'Visa, MasterCard, American Express'
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: 'logo-paypal',
      description: 'תשלום מאובטח דרך PayPal'
    },
    {
      id: 'apple',
      name: 'Apple Pay',
      icon: 'logo-apple',
      description: 'תשלום מהיר ויבטח'
    }
  ];

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      // סימולציה של תהליך התשלום
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert(
        'הצלחה!',
        `המסלול ${subscriptionPlans.find(p => p.id === selectedPlan)?.name} הופעל בהצלחה!`,
        [{ text: 'אישור', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בתהליך התשלום');
    } finally {
      setIsLoading(false);
    }
  };

  const currentSubscription = {
    plan: 'free',
    expiresAt: null,
    autoRenew: false
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#181818' }}>
      {/* גרדיאנט רקע */}
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.05)', 'transparent', 'rgba(0, 230, 84, 0.03)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
      />
      
      {/* Header */}
      <View style={{
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 230, 84, 0.1)',
        backgroundColor: '#181818'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#181818',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)'
            }}
          >
            <ArrowLeft size={20} color="#fff" strokeWidth={2} />
          </Pressable>
          
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', writingDirection: 'rtl' }}>
            מסלול ותשלומים
          </Text>
          
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* סטטוס מנוי נוכחי */}
        <View style={{ padding: 20, marginBottom: 20 }}>
          <View style={{
            padding: 20,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(0, 230, 84, 0.1)',
            backgroundColor: 'rgba(0, 230, 84, 0.02)'
          }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 }}>
              <Crown size={24} color="#00E654" strokeWidth={2} style={{ marginLeft: 12 }} />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', writingDirection: 'rtl' }}>
                המסלול הנוכחי שלך
              </Text>
            </View>
            
            <View style={{ 
              backgroundColor: '#181818', 
              padding: 16, 
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(0, 230, 84, 0.1)'
            }}>
              <Text style={{ color: '#00E654', fontSize: 20, fontWeight: 'bold', marginBottom: 8, writingDirection: 'rtl' }}>
                {subscriptionPlans.find(p => p.id === currentSubscription.plan)?.name}
              </Text>
              <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl' }}>
                {currentSubscription.expiresAt ? `פג ב-${currentSubscription.expiresAt}` : 'מנוי ללא הגבלת זמן'}
              </Text>
              {currentSubscription.autoRenew && (
                <Text style={{ color: '#00E654', fontSize: 12, marginTop: 4, writingDirection: 'rtl' }}>
                  חידוש אוטומטי פעיל
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* תוכניות מנוי */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, writingDirection: 'rtl' }}>
            בחר תוכנית
          </Text>
          
          {subscriptionPlans.map((plan, index) => (
            <Pressable
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
              style={({ pressed }) => ({
                marginBottom: 16,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: pressed ? 0.8 : 1
              })}
            >
              <LinearGradient
                colors={selectedPlan === plan.id ? ['#181818', '#1a1a1a'] : ['#181818', '#1a1a1a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 20,
                  borderRadius: 16,
                  borderWidth: selectedPlan === plan.id ? 2 : 1,
                  borderColor: selectedPlan === plan.id ? plan.color : 'rgba(0, 230, 84, 0.1)',
                  shadowColor: selectedPlan === plan.id ? plan.color : '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: selectedPlan === plan.id ? 0.3 : 0.1,
                  shadowRadius: 4,
                  elevation: selectedPlan === plan.id ? 6 : 2,
                  position: 'relative'
                }}
              >
                {plan.popular && (
                  <View style={{
                    position: 'absolute',
                    top: -8,
                    right: 20,
                    backgroundColor: plan.color,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 12
                  }}>
                    <Text style={{ color: '#000', fontSize: 12, fontWeight: 'bold', writingDirection: 'rtl' }}>
                      מומלץ
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 }}>
                  <Crown size={24} color={plan.color} strokeWidth={2} style={{ marginLeft: 12 }} />
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', writingDirection: 'rtl' }}>
                    {plan.name}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row-reverse', alignItems: 'baseline', marginBottom: 8 }}>
                  <Text style={{ color: plan.color, fontSize: 32, fontWeight: 'bold' }}>
                    {plan.price}
                  </Text>
                  <Text style={{ color: '#999', fontSize: 14, marginRight: 8, writingDirection: 'rtl' }}>
                    {plan.period}
                  </Text>
                </View>

                <Text style={{ color: '#999', fontSize: 14, marginBottom: 16, writingDirection: 'rtl' }}>
                  {plan.description}
                </Text>

                {/* רשימת תכונות */}
                <View>
                  {plan.features.map((feature, featureIndex) => (
                    <View key={featureIndex} style={{ 
                      flexDirection: 'row-reverse', 
                      alignItems: 'center', 
                      marginBottom: 8 
                    }}>
                      <Check size={16} color={plan.color} strokeWidth={2} style={{ marginLeft: 8 }} />
                      <Text style={{ color: '#fff', fontSize: 14, writingDirection: 'rtl' }}>
                        {feature}
                      </Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        {/* ניהול תשלומים */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, writingDirection: 'rtl' }}>
            ניהול תשלומים
          </Text>
          
          <View style={{ marginBottom: 12 }}>
            <Pressable
              onPress={() => Alert.alert('היסטוריית תשלומים', 'פתיחת היסטוריית התשלומים...')}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: pressed ? 0.8 : 1
              })}
            >
              <LinearGradient
                colors={['#181818', '#1a1a1a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0, 230, 84, 0.1)'
                }}
              >
                <History size={24} color="#00E654" strokeWidth={2} style={{ marginLeft: 16 }} />
                
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4, writingDirection: 'rtl' }}>
                    היסטוריית תשלומים
                  </Text>
                  <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl' }}>
                    צפה בכל התשלומים והחשבוניות
                  </Text>
                </View>
                
                <ChevronLeft size={20} color="#00E654" strokeWidth={2} />
              </LinearGradient>
            </Pressable>
          </View>

          <View style={{ marginBottom: 12 }}>
            <Pressable
              onPress={() => Alert.alert('הגדרות תשלום', 'פתיחת הגדרות התשלום...')}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: pressed ? 0.8 : 1
              })}
            >
              <LinearGradient
                colors={['#181818', '#1a1a1a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0, 230, 84, 0.1)'
                }}
              >
                <Settings size={24} color="#00E654" strokeWidth={2} style={{ marginLeft: 16 }} />
                
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4, writingDirection: 'rtl' }}>
                    הגדרות תשלום
                  </Text>
                  <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl' }}>
                    נהל שיטות תשלום וחידוש אוטומטי
                  </Text>
                </View>
                
                <ChevronLeft size={20} color="#00E654" strokeWidth={2} />
              </LinearGradient>
            </Pressable>
          </View>

          <View style={{ marginBottom: 12 }}>
            <Pressable
              onPress={() => Alert.alert('ביטול מסלול', 'האם אתה בטוח שברצונך לבטל את המסלול?')}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: pressed ? 0.8 : 1
              })}
            >
              <LinearGradient
                colors={['#181818', '#1a1a1a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(220, 38, 38, 0.2)'
                }}
              >
                <Receipt size={24} color="#DC2626" strokeWidth={2} style={{ marginLeft: 16 }} />
                
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4, writingDirection: 'rtl' }}>
                    ביטול מסלול
                  </Text>
                  <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl' }}>
                    בטל את המסלול הנוכחי
                  </Text>
                </View>
                
                <ChevronLeft size={20} color="#DC2626" strokeWidth={2} />
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        {/* שיטות תשלום */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, writingDirection: 'rtl' }}>
            שיטת תשלום
          </Text>
          
          {paymentMethods.map((method, index) => (
            <View key={index} style={{ marginBottom: 12 }}>
              <LinearGradient
                colors={['#181818', '#1a1a1a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0, 230, 84, 0.1)'
                }}
              >
                <Ionicons name={method.icon as any} size={24} color="#00E654" style={{ marginLeft: 16 }} />
                
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4, writingDirection: 'rtl' }}>
                    {method.name}
                  </Text>
                  <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl' }}>
                    {method.description}
                  </Text>
                </View>
                
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: '#00E654',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <View style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#00E654'
                  }} />
                </View>
              </LinearGradient>
            </View>
          ))}
        </View>

        {/* מבצעים והטבות */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, writingDirection: 'rtl' }}>
            מבצעים והטבות
          </Text>
          
          <View style={{
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(0, 230, 84, 0.1)',
            backgroundColor: 'rgba(0, 230, 84, 0.02)'
          }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 }}>
              <Gift size={20} color="#00E654" strokeWidth={2} style={{ marginLeft: 8 }} />
              <Text style={{ color: '#00E654', fontSize: 16, fontWeight: 'bold', writingDirection: 'rtl' }}>
                מבצע ראש חודש
              </Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 14, marginBottom: 8, writingDirection: 'rtl' }}>
              30% הנחה על כל התוכניות למשך 3 חודשים
            </Text>
            <Text style={{ color: '#999', fontSize: 12, writingDirection: 'rtl' }}>
              מבצע תקף עד סוף החודש
            </Text>
          </View>
        </View>

        {/* כפתור הרשמה */}
        <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
          <LinearGradient
            colors={isLoading ? ['#666', '#555'] : ['#00E654', '#00D04B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              padding: 16,
              borderRadius: 16,
              alignItems: 'center',
              shadowColor: '#00E654',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6
            }}
          >
            <Pressable
              onPress={handleSubscribe}
              disabled={isLoading || selectedPlan === currentSubscription.plan}
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              <Text style={{ 
                color: isLoading ? '#ccc' : '#000', 
                fontSize: 16, 
                fontWeight: 'bold', 
                writingDirection: 'rtl' 
              }}>
                {isLoading 
                  ? 'מעבד תשלום...' 
                  : selectedPlan === currentSubscription.plan 
                    ? 'המסלול הנוכחי' 
                    : `הרשם ל${subscriptionPlans.find(p => p.id === selectedPlan)?.name}`
                }
              </Text>
            </Pressable>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  );
}
