import i18n from '../../lib/i18n';
import { TEXT_DIR, getStoredLanguage, isRtlLanguage } from '../../lib/i18n/language';

import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { I18nManager, View, Text, TextInput, TouchableOpacity, Dimensions, Keyboard, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { AuthService } from '../../services/authService';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useTheme } from '../../context/ThemeContext';
import UIButton from '../../components/ui/UIButton';
import { WelcomePrints } from '../../components/auth/WelcomePrints';
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

// The logo goes after the words, in reading order: left of Hebrew/Arabic text, right of English.
// UIButton places it by source order, which the layout flips only when RTL is actually active
// (it isn't in Expo Go), so take both into account.
const K = 'auto.screens__Auth__LoginScreen.';
const ICON_AFTER_TEXT: 'left' | 'right' =
  isRtlLanguage(getStoredLanguage()) === I18nManager.isRTL ? 'right' : 'left';

const { width } = Dimensions.get('window');

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
        <Text style={[formFieldLabelStyle({ tokens, focused, error: false }), { textAlign: 'right', writingDirection: TEXT_DIR }]}>{label}</Text>
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
          textContentType={isPassword ? 'password' : keyboardType === 'email-address' ? 'username' : undefined}
          autoComplete={isPassword ? 'current-password' : keyboardType === 'email-address' ? 'email' : undefined}
          returnKeyType={isPassword ? 'go' : 'next'}
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
  const { isDarkMode } = useTheme();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const rememberMe = true; // keeps the email for next time; no checkbox
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);
  const [showForm, setShowForm] = useState(false);

  const { signIn, signInWithGoogle, signInWithApple, isLoading, setUser, passwordRecoveryMode, setPasswordRecoveryMode } = useAuth();
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


  const loadSavedCredentials = async () => {
    try {
      // Migrate: clear any legacy plaintext password from older versions
      await AsyncStorage.removeItem('saved_password');

      const savedEmail    = await AsyncStorage.getItem('saved_email');
      const savedRemember = await AsyncStorage.getItem('remember_me');
      if (savedRemember === 'true' && savedEmail) {
        setEmail(savedEmail);
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
      legacyAlert(i18n.t('auto.screens__Auth__LoginScreen.s1'), i18n.t('auto.screens__Auth__LoginScreen.s2'));
      return;
    }
    // ניקוי מכוון לפני/תוך signIn — גם אם נשארנו על Login עם דגל recovery
    await setPasswordRecoveryMode(false);
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await signIn({ email: normalizedEmail, password });
    if (error) {
      legacyAlert(i18n.t('auto.screens__Auth__LoginScreen.s3'), error);
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
      if (result.error) { legacyAlert(i18n.t('auto.screens__Auth__LoginScreen.s3'), result.error); return; }
      if (result.isNewUser && result.googleUser) {
        // קודם קונטקסט הרשמה, אחר כך setUser — App מנתב ל-Onboarding עם isGoogleSignUp=true
        setGoogleUserData(result.googleUser);
        const { user: profile } = await AuthService.getCurrentUser();
        if (profile) setUser(profile);
        // Navigation ל-Onboarding קורה אוטומטית דרך App.tsx conditional rendering
      }
    } catch {
      legacyAlert(i18n.t('auto.screens__Auth__LoginScreen.s1'), i18n.t('auto.screens__Auth__LoginScreen.s4'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (result.error) { if (result.error === i18n.t('auto.services__authService.s43')) return; legacyAlert(i18n.t('auto.screens__Auth__LoginScreen.s3'), result.error); return; }
      if (result.isNewUser && result.googleUser) {
        // קודם קונטקסט הרשמה, אחר כך setUser — App מנתב ל-Onboarding עם isGoogleSignUp=true
        setGoogleUserData(result.googleUser);
        const { user: profile } = await AuthService.getCurrentUser();
        if (profile) setUser(profile);
        // Navigation ל-Onboarding קורה אוטומטית דרך App.tsx conditional rendering
      }
    } catch {
      legacyAlert(i18n.t('auto.screens__Auth__LoginScreen.s1'), i18n.t('auto.screens__Auth__LoginScreen.s4'));
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <ScreenGradientBackground animated={false} />

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
                  {/* What DarkPool is, then the one rich moment: prints as the app shows them */}
                  <View style={styles.welcomeTop}>
                    <Text style={[styles.welcomeTitle, { color: colors.text.primary }]}>{i18n.t(K + 'welcomeTitle')}</Text>
                    <Text style={[styles.welcomeSub, { color: colors.text.secondary }]}>{i18n.t(K + 'welcomeSub')}</Text>
                    <WelcomePrints />
                  </View>

                  <View style={styles.buttonStack}>
                    <UIButton
                      title={i18n.t(K + 's5')}
                      variant="primary"
                      size="lg"
                      fullWidth
                      onPress={() => navigation.navigate('Register')}
                    />
                    {appleAvailable ? (
                      <UIButton
                        title={i18n.t(K + 'appleContinue')}
                        variant="secondary"
                        size="lg"
                        icon="logo-apple"
                        iconPosition={ICON_AFTER_TEXT}
                        fullWidth
                        loading={appleLoading}
                        disabled={isLoading || appleLoading}
                        style={{ borderRadius: tokens.borderRadius.full }}
                        onPress={() => void handleAppleSignIn()}
                      />
                    ) : null}
                    <UIButton
                      title={i18n.t(K + 'googleContinue')}
                      variant="secondary"
                      size="lg"
                      icon="logo-google"
                      iconPosition={ICON_AFTER_TEXT}
                      fullWidth
                      loading={googleLoading}
                      disabled={isLoading || googleLoading}
                      style={{ borderRadius: tokens.borderRadius.full }}
                      onPress={() => void handleGoogleSignIn()}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        void HapticFeedback.selection();
                        setShowForm(true);
                      }}
                      hitSlop={10}
                      style={styles.emailLink}
                      accessibilityRole="button"
                    >
                      <Text style={[appCaptionStyle, styles.emailLinkText, { color: colors.text.secondary }]}>{i18n.t(K + 'emailSignInLink')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={styles.form}>
                  {/* Back where you came from, not a text link at the bottom */}
                  <TouchableOpacity
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      setShowForm(false);
                    }}
                    hitSlop={12}
                    style={styles.backBtn}
                    accessibilityRole="button"
                    accessibilityLabel={i18n.t(K + 'back')}
                  >
                    <Ionicons name={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color={colors.text.primary} />
                  </TouchableOpacity>

                  <View style={styles.titleBlock}>
                    <Text style={[appFlowTitleStyle, { color: colors.text.primary }]}>{i18n.t(K + 'formTitle')}</Text>
                    <Text style={[appFlowSubtitleStyle, { color: colors.text.secondary }]}>{i18n.t(K + 'formSub')}</Text>
                  </View>

                  {/* The latest print from the welcome stack — the same world, so the form isn't a blank page */}
                  <View style={styles.formPrint}>
                    <WelcomePrints rows={1} />
                  </View>

                  <Field
                    label={i18n.t(K + 's9')}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    tokens={tokens}
                  />

                  <Field
                    label={i18n.t(K + 's10')}
                    value={password}
                    onChangeText={setPassword}
                    placeholder=""
                    secureTextEntry
                    tokens={tokens}
                  />

                  <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7} hitSlop={8} style={styles.forgot}>
                    <Text style={[appCaptionStyle, styles.emailLinkText, { color: colors.text.secondary }]}>{i18n.t(K + 's13')}</Text>
                  </TouchableOpacity>

                  <UIButton
                    title={i18n.t(K + 'signInBtn')}
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={isLoading}
                    disabled={isLoading}
                    onPress={() => void handleSignIn()}
                  />

                  <TouchableOpacity
                    onPress={() => navigation.navigate('Register')}
                    hitSlop={10}
                    style={styles.emailLink}
                    accessibilityRole="button"
                  >
                    <Text style={[appCaptionStyle, styles.emailLinkText, { color: colors.text.secondary }]}>{i18n.t(K + 'noAccount')}</Text>
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
  backBtn: { alignSelf: 'flex-start', width: 44, height: 44, justifyContent: 'center', marginBottom: 8 },
  forgot: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 20 },
  formPrint: { marginBottom: APP_LAYOUT.sectionGap / 2 },
  welcomeTop: { flex: 1, justifyContent: 'center', gap: 12, paddingBottom: 24 },
  welcomeTitle: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.6, textAlign: 'right', writingDirection: TEXT_DIR },
  welcomeSub: { fontSize: 17, lineHeight: 24, textAlign: 'right', writingDirection: TEXT_DIR, marginBottom: 12 },
  buttonStack: {
    gap: APP_LAYOUT.stackGapTight,
  },
  form: {
    width: '100%',
  },
  titleBlock: {
    marginBottom: APP_LAYOUT.sectionGap / 2 + 4,
  },
  emailLink: { alignSelf: 'center', paddingVertical: 6, marginTop: 4 },
  emailLinkText: { textDecorationLine: 'underline' },
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
});
