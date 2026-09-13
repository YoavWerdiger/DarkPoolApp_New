import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UIButton from '../../components/ui/UIButton';
import { useOnboarding } from '../../context/OnboardingContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

type NavigationProp = NativeStackNavigationProp<any, 'OnboardingInterests'>;

interface Props {
  navigation: NavigationProp;
}

type Interest = {
  id: string;
  emoji: string;
  title: string;
};

const INTERESTS: Interest[] = [
  { id: 'stocks', emoji: '📈', title: 'מניות' },
  { id: 'congress', emoji: '🏛️', title: 'מסחר קונגרס' },
  { id: 'options', emoji: '💼', title: 'אופציות' },
  { id: 'institutional', emoji: '🏦', title: 'מוסדיים' },
  { id: 'crypto', emoji: '📊', title: 'קריפטו' },
  { id: 'funds', emoji: '🎯', title: 'קרנות נאמנות' },
];

/**
 * מסך 7: OnboardingInterestsScreen
 * בחירת תחומי עניין (multi-select)
 */
const OnboardingInterestsScreen: React.FC<Props> = ({ navigation }) => {
  const { data, setInterests, setCurrentStep, markStepCompleted } = useOnboarding();
  const tokens = useDesignTokens();

  const [selected, setSelected] = useState<string[]>(data.interests || []);

  const canContinue = selected.length > 0;

  const handleToggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    void HapticFeedback.impactLight();
  };

  const handleNext = () => {
    if (!canContinue) {
      void HapticFeedback.error();
      return;
    }

    setInterests(selected);
    markStepCompleted(7);
    setCurrentStep(8);
    
    void HapticFeedback.success();
    navigation.navigate('OnboardingNotifications');
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
              שלב 7 מתוך 10
            </Text>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
              מה מעניין אותך?
            </Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              בחר לפחות תחום אחד שתרצה לעקוב אחריו
            </Text>

            {/* Interest Pills */}
            <View style={styles.pillsContainer}>
              {INTERESTS.map((interest) => (
                <InterestPill
                  key={interest.id}
                  interest={interest}
                  selected={selected.includes(interest.id)}
                  onToggle={() => handleToggle(interest.id)}
                />
              ))}
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

/**
 * InterestPill - כפתור pill לתחום עניין
 */
const InterestPill: React.FC<{
  interest: Interest;
  selected: boolean;
  onToggle: () => void;
}> = ({ interest, selected, onToggle }) => {
  const tokens = useDesignTokens();

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: selected ? tokens.colors.primary.main : tokens.colors.border.main,
          backgroundColor: selected
            ? tokens.colors.primary.dim
            : 'rgba(255, 255, 255, 0.05)',
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={styles.pillEmoji}>{interest.emoji}</Text>
      <Text
        style={[
          styles.pillText,
          {
            color: selected ? tokens.colors.primary.main : tokens.colors.text.secondary,
            fontWeight: selected ? '700' : '500',
          },
        ]}
      >
        {interest.title}
      </Text>
      {selected && (
        <View
          style={[
            styles.checkmark,
            { backgroundColor: tokens.colors.primary.main },
          ]}
        >
          <Text style={styles.checkmarkText}>✓</Text>
        </View>
      )}
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
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'right',
  },
  pillsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
  },
  pill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 9999,
    borderWidth: 2,
  },
  pillEmoji: {
    fontSize: 20,
  },
  pillText: {
    fontSize: 16,
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
});

export default OnboardingInterestsScreen;
