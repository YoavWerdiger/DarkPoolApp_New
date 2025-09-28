import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback, Keyboard, ImageBackground } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Mail, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, isLoading } = useAuth();

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }

    const { error } = await signIn({ email: email.trim(), password });
    if (error) {
      Alert.alert('שגיאה בהתחברות', error);
    }
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert('שגיאה', 'אנא הכנס את כתובת האימייל שלך');
      return;
    }
    Alert.alert('איפוס סיסמה', 'נשלח לך אימייל לאיפוס הסיסמה');
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
            <View style={{ alignItems: 'center', marginBottom: 48 }}>
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
                  ברוכים הבאים ל-DarkPool
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
                 התחבר לחשבון שלך כדי להמשיך
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

            {/* Form Section */}
            <View style={{ gap: 20 }}>
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
                  borderColor: '#333333',
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Mail size={20} color="#666666" strokeWidth={2} />
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
                  borderColor: '#333333',
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Lock size={20} color="#666666" strokeWidth={2} />
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
                    placeholder="הכנס את הסיסמה"
                    placeholderTextColor="#666666"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <Pressable 
                    onPress={() => setShowPassword(!showPassword)}
                    style={{ padding: 6 }}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color="#666666" 
                    />
                  </Pressable>
                </View>
              </View>

               {/* Forgot Password */}
               <Pressable onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
                 <Text style={{ 
                   color: '#00E654', 
                   fontSize: 14, 
                   fontWeight: '500',
                   letterSpacing: 0.2,
                   textAlign: 'right'
                 }}>
                   שכחת סיסמה?
                 </Text>
               </Pressable>

              {/* Login Button */}
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
                <Pressable
                  onPress={handleSignIn}
                  disabled={isLoading}
                  style={{
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isLoading ? 0.7 : 1
                  }}
                >
                   <Text style={{ 
                     color: '#000000', 
                     fontSize: 16, 
                     fontWeight: '700',
                     letterSpacing: 0.5,
                     textTransform: 'uppercase',
                     writingDirection: 'rtl'
                   }}>
                     {isLoading ? 'מתחבר...' : 'התחבר'}
                   </Text>
                </Pressable>
              </LinearGradient>

               {/* Register Link */}
               <View style={{ 
                 flexDirection: 'row-reverse', 
                 justifyContent: 'center', 
                 alignItems: 'center', 
                 marginTop: 24,
                 gap: 6
               }}>
                 <Text style={{ color: '#A0A0A0', fontSize: 14, fontWeight: '400' }}>
                   אין לך חשבון?
                 </Text>
                <Pressable onPress={() => navigation.navigate('Onboarding')}>
                  <Text style={{ 
                    color: '#00E654', 
                    fontSize: 14, 
                    fontWeight: '600',
                    letterSpacing: 0.2
                  }}>
                    הירשם עכשיו
                  </Text>
                </Pressable>
               </View>
            </View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}