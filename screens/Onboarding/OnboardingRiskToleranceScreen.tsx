import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { useOnboarding, RiskTolerance } from '../../context/OnboardingContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

type NavigationProp = NativeStackNavigationProp<any, 'OnboardingRiskTolerance'>;

interface Props {
  navigation: NavigationProp;
}

type RiskOption = {
  type: RiskTolerance;
  emoji: string;
  title: string;
  description: string;
  color: string;
};

const RISK_OPTIONS: RiskOption[] = [
  {
    type: 'conservative',
    emoji: '🟢',
    title: 'שמרני',
    description: 'סיכון נמוך, תשואות יציבות',
    color: '#10B981',
  },
  {
    type: 'moderate',
    emoji: '🟡',
    title: 'מאוזן',
    description: 'איזון בין סיכון לתשואה',
    color: '#FFB800',
  },
  {
    type: 'aggressive',
    emoji: '🔴',
    title: 'אגרסיבי',
    description: 'סיכון גבוה, פוטנציאל גבוה',
    color: '#FF4444',
  },
];

/**
 * מסך 6: OnboardingRiskToleranceScreen (אופציונלי)
 * בחירת סובלנות סיכון
 */
const OnboardingRiskToleranceScreen: React.FC<Props> = ({ navigation }) => {
  const { data, setRiskTolerance, setCurrentStep, markStepCompleted } = useOnboarding();
  const tokens = useDesignTokens();

  const [selected, setSelected] = useState<RiskTolerance | null>(data.riskTolerance);

  const handleNext = () => {
    if (selected) {
      setRiskTolerance(selected);
    }
    
    markStepCompleted(6);
    setCurrentStep(7);
    
    void HapticFeedback.success();
    navigation.navigate('OnboardingInterests');
  };

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  const handleSkip = () => {
    void HapticFeedback.impactLight();
    markStepCompleted(6);
    setCurrentStep(7);
    navigation.navigate('OnboardingInterests');
  };

  const handleSelect = (type: RiskTolerance) => {
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
              <Ionicons name="chevron-forward" size={28} color={tokens.colors.text.primary} />
            </Pressable>
            <Text style={[styles.stepIndicator, { color: tokens.colors.text.tertiary }]}>
              שלב 6 מתוך 10
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={handleSkip} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={tokens.colors.text.primary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
              מה רמת הסיכון שלך?
            </Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              זה יעזור לנו להציע לך השקעות מתאימות (אופציונלי)
            </Text>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {RISK_OPTIONS.map((option) => (
                <RiskOptionCard
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
            <View style={styles.footerButtons}>
              <View style={{ flex: 1 }}>
                <UIButton
                  title="דלג"
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={handleSkip}
                />
              </View>
              <View style={{ flex: 1 }}>
                <UIButton
                  title="המשך"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={handleNext}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenChrome>
  );
};

/**
 * RiskOptionCard - כרטיס בחירת סיכון
 */
const RiskOptionCard: React.FC<{
  option: RiskOption;
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
            borderColor: option.color,
            backgroundColor: `${option.color}15`,
          },
        ]}
      >
        <View style={styles.optionContent}>
          <Text style={styles.emoji}>{option.emoji}</Text>

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
                borderColor: selected ? option.color : tokens.colors.border.main,
              },
            ]}
          >
            {selected && <View style={[styles.radioDot, { backgroundColor: option.color }]} />}
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
  closeButton: {
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
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    minHeight: 72,
  },
  optionContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
  },
  emoji: {
    fontSize: 32,
  },
  optionText: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  optionDescription: {
    fontSize: 13,
    textAlign: 'right',
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
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
});

export default OnboardingRiskToleranceScreen;
