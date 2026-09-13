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
import * as Notifications from 'expo-notifications';

type NavigationProp = NativeStackNavigationProp<any, 'OnboardingNotifications'>;

interface Props {
  navigation: NavigationProp;
}

/**
 * מסך 8: OnboardingNotificationsScreen (אופציונלי)
 * הפעלת התראות push
 */
const OnboardingNotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { setNotifications, setCurrentStep, markStepCompleted } = useOnboarding();
  const tokens = useDesignTokens();

  const handleEnable = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const enabled = status === 'granted';

      setNotifications(enabled);
      markStepCompleted(8);
      setCurrentStep(9);
      
      void HapticFeedback.success();
      navigation.navigate('OnboardingSecurity');
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      handleSkip();
    }
  };

  const handleSkip = () => {
    setNotifications(false);
    markStepCompleted(8);
    setCurrentStep(9);
    
    void HapticFeedback.impactLight();
    navigation.navigate('OnboardingSecurity');
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
              שלב 8 מתוך 10
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
                name="notifications"
                size={40}
                color={tokens.colors.primary.main}
              />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
              קבל התראות בזמן אמת
            </Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              היה הראשון לדעת על עסקאות חשובות
            </Text>

            {/* Features */}
            <View style={styles.featuresContainer}>
              <Feature
                icon="shield-checkmark-outline"
                text="התראות אבטחה וחשבון"
              />
              <Feature
                icon="trending-up-outline"
                text="עסקאות קונגרס חשובות"
              />
              <Feature
                icon="people-outline"
                text="פעילות insider בזמן אמת"
              />
              <Feature
                icon="pulse-outline"
                text="עדכוני מחירים והתראות מותאמות"
              />
            </View>

            <Text style={[styles.note, { color: tokens.colors.text.tertiary }]}>
              ניתן לשנות העדפות התראות בכל עת דרך ההגדרות
            </Text>

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
                  title="הפעל"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={handleEnable}
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
    marginBottom: 32,
    textAlign: 'center',
  },
  featuresContainer: {
    width: '100%',
    gap: 16,
  },
  feature: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    textAlign: 'right',
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

export default OnboardingNotificationsScreen;
