import React, { ReactNode } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { ScreenGradientBackground } from '../VideoBackground';
import OnboardingProgressIndicator from './OnboardingProgressIndicator';

export interface OnboardingScreenProps {
  /** כותרת המסך */
  title: string;
  /** תיאור משני מתחת לכותרת */
  subtitle?: string;
  /** תוכן המסך */
  children: ReactNode;
  /** כפתור/ים בתחתית המסך */
  footer?: ReactNode;
  /** הצגת כפתור חזרה */
  showBack?: boolean;
  /** פעולה בלחיצה על חזרה */
  onBack?: () => void;
  /** הצגת כפתור X (יציאה) */
  showClose?: boolean;
  /** פעולה בלחיצה על X */
  onClose?: () => void;
  /** שלב נוכחי (להצגת progress) */
  currentStep?: number;
  /** סה"כ שלבים */
  totalSteps?: number;
  /** מצב progress indicator */
  progressVariant?: 'dots' | 'bar' | 'none';
  /** סגנון נוסף */
  style?: ViewStyle;
}

/**
 * OnboardingScreen - Layout wrapper למסכי onboarding בסגנון DarkPool
 * 
 * כולל:
 * - Glass effects וגרדיאנט DarkPool
 * - Brand watermark
 * - Safe area insets
 * - כפתורי ניווט
 * - Progress indicator
 * - RTL support
 */
const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  title,
  subtitle,
  children,
  footer,
  showBack = false,
  onBack,
  showClose = false,
  onClose,
  currentStep,
  totalSteps,
  progressVariant = 'dots',
  style,
}) => {
  const tokens = useDesignTokens();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: 'transparent',
    ...style,
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    minHeight: 44,
    zIndex: 10,
  };

  const titleStyle: TextStyle = {
    fontSize: tokens.typography.heroTitle.size,
    fontWeight: tokens.typography.heroTitle.weight,
    letterSpacing: tokens.typography.heroTitle.letterSpacing,
    lineHeight: tokens.typography.heroTitle.lineHeight,
    color: tokens.colors.text.primary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: subtitle ? tokens.spacing.sm : tokens.spacing.xl,
  };

  const subtitleStyle: TextStyle = {
    fontSize: tokens.typography.body.size,
    fontWeight: tokens.typography.body.weight,
    lineHeight: tokens.typography.body.lineHeight,
    color: tokens.colors.text.secondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: tokens.spacing.xl,
  };

  const contentStyle: ViewStyle = {
    flex: 1,
    paddingHorizontal: tokens.spacing.lg,
  };

  const footerStyle: ViewStyle = {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xl,
    paddingTop: tokens.spacing.md,
  };

  const iconButtonStyle: ViewStyle = {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  };

  return (
    <View style={containerStyle}>
      <ScreenGradientBackground />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header - כפתורי ניווט */}
          <View style={headerStyle}>
            {/* Left side - Back button */}
            <View style={{ width: 44 }}>
              {showBack && onBack && (
                <Pressable
                  onPress={onBack}
                  style={({ pressed }) => [
                    iconButtonStyle,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={28}
                    color={tokens.colors.text.primary}
                  />
                </Pressable>
              )}
            </View>

            {/* Center - Progress Indicator */}
            {currentStep && totalSteps && progressVariant !== 'none' && (
              <View style={{ flex: 1, alignItems: 'center' }}>
                <OnboardingProgressIndicator
                  currentStep={currentStep}
                  totalSteps={totalSteps}
                  variant={progressVariant}
                />
              </View>
            )}

            {/* Right side - Close button */}
            <View style={{ width: 44 }}>
              {showClose && onClose && (
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    iconButtonStyle,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={28}
                    color={tokens.colors.text.primary}
                  />
                </Pressable>
              )}
            </View>
          </View>

          {/* Content */}
          <ScrollView
            style={contentStyle}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title & Subtitle */}
            <View>
              <Text style={titleStyle}>{title}</Text>
              {subtitle && <Text style={subtitleStyle}>{subtitle}</Text>}
            </View>

            {/* Main Content */}
            {children}
          </ScrollView>

          {/* Footer - Buttons */}
          {footer && <View style={footerStyle}>{footer}</View>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default OnboardingScreen;
