import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback, Keyboard, ImageBackground } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { User, Mail, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { AuthService } from '../../services/authService';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { SUPABASE_URL } from '../../config/publicEnv';

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signUp, isLoading, user } = useAuth();

  // הוסף את המשתמש לערוצים הקיימים כשהמשתמש משתנה
  useEffect(() => {
    if (user?.id) {
      addUserToDefaultChannels(user.id).catch(err => {
      });
    }
  }, [user]);

  const validateForm = async () => {
    if (!fullName.trim()) {
      legacyAlert('שגיאה', 'אנא הכנס את שמך המלא');
      return false;
    }
    if (!email.trim()) {
      legacyAlert('שגיאה', 'אנא הכנס כתובת אימייל');
      return false;
    }
    if (!email.includes('@')) {
      legacyAlert('שגיאה', 'אנא הכנס כתובת אימייל תקינה');
      return false;
    }
    
    // בדיקה שהמייל לא קיים
    const { exists: emailExists, error: emailError } = await AuthService.checkEmailExists(email.trim());
    if (emailError) {
      legacyAlert('שגיאה', 'שגיאה בבדיקת המייל');
      return false;
    }
    if (emailExists) {
      legacyAlert('שגיאה', 'כתובת המייל כבר קיימת במערכת');
      return false;
    }
    
    if (password.length < 6) {
      legacyAlert('שגיאה', 'הסיסמה חייבת להיות לפחות 6 תווים');
      return false;
    }
    if (password !== confirmPassword) {
      legacyAlert('שגיאה', 'הסיסמאות אינן תואמות');
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    if (!(await validateForm())) return;

    const { error } = await signUp({
      email: email.trim(),
      password,
      display_name: fullName.trim(),
    });

    if (error) {
      legacyAlert('שגיאה בהרשמה', error);
    } else {
      legacyAlert('הצלחה', 'החשבון נוצר בהצלחה! אנא אשר את האימייל שלך.', [
        { text: 'אישור', onPress: () => navigation.navigate('Login') }
      ]);
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
          colors={[DesignTokens.colors.background.secondary, DesignTokens.colors.background.tertiary, DesignTokens.colors.background.tertiary, DesignTokens.colors.background.secondary]}
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
            opacity: 0.22
          }}>
            <ImageBackground
              source={{ uri: `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png` }}
              resizeMode="contain"
              style={{
                width: width,
                height: height,
              }}
              imageStyle={{
                opacity: 0.35
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
                צור חשבון
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
                הירשם כדי להתחיל להשתמש באפליקציה
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

            {/* Form Section */}
            <View style={{ gap: 20 }}>
              {/* Full Name Input */}
              <View>
                <Text style={{ 
                  color: DesignTokens.colors.text.primary, 
                  fontSize: 14, 
                  fontWeight: '600', 
                  marginBottom: 8,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  textAlign: 'right'
                }}>
                  שם מלא
                </Text>
                <View style={{
                  backgroundColor: DesignTokens.colors.background.secondary,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: DesignTokens.colors.border.main,
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <User size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                  <TextInput
                    style={{
                      flex: 1,
                      color: DesignTokens.colors.text.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 16,
                      fontSize: 16,
                      fontWeight: '500',
                      textAlign: 'right'
                    }}
                    placeholder="הכנס את שמך המלא"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Email Input */}
              <View>
                <Text style={{ 
                  color: DesignTokens.colors.text.primary, 
                  fontSize: 14, 
                  fontWeight: '600', 
                  marginBottom: 8,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  textAlign: 'right'
                }}>
                  כתובת אימייל
                </Text>
                <View style={{
                  backgroundColor: DesignTokens.colors.background.secondary,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: DesignTokens.colors.border.main,
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Mail size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                  <TextInput
                    style={{
                      flex: 1,
                      color: DesignTokens.colors.text.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 16,
                      fontSize: 16,
                      fontWeight: '500',
                      textAlign: 'right'
                    }}
                    placeholder="הכנס את כתובת האימייל"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View>
                <Text style={{ 
                  color: DesignTokens.colors.text.primary, 
                  fontSize: 14, 
                  fontWeight: '600', 
                  marginBottom: 8,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  textAlign: 'right'
                }}>
                  סיסמה
                </Text>
                <View style={{
                  backgroundColor: DesignTokens.colors.background.secondary,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: DesignTokens.colors.border.main,
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Lock size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                  <TextInput
                    style={{
                      flex: 1,
                      color: DesignTokens.colors.text.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 16,
                      fontSize: 16,
                      fontWeight: '500',
                      textAlign: 'right'
                    }}
                    placeholder="הכנס סיסמה (לפחות 6 תווים)"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <Pressable 
                    onPress={() => setShowPassword(!showPassword)}
                    style={{ padding: 6 }}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color={DesignTokens.colors.text.tertiary} 
                    />
                  </Pressable>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View>
                <Text style={{ 
                  color: DesignTokens.colors.text.primary, 
                  fontSize: 14, 
                  fontWeight: '600', 
                  marginBottom: 8,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  textAlign: 'right'
                }}>
                  אימות סיסמה
                </Text>
                <View style={{
                  backgroundColor: DesignTokens.colors.background.secondary,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: DesignTokens.colors.border.main,
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Lock size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                  <TextInput
                    style={{
                      flex: 1,
                      color: DesignTokens.colors.text.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 16,
                      fontSize: 16,
                      fontWeight: '500',
                      textAlign: 'right'
                    }}
                    placeholder="הכנס שוב את הסיסמה"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <Pressable 
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ padding: 6 }}
                  >
                    <Ionicons 
                      name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color={DesignTokens.colors.text.tertiary} 
                    />
                  </Pressable>
                </View>
              </View>

              {/* Register Button */}
              <LinearGradient
                colors={[DesignTokens.colors.primary.main, DesignTokens.colors.primary.dark, DesignTokens.colors.primary.darker]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 14,
                  marginTop: 12,
                  shadowColor: DesignTokens.colors.primary.main,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8
                }}
              >
                <Pressable
                  onPress={handleSignUp}
                  disabled={isLoading}
                  style={{
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isLoading ? 0.7 : 1
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
                    {isLoading ? 'יוצר חשבון...' : 'צור חשבון'}
                  </Text>
                </Pressable>
              </LinearGradient>

              {/* Login Link */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'center', 
                alignItems: 'center', 
                marginTop: 24,
                gap: 6
              }}>
                <Text style={{ color: DesignTokens.colors.text.secondary, fontSize: 14, fontWeight: '400' }}>
                  יש לך כבר חשבון?
                </Text>
                <Pressable onPress={() => navigation.navigate('Login')}>
                  <Text style={{ 
                    color: DesignTokens.colors.primary.main, 
                    fontSize: 14, 
                    fontWeight: '600',
                    letterSpacing: 0.2,
                    textAlign: 'right'
                  }}>
                    התחבר עכשיו
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

export async function addUserToDefaultChannels(userId: string) {
  try {
    const { data: channels } = await supabase.from('channels').select('id').eq('is_private', false);
    if (channels) {
      for (const channel of channels) {
        // בדיקה אם המשתמש כבר חבר בערוץ
        const { data: existingMember, error: checkError } = await supabase
          .from('channel_members')
          .select('id')
          .eq('channel_id', channel.id)
          .eq('user_id', userId)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
          continue;
        }
        
        if (existingMember) {
          continue;
        }
        
        // המשתמש לא חבר, נוסיף אותו
        const { error: insertError } = await supabase.from('channel_members').insert({ 
          channel_id: channel.id, 
          user_id: userId 
        });
        
        if (insertError) {
        } else {
        }
      }
    }
  } catch (error) {
  }
}