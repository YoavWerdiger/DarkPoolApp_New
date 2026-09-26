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

type NavigationProp = NativeStackNavigationProp<any, 'OnboardingName'>;

interface Props {
  navigation: NavigationProp;
}

/**
 * מסך 3: OnboardingNameScreen
 * שם מלא (פרטי + משפחה)
 */
const OnboardingNameScreen: React.FC<Props> = ({ navigation }) => {
  const { data, setName, setCurrentStep, markStepCompleted } = useOnboarding();
  const tokens = useDesignTokens();

  const [firstName, setFirstName] = useState(data.firstName || '');
  const [lastName, setLastName] = useState(data.lastName || '');

  const isValidName = (name: string): boolean => {
    return name.trim().length >= 2 && !/\d/.test(name);
  };

  const canContinue = isValidName(firstName) && isValidName(lastName);

  const handleNext = () => {
    if (!canContinue) {
      void HapticFeedback.error();
      return;
    }

    setName(firstName.trim(), lastName.trim());
    markStepCompleted(3);
    setCurrentStep(4);
    
    void HapticFeedback.success();
    navigation.navigate('OnboardingDateOfBirth');
  };

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
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
              שלב 3 מתוך 10
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
              איך קוראים לך?
            </Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              השם חייב להתאים לשם המופיע בתעודת הזהות
            </Text>

            {/* Inputs */}
            <View style={styles.inputsContainer}>
              <UICard variant="inputGlass" padding="none" style={styles.inputCard}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={tokens.colors.text.tertiary} />
                  <TextInput
                    style={[styles.input, { color: tokens.colors.text.primary }]}
                    placeholder="שם פרטי"
                    placeholderTextColor={tokens.colors.text.muted}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoFocus
                    textAlign="right"
                  />
                </View>
              </UICard>

              <UICard variant="inputGlass" padding="none" style={styles.inputCard}>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={tokens.colors.text.tertiary} />
                  <TextInput
                    style={[styles.input, { color: tokens.colors.text.primary }]}
                    placeholder="שם משפחה"
                    placeholderTextColor={tokens.colors.text.muted}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    autoCorrect={false}
                    textAlign="right"
                  />
                </View>
              </UICard>
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
    marginBottom: 32,
    textAlign: 'right',
  },
  inputsContainer: {
    gap: 16,
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
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
});

export default OnboardingNameScreen;
