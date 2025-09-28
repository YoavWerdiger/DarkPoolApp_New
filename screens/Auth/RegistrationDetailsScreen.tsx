import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Dimensions, TouchableWithoutFeedback, Keyboard, ImageBackground } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { AuthService } from '../../services/authService';

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
    
    // בדיקת פורמט מייל
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('אנא הכנס כתובת אימייל תקינה');
      return false;
    }
    
    // בדיקת פורמט טלפון
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
      // שמור את הנתונים ב-context
      setData({
        ...data,
        fullName: name.trim(),
        email: email.trim(),
        password: password,
        phone: phone.trim()
      });
      
      // עבור לדף הבא
      navigation.navigate('RegistrationProfileImage');
    } catch (error) {
      console.error('Registration error:', error);
      setError('שגיאה בשמירת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const { width, height } = Dimensions.get('window');

  // Create subtle background pattern
  const createBackgroundPattern = () => {
    const patterns = [];
    for (let i = 0; i < 15; i++) {
      patterns.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.05 + 0.02
      });
    }
    return patterns;
  };

  const backgroundPattern = createBackgroundPattern();

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
          {/* Subtle Background Pattern */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {backgroundPattern.map((dot, index) => (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  left: dot.x,
                  top: dot.y,
                  width: dot.size,
                  height: dot.size,
                  backgroundColor: '#00E654',
                  opacity: dot.opacity,
                  borderRadius: dot.size / 2
                }}
              />
            ))}
          </View>

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Transparent Background Image - Center */}
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

          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
            {/* Header Section */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              {/* Main Title */}
              <Text style={{ 
                fontSize: 32, 
                fontWeight: '800', 
                color: '#FFFFFF', 
                marginBottom: 8,
                letterSpacing: -0.8,
                textAlign: 'center',
                writingDirection: 'rtl'
              }}>
                פרטים אישיים
              </Text>
              
              {/* Subtitle */}
              <Text style={{ 
                fontSize: 16, 
                color: '#B0B0B0', 
                fontWeight: '400',
                letterSpacing: 0.3,
                textAlign: 'center',
                lineHeight: 22,
                writingDirection: 'rtl'
              }}>
                מלא את הפרטים שלך כדי להמשיך
              </Text>
              
              {/* Decorative Line */}
              <View style={{
                width: 60,
                height: 2,
                backgroundColor: '#00E654',
                marginTop: 16,
                borderRadius: 1
              }} />
            </View>

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
                  color: '#FFFFFF', 
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
                  backgroundColor: '#1a1a1a',
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: error && !name ? '#F85149' : '#333333',
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Ionicons name="person-outline" size={20} color="#666666" />
                  <TextInput
                    style={{
                      flex: 1,
                      color: '#FFFFFF',
                      paddingHorizontal: 12,
                      paddingVertical: 16,
                      fontSize: 16,
                      fontWeight: '500',
                      textAlign: 'right'
                    }}
                    placeholder="הכנס את שמך המלא"
                    placeholderTextColor="#666666"
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
                  color: '#FFFFFF', 
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
                  backgroundColor: '#1a1a1a',
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: error && !phone ? '#F85149' : '#333333',
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Ionicons name="call-outline" size={20} color="#666666" />
                  <TextInput
                    style={{
                      flex: 1,
                      color: '#FFFFFF',
                      paddingHorizontal: 12,
                      paddingVertical: 16,
                      fontSize: 16,
                      fontWeight: '500',
                      textAlign: 'right'
                    }}
                    placeholder="הכנס מספר טלפון (לדוג׳ 0501234567)"
                    placeholderTextColor="#666666"
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
                  color: '#FFFFFF', 
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
                  backgroundColor: '#1a1a1a',
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: error && !email ? '#F85149' : '#333333',
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Ionicons name="mail-outline" size={20} color="#666666" />
                  <TextInput
                    style={{
                      flex: 1,
                      color: '#FFFFFF',
                      paddingHorizontal: 12,
                      paddingVertical: 16,
                      fontSize: 16,
                      fontWeight: '500',
                      textAlign: 'right'
                    }}
                    placeholder="הכנס את כתובת האימייל"
                    placeholderTextColor="#666666"
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
                  color: '#FFFFFF', 
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
                  backgroundColor: '#1a1a1a',
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: error && !password ? '#F85149' : '#333333',
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666666" />
                  <TextInput
                    style={{
                      flex: 1,
                      color: '#FFFFFF',
                      paddingHorizontal: 12,
                      paddingVertical: 16,
                      fontSize: 16,
                      fontWeight: '500',
                      textAlign: 'right'
                    }}
                    placeholder="הכנס סיסמה (לפחות 6 תווים)"
                    placeholderTextColor="#666666"
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
                  shadowColor: '#00E654',
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
                      color: '#000000', 
                      fontSize: 16, 
                      fontWeight: '700',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      writingDirection: 'rtl'
                    }}>
                      המשך
                    </Text>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default RegistrationDetailsScreen;