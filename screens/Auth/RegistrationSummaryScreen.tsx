import { legacyAlert } from '../../utils/appDialog';
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ImageBackground, ScrollView } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Check, User, Phone, TrendingUp, BarChart3, Clock, Rocket } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthService } from '../../services/authService';
import { SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { DesignTokens } from '../../components/ui/DesignTokens';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL } from '../../config/publicEnv';

const { width, height } = Dimensions.get('window');

const tracks: Record<string, string> = {
  '1': 'מסלול משקיעים מתחילים',
  '2': 'מסלול מסחר יומי',
  '3': 'מסלול ניתוח טכני',
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

// Row item in summary card
const SummaryRow = ({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.05)',
    }}
  >
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(0,230,84,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
      }}
    >
      {icon}
    </View>
    <Text
      style={{
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        textAlign: 'right',
        flex: 1,
      }}
    >
      {label}
    </Text>
  </View>
);

const RegistrationSummaryScreen = ({ navigation }: { navigation: any }) => {
  const { data, resetData } = useRegistration();
  const { signIn, setUser, signOut, user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    try {
      const introData = {
        markets:        data.markets        || [],
        experience:     data.experience     || '',
        styles:         data.styles         || [],
        brokers:        data.brokers        || [],
        level:          data.level          || '',
        goal:           data.goal           || '',
        communityGoals: data.communityGoals || [],
        hours:          data.hours          || '',
        socials:        data.socials        || [],
        heardFrom:      data.heardFrom      || '',
        wish:           data.wish           || '',
        fullTime:       data.fullTime       || '',
        style:          data.style          || '',
      };

      let user, signUpError;

      if (data.isGoogleSignUp && data.googleUserId) {
        try {
          const { error: updateError } = await supabase
            .from('users')
            .update({
              phone:        data.phone || null,
              track_id:     data.trackId || '1',
              account_type: data.accountType,
              intro_data:   introData,
              updated_at:   new Date().toISOString(),
            })
            .eq('id', data.googleUserId);
          if (updateError) {
            signUpError = updateError.message;
          } else {
            user = await AuthService.getUserProfile(data.googleUserId);
          }
        } catch (error: any) {
          signUpError = error.message || 'שגיאה בעדכון הפרופיל';
        }
      } else {
        try {
          await AsyncStorage.removeItem('saved_email');
          await AsyncStorage.removeItem('saved_password');
          await AsyncStorage.removeItem('remember_me');
          await AsyncStorage.setItem('explicit_logout', 'true');
        } catch {}

        if (currentUser) await signOut();

        try {
          const result = await AuthService.signUp({
            email:           data.email,
            password:        data.password,
            display_name:    data.fullName,
            full_name:       data.fullName,
            profile_picture: data.profileImage ?? undefined,
            phone:           data.phone,
            track_id:        data.trackId || '1',
            account_type:    data.accountType,
            intro_data:      introData,
          });
          user       = result.user;
          signUpError = result.error;
        } catch (authError: any) {
          signUpError = authError.message || 'Unknown error in AuthService';
        }
      }

      if (signUpError) { setLoading(false); legacyAlert('שגיאה בהרשמה', signUpError); return; }

      if (user) {
        if (data.isGoogleSignUp) {
          setLoading(false);
          try { await AsyncStorage.removeItem('explicit_logout'); } catch {}
          setUser(user);
          if (resetData) resetData();

          const selectedPlan = SUBSCRIPTION_PLANS[data.accountType as keyof typeof SUBSCRIPTION_PLANS];
          const planName     = selectedPlan ? selectedPlan.name : 'מסלול חודשי';

          legacyAlert(
            'הרשמה הושלמה בהצלחה! 🎉',
            `ברוכים הבאים ל-DarkPool! החשבון שלך נוצר עם תוכנית ${planName}.`,
            [{
              text: 'התחל',
              onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }),
            }]
          );
        } else {
          setLoading(false);
          try { await AsyncStorage.setItem('explicit_logout', 'true'); } catch {}
          await signOut(true);
          if (resetData) resetData();

          legacyAlert(
            'נשלח מייל אימות',
            `שלחנו קישור אימות לכתובת ${data.email}. יש לאשר את המייל ורק אז להתחבר.`,
            [
              {
                text: 'שלח שוב',
                onPress: async () => {
                  const { error } = await AuthService.resendVerificationEmail(data.email || '');
                  if (error) {
                    legacyAlert('שגיאה', error);
                  } else {
                    legacyAlert('בוצע', 'מייל אימות נשלח שוב בהצלחה');
                  }
                },
              },
              {
                text: 'אישור',
                onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }),
              },
            ]
          );
        }
      } else {
        legacyAlert('שגיאה', 'לא ניתן היה ליצור את המשתמש');
      }
    } catch {
      setLoading(false);
      legacyAlert('שגיאה', 'אירעה שגיאה בעת השלמת ההרשמה');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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

          {/* SafeArea with progress bar */}
          <View style={{ paddingTop: 44 }}>
            <ProgressBar current={5} total={5} />
          </View>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Success icon */}
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <LinearGradient
                colors={['rgba(0,230,84,0.25)', 'rgba(0,230,84,0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                  borderWidth: 1.5,
                  borderColor: 'rgba(0,230,84,0.3)',
                }}
              >
                <Check size={44} color={DesignTokens.colors.primary.main} strokeWidth={2.5} />
              </LinearGradient>

              <Text
                style={{
                  fontSize: 30,
                  fontWeight: '800',
                  color: '#fff',
                  marginBottom: 8,
                  letterSpacing: -0.5,
                  textAlign: 'center',
                }}
              >
                הרשמה הושלמה!
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: 'rgba(255,255,255,0.55)',
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                ברוכים הבאים ל-DarkPool
              </Text>
            </View>

            {/* Summary card */}
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                padding: 20,
                marginBottom: 28,
              }}
            >
              {/* Profile header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.06)',
                }}
              >
                {data.profileImage ? (
                  <Image
                    source={{ uri: data.profileImage }}
                    style={{ width: 56, height: 56, borderRadius: 28, marginLeft: 14 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: 'rgba(0,230,84,0.15)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 14,
                    }}
                  >
                    <User size={28} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 18,
                      fontWeight: '700',
                      textAlign: 'right',
                      marginBottom: 3,
                    }}
                  >
                    {data.fullName}
                  </Text>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.45)',
                      fontSize: 13,
                      textAlign: 'right',
                    }}
                  >
                    {data.email}
                  </Text>
                </View>
              </View>

              {/* Details */}
              {data.phone && (
                <SummaryRow
                  icon={<Phone size={18} color={DesignTokens.colors.primary.main} strokeWidth={2} />}
                  label={data.phone}
                />
              )}
              <SummaryRow
                icon={<TrendingUp size={18} color={DesignTokens.colors.primary.main} strokeWidth={2} />}
                label={tracks[data.trackId] || 'מסלול לא נבחר'}
              />
              {data.markets && data.markets.length > 0 && (
                <SummaryRow
                  icon={<BarChart3 size={18} color={DesignTokens.colors.primary.main} strokeWidth={2} />}
                  label={data.markets.join(' · ')}
                />
              )}
              {data.experience && (
                <SummaryRow
                  icon={<Clock size={18} color={DesignTokens.colors.primary.main} strokeWidth={2} />}
                  label={data.experience}
                />
              )}
            </View>

            {/* Buttons */}
            <View style={{ gap: 8 }}>
              <LinearGradient
                colors={['#00C805', '#00A004', '#008F03']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 30,
                  shadowColor: DesignTokens.colors.primary.main,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <TouchableOpacity
                  onPress={handleFinish}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={{
                    paddingVertical: 17,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    opacity: loading ? 0.75 : 1,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <>
                      <Rocket size={18} color="#000" strokeWidth={2} style={{ marginLeft: 8 }} />
                      <Text style={{ color: '#000', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 }}>
                        התחל להשתמש
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </LinearGradient>

              <TouchableOpacity
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
                style={{ paddingVertical: 16, alignItems: 'center' }}
              >
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 15,
                    fontWeight: '500',
                  }}
                >
                  ערוך פרטים
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default RegistrationSummaryScreen;
