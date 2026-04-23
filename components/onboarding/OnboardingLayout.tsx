import React from 'react';
import {
  View,
  Text,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens } from '../ui/DesignTokens';

const { width, height } = Dimensions.get('window');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  showBack?: boolean;
  scrollable?: boolean;
}

const ProgressBar = ({ current, total }: { current: number; total: number }) => (
  <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 6 }}>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 3,
            backgroundColor:
              index < current
                ? DesignTokens.colors.primary.main
                : 'rgba(255,255,255,0.1)',
            shadowColor: index < current ? DesignTokens.colors.primary.main : 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: index < current ? 0.7 : 0,
            shadowRadius: 4,
          }}
        />
      ))}
    </View>
  </View>
);

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  title,
  subtitle,
  currentStep,
  totalSteps,
  onBack,
  showBack = false,
  scrollable = false,
}) => {
  const Content = scrollable ? ScrollView : View;
  const contentProps = scrollable
    ? {
        showsVerticalScrollIndicator: false,
        contentContainerStyle: { flexGrow: 1, justifyContent: 'center' as const, paddingBottom: 40 },
        keyboardShouldPersistTaps: 'handled' as const,
      }
    : { style: { flex: 1, justifyContent: 'center' as const } };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={['#0A0E0A', '#0F1A0F', '#142014', '#0A0E0A']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ flex: 1 }}
        >
          {/* Depth overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.35)']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Bull & Bear background */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', opacity: 0.22 }}>
            <ImageBackground
              source={{ uri: `${SUPABASE_URL}/storage/v1/object/public/backgrounds/transback.png` }}
              style={{ width: width * 1.6, height: height * 1.6 }}
              imageStyle={{ resizeMode: 'contain' }}
            />
          </View>

          <SafeAreaView style={{ flex: 1 }}>
            {/* Back Button */}
            {showBack && onBack && (
              <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
                <TouchableOpacity
                  onPress={onBack}
                  activeOpacity={0.75}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    alignSelf: 'flex-end',
                  }}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={DesignTokens.colors.text.primary}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Progress Bar — not animated so it's always visible */}
            <ProgressBar current={currentStep} total={totalSteps} />

            <View style={{ flex: 1 }}>

              {/* Content */}
              <Content {...contentProps}>
                <View
                  style={{
                    paddingHorizontal: 24,
                    paddingTop: showBack ? 6 : 16,
                    paddingBottom: 32,
                  }}
                >
                  {/* Header */}
                  <View style={{ marginBottom: 36 }}>
                    <Text
                      style={{
                        fontSize: 30,
                        fontWeight: '800',
                        color: '#fff',
                        marginBottom: 8,
                        letterSpacing: -0.5,
                        textAlign: 'right',
                        lineHeight: 36,
                      }}
                    >
                      {title}
                    </Text>
                    {subtitle && (
                      <Text
                        style={{
                          fontSize: 15,
                          color: 'rgba(255,255,255,0.5)',
                          fontWeight: '400',
                          textAlign: 'right',
                          lineHeight: 22,
                        }}
                      >
                        {subtitle}
                      </Text>
                    )}
                  </View>

                  {children}
                </View>
              </Content>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default OnboardingLayout;
