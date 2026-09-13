import React, { useState } from 'react';
import { View, Text, TextStyle, ViewStyle, Pressable } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import CashAppScreen from '../../components/ui/CashAppScreen';
import CashAppInput from '../../components/ui/CashAppInput';
import CashAppButton from '../../components/ui/CashAppButton';
import { useOnboarding } from '../../context/OnboardingContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

type OnboardingStackParamList = {
  OnboardingPhone: undefined;
  OnboardingVerification: undefined;
  OnboardingName: undefined;
};

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'OnboardingPhone'>;

interface Props {
  navigation: NavigationProp;
}

/**
 * מסך 1: OnboardingPhoneScreen
 * כניסה ראשונית עם מספר טלפון
 */
const OnboardingPhoneScreen: React.FC<Props> = ({ navigation }) => {
  const { data, setPhone, setCurrentStep, markStepCompleted } = useOnboarding();
  const tokens = useDesignTokens();
  const cashApp = tokens.cashAppStyle;

  const [phone, setPhoneInput] = useState(data.phone || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidPhone = (phoneNumber: string): boolean => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length === 10 && cleaned.startsWith('05');
  };

  const canContinue = !loading && isValidPhone(phone);

  const handleNext = async () => {
    if (!canContinue) {
      setError('אנא הכנס מספר טלפון תקין (למשל 054-123-4567)');
      void HapticFeedback.error();
      return;
    }

    setError('');
    setLoading(true);

    try {
      // TODO: הוסף אימות SMS אמיתי
      // כרגע זה רק סימולציה - צריך להוסיף:
      // 1. קריאה לשרת לשליחת קוד SMS
      // 2. API endpoint ב-Supabase Edge Function
      // 3. אינטגרציה עם Twilio או שירות SMS אחר
      
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call

      setPhone(phone);
      markStepCompleted(1);
      setCurrentStep(2);
      
      void HapticFeedback.success();
      navigation.navigate('OnboardingVerification');
    } catch (err) {
      setError('שגיאה בשליחת קוד האימות. נסה שוב.');
      void HapticFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  const handleEmailOption = () => {
    // TODO: הוסף אפשרות כניסה באימייל
    void HapticFeedback.impactLight();
  };

  const handleHelp = () => {
    // TODO: הוסף מסך עזרה
    void HapticFeedback.impactLight();
  };

  const errorStyle: TextStyle = {
    fontSize: 14,
    color: cashApp.colors.error,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: tokens.spacing.md,
  };

  const legalStyle: TextStyle = {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 18,
    marginTop: tokens.spacing.xl * 2,
  };

  return (
    <CashAppScreen
      title="מה מספר הטלפון שלך?"
      subtitle="נשתמש בו ליצירת קשר ולהתראות חשובות"
      showHelp
      onHelp={handleHelp}
      currentStep={1}
      totalSteps={10}
      footer={
        <View style={{ flexDirection: 'row-reverse', gap: tokens.spacing.md }}>
          <View style={{ flex: 1 }}>
            <CashAppButton
              title="המשך"
              variant="primary"
              onPress={handleNext}
              disabled={!canContinue}
              loading={loading}
              style={{ backgroundColor: '#000000' }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <CashAppButton
              title="שימוש באימייל"
              variant="secondary"
              onPress={handleEmailOption}
              style={{ backgroundColor: '#e8e8e8' }}
              textStyle={{ color: '#000000' }}
            />
          </View>
        </View>
      }
    >
      {error ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 68, 68, 0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255, 68, 68, 0.35)',
            borderRadius: cashApp.borderRadius.input,
            padding: tokens.spacing.md,
            marginBottom: tokens.spacing.lg,
          }}
        >
          <Ionicons
            name="alert-circle"
            size={18}
            color={cashApp.colors.error}
            style={{ marginLeft: tokens.spacing.sm }}
          />
          <Text style={errorStyle}>{error}</Text>
        </View>
      ) : null}

      <CashAppInput
        label="מספר טלפון"
        placeholder="054-000-0000"
        value={phone}
        onChangeText={(text) => {
          setPhoneInput(text);
          if (error) setError('');
        }}
        keyboardType="phone-pad"
        autoFormat="phone"
        maxLength={12}
        autoFocus
        leftIcon="call-outline"
      />

      <Pressable
        onPress={handleHelp}
        style={{
          alignSelf: 'center',
          marginTop: tokens.spacing.lg,
          paddingVertical: tokens.spacing.sm,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            color: cashApp.colors.primary,
            textAlign: 'center',
            textDecorationLine: 'underline',
            fontWeight: '500',
            writingDirection: 'rtl',
          }}
        >
          צריך עזרה להתחברות?
        </Text>
      </Pressable>

      <Text style={legalStyle}>
        בלחיצה על "המשך" אני מאשר/ת את{' '}
        <Text style={{ color: cashApp.colors.primary, textDecorationLine: 'underline' }}>
          התנאים וההגבלות
        </Text>
        {', '}
        <Text style={{ color: cashApp.colors.primary, textDecorationLine: 'underline' }}>
          הסכמת E-Sign
        </Text>
        {' ו'}
        <Text style={{ color: cashApp.colors.primary, textDecorationLine: 'underline' }}>
          מדיניות הפרטיות
        </Text>
        .{'\n\n'}
        אני מאשר/ת קבלת קוד אימות חד-פעמי מ-DarkPool. תדירות ההודעות משתנה. 
        עלולים לחול תעריפי הודעות ונתונים. השב HELP לעזרה, STOP לביטול.
      </Text>

      <View style={{ flex: 1 }} />
    </CashAppScreen>
  );
};

export default OnboardingPhoneScreen;
