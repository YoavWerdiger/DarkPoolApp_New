import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Dimensions, Keyboard, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, ActivityIndicator, Pressable, ScrollView, ImageBackground, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { AuthService } from '../../services/authService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { ScreenGradientBackground } from '../../components/VideoBackground';
import { SUPABASE_URL } from '../../config/publicEnv';
import { HapticFeedback } from '../../utils/hapticFeedback';

const { width, height } = Dimensions.get('window');
const WELCOME_LOGO_URI = 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/app-media/image%20(3).png';

// ─── Reusable input ────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
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
          backgroundColor: colors.glass.cardElevated.bg,
          borderRadius: 26,
          borderWidth: 1.5,
          borderColor: focused
            ? colors.primary.main
            : colors.glass.cardElevated.border,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {rightEl}
        <TextInput
          style={{
            flex: 1,
            color: colors.text.primary,
            paddingHorizontal: 0,
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
  const [showForm, setShowForm] = useState(false);
  const logoFloat = useRef(new Animated.Value(0)).current;

  const { signIn, signInWithGoogle, isLoading, setUser, passwordRecoveryMode, setPasswordRecoveryMode } = useAuth();
  const { setGoogleUserData } = useRegistration();

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  // מסך התחברות מכוון — מנקים recovery תקוע שלא יחסום Main אחרי login.
  // לא מנקים כש-recovery פעיל (deep-link / OTP) — PasswordRecoveryRedirect מנווט משם.
  useFocusEffect(
    useCallback(() => {
      if (passwordRecoveryMode) return;
      void setPasswordRecoveryMode(false);
    }, [passwordRecoveryMode, setPasswordRecoveryMode])
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -8,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [logoFloat]);

  const loadSavedCredentials = async () => {
    try {
      // Migrate: clear any legacy plaintext password from older versions
      await AsyncStorage.removeItem('saved_password');

      const savedEmail    = await AsyncStorage.getItem('saved_email');
      const savedRemember = await AsyncStorage.getItem('remember_me');
      if (savedRemember === 'true' && savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {}
  };

  const saveCredentials = async (e: string, remember: boolean) => {
    try {
      if (remember) {
        await AsyncStorage.setItem('saved_email', e);
        await AsyncStorage.setItem('remember_me', 'true');
      } else {
        await AsyncStorage.removeItem('saved_email');
        await AsyncStorage.removeItem('remember_me');
      }
    } catch {}
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      legacyAlert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }
    // ניקוי מכוון לפני/תוך signIn — גם אם נשארנו על Login עם דגל recovery
    await setPasswordRecoveryMode(false);
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await signIn({ email: normalizedEmail, password });
    if (error) {
      legacyAlert('שגיאה בהתחברות', error);
      await saveCredentials('', false);
    } else {
      await saveCredentials(normalizedEmail, rememberMe);
    }
  };

  const handleForgotPassword = () => {
    void HapticFeedback.impactLight();
    navigation.navigate('ForgotPassword', { email: email.trim() });
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) { legacyAlert('שגיאה בהתחברות', result.error); return; }
      if (result.isNewUser && result.googleUser) {
        // קודם קונטקסט הרשמה, אחר כך setUser — App מנתב ל-Onboarding עם isGoogleSignUp=true
        setGoogleUserData(result.googleUser);
        const { user: profile } = await AuthService.getCurrentUser();
        if (profile) setUser(profile);
        // Navigation ל-Onboarding קורה אוטומטית דרך App.tsx conditional rendering
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
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: 0.12,
            }}
          >
            <ImageBackground
              source={{ uri: `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png` }}
              style={{ width: width * 1.45, height: height * 1.45 }}
              imageStyle={{ resizeMode: 'contain' }}
            />
          </View>

          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: showForm ? 'center' : 'space-between',
                paddingHorizontal: 24,
                paddingTop: showForm ? 20 : 40,
                paddingBottom: 28,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {!showForm ? (
                <>
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 }}>
                    <Animated.View style={{ transform: [{ translateY: logoFloat }] }}>
                      <Image
                        source={{ uri: WELCOME_LOGO_URI }}
                        style={{ width: width * 0.78, height: width * 0.78, marginBottom: 10 }}
                        resizeMode="contain"
                      />
                    </Animated.View>
                  </View>

                  <View style={{ gap: 12 }}>
                    <LinearGradient
                      colors={colors.primary.gradient as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        borderRadius: 28,
                        shadowColor: colors.primary.main,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3,
                        shadowRadius: 14,
                        elevation: 8,
                      }}
                    >
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.medium();
                    navigation.navigate('Register');
                  }}
                  activeOpacity={0.86}
                  style={{ paddingVertical: 17, alignItems: 'center' }}
                      >
                        <Text style={{ color: colors.text.inverse, fontSize: 17, fontWeight: '800' }}>
                          התחל כאן
                        </Text>
                      </TouchableOpacity>
                    </LinearGradient>

                    <TouchableOpacity
                      onPress={() => {
                        void HapticFeedback.impactLight();
                        setShowForm(true);
                      }}
                      activeOpacity={0.85}
                      style={{
                        borderRadius: 28,
                        borderWidth: 1.5,
                        borderColor: colors.glass.cardElevated.border,
                        backgroundColor: colors.glass.cardElevated.bg,
                        paddingVertical: 16,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: colors.text.primary, fontSize: 16, fontWeight: '700' }}>
                        יש לי כבר חשבון
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={{ width: '100%', alignSelf: 'center' }}>
                  <View style={{ marginBottom: 24 }}>
                    <Text
                      style={{
                        fontSize: 28,
                        fontWeight: '800',
                        color: colors.text.primary,
                        marginBottom: 8,
                        letterSpacing: -0.5,
                        textAlign: 'right',
                      }}
                    >
                      התחברות לחשבון
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        color: colors.text.secondary,
                        fontWeight: '500',
                        textAlign: 'right',
                      }}
                    >
                      ברוכים הבאים לקהילת DarkPool
                    </Text>
                  </View>

                <Field
                  label="כתובת אימייל"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  tokens={tokens}
                />

                <Field
                  label="סיסמה"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="הכנס את הסיסמה"
                  secureTextEntry={!showPassword}
                  tokens={tokens}
                  rightEl={
                    <Pressable
                      onPress={() => {
                        void HapticFeedback.selection();
                        setShowPassword(!showPassword);
                      }}
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
                    onPress={() => {
                      void HapticFeedback.selection();
                      setRememberMe(!rememberMe);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 4,
                      paddingHorizontal: 2,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
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

                  <Pressable
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      handleForgotPassword();
                    }}
                  >
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
                    onPress={() => {
                      void HapticFeedback.medium();
                      handleSignIn();
                    }}
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
                    marginVertical: 18,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      borderRadius: 999,
                    }}
                  />
                  <Text
                    style={{
                      color: colors.text.tertiary,
                      fontSize: 12,
                      fontWeight: '600',
                      marginHorizontal: 12,
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 999,
                      paddingHorizontal: 9,
                      paddingVertical: 2,
                    }}
                  >
                    או
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      borderRadius: 999,
                    }}
                  />
                </View>

                {/* Google */}
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.medium();
                    handleGoogleSignIn();
                  }}
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
                onPress={() => {
                  void HapticFeedback.impactLight();
                  navigation.navigate('Register');
                }}
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

                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    setShowForm(false);
                  }}
                  activeOpacity={0.75}
                  style={{ alignItems: 'center', marginTop: 18 }}
                >
                  <Text style={{ color: colors.text.tertiary, fontSize: 13, fontWeight: '600' }}>
                    חזרה למסך ברוכים הבאים
                  </Text>
                </TouchableOpacity>
              </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
