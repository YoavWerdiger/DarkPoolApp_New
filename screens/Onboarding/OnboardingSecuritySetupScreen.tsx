import React from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UIButton from '../../components/ui/UIButton';
import { useOnboarding } from '../../context/OnboardingContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

type NavigationProp = NativeStackNavigationProp<any, 'OnboardingSecurity'>;

interface Props {
  navigation: NavigationProp;
}

/**
 * מסך 9: OnboardingSecuritySetupScreen (אופציונלי)
 * הגדרת PIN/ביומטריה
 */
const OnboardingSecuritySetupScreen: React.FC<Props> = ({ navigation }) => {
  const { setSecurityPin, setCurrentStep, markStepCompleted } = useOnboarding();
  const tokens = useDesignTokens();

  const handleNext = () => {
    // TODO: במימוש מלא, כאן תהיה מסך יצירת PIN
    // לצורך הדוגמה, נעבור ישר להשלמה
    setSecurityPin(true);
    markStepCompleted(9);
    setCurrentStep(10);
    
    void HapticFeedback.success();
    navigation.navigate('OnboardingComplete');
  };

  const handleLater = () => {
    setSecurityPin(false);
    markStepCompleted(9);
    setCurrentStep(10);
    
    void HapticFeedback.impactLight();
    navigation.navigate('OnboardingComplete');
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
              שלב 9 מתוך 10
            </Text>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: tokens.colors.primary.dim },
              ]}
            >
              <Ionicons
                name="lock-closed"
                size={40}
                color={tokens.colors.primary.main}
              />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
              אבטח את החשבון
            </Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              הגן על המידע שלך עם PIN או זיהוי ביומטרי
            </Text>

            <Text style={[styles.description, { color: tokens.colors.text.secondary }]}>
              נבקש ממך PIN או זיהוי פנים/טביעת אצבע כאשר:
            </Text>

            {/* Features */}
            <View style={styles.featuresContainer}>
              <Feature
                icon="time-outline"
                text="פותח את האפליקציה אחרי 5 דקות של חוסר פעילות"
              />
              <Feature
                icon="swap-horizontal-outline"
                text="מבצע העברת כסף או עסקה"
              />
              <Feature
                icon="settings-outline"
                text="משנה הגדרות אבטחה חשובות"
              />
            </View>

            <Text style={[styles.note, { color: tokens.colors.text.tertiary }]}>
              ניתן לשנות את הגדרות האבטחה בכל עת דרך ההגדרות
            </Text>

            <View style={{ flex: 1 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerButtons}>
              <View style={{ flex: 1 }}>
                <UIButton
                  title="אחר כך"
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={handleLater}
                />
              </View>
              <View style={{ flex: 1 }}>
                <UIButton
                  title="הבא"
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
 * Feature - שורת פיצ'ר
 */
const Feature: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}> = ({ icon, text }) => {
  const tokens = useDesignTokens();

  return (
    <View style={styles.feature}>
      <Ionicons
        name={icon}
        size={24}
        color={tokens.colors.primary.main}
        style={{ marginTop: 2 }}
      />
      <Text style={[styles.featureText, { color: tokens.colors.text.secondary }]}>
        {text}
      </Text>
    </View>
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
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  featuresContainer: {
    width: '100%',
    gap: 16,
  },
  feature: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    textAlign: 'right',
    lineHeight: 22,
  },
  note: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 18,
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

export default OnboardingSecuritySetupScreen;
