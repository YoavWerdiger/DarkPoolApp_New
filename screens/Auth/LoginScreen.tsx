import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Dimensions, Keyboard, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, ActivityIndicator, Pressable, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ScreenGradientBackground } from '../../components/VideoBackground';
import { SUPABASE_URL } from '../../config/publicEnv';

const { width, height } = Dimensions.get('window');

// ─── Reusable input ────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  rightEl?: React.ReactNode;
  tokens: ReturnType<typeof useDesignTokens>;
}

const Field: React.FC<FieldProps> = ({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  rightEl,
  tokens,
}) => {
  const [focused, setFocused] = useState(false);
  const { colors } = tokens;
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: colors.text.secondary,
          fontSize: 13,
          fontWeight: '500',
          marginBottom: 8,
          textAlign: 'right',
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          backgroundColor: colors.glass.card.bg,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: focused
            ? colors.primary.main
            : colors.glass.card.border,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Ionicons
          name={icon}
          size={19}
          color={focused ? colors.primary.main : colors.text.tertiary}
        />
        <TextInput
          style={{
            flex: 1,
            color: colors.text.primary,
            paddingHorizontal: 12,
            paddingVertical: 15,
            fontSize: 16,
            fontWeight: '400',
            textAlign: 'right',
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.text.disabled}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightEl}
      </View>
    </View>
  );
};

