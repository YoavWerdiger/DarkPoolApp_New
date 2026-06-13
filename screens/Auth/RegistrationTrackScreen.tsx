import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRegistration } from '../../context/RegistrationContext';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { SUPABASE_URL } from '../../config/publicEnv';
import { HapticFeedback } from '../../utils/hapticFeedback';

const { width, height } = Dimensions.get('window');

type PlanConfig = (typeof SUBSCRIPTION_PLANS)[keyof typeof SUBSCRIPTION_PLANS];

const getDisplayPlans = () => {
  const plans = (Object.values(SUBSCRIPTION_PLANS) as PlanConfig[])
    .filter((plan) => !('isAddon' in plan && plan.isAddon) && !('isOneTime' in plan && plan.isOneTime))
    .map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      period: plan.period,
      features: plan.features,
      excludedFeatures: plan.excludedFeatures || [],
      popular: plan.popular,
      color: plan.color,
    }));
  return plans.sort((a, b) => {
    if (a.id === 'free') return -1;
    if (b.id === 'free') return 1;
    return a.price - b.price;
  });
};

const ProgressBar = ({ current, total }: { current: number; total: number }) => (
  <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 }}>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor:
              i < current
                ? DesignTokens.colors.primary.main
                : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}
    </View>
  </View>
);

const RegistrationTrackScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const [selectedTrack, setSelectedTrack] = useState<string | null>(data.trackId || null);
  const tracks = getDisplayPlans();

  const formatPrice = (price: number, period: string) => {
    if (price === 0) return 'חינם';
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

  const handleNext = () => {
    if (!selectedTrack) return;
    const track = tracks.find(t => t.id === selectedTrack);

    if (selectedTrack === 'free') {
      setData({ ...data, trackId: '1', trackName: track?.name, trackPrice: 0, accountType: 'free' });
      navigation.navigate('RegistrationSummary');
      return;
    }

    setData({
      ...data,
      trackId: '1',
      trackName: track?.name,
      trackPrice: track?.price,
      accountType: selectedTrack,
    });
    navigation.navigate('CreditCardCheckout', {
      planId: selectedTrack,
      trackName: track?.name,
      trackPrice: track?.price,
      fromRegistration: true,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <LinearGradient
        colors={['#0A0E0A', '#0F1A0F', '#142014', '#0A0E0A']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ flex: 1 }}
      >
        {/* Depth overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.35)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Bull & Bear background */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', opacity: 0.22 }}>
          <ImageBackground
            source={{ uri: `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png` }}
            style={{ width: width * 1.6, height: height * 1.6 }}
            imageStyle={{ resizeMode: 'contain' }}
          />
        </View>

        {/* Animated candlestick chart */}

        <SafeAreaView style={{ flex: 1 }}>
          <ProgressBar current={4} total={5} />

          {/* Back */}
          <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.impactLight();
                navigation.goBack();
              }}
              activeOpacity={0.75}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'flex-end',
              }}
            >
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={{ paddingHorizontal: 24, paddingTop: 12, marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 30,
                fontWeight: '800',
                color: '#fff',
                marginBottom: 8,
                letterSpacing: -0.5,
                textAlign: 'right',
              }}
            >
              בחר מסלול
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: 'rgba(255,255,255,0.55)',
                textAlign: 'right',
                lineHeight: 22,
              }}
            >
              בחר את המסלול המתאים ביותר עבורך
            </Text>
          </View>

          {/* Plans list */}
          <FlatList
            data={tracks}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}
            renderItem={({ item }) => {
              const isSelected = selectedTrack === item.id;
              const isFree = item.id === 'free';

              return (
                <TouchableOpacity
                  onPress={() => {
                    if (selectedTrack !== item.id) void HapticFeedback.selection();
                    setSelectedTrack(item.id);
                  }}
                  activeOpacity={0.8}
                  style={{
                    borderRadius: 20,
                    marginBottom: 14,
                    overflow: 'hidden',
                    borderWidth: isSelected ? 1.5 : 1,
                    borderColor: isSelected
                      ? DesignTokens.colors.primary.main
                      : 'rgba(255,255,255,0.08)',
                    shadowColor: isSelected ? DesignTokens.colors.primary.main : '#000',
                    shadowOffset: { width: 0, height: isSelected ? 6 : 2 },
                    shadowOpacity: isSelected ? 0.25 : 0.08,
                    shadowRadius: isSelected ? 16 : 6,
                    elevation: isSelected ? 8 : 2,
                  }}
                >
                  <LinearGradient
                    colors={
                      isSelected
                        ? ['rgba(0,230,84,0.12)', 'rgba(0,230,84,0.04)']
                        : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 20 }}
                  >
                    {/* Popular badge */}
                    {item.popular && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 14,
                          left: 14,
                          backgroundColor: DesignTokens.colors.primary.main,
                          borderRadius: 20,
                          paddingHorizontal: 12,
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>
                          פופולרי ⭐
                        </Text>
                      </View>
                    )}

                    {/* Header row */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                        marginTop: item.popular ? 24 : 0,
                      }}
                    >
                      {/* Left: checkmark */}
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: isSelected
                            ? DesignTokens.colors.primary.main
                            : 'rgba(255,255,255,0.08)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: isSelected ? 0 : 1,
                          borderColor: 'rgba(255,255,255,0.15)',
                          marginTop: 2,
                        }}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="#000" />
                        )}
                      </View>

                      {/* Right: name + price */}
                      <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 8 }}>
                        <Text
                          style={{
                            color: '#fff',
                            fontWeight: '700',
                            fontSize: 17,
                            textAlign: 'right',
                            marginBottom: 2,
                          }}
                        >
                          {item.name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                          <Text
                            style={{
                              color: 'rgba(255,255,255,0.4)',
                              fontSize: 14,
                              fontWeight: '400',
                            }}
                          >
                            {item.price > 0 ? formatPeriod(item.period) : ''}
                          </Text>
                          <Text
                            style={{
                              color: isFree
                                ? DesignTokens.colors.primary.main
                                : '#fff',
                              fontWeight: '800',
                              fontSize: 22,
                              marginRight: 4,
                            }}
                          >
                            {formatPrice(item.price, item.period)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Description */}
                    {item.description && (
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.5)',
                          fontSize: 13,
                          textAlign: 'right',
                          marginBottom: 12,
                          lineHeight: 19,
                        }}
                      >
                        {item.description}
                      </Text>
                    )}

                    {/* Divider */}
                    <View
                      style={{
                        height: 1,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        marginBottom: 12,
                      }}
                    />

                    {/* Features */}
                    <View style={{ gap: 7 }}>
                      {item.features.map((feature, i) => (
                        <View
                          key={i}
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={15}
                            color={DesignTokens.colors.primary.main}
                            style={{ marginLeft: 8 }}
                          />
                          <Text
                            style={{
                              color: 'rgba(255,255,255,0.7)',
                              fontSize: 13,
                              textAlign: 'right',
                              flex: 1,
                            }}
                          >
                            {feature}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            }}
          />

          {/* CTA */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
            <LinearGradient
              colors={
                selectedTrack
                  ? ['#00C805', '#00A004', '#008F03']
                  : ['#2A2A2A', '#2A2A2A']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 30,
                shadowColor: selectedTrack ? DesignTokens.colors.primary.main : 'transparent',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: selectedTrack ? 0.35 : 0,
                shadowRadius: 16,
                elevation: selectedTrack ? 8 : 0,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  void HapticFeedback.medium();
                  handleNext();
                }}
                disabled={!selectedTrack}
                activeOpacity={0.85}
                style={{ paddingVertical: 17, alignItems: 'center' }}
              >
                <Text
                  style={{
                    color: selectedTrack ? '#000' : 'rgba(255,255,255,0.25)',
                    fontSize: 16,
                    fontWeight: '700',
                    letterSpacing: 0.3,
                  }}
                >
                  {selectedTrack === 'free' ? 'התחל בחינם' : 'המשך לתשלום'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

export default RegistrationTrackScreen;
