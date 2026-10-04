import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Dimensions, Keyboard, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, ScrollView, Animated, Easing, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { AuthService } from '../../services/authService';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UIButton from '../../components/ui/UIButton';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import {
  APP_TYPE,
  appCaptionStyle,
  appFlowSubtitleStyle,
  appFlowTitleStyle,
} from '../../components/ui/appType';
import { ScreenGradientBackground } from '../../components/VideoBackground';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import { PasswordVisibilityToggle } from '../../components/ui/PasswordVisibilityToggle';

const { width } = Dimensions.get('window');
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
  tokens,
}) => {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const { colors } = tokens;
  const isPassword = secureTextEntry === true;
  return (
    <View style={{ marginBottom: APP_LAYOUT.componentGap }}>
      <View
        style={{ marginBottom: APP_LAYOUT.stackGapSmall }}
      >
        <Text style={[formFieldLabelStyle({ tokens, focused, error: false }), { textAlign: 'right', writingDirection: 'rtl' }]}>{label}</Text>
      </View>
      <View
        style={[
          {
            borderRadius: tokens.borderRadius.search,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 52,
          },
          formFieldShellStyle({ tokens, focused, error: false }),
        ]}
      >
        {isPassword ? (
          <PasswordVisibilityToggle
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((v) => !v)}
          />
        ) : null}
        <TextInput
          style={[formFieldInputStyle(tokens), { flex: 1, paddingVertical: 14 }]}
          placeholder={placeholder}
          placeholderTextColor={formFieldPlaceholderColor(tokens)}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword ? !passwordVisible : secureTextEntry}
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
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <ScreenGradientBackground />

          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={[
                styles.scroll,
                showForm ? styles.scrollForm : styles.scrollWelcome,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {!showForm ? (
                <>
                  <View style={styles.logoWrap}>
                    <Animated.View style={{ transform: [{ translateY: logoFloat }] }}>
                      <Image
                        source={{ uri: WELCOME_LOGO_URI }}
                        style={{ width: width * 0.78, height: width * 0.78 }}
                        resizeMode="contain"
                      />
                    </Animated.View>
                  </View>

                  <View style={styles.buttonStack}>
                    <UIButton
                      title="התחל כאן"
                      variant="primary"
                      size="lg"
                      fullWidth
                      onPress={() => navigation.navigate('Register')}
                    />
                    <UIButton
                      title="יש לי כבר חשבון"
                      variant="secondary"
                      size="lg"
                      fullWidth
                      onPress={() => setShowForm(true)}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.form}>
                  <View style={styles.titleBlock}>
                    <Text style={[appFlowTitleStyle, { color: colors.text.primary }]}>
                      התחברות לחשבון
                    </Text>
                    <Text style={[appFlowSubtitleStyle, { color: colors.text.secondary }]}>
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
                    secureTextEntry
                    tokens={tokens}
                  />

                  {/* זכור אותי (ימין) · שכחת סיסמה (שמאל) */}
                  <View style={styles.optionsRow}>
                    <TouchableOpacity
                      onPress={() => {
                        void HapticFeedback.selection();
                        setRememberMe(!rememberMe);
                      }}
                      activeOpacity={0.7}
                      style={styles.rememberBtn}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: rememberMe }}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: rememberMe ? colors.text.primary : colors.text.tertiary,
                            backgroundColor: rememberMe ? colors.text.primary : 'transparent',
                          },
                        ]}
                      >
                        {rememberMe ? (
                          <Ionicons name="checkmark" size={13} color={colors.text.inverse} />
                        ) : null}
                      </View>
                      <Text style={[styles.optionText, { color: colors.text.secondary }]}>זכור אותי</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7} hitSlop={8}>
                      <Text style={[styles.optionText, styles.linkText, { color: colors.text.primary }]}>
                        שכחת סיסמה?
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <UIButton
                    title="התחבר"
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={isLoading}
                    disabled={isLoading}
                    onPress={() => void handleSignIn()}
                  />

                  <View style={styles.dividerRow}>
                    <View style={[styles.dividerLine, { backgroundColor: colors.border.divider }]} />
                    <Text style={[appCaptionStyle, styles.dividerText, { color: colors.text.tertiary }]}>או</Text>
                    <View style={[styles.dividerLine, { backgroundColor: colors.border.divider }]} />
                  </View>

                  <View style={styles.buttonStack}>
                    <UIButton
                      title="התחבר עם Google"
                      variant="secondary"
                      size="lg"
                      icon="logo-google"
                      iconPosition="right"
                      fullWidth
                      loading={googleLoading}
                      disabled={isLoading || googleLoading}
                      onPress={() => void handleGoogleSignIn()}
                    />
                    <UIButton
                      title="צור חשבון חדש"
                      variant="ghost"
                      size="lg"
                      fullWidth
                      textStyle={{ color: colors.text.primary }}
                      onPress={() => navigation.navigate('Register')}
                    />
                  </View>

                  <Text style={[appCaptionStyle, styles.footer, { color: colors.text.tertiary }]}>
                    בהתחברות אתה מסכים לתנאי השימוש ומדיניות הפרטיות
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      setShowForm(false);
                    }}
                    activeOpacity={0.7}
                    style={styles.backLink}
                  >
                    <Text style={[styles.optionText, { color: colors.text.secondary }]}>
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

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingBottom: APP_LAYOUT.componentGap,
  },
  scrollWelcome: {
    justifyContent: 'space-between',
    paddingTop: APP_LAYOUT.sectionGap,
  },
  scrollForm: {
    justifyContent: 'center',
    paddingTop: APP_LAYOUT.componentGap,
  },
  logoWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonStack: {
    gap: APP_LAYOUT.stackGapTight,
  },
  form: {
    width: '100%',
  },
  titleBlock: {
    marginBottom: APP_LAYOUT.sectionGap / 2 + 4,
  },
  optionsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: APP_LAYOUT.stackGapSmall / 2,
    marginBottom: APP_LAYOUT.sectionGap / 2 + 4,
  },
  rememberBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: APP_LAYOUT.stackGapSmall,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    fontWeight: APP_TYPE.cardBody.fontWeight,
    writingDirection: 'rtl',
  },
  linkText: {
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: APP_LAYOUT.componentGap + 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    marginHorizontal: APP_LAYOUT.stackGapTight,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    marginTop: APP_LAYOUT.sectionGap / 2 + 4,
  },
  backLink: {
    alignItems: 'center',
    marginTop: APP_LAYOUT.componentGap,
    paddingVertical: 4,
  },
});