// ─── Screen ────────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { colors } = tokens;
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { signIn, signInWithGoogle, isLoading } = useAuth();
  const { setGoogleUserData } = useRegistration();

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail    = await AsyncStorage.getItem('saved_email');
      const savedPassword = await AsyncStorage.getItem('saved_password');
      const savedRemember = await AsyncStorage.getItem('remember_me');
      if (savedRemember === 'true' && savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch {}
  };

  const saveCredentials = async (e: string, p: string, remember: boolean) => {
    try {
      if (remember) {
        await AsyncStorage.setItem('saved_email',    e);
        await AsyncStorage.setItem('saved_password', p);
        await AsyncStorage.setItem('remember_me',    'true');
      } else {
        await AsyncStorage.removeItem('saved_email');
        await AsyncStorage.removeItem('saved_password');
        await AsyncStorage.removeItem('remember_me');
      }
    } catch {}
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      legacyAlert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }
    const { error } = await signIn({ email: email.trim(), password });
    if (error) {
      legacyAlert('שגיאה בהתחברות', error);
      await saveCredentials('', '', false);
    } else {
      await saveCredentials(email.trim(), password, rememberMe);
    }
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      legacyAlert('שגיאה', 'אנא הכנס את כתובת האימייל שלך');
      return;
    }
    legacyAlert('איפוס סיסמה', 'נשלח לך אימייל לאיפוס הסיסמה');
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) { legacyAlert('שגיאה בהתחברות', result.error); return; }
      if (result.isNewUser && result.googleUser) {
        setGoogleUserData(result.googleUser);
        navigation.navigate('Onboarding', { skipToIntro: true });
      }
    } catch {
      legacyAlert('שגיאה', 'אירעה שגיאה בהתחברות עם Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
          <ScreenGradientBackground />

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
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'center',
                paddingHorizontal: 24,
                paddingVertical: 32,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Logo גדול */}
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <Image
                  source={require('../../assets/icon.png')}
                  style={{ width: 96, height: 96, borderRadius: 24 }}
                  resizeMode="contain"
                />
              </View>

              {/* Header */}
              <View style={{ marginBottom: 40 }}>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: '800',
                    color: colors.text.primary,
                    marginBottom: 8,
                    letterSpacing: -0.8,
                    textAlign: 'right',
                    lineHeight: 38,
                  }}
                >
                  ברוכים הבאים{'\n'}ל-DarkPool
                </Text>

                <Text
                  style={{
                    fontSize: 15,
                    color: colors.text.secondary,
                    fontWeight: '400',
                    textAlign: 'right',
                    lineHeight: 22,
                  }}
                >
                  התחבר לחשבון שלך כדי להמשיך
                </Text>
              </View>

              {/* Form */}
              <View>
                <Field
                  label="כתובת אימייל"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  tokens={tokens}
                />

                <Field
                  label="סיסמה"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="הכנס את הסיסמה"
                  secureTextEntry={!showPassword}
                  tokens={tokens}
                  rightEl={
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ padding: 6 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={19}
                        color={colors.text.tertiary}
                      />
                    </Pressable>
                  }
                />

                {/* Remember me + Forgot */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 28,
                    marginTop: 4,
                  }}
                >
                  <Pressable
                    onPress={() => setRememberMe(!rememberMe)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        borderWidth: 1.5,
                        borderColor: rememberMe
                          ? colors.primary.main
                          : colors.border.hover,
                        backgroundColor: rememberMe
                          ? colors.primary.main
                          : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {rememberMe && (
                        <Ionicons name="checkmark" size={13} color={colors.text.inverse} />
                      )}
                    </View>
                    <Text
                      style={{
                        color: colors.text.secondary,
                        fontSize: 14,
                        fontWeight: '500',
                      }}
                    >
                      זכור אותי
                    </Text>
                  </Pressable>

                  <Pressable onPress={handleForgotPassword}>
                    <Text
                      style={{
                        color: colors.primary.main,
                        fontSize: 14,
                        fontWeight: '600',
                      }}
                    >
                      שכחת סיסמה?
                    </Text>
                  </Pressable>
                </View>

                {/* Login CTA */}
                <LinearGradient
                  colors={colors.primary.gradient as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 30,
                    shadowColor: colors.primary.main,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.35,
                    shadowRadius: 16,
                    elevation: 8,
                    marginBottom: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={handleSignIn}
                    disabled={isLoading}
                    activeOpacity={0.85}
                    style={{
                      paddingVertical: 17,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isLoading ? 0.75 : 1,
                    }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={colors.text.inverse} size="small" />
                    ) : (
                      <Text
                        style={{
                          color: colors.text.inverse,
                          fontSize: 16,
                          fontWeight: '700',
                          letterSpacing: 0.3,
                        }}
                      >
                        התחבר
                      </Text>
                    )}
                  </TouchableOpacity>
                </LinearGradient>

                {/* Divider */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginVertical: 20,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: colors.border.divider,
                    }}
                  />
                  <Text
                    style={{
                      color: colors.text.tertiary,
                      fontSize: 13,
                      fontWeight: '500',
                      marginHorizontal: 16,
                    }}
                  >
                    או
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: colors.border.divider,
                    }}
                  />
                </View>

                {/* Google */}
                <TouchableOpacity
                  onPress={handleGoogleSignIn}
                  disabled={isLoading || googleLoading}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: colors.selection.subtle,
                    borderRadius: 30,
                    borderWidth: 1,
                    borderColor: colors.glass.card.border,
                    paddingVertical: 15,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    marginBottom: 12,
                    opacity: isLoading || googleLoading ? 0.6 : 1,
                  }}
                >
                  {googleLoading ? (
                    <ActivityIndicator color={colors.text.primary} size="small" />
                  ) : (
                    <>
                      <Image
                        source={{ uri: 'https://www.google.com/favicon.ico' }}
                        style={{ width: 18, height: 18 }}
                      />
                      <Text
                        style={{
                          color: colors.text.primary,
                          fontSize: 15,
                          fontWeight: '600',
                          letterSpacing: 0.2,
                        }}
                      >
                        התחבר עם Google
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Register */}
                <TouchableOpacity
                  onPress={() => navigation.navigate('Onboarding')}
                  activeOpacity={0.75}
                  style={{
                    borderRadius: 30,
                    borderWidth: 1.5,
                    borderColor: colors.primary.main,
                    paddingVertical: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary.main,
                      fontSize: 15,
                      fontWeight: '700',
                      letterSpacing: 0.2,
                    }}
                  >
                    צור חשבון חדש
                  </Text>
                </TouchableOpacity>

                {/* Footer */}
                <Text
                  style={{
                    color: colors.text.disabled,
                    fontSize: 12,
                    textAlign: 'center',
                    marginTop: 28,
                    lineHeight: 18,
                  }}
                >
                  בהתחברות אתה מסכים לתנאי השימוש ומדיניות הפרטיות
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
