import React, { useMemo } from 'react';
import { 
  View, 
  Text, 
  Dimensions, 
  ImageBackground,
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  TouchableOpacity,
  Keyboard,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens } from '../ui/DesignTokens';

const { width, height } = Dimensions.get('window');

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

// רקע עם דוגמה עדינה
const BackgroundPattern = React.memo(() => {
  const patterns = useMemo(() => {
    const dots = [];
    for (let i = 0; i < 15; i++) {
      dots.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.05 + 0.02
      });
    }
    return dots;
  }, []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {patterns.map((dot, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: dot.x,
            top: dot.y,
            width: dot.size,
            height: dot.size,
            backgroundColor: DesignTokens.colors.primary.main,
            opacity: dot.opacity,
            borderRadius: dot.size / 2
          }}
        />
      ))}
    </View>
  );
});

// Step Indicators בלבד
const StepIndicators = ({ current, total }: { current: number; total: number }) => {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' }}>
      {/* Step indicators */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8
      }}>
        {Array.from({ length: total }).map((_, index) => (
          <View
            key={index}
            style={{
              width: index + 1 === current ? 28 : 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: index + 1 <= current 
                ? DesignTokens.colors.primary.main 
                : 'rgba(255,255,255,0.15)'
            }}
          />
        ))}
      </View>
      
      {/* Step text */}
      <Text style={{
        color: DesignTokens.colors.text.tertiary,
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 10
      }}>
        שלב {current} מתוך {total}
      </Text>
    </View>
  );
};

// Header עם כותרת וכפתור חזרה
const Header = ({ 
  title, 
  subtitle,
  onBack,
  showBack
}: { 
  title: string; 
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
}) => (
  <View style={{ marginBottom: 40 }}>
    {/* Back Button */}
    {showBack && onBack && (
      <TouchableOpacity
        onPress={onBack}
        style={{
          position: 'absolute',
          left: 0,
          top: -50,
          padding: 8,
          zIndex: 10
        }}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center'
        }}>
          <Ionicons name="chevron-forward" size={24} color={DesignTokens.colors.text.primary} />
          <Text style={{
            color: DesignTokens.colors.text.secondary,
            fontSize: 16,
            marginRight: 4
          }}>
            חזרה
          </Text>
        </View>
      </TouchableOpacity>
    )}
    
    <View style={{ alignItems: 'center' }}>
      {/* Title */}
      <Text style={{ 
        fontSize: 32, 
        fontWeight: '800', 
        color: DesignTokens.colors.text.primary, 
        marginBottom: 8,
        letterSpacing: -0.8,
        textAlign: 'center'
      }}>
        {title}
      </Text>
      
      {/* Subtitle */}
      {subtitle && (
        <Text style={{ 
          fontSize: 16, 
          color: DesignTokens.colors.text.secondary, 
          fontWeight: '400',
          letterSpacing: 0.3,
          textAlign: 'center',
          lineHeight: 22
        }}>
          {subtitle}
        </Text>
      )}
      
      {/* Decorative Line */}
      <View style={{
        width: 60,
        height: 2,
        backgroundColor: DesignTokens.colors.primary.main,
        marginTop: 16,
        borderRadius: 1
      }} />
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
  scrollable = false
}) => {
  const Content = scrollable ? ScrollView : View;
  const contentProps = scrollable ? {
    showsVerticalScrollIndicator: false,
    contentContainerStyle: { flexGrow: 1, paddingBottom: 40 },
    keyboardShouldPersistTaps: 'handled' as const
  } : {
    style: { flex: 1 }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={['#000000', '#0d1b0d', '#1a2d1a', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        >
          {/* Background Pattern */}
          <BackgroundPattern />
          
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Background Image */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: 0.15
          }}>
            <ImageBackground
              source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
              style={{
                width: width,
                height: height,
                resizeMode: 'contain'
              }}
              imageStyle={{
                opacity: 0.3
              }}
            />
          </View>

          <SafeAreaView style={{ flex: 1 }}>
            {/* Step Indicators */}
            <StepIndicators current={currentStep} total={totalSteps} />
            
            {/* Content */}
            <Content {...contentProps}>
              <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
                {/* Header */}
                <Header title={title} subtitle={subtitle} onBack={onBack} showBack={showBack} />
                
                {/* Children */}
                {children}
              </View>
            </Content>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default OnboardingLayout;
