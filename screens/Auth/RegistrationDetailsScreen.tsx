import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthService } from '../../services/authService';
import { DesignTokens } from '../../components/ui/DesignTokens';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';

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
    
    // בדיקה שהמייל לא קיים
    const { exists: emailExists, error: emailError } = await AuthService.checkEmailExists(email.trim());
    if (emailError) {
      setError('שגיאה בבדיקת המייל');
      return false;
    }
    if (emailExists) {
      setError('כתובת המייל כבר קיימת במערכת');
      return false;
    }
    
    // בדיקה שהטלפון לא קיים
    const { exists: phoneExists, error: phoneError } = await AuthService.checkPhoneExists(phone.trim());
    if (phoneError) {
      setError('שגיאה בבדיקת הטלפון');
      return false;
    }
    if (phoneExists) {
      setError('מספר הטלפון כבר קיים במערכת');
      return false;
    }
    
    if (password.length < 6) {
      setError('הסיסמה חייבת להיות לפחות 6 תווים');
      return false;
    }
    
    return true;
  };

  const handleNext = async () => {
    setError('');
    
    if (!(await validateForm())) {
      return;
    }

    setLoading(true);
    
    try {
      setData({
        ...data,
        fullName: name.trim(),
        email: email.trim(),
        password: password,
        phone: phone.trim()
      });
      
      navigation.navigate('RegistrationProfileImage');
    } catch (error) {
      console.error('Registration error:', error);
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
      showBack={false}
      scrollable={true}
    >
      {/* Error Message */}
      {error ? (
        <View style={{
          backgroundColor: 'rgba(248, 81, 73, 0.1)',
          borderColor: '#F85149',
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          marginBottom: 20,
          flexDirection: 'row',
          alignItems: 'center'
        }}>
          <Ionicons name="alert-circle" size={20} color="#F85149" style={{ marginLeft: 8 }} />
          <Text style={{ color: '#F85149', fontSize: 14, fontWeight: '500', textAlign: 'right', flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}

      {/* Form Section */}
      <View style={{ gap: 20 }}>
        {/* Full Name Input */}
        <View>
          <Text style={{ 
            color: DesignTokens.colors.text.primary, 
            fontSize: 14, 
            fontWeight: '600', 
            marginBottom: 8,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            textAlign: 'right'
          }}>
            שם מלא
          </Text>
          <View style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: error && !name ? '#F85149' : '#333333',
            paddingHorizontal: 16,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <Ionicons name="person-outline" size={20} color={DesignTokens.colors.text.tertiary} />
            <TextInput
              style={{
                flex: 1,
                color: DesignTokens.colors.text.primary,
                paddingHorizontal: 12,
                paddingVertical: 16,
                fontSize: 16,
                fontWeight: '500',
                textAlign: 'right'
              }}
              placeholder="הכנס את שמך המלא"
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Phone Input */}
        <View>
          <Text style={{ 
            color: DesignTokens.colors.text.primary, 
            fontSize: 14, 
            fontWeight: '600', 
            marginBottom: 8,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            textAlign: 'right'
          }}>
            מספר טלפון
          </Text>
          <View style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: error && !phone ? '#F85149' : '#333333',
            paddingHorizontal: 16,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <Ionicons name="call-outline" size={20} color={DesignTokens.colors.text.tertiary} />
            <TextInput
              style={{
                flex: 1,
                color: DesignTokens.colors.text.primary,
                paddingHorizontal: 12,
                paddingVertical: 16,
                fontSize: 16,
                fontWeight: '500',
                textAlign: 'right'
              }}
              placeholder="הכנס מספר טלפון (לדוג׳ 0501234567)"
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>
        </View>

        {/* Email Input */}
        <View>
          <Text style={{ 
            color: DesignTokens.colors.text.primary, 
            fontSize: 14, 
            fontWeight: '600', 
            marginBottom: 8,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            textAlign: 'right'
          }}>
            כתובת אימייל
          </Text>
          <View style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: error && !email ? '#F85149' : '#333333',
            paddingHorizontal: 16,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <Ionicons name="mail-outline" size={20} color={DesignTokens.colors.text.tertiary} />
            <TextInput
              style={{
                flex: 1,
                color: DesignTokens.colors.text.primary,
                paddingHorizontal: 12,
                paddingVertical: 16,
                fontSize: 16,
                fontWeight: '500',
                textAlign: 'right'
              }}
              placeholder="הכנס את כתובת האימייל"
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Password Input */}
        <View>
          <Text style={{ 
            color: DesignTokens.colors.text.primary, 
            fontSize: 14, 
            fontWeight: '600', 
            marginBottom: 8,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            textAlign: 'right'
          }}>
            סיסמה
          </Text>
          <View style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: error && !password ? '#F85149' : '#333333',
            paddingHorizontal: 16,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <Ionicons name="lock-closed-outline" size={20} color={DesignTokens.colors.text.tertiary} />
            <TextInput
              style={{
                flex: 1,
                color: DesignTokens.colors.text.primary,
                paddingHorizontal: 12,
                paddingVertical: 16,
                fontSize: 16,
                fontWeight: '500',
                textAlign: 'right'
              }}
              placeholder="הכנס סיסמה (לפחות 6 תווים)"
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Next Button */}
        <LinearGradient
          colors={['#00E654', '#00B84A', '#008F3A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 14,
            marginTop: 12,
            shadowColor: DesignTokens.colors.primary.main,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8
          }}
        >
          <TouchableOpacity
            onPress={handleNext}
            disabled={loading}
            style={{
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Text style={{ 
                color: DesignTokens.colors.background.primary, 
                fontSize: 16, 
                fontWeight: '700',
                letterSpacing: 0.5,
                textTransform: 'uppercase'
              }}>
                המשך
              </Text>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </OnboardingLayout>
  );
};

export default RegistrationDetailsScreen;
