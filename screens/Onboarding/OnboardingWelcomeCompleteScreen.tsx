import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { useOnboarding } from '../../context/OnboardingContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

type NavigationProp = NativeStackNavigationProp<any, 'OnboardingComplete'>;

interface Props {
  navigation: NavigationProp;
}

/**
 * מסך 10: OnboardingWelcomeCompleteScreen
 * סיום מוצלח - ברוכים הבאים!
 */
const OnboardingWelcomeCompleteScreen: React.FC<Props> = ({ navigation }) => {
  const { data, completeOnboarding } = useOnboarding();
  const tokens = useDesignTokens();

  // Animations
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // אנימציה של כניסה
    scale.value = withSequence(
      withSpring(1.2, { damping: 10, stiffness: 100 }),
      withSpring(1, { damping: 15, stiffness: 150 })
    );
    opacity.value = withDelay(100, withSpring(1, { damping: 15, stiffness: 100 }));

    // Haptic feedback
    void HapticFeedback.success();
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handleStart = () => {
    completeOnboarding();
    void HapticFeedback.impactLight();
    
    // Navigate to main app
    // TODO: החלף ב-navigation מתאים ל-MainTabs או DarkPoolHome
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' as never }],
    });
  };

  return (
    <ScreenChrome rtl>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Animated Emoji */}
            <Animated.View style={[styles.emojiContainer, animatedStyle]}>
              <Text style={styles.mainEmoji}>✨</Text>
              <View style={styles.decorEmoji1}>
                <Text style={styles.decorEmoji}>🎉</Text>
              </View>
              <View style={styles.decorEmoji2}>
                <Text style={styles.decorEmoji}>🎉</Text>
              </View>
            </Animated.View>

            {/* Title */}
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
              ברוך הבא ל-DarkPool{data.firstName ? `, ${data.firstName}` : ''}!
            </Text>

            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              החשבון שלך מוכן. אתה יכול להתחיל לעקוב אחרי עסקאות של קונגרס,
              insiders ומשקיעים מוסדיים
            </Text>

            {/* Feature Cards */}
            <View style={styles.featuresContainer}>
              <UICard
                variant="glass"
                padding="md"
                style={[styles.featureCard, { borderColor: tokens.colors.primary.main }]}
              >
                <Text style={[styles.featureTitle, { color: tokens.colors.text.primary }]}>
                  🏛️ מסחר קונגרס
                </Text>
                <Text style={[styles.featureSubtitle, { color: tokens.colors.text.secondary }]}>
                  עקוב אחרי עסקאות של חברי קונגרס בזמן אמת
                </Text>
              </UICard>

              <UICard
                variant="glass"
                padding="md"
                style={[styles.featureCard, { borderColor: tokens.colors.primary.main }]}
              >
                <Text style={[styles.featureTitle, { color: tokens.colors.text.primary }]}>
                  👔 פעילות Insiders
                </Text>
                <Text style={[styles.featureSubtitle, { color: tokens.colors.text.secondary }]}>
                  גלה רכישות ומכירות של מנהלים בכירים
                </Text>
              </UICard>

              <UICard
                variant="glass"
                padding="md"
                style={[styles.featureCard, { borderColor: tokens.colors.primary.main }]}
              >
                <Text style={[styles.featureTitle, { color: tokens.colors.text.primary }]}>
                  🏦 תיקי מוסדיים
                </Text>
                <Text style={[styles.featureSubtitle, { color: tokens.colors.text.secondary }]}>
                  צפה בתיקי השקעות של קרנות גידור ומוסדיים
                </Text>
              </UICard>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <UIButton
              title="בואו נתחיל!"
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleStart}
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
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    justifyContent: 'center',
  },
  emojiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  mainEmoji: {
    fontSize: 80,
  },
  decorEmoji1: {
    position: 'absolute',
    top: -10,
    left: -20,
  },
  decorEmoji2: {
    position: 'absolute',
    top: -10,
    right: -20,
  },
  decorEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  featuresContainer: {
    gap: 16,
  },
  featureCard: {
    borderWidth: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  featureSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
  },
});

export default OnboardingWelcomeCompleteScreen;
