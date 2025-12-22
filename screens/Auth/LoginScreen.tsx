import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Dimensions, Keyboard, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DesignTokens } from '../../components/ui/DesignTokens';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signInWithGoogle, isLoading } = useAuth();
  const { setGoogleUserData } = useRegistration();

  // Create subtle background pattern
  const backgroundPattern = useMemo(() => {
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
  }, []);

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('saved_email');
      const savedPassword = await AsyncStorage.getItem('saved_password');
      const savedRememberMe = await AsyncStorage.getItem('remember_me');
      
      if (savedRememberMe === 'true' && savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
  };

  const saveCredentials = async (email: string, password: string, remember: boolean) => {
    try {
      if (remember) {
        await AsyncStorage.setItem('saved_email', email);
        await AsyncStorage.setItem('saved_password', password);
        await AsyncStorage.setItem('remember_me', 'true');
      } else {
        await AsyncStorage.removeItem('saved_email');
        await AsyncStorage.removeItem('saved_password');
        await AsyncStorage.removeItem('remember_me');
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }

    const { error } = await signIn({ email: email.trim(), password });
    if (error) {
      Alert.alert('שגיאה בהתחברות', error);
      await saveCredentials('', '', false);
    } else {
      await saveCredentials(email.trim(), password, rememberMe);
    }
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert('שגיאה', 'אנא הכנס את כתובת האימייל שלך');
      return;
    }
    Alert.alert('איפוס סיסמה', 'נשלח לך אימייל לאיפוס הסיסמה');
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      
      if (result.error) {
        Alert.alert('שגיאה בהתחברות', result.error);
        return;
      }
      
      // משתמש חדש - צריך להשלים הרשמה
      if (result.isNewUser && result.googleUser) {
        console.log('🆕 LoginScreen: New Google user, navigating to onboarding');
        setGoogleUserData(result.googleUser);
        navigation.navigate('Onboarding', { skipToIntro: true });
        return;
      }
      
      // משתמש קיים - התחבר בהצלחה (AuthContext כבר עדכן את ה-state)
      console.log('✅ LoginScreen: Existing Google user logged in successfully');
      // הניווט יתבצע אוטומטית ע"י AppNavigator כשה-user ישתנה
    } catch (error: any) {
      console.error('❌ LoginScreen: Google sign in error:', error);
      Alert.alert('שגיאה', 'אירעה שגיאה בהתחברות עם Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegister = () => {
    navigation.navigate('Onboarding');
  };

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
            <Image
              source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
              style={{
                width: '100%',
                height: '100%',
                resizeMode: 'contain',
                opacity: 0.3
              }}
            />
          </View>

          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView 
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header Section - ללא לוגו */}
              <View style={{ alignItems: 'center', marginBottom: 40 }}>
                <Text style={{ 
                  fontSize: 32, 
                  fontWeight: '800', 
                  color: DesignTokens.colors.text.primary, 
                  marginBottom: 8,
                  letterSpacing: -0.8,
                  textAlign: 'center'
                }}>
                  ברוכים הבאים ל-DarkPool
                </Text>
                
                <Text style={{ 
                  fontSize: 16, 
                  color: DesignTokens.colors.text.secondary, 
                  fontWeight: '400',
                  letterSpacing: 0.3,
                  textAlign: 'center',
                  lineHeight: 22
                }}>
                  התחבר לחשבון שלך כדי להמשיך
                </Text>
                
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
                    borderColor: '#333333',
                    paddingHorizontal: 16,
                    paddingVertical: 4,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <Ionicons name="mail-outline" size={20} color={DesignTokens.colors.text.tertiary} />
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
                    borderColor: '#333333',
                    paddingHorizontal: 16,
                    paddingVertical: 4,
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <Ionicons name="lock-closed-outline" size={20} color={DesignTokens.colors.text.tertiary} />
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
                      placeholder="הכנס את הסיסמה"
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

                {/* Remember Me & Forgot Password */}
                <View style={{ 
                  flexDirection: 'row-reverse', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: 8
                }}>
                  <Pressable 
                    onPress={() => setRememberMe(!rememberMe)}
                    style={{ 
                      flexDirection: 'row-reverse', 
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <View style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: rememberMe ? DesignTokens.colors.primary.main : DesignTokens.colors.text.tertiary,
                      backgroundColor: rememberMe ? DesignTokens.colors.primary.main : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {rememberMe && (
                        <Ionicons name="checkmark" size={12} color={DesignTokens.colors.background.primary} />
                      )}
                    </View>
                    <Text style={{ 
                      color: DesignTokens.colors.text.secondary, 
                      fontSize: 14, 
                      fontWeight: '500',
                      letterSpacing: 0.2
                    }}>
                      זכור אותי
                    </Text>
                  </Pressable>

                  <Pressable onPress={handleForgotPassword}>
                    <Text style={{ 
                      color: DesignTokens.colors.primary.main, 
                      fontSize: 14, 
                      fontWeight: '500',
                      letterSpacing: 0.2,
                      textAlign: 'right'
                    }}>
                      שכחת סיסמה?
                    </Text>
                  </Pressable>
                </View>

                {/* Login Button */}
                <LinearGradient
                  colors={['#00E654', '#00B84A', '#008F3A']}
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
                  <TouchableOpacity
                    onPress={handleSignIn}
                    disabled={isLoading}
                    style={{
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isLoading ? 0.7 : 1
                    }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#000000" size="small" />
                    ) : (
                      <Text style={{ 
                        color: DesignTokens.colors.background.primary, 
                        fontSize: 16, 
                        fontWeight: '700',
                        letterSpacing: 0.5,
                        textTransform: 'uppercase'
                      }}>
                        התחבר
                      </Text>
                    )}
                  </TouchableOpacity>
                </LinearGradient>

                {/* Divider */}
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  marginVertical: 20 
                }}>
                  <View style={{ 
                    flex: 1, 
                    height: 1, 
                    backgroundColor: DesignTokens.colors.border.main 
                  }} />
                  <Text style={{ 
                    color: DesignTokens.colors.text.secondary, 
                    fontSize: 14, 
                    fontWeight: '500',
                    marginHorizontal: 16
                  }}>
                    או
                  </Text>
                  <View style={{ 
                    flex: 1, 
                    height: 1, 
                    backgroundColor: DesignTokens.colors.border.main 
                  }} />
                </View>

                {/* Google Sign In Button */}
                <TouchableOpacity
                  onPress={handleGoogleSignIn}
                  disabled={isLoading || googleLoading}
                  style={{
                    backgroundColor: DesignTokens.colors.background.secondary,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: DesignTokens.colors.border.main,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    opacity: (isLoading || googleLoading) ? 0.7 : 1,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2
                  }}
                >
                  {googleLoading ? (
                    <ActivityIndicator color={DesignTokens.colors.text.primary} size="small" />
                  ) : (
                    <>
                      <Image
                        source={{ uri: 'https://www.google.com/favicon.ico' }}
                        style={{
                          width: 20,
                          height: 20,
                        }}
                      />
                      <Text style={{ 
                        color: DesignTokens.colors.text.primary, 
                        fontSize: 16, 
                        fontWeight: '600',
                        letterSpacing: 0.3
                      }}>
                        התחבר עם Google
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Register Button */}
                <TouchableOpacity
                  onPress={handleRegister}
                  style={{
                    backgroundColor: 'transparent',
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: DesignTokens.colors.primary.main,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8
                  }}
                >
                  <Text style={{ 
                    color: DesignTokens.colors.primary.main, 
                    fontSize: 16, 
                    fontWeight: '600',
                    letterSpacing: 0.3
                  }}>
                    צור חשבון חדש
                  </Text>
                </TouchableOpacity>

                {/* Footer text */}
                <Text style={{ 
                  color: DesignTokens.colors.text.tertiary, 
                  fontSize: 12, 
                  textAlign: 'center',
                  marginTop: 20,
                  lineHeight: 18
                }}>
                  בהתחברות אתה מסכים לתנאי השימוש ומדיניות הפרטיות
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
