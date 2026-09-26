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

type NavigationProp = NativeStackNavigationProp<any, 'OnboardingDateOfBirth'>;

interface Props {
  navigation: NavigationProp;
}

/**
 * מסך 4: OnboardingDateOfBirthScreen
 * תאריך לידה (חובה - מעל גיל 18)
 */
const OnboardingDateOfBirthScreen: React.FC<Props> = ({ navigation }) => {
  const { setDateOfBirth, setCurrentStep, markStepCompleted } = useOnboarding();
  const tokens = useDesignTokens();
  const cashApp = tokens.cashAppStyle;

  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  const calculateAge = (birthDate: string): number => {
    const cleaned = birthDate.replace(/\D/g, '');
    if (cleaned.length !== 8) return 0;

    const day = parseInt(cleaned.slice(0, 2), 10);
    const month = parseInt(cleaned.slice(2, 4), 10);
    const year = parseInt(cleaned.slice(4, 8), 10);

    const today = new Date();
    const birth = new Date(year, month - 1, day);
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  const isValidDate = (dateString: string): boolean => {
    const cleaned = dateString.replace(/\D/g, '');
    if (cleaned.length !== 8) return false;

    const day = parseInt(cleaned.slice(0, 2), 10);
    const month = parseInt(cleaned.slice(2, 4), 10);
    const year = parseInt(cleaned.slice(4, 8), 10);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > new Date().getFullYear()) return false;

    const age = calculateAge(dateString);
    return age >= 18;
  };

  const canContinue = isValidDate(date);

  const handleNext = () => {
    if (!canContinue) {
      const age = calculateAge(date);
      if (age < 18 && age > 0) {
        setError('עליך להיות מעל גיל 18 כדי להירשם ל-DarkPool');
      } else {
        setError('אנא הכנס תאריך לידה תקין');
      }
      void HapticFeedback.error();
      return;
    }

    // המר לפורמט ISO
    const cleaned = date.replace(/\D/g, '');
    const day = cleaned.slice(0, 2);
    const month = cleaned.slice(2, 4);
    const year = cleaned.slice(4, 8);
    const isoDate = `${year}-${month}-${day}`;

    setDateOfBirth(isoDate);
    markStepCompleted(4);
    setCurrentStep(5);
    
    void HapticFeedback.success();
    navigation.navigate('OnboardingInvestorType');
  };

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  const formatDate = (text: string): string => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
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
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="chevron-forward" size={28} color={tokens.colors.text.primary} />
            </Pressable>
            <Text style={[styles.stepIndicator, { color: tokens.colors.text.tertiary }]}>
              שלב 4 מתוך 10
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
              מה תאריך הלידה שלך?
            </Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              נשתמש בזה לאימות גיל ואבטחת חשבון
            </Text>

            {/* Warning */}
            <UICard 
              variant="glass" 
              padding="md" 
              style={[styles.warningCard, { borderColor: tokens.colors.warning.main }]}
            >
              <View style={styles.warningContent}>
                <Ionicons name="warning" size={20} color={tokens.colors.warning.main} />
                <Text style={[styles.warningText, { color: tokens.colors.warning.main }]}>
                  תאריך לידה שגוי יפגע בגישה לרוב התכונות באפליקציה
                </Text>
              </View>
            </UICard>

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
                תאריך לידה
              </Text>
              <UICard variant="inputGlass" padding="none" style={styles.inputCard}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="calendar-outline" size={20} color={tokens.colors.text.tertiary} />
                  <TextInput
                    style={[styles.input, { color: tokens.colors.text.primary }]}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={tokens.colors.text.muted}
                    value={date}
                    onChangeText={(text) => {
                      setDate(formatDate(text));
                      if (error) setError('');
                    }}
                    keyboardType="number-pad"
                    maxLength={10}
                    autoFocus
                    textAlign="right"
                  />
                </View>
              </UICard>
              <Text style={[styles.helperText, { color: tokens.colors.text.tertiary }]}>
                לדוגמה: 18/02/1995
              </Text>
            </View>

            <View style={{ flex: 1 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <UIButton
              title="המשך"
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleNext}
              disabled={!canContinue}
            />
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
  warningCard: {
    borderWidth: 1,
    marginBottom: 16,
  },
  warningContent: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 20,
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
  helperText: {
    fontSize: 12,
    textAlign: 'right',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
});

export default OnboardingDateOfBirthScreen;
