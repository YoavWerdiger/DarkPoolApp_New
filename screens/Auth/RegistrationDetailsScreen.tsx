import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '../../services/authService';
import { DesignTokens } from '../../components/ui/DesignTokens';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingInput from '../../components/onboarding/OnboardingInput';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import { HapticFeedback } from '../../utils/hapticFeedback';

const RegistrationDetailsScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const [name, setName] = useState(data.fullName || '');
  const [email, setEmail] = useState(data.email || '');
  const [password, setPassword] = useState(data.password || '');
  const [phone, setPhone] = useState(data.phone || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = async () => {
    if (!name || !email || !password || !phone) {
      setError('אנא מלא את כל השדות');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('אנא הכנס כתובת אימייל תקינה');
      return false;
    }

    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phone)) {
      setError('אנא הכנס מספר טלפון תקין (10-15 ספרות)');
      return false;
    }

    const { exists: emailExists, error: emailError } = await AuthService.checkEmailExists(email.trim());
    if (emailError) { setError('שגיאה בבדיקת המייל'); return false; }
    if (emailExists) { setError('כתובת המייל כבר קיימת במערכת'); return false; }

    const { exists: phoneExists, error: phoneError } = await AuthService.checkPhoneExists(phone.trim());
    if (phoneError) { setError('שגיאה בבדיקת הטלפון'); return false; }
    if (phoneExists) { setError('מספר הטלפון כבר קיים במערכת'); return false; }

    if (password.length < 6) {
      setError('הסיסמה חייבת להיות לפחות 6 תווים');
      return false;
    }

    return true;
  };

  const handleNext = async () => {
    setError('');
    if (!(await validateForm())) return;

    setLoading(true);
    try {
      setData({
        ...data,
        fullName: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
      });
      navigation.navigate('RegistrationProfileImage');
    } catch {
      setError('שגיאה בשמירת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      title="פרטים אישיים"
      subtitle="מלא את הפרטים שלך כדי להמשיך"
      currentStep={1}
      totalSteps={5}
      showBack={true}
      onBack={() => {
        void HapticFeedback.impactLight();
        navigation.goBack();
      }}
      scrollable={true}
    >
      {/* Error Banner */}
      {error ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(248,81,73,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(248,81,73,0.4)',
            borderRadius: 14,
            padding: 14,
            marginBottom: 20,
          }}
        >
          <Ionicons name="alert-circle" size={18} color="#F85149" style={{ marginLeft: 8 }} />
          <Text
            style={{
              color: '#F85149',
              fontSize: 14,
              fontWeight: '500',
              textAlign: 'right',
              flex: 1,
            }}
          >
            {error}
          </Text>
        </View>
      ) : null}

      {/* Form */}
      <View style={{ gap: 4 }}>
        <OnboardingInput
          label="שם מלא"
          icon="person-outline"
          placeholder="הכנס את שמך המלא"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <OnboardingInput
          label="מספר טלפון"
          icon="call-outline"
          placeholder="054-000-0000"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={15}
        />

        <OnboardingInput
          label="כתובת אימייל"
          icon="mail-outline"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <OnboardingInput
          label="סיסמה"
          icon="lock-closed-outline"
          placeholder="לפחות 6 תווים"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={true}
          autoCapitalize="none"
        />
      </View>

      {/* Buttons */}
      <View style={{ marginTop: 20, gap: 4 }}>
        <OnboardingButton
          title="המשך"
          onPress={handleNext}
          loading={loading}
          disabled={loading}
        />
      </View>
    </OnboardingLayout>
  );
};

export default RegistrationDetailsScreen;
