import { ROW_REV, TEXT_START } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import React, { useState } from 'react';
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

type OnboardingStackParamList = {
  OnboardingPhone: undefined;
  OnboardingVerification: undefined;
  OnboardingName: undefined;
};

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'OnboardingPhone'>;

interface Props {
  navigation: NavigationProp;
}

/**
 * מסך 1: OnboardingPhoneScreen
 * כניסה ראשונית עם מספר טלפון
 */
const OnboardingPhoneScreen: React.FC<Props> = ({ navigation }) => {
  const { data, setPhone, setCurrentStep, markStepCompleted } = useOnboarding();
  const tokens = useDesignTokens();

  const [phone, setPhoneInput] = useState(data.phone || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatPhone = (text: string): string => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const isValidPhone = (phoneNumber: string): boolean => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length === 10 && cleaned.startsWith('05');
  };

  const canContinue = !loading && isValidPhone(phone);

  const handleNext = async () => {
    if (!canContinue) {
      setError(i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s1'));
      void HapticFeedback.error();
      return;
    }

    setError('');
    setLoading(true);

    try {
      // TODO: הוסף אימות SMS אמיתי
      // כרגע זה רק סימולציה
      await new Promise((resolve) => setTimeout(resolve, 500));

      setPhone(phone);
      markStepCompleted(1);
      setCurrentStep(2);
      
      void HapticFeedback.success();
      navigation.navigate('OnboardingVerification');
    } catch (err) {
      setError(i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s2'));
      void HapticFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  const handleEmailOption = () => {
    // TODO: הוסף אפשרות כניסה באימייל
    void HapticFeedback.impactLight();
  };

  const handleHelp = () => {
    // TODO: הוסף מסך עזרה
    void HapticFeedback.impactLight();
  };

  return (
    <ScreenChrome rtl>
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }} />
            <Text style={[styles.stepIndicator, { color: tokens.colors.text.tertiary }]}>{i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s3')}</Text>
            <View style={{ flex: 1, alignItems: 'flex-start' }}>
              <Pressable onPress={handleHelp} style={styles.helpButton}>
                <Ionicons name="help-circle-outline" size={24} color={tokens.colors.text.tertiary} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>{i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s4')}</Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>{i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s5')}</Text>

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
              <Text style={[styles.label, { color: tokens.colors.text.secondary }]}>{i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s6')}</Text>
              <UICard variant="inputGlass" padding="none" style={styles.inputCard}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={20} color={tokens.colors.text.tertiary} />
                  <TextInput
                    style={[styles.input, { color: tokens.colors.text.primary }]}
                    placeholder="054-000-0000"
                    placeholderTextColor={tokens.colors.text.muted}
                    value={phone}
                    onChangeText={(text) => {
                      setPhoneInput(formatPhone(text));
                      if (error) setError('');
                    }}
                    keyboardType="phone-pad"
                    maxLength={12}
                    autoFocus
                    textAlign="right"
                  />
                </View>
              </UICard>
            </View>

            <Pressable onPress={handleHelp} style={styles.helpLink}>
              <Text style={[styles.helpLinkText, { color: tokens.colors.primary.main }]}>{i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s7')}</Text>
            </Pressable>

            {/* Legal Text */}
            <Text style={[styles.legalText, { color: tokens.colors.text.tertiary }]}>
              {i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s8')}{' '}
              <Text style={[styles.legalLink, { color: tokens.colors.primary.main }]}>{i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s10')}</Text>
              {', '}
              <Text style={[styles.legalLink, { color: tokens.colors.primary.main }]}>{i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s11')}</Text>
              {i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s12')}
              <Text style={[styles.legalLink, { color: tokens.colors.primary.main }]}>{i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s13')}</Text>
              .{'\n\n'}
              {i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s9')}
            </Text>

            <View style={{ flex: 1 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerButtons}>
              <View style={{ flex: 1 }}>
                <UIButton
                  title={i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s14')}
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={handleNext}
                  disabled={!canContinue}
                  loading={loading}
                />
              </View>
              <View style={{ flex: 1 }}>
                <UIButton
                  title={i18n.t('auto.screens__Onboarding__OnboardingPhoneScreen.s15')}
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={handleEmailOption}
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
  helpButton: {
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
    textAlign: TEXT_START,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: TEXT_START,
  },
  errorCard: {
    borderWidth: 1,
    marginBottom: 16,
  },
  errorContent: {
    flexDirection: ROW_REV,
    alignItems: 'flex-start',
    gap: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: TEXT_START,
    lineHeight: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: TEXT_START,
  },
  inputCard: {
    minHeight: 56,
    borderRadius: 9999,
  },
  inputWrapper: {
    flexDirection: ROW_REV,
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
  helpLink: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  helpLinkText: {
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 64,
    textAlign: TEXT_START,
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
  footerButtons: {
    flexDirection: ROW_REV,
    gap: 12,
  },
});

export default OnboardingPhoneScreen;
