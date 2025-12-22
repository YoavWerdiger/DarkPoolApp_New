import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { SUBSCRIPTION_PLANS } from '../../services/paymentService';

const { width, height } = Dimensions.get('window');

// המרת תוכניות המנוי לפורמט לתצוגה (ללא תוספות ותשלומים חד פעמיים)
const getDisplayPlans = () => {
  return Object.values(SUBSCRIPTION_PLANS)
    .filter(plan => !plan.isAddon && !plan.isOneTime && plan.id !== 'free')
    .map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      period: plan.period,
      features: plan.features,
      excludedFeatures: plan.excludedFeatures || [],
      popular: plan.popular,
      color: plan.color
    }));
};

// Step Indicators Component
const StepIndicators = ({ current, total }: { current: number; total: number }) => (
  <View style={{ paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' }}>
    <View style={{
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8
    }}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={{
            width: index + 1 === current ? 28 : 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: index + 1 <= current 
              ? DesignTokens.colors.primary.main 
              : 'rgba(255,255,255,0.15)'
          }}
        />
      ))}
    </View>
    <Text style={{
      color: DesignTokens.colors.text.tertiary,
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'center',
      marginTop: 10
    }}>
      שלב {current} מתוך {total}
    </Text>
  </View>
);

const RegistrationTrackScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const [selectedTrack, setSelectedTrack] = useState(data.trackId || null);
  
  const tracks = getDisplayPlans();

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

  const handleBack = () => {
    navigation.goBack();
  };

  const handleNext = () => {
    if (!selectedTrack) return;
    
    const track = tracks.find(t => t.id === selectedTrack);
    
    setData({ 
      ...data, 
      trackId: selectedTrack,
      trackName: track?.name,
      trackPrice: track?.price
    });
    
    // לאחר בחירת מסלול - עובר לתשלום ב-Cardcom
    navigation.navigate('CreditCardCheckout', {
      planId: selectedTrack,
      trackName: track?.name,
      trackPrice: track?.price,
      fromRegistration: true
    });
  };

  const formatPrice = (price: number, period: string) => {
    if (price === 0) return 'חינם';
    if (period === 'yearly') {
      return `₪${price}`;
    }
    return `₪${price}`;
  };

  const formatPeriod = (period: string) => {
    switch (period) {
      case 'monthly': return '/חודש';
      case 'quarterly': return '/רבעון';
      case 'yearly': return '/שנה';
      default: return '';
    }
  };

  return (
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

        {/* Transparent Background Image */}
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
            source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
            style={{
              width: width,
              height: height,
              resizeMode: 'contain'
            }}
            imageStyle={{
              opacity: 0.3
            }}
          />
        </View>

        <SafeAreaView style={{ flex: 1 }}>
          {/* Step Indicators */}
          <StepIndicators current={4} total={5} />
          
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 10 }}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={handleBack}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-end',
                marginBottom: 16
              }}
            >
              <Text style={{
                color: DesignTokens.colors.text.secondary,
                fontSize: 16,
                marginLeft: 4
              }}>
                חזרה
              </Text>
              <Ionicons name="chevron-forward" size={24} color={DesignTokens.colors.text.primary} />
            </TouchableOpacity>
            
            {/* Header Section */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ 
                fontSize: 32, 
                fontWeight: '800', 
                color: DesignTokens.colors.text.primary, 
                marginBottom: 8,
                letterSpacing: -0.8,
                textAlign: 'center'
              }}>
                בחר מסלול
              </Text>
              
              <Text style={{ 
                fontSize: 16, 
                color: DesignTokens.colors.text.secondary, 
                fontWeight: '400',
                letterSpacing: 0.3,
                textAlign: 'center',
                lineHeight: 22
              }}>
                בחר את המסלול המתאים ביותר עבורך
              </Text>
              
              <View style={{
                width: 60,
                height: 2,
                backgroundColor: DesignTokens.colors.primary.main,
                marginTop: 16,
                borderRadius: 1
              }} />
            </View>

            {/* Tracks List */}
            <FlatList
              data={tracks}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedTrack(item.id)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: selectedTrack === item.id 
                      ? 'rgba(0, 230, 84, 0.15)' 
                      : '#181818',
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16,
                    borderWidth: selectedTrack === item.id ? 2 : 1,
                    borderColor: selectedTrack === item.id 
                      ? DesignTokens.colors.primary.main 
                      : 'rgba(255, 255, 255, 0.1)',
                    shadowColor: selectedTrack === item.id 
                      ? DesignTokens.colors.primary.main 
                      : '#000',
                    shadowOpacity: selectedTrack === item.id ? 0.3 : 0.1,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: selectedTrack === item.id ? 8 : 2
                  }}
                >
                  {/* Popular Badge */}
                  {item.popular && (
                    <View style={{
                      position: 'absolute',
                      top: -10,
                      right: 16,
                      backgroundColor: DesignTokens.colors.primary.main,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 12
                    }}>
                      <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>
                        פופולרי
                      </Text>
                    </View>
                  )}
                  
                  {/* Header Row */}
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginBottom: 12,
                    marginTop: item.popular ? 8 : 0
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ 
                        color: DesignTokens.colors.text.primary, 
                        fontWeight: '700', 
                        fontSize: 18, 
                        textAlign: 'right',
                        marginBottom: 4
                      }}>
                        {item.name}
                      </Text>
                      <Text style={{ 
                        color: DesignTokens.colors.primary.main, 
                        fontWeight: '800', 
                        fontSize: 24, 
                        textAlign: 'right'
                      }}>
                        {formatPrice(item.price, item.period)}
                        <Text style={{ 
                          color: DesignTokens.colors.text.tertiary, 
                          fontWeight: '400', 
                          fontSize: 14 
                        }}>
                          {formatPeriod(item.period)}
                        </Text>
                      </Text>
                    </View>
                    
                    {selectedTrack === item.id && (
                      <View style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: DesignTokens.colors.primary.main,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Ionicons name="checkmark" size={18} color="#000" />
                      </View>
                    )}
                  </View>

                  {/* Description */}
                  {item.description && (
                    <Text style={{ 
                      color: DesignTokens.colors.text.secondary, 
                      fontSize: 14, 
                      textAlign: 'right',
                      marginBottom: 12,
                      lineHeight: 20
                    }}>
                      {item.description}
                    </Text>
                  )}

                  {/* Features */}
                  <View style={{ gap: 6 }}>
                    {item.features.slice(0, 6).map((feature, index) => (
                      <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons 
                          name="checkmark-circle" 
                          size={16} 
                          color={DesignTokens.colors.primary.main} 
                          style={{ marginLeft: 8 }} 
                        />
                        <Text style={{ 
                          color: DesignTokens.colors.text.secondary, 
                          fontSize: 13, 
                          textAlign: 'right',
                          flex: 1
                        }}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                    {item.features.length > 6 && (
                      <Text style={{ 
                        color: DesignTokens.colors.primary.main, 
                        fontSize: 12, 
                        textAlign: 'right',
                        fontWeight: '600'
                      }}>
                        + עוד {item.features.length - 6} תכונות
                      </Text>
                    )}
                  </View>
                  
                  {/* Excluded Features */}
                  {item.excludedFeatures && item.excludedFeatures.length > 0 && (
                    <View style={{ marginTop: 8, gap: 4 }}>
                      {item.excludedFeatures.slice(0, 2).map((feature, index) => (
                        <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons 
                            name="close-circle" 
                            size={14} 
                            color="rgba(255, 255, 255, 0.3)" 
                            style={{ marginLeft: 8 }} 
                          />
                          <Text style={{ 
                            color: 'rgba(255, 255, 255, 0.4)', 
                            fontSize: 12, 
                            textAlign: 'right',
                            flex: 1,
                            textDecorationLine: 'line-through'
                          }}>
                            {feature}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />

            {/* Next Button */}
            <View style={{ paddingBottom: 20 }}>
              <LinearGradient
                colors={selectedTrack 
                  ? ['#00E654', '#00B84A', '#008F3A'] 
                  : ['#333', '#333', '#333']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 14,
                  shadowColor: selectedTrack ? DesignTokens.colors.primary.main : 'transparent',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: selectedTrack ? 0.4 : 0,
                  shadowRadius: 12,
                  elevation: selectedTrack ? 8 : 0
                }}
              >
                <TouchableOpacity
                  onPress={handleNext}
                  disabled={!selectedTrack}
                  style={{
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: selectedTrack ? 1 : 0.5
                  }}
                >
                  <Text style={{ 
                    color: selectedTrack ? '#000' : '#888', 
                    fontSize: 16, 
                    fontWeight: '700',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase'
                  }}>
                    המשך לתשלום
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

export default RegistrationTrackScreen;
