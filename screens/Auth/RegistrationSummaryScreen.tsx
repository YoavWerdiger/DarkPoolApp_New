import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Alert, ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ImageBackground } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Check, User, Phone, Mail, TrendingUp, BarChart3, Clock, Rocket } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthService } from '../../services/authService';
import { SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { DesignTokens } from '../../components/ui/DesignTokens';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Debug: בדיקה שה-AuthService קיים
console.log('🔍 RegistrationSummary: AuthService imported:', !!AuthService);
console.log('🔍 RegistrationSummary: AuthService.signUp exists:', !!AuthService.signUp);

const tracks: Record<string, string> = {
  '1': 'מסלול משקיעים מתחילים',
  '2': 'מסלול מסחר יומי',
  '3': 'מסלול ניתוח טכני',
};

const RegistrationSummaryScreen = ({ navigation }: { navigation: any }) => {
  const { data } = useRegistration();
  const { signIn, setUser, signOut, user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    
    try {
      console.log('🔄 RegistrationSummary: Starting registration with data:', data);
      
      // מחיקת כל הנתונים השמורים לפני יצירת משתמש חדש
      // זה מבטיח שלא תהיה התחברות אוטומטית למשתמש אחר אחרי ריענון
      try {
        await AsyncStorage.removeItem('saved_email');
        await AsyncStorage.removeItem('saved_password');
        await AsyncStorage.removeItem('remember_me');
        await AsyncStorage.setItem('explicit_logout', 'true'); // סימון שהמשתמש התנתק
        console.log('✅ RegistrationSummary: Cleared all saved credentials before registration');
      } catch (storageError) {
        console.error('❌ RegistrationSummary: Error clearing saved credentials:', storageError);
      }
      
      // אם יש משתמש מחובר, נתנתק קודם
      if (currentUser) {
        console.log('🔄 RegistrationSummary: User already logged in, signing out first...');
        await signOut();
        console.log('✅ RegistrationSummary: Signed out existing user');
      }
      
      // וידוא שכל הנתונים הנדרשים קיימים
      const registrationData = {
        email: data.email,
        password: data.password,
        display_name: data.fullName,
            full_name: data.fullName,
        profile_picture: data.profileImage,
        phone: data.phone,
        track_id: data.trackId || '1', // default למסלול מתחילים
        account_type: data.accountType,
        intro_data: {
          markets: data.markets || [],
          experience: data.experience || '',
          styles: data.styles || [],
          brokers: data.brokers || [],
          level: data.level || '',
          goal: data.goal || '',
          communityGoals: data.communityGoals || [],
          hours: data.hours || '',
          socials: data.socials || [],
          heardFrom: data.heardFrom || '',
          wish: data.wish || ''
        }
      };

      console.log('🔄 RegistrationSummary: Sending registration data:', registrationData);

      // יצירת משתמש עם כל הנתונים בבת אחת
      console.log('🔄 RegistrationSummary: Calling AuthService.signUp...');
      
      let user, signUpError;
      try {
        const result = await AuthService.signUp(registrationData);
        user = result.user;
        signUpError = result.error;
        console.log('🔄 RegistrationSummary: AuthService.signUp completed:', { user: !!user, error: signUpError });
      } catch (authError) {
        console.error('❌ RegistrationSummary: AuthService.signUp threw exception:', authError);
        signUpError = authError.message || 'Unknown error in AuthService';
      }

      if (signUpError) {
        setLoading(false);
        Alert.alert('שגיאה בהרשמה', signUpError);
        return;
      }

      // אם המשתמש נוצר בהצלחה, נעביר אותו ישירות לדף הקבוצות
      if (user) {
        console.log('✅ RegistrationSummary: User created successfully, navigating to main app');
        
        // מחיקת explicit_logout כדי לאפשר התחברות אוטומטית למשתמש החדש (אם יסומן "זכור אותי")
        try {
          await AsyncStorage.removeItem('explicit_logout');
          console.log('✅ RegistrationSummary: Removed explicit_logout flag for new user');
        } catch (error) {
          console.error('❌ RegistrationSummary: Error removing explicit_logout:', error);
        }
        
      // עדכון ה-AuthContext עם המשתמש החדש
      setUser(user);
      
      // קבלת פרטי התוכנית שנבחרה
      const selectedPlan = SUBSCRIPTION_PLANS[data.accountType as keyof typeof SUBSCRIPTION_PLANS];
      const planName = selectedPlan ? selectedPlan.name : 'מסלול חודשי';
      
      Alert.alert(
        'הרשמה הושלמה בהצלחה!',
        `ברוכים הבאים ל-DarkPool! החשבון שלך נוצר עם תוכנית ${planName}. תוכל להתחיל להשתמש באפליקציה.`,
        [
          {
            text: 'התחל',
            onPress: () => {
              // ניווט ישיר לדף הקבוצות
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              });
            }
          }
        ]
      );
      } else {
        Alert.alert('שגיאה', 'לא ניתן היה ליצור את המשתמש');
      }
    } catch (error: any) {
      setLoading(false);
      Alert.alert('שגיאה', 'אירעה שגיאה בעת השלמת ההרשמה');
      console.error('Registration completion error:', error);
    }
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

          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
            {/* Header Section */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              {/* Success Icon */}
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'rgba(0, 230, 84, 0.2)',
                borderWidth: 3,
                borderColor: DesignTokens.colors.primary.main,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                shadowColor: DesignTokens.colors.primary.main,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8
              }}>
                <Check size={40} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              </View>

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
                הרשמה הושלמה!
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
                ברוכים הבאים ל-DarkPool
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

            {/* Summary Section */}
            <View style={{
              backgroundColor: '#181818',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              padding: 20,
              marginBottom: 40
            }}>
              {/* Profile Section */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        {data.profileImage ? (
                  <Image
                    source={{ uri: data.profileImage }}
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 30,
                      marginLeft: 16
                    }}
                  />
                ) : (
                  <View style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: 'rgba(0, 230, 84, 0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 16
                  }}>
                    <User size={30} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    color: DesignTokens.colors.text.primary, 
                    fontSize: 18, 
                    fontWeight: '700',
                    writingDirection: 'rtl'
                  }}>
                    {data.fullName}
                  </Text>
                  <Text style={{ 
                    color: DesignTokens.colors.text.secondary, 
                    fontSize: 14,
                    writingDirection: 'rtl'
                  }}>
                    {data.email}
                  </Text>
                </View>
              </View>

              {/* Details Section */}
              <View style={{ gap: 16 }}>
                {/* Phone */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Phone size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} style={{ marginLeft: 12 }} />
                  <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 14, writingDirection: 'rtl', flex: 1 }}>
                    {data.phone}
                  </Text>
                </View>

                {/* Track */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TrendingUp size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} style={{ marginLeft: 12 }} />
                  <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 14, writingDirection: 'rtl', flex: 1 }}>
                    {tracks[data.trackId] || 'מסלול לא נבחר'}
                  </Text>
                </View>

                {/* Markets */}
                {data.markets && data.markets.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <BarChart3 size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} style={{ marginLeft: 12 }} />
                    <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 14, writingDirection: 'rtl', flex: 1 }}>
                      {data.markets.join(', ')}
                    </Text>
                  </View>
                )}

                {/* Experience */}
                {data.experience && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={20} color={DesignTokens.colors.primary.main} strokeWidth={2} style={{ marginLeft: 12 }} />
                    <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 14, writingDirection: 'rtl', flex: 1 }}>
                      {data.experience}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={{ gap: 16 }}>
              {/* Finish Button */}
              <LinearGradient
                colors={['#00E654', '#00B84A', '#008F3A']}
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
          onPress={handleFinish}
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
                      <Rocket size={20} color="#000000" strokeWidth={2} style={{ marginLeft: 8 }} />
                      <Text style={{ 
                        color: DesignTokens.colors.background.primary, 
                        fontSize: 16, 
                        fontWeight: '700',
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        writingDirection: 'rtl'
                      }}>
                        התחל להשתמש
                      </Text>
                    </View>
          )}
        </TouchableOpacity>
              </LinearGradient>

              {/* Edit Button */}
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{
                  backgroundColor: '#181818',
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)'
                }}
              >
                <Text style={{ 
                  color: DesignTokens.colors.text.secondary, 
                  fontSize: 16, 
                  fontWeight: '600',
                  letterSpacing: 0.3,
                  writingDirection: 'rtl'
                }}>
                  ערוך פרטים
                </Text>
              </TouchableOpacity>
            </View>
    </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default RegistrationSummaryScreen; 