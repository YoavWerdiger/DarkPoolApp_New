import { ROW_REV, TEXT_START, dirIcon } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { useOnboarding, InvestorType } from '../../context/OnboardingContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

type NavigationProp = NativeStackNavigationProp<any, 'OnboardingInvestorType'>;

interface Props {
  navigation: NavigationProp;
}

type InvestorOption = {
  type: InvestorType;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const INVESTOR_OPTIONS: InvestorOption[] = [
  {
    type: 'retail',
    icon: 'person',
    title: i18n.t('auto.screens__Onboarding__OnboardingInvestorTypeScreen.s1'),
    description: i18n.t('auto.screens__Onboarding__OnboardingInvestorTypeScreen.s2'),
  },
  {
    type: 'institutional',
    icon: 'business',
    title: i18n.t('auto.screens__Onboarding__OnboardingInvestorTypeScreen.s3'),
    description: i18n.t('auto.screens__Onboarding__OnboardingInvestorTypeScreen.s4'),
  },
];

/**
 * מסך 5: OnboardingInvestorTypeScreen
 * בחירת סוג משקיע (ייחודי ל-DarkPool)
 */
const OnboardingInvestorTypeScreen: React.FC<Props> = ({ navigation }) => {
  const { data, setInvestorType, setCurrentStep, markStepCompleted } = useOnboarding();
  const tokens = useDesignTokens();

  const [selected, setSelected] = useState<InvestorType | null>(data.investorType);

  const canContinue = selected !== null;

  const handleNext = () => {
    if (!canContinue || !selected) {
      void HapticFeedback.error();
      return;
    }

    setInvestorType(selected);
    markStepCompleted(5);
    setCurrentStep(6);
    
    void HapticFeedback.success();
    navigation.navigate('OnboardingRiskTolerance');
  };

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  const handleSelect = (type: InvestorType) => {
    setSelected(type);
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
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name={dirIcon('chevron-forward')} size={28} color={tokens.colors.text.primary} />
            </Pressable>
            <Text style={[styles.stepIndicator, { color: tokens.colors.text.tertiary }]}>{i18n.t('auto.screens__Onboarding__OnboardingInvestorTypeScreen.s5')}</Text>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>{i18n.t('auto.screens__Onboarding__OnboardingInvestorTypeScreen.s6')}</Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>{i18n.t('auto.screens__Onboarding__OnboardingInvestorTypeScreen.s7')}</Text>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {INVESTOR_OPTIONS.map((option) => (
                <OptionCard
                  key={option.type}
                  option={option}
                  selected={selected === option.type}
                  onSelect={() => handleSelect(option.type)}
                />
              ))}
            </View>

            <View style={{ flex: 1 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <UIButton
              title={i18n.t('auto.screens__Onboarding__OnboardingInvestorTypeScreen.s8')}
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

/**
 * OptionCard - כרטיס בחירה
 */
const OptionCard: React.FC<{
  option: InvestorOption;
  selected: boolean;
  onSelect: () => void;
}> = ({ option, selected, onSelect }) => {
  const tokens = useDesignTokens();

  return (
    <Pressable onPress={onSelect} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
      <UICard
        variant="glass"
        padding="md"
        style={[
          styles.optionCard,
          selected && {
            borderWidth: 2,
            borderColor: tokens.colors.primary.main,
            backgroundColor: tokens.colors.primary.dim,
          },
        ]}
      >
        <View style={styles.optionContent}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: selected
                  ? tokens.colors.primary.main
                  : 'rgba(255, 255, 255, 0.15)',
              },
            ]}
          >
            <Ionicons
              name={option.icon}
              size={24}
              color={selected ? '#FFFFFF' : tokens.colors.text.primary}
            />
          </View>

          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, { color: tokens.colors.text.primary }]}>
              {option.title}
            </Text>
            <Text style={[styles.optionDescription, { color: tokens.colors.text.secondary }]}>
              {option.description}
            </Text>
          </View>

          <View
            style={[
              styles.radio,
              {
                borderColor: selected
                  ? tokens.colors.primary.main
                  : tokens.colors.border.main,
              },
            ]}
          >
            {selected && (
              <View
                style={[styles.radioDot, { backgroundColor: tokens.colors.primary.main }]}
              />
            )}
          </View>
        </View>
      </UICard>
    </Pressable>
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
    textAlign: TEXT_START,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: TEXT_START,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    minHeight: 80,
  },
  optionContent: {
    flexDirection: ROW_REV,
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: TEXT_START,
  },
  optionDescription: {
    fontSize: 13,
    textAlign: TEXT_START,
    lineHeight: 18,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
});

export default OnboardingInvestorTypeScreen;
