import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { useOnboarding } from '../../context/OnboardingContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

type NavigationProp = NativeStackNavigationProp<any, 'OnboardingVerification'>;

interface Props {
  navigation: NavigationProp;
}

/**
 * מסך 2: OnboardingVerificationScreen
 * אימות קוד OTP שנשלח לטלפון
 */
const OnboardingVerificationScreen: React.FC<Props> = ({ navigation }) => {
  const { data, setPhoneVerified, setCurrentStep, markStepCompleted } = useOnboarding();
  const tokens = useDesignTokens();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const isValidCode = code.replace(/\D/g, '').length === 6;
  const canContinue = !loading && isValidCode;

  const handleNext = async () => {
    if (!canContinue) {
      setError('אנא הכנס קוד אימות תקין (6 ספרות)');
      void HapticFeedback.error();
      return;
    }

    setError('');
    setLoading(true);

    try {
      // כאן תהיה קריאה לשרת לאימות הקוד
      await new Promise((resolve) => setTimeout(resolve, 800));

      setPhoneVerified(true);
      markStepCompleted(2);
      setCurrentStep(3);
      
      void HapticFeedback.success();
      navigation.navigate('OnboardingName');
    } catch (err) {
      setError('קוד אימות שגוי. נסה שוב.');
      void HapticFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    void HapticFeedback.impactLight();
    setCanResend(false);
    setResendTimer(60);
    
    // כאן תהיה קריאה לשרת לשליחת קוד חדש
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  const maskedPhone = data.phone.replace(/(\d{3})-(\d{3})-(\d{4})/, '$1-***-$4');

  return (
    <ScreenChrome rtl>
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="chevron-forward" size={28} color={tokens.colors.text.primary} />
            </Pressable>
            <Text style={[styles.stepIndicator, { color: tokens.colors.text.tertiary }]}>
              שלב 2 מתוך 10
            </Text>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
              הכנס את הקוד שנשלח
            </Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              שלחנו קוד אימות ל-{maskedPhone}
            </Text>

            {/* Error */}
            {error ? (
              <UICard 
                variant="glass" 
                padding="md" 
                style={[styles.errorCard, { borderColor: tokens.colors.danger.main }]}
              >
                <View style={styles.errorContent}>
                  <Ionicons name="alert-circle" size={20} color={tokens.colors.danger.main} />
                  <Text style={[styles.errorText, { color: tokens.colors.danger.main }]}>
                    {error}
                  </Text>
                </View>
              </UICard>
            ) : null}

            {/* Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: tokens.colors.text.secondary }]}>
                קוד אימות
              </Text>
              <UICard variant="inputGlass" padding="none" style={styles.inputCard}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="keypad-outline" size={20} color={tokens.colors.text.tertiary} />
                  <TextInput
                    style={[styles.input, { color: tokens.colors.text.primary }]}
                    placeholder="000-000"
                    placeholderTextColor={tokens.colors.text.muted}
                    value={code}
                    onChangeText={(text) => {
                      setCode(text);
                      if (error) setError('');
                    }}
                    keyboardType="number-pad"
                    maxLength={7}
                    autoFocus
                    textAlign="right"
                  />
                </View>
              </UICard>
            </View>

            <Text style={[styles.timer, { color: tokens.colors.text.tertiary }]}>
              {canResend
                ? 'ניתן לשלוח קוד חדש'
                : `ניתן לבקש קוד נוסף בעוד ${resendTimer} שניות`}
            </Text>

            <Pressable onPress={() => {}}>
              <Text style={[styles.link, { color: tokens.colors.primary.main }]}>
                צריך עזרה בכניסה?
              </Text>
            </Pressable>

            <View style={{ flex: 1 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerButtons}>
              <View style={{ flex: 1 }}>
                <UIButton
                  title="שלח שוב"
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={handleResend}
                  disabled={!canResend}
                />
              </View>
              <View style={{ flex: 1 }}>
                <UIButton
                  title="המשך"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={handleNext}
                  disabled={!canContinue}
                  loading={loading}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenChrome>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'right',
  },
  errorCard: {
    borderWidth: 1,
    marginBottom: 16,
  },
  errorContent: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  inputCard: {
    minHeight: 56,
    borderRadius: 9999,
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
  },
  timer: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 12,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
});

export default OnboardingVerificationScreen;
