import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback, Keyboard, ImageBackground } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Mail, Lock, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn, isLoading, attemptAutoLogin } = useAuth();

  // טעינת פרטי התחברות שמורים
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('saved_email');
      const savedPassword = await AsyncStorage.getItem('saved_password');
      const savedRememberMe = await AsyncStorage.getItem('remember_me');
      
      if (savedRememberMe === 'true' && savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
  };

  const saveCredentials = async (email: string, password: string, remember: boolean) => {
    try {
      if (remember) {
        await AsyncStorage.setItem('saved_email', email);
        await AsyncStorage.setItem('saved_password', password);
        await AsyncStorage.setItem('remember_me', 'true');
      } else {
        await AsyncStorage.removeItem('saved_email');
        await AsyncStorage.removeItem('saved_password');
        await AsyncStorage.removeItem('remember_me');
      }
    } catch (error) {
      console.error('Error saving credentials:', error);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }

    const { error } = await signIn({ email: email.trim(), password });
    if (error) {
      Alert.alert('שגיאה בהתחברות', error);
    } else {
      // אם ההתחברות הצליחה, נשמור את הפרטים אם "זכור אותי" מסומן
      await saveCredentials(email.trim(), password, rememberMe);
      
      if (rememberMe) {
        // הודעה למשתמש על התחברות אוטומטית
        setTimeout(() => {
          Alert.alert(
            'התחברות מוצלחת!', 
            'הנתונים נשמרו. בפעם הבאה תתחבר אוטומטית.',
            [{ text: 'אישור' }]
          );
        }, 1000);
      }
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

               {/* Remember Me & Forgot Password */}
               <View style={{ 
                 flexDirection: 'row-reverse', 
                 justifyContent: 'space-between', 
                 alignItems: 'center',
                 marginTop: 8
               }}>
                 {/* Remember Me Checkbox */}
                 <Pressable 
                   onPress={() => setRememberMe(!rememberMe)}
                   style={{ 
                     flexDirection: 'row-reverse', 
                     alignItems: 'center',
                     gap: 8
                   }}
                 >
                   <View style={{
                     width: 20,
                     height: 20,
                     borderRadius: 4,
                     borderWidth: 2,
                     borderColor: rememberMe ? '#00E654' : '#666666',
                     backgroundColor: rememberMe ? '#00E654' : 'transparent',
                     alignItems: 'center',
                     justifyContent: 'center'
                   }}>
                     {rememberMe && (
                       <Check size={12} color="#000" strokeWidth={3} />
                     )}
                   </View>
                   <Text style={{ 
                     color: '#B0B0B0', 
                     fontSize: 14, 
                     fontWeight: '500',
                     letterSpacing: 0.2,
                     writingDirection: 'rtl'
                   }}>
                     זכור אותי
                   </Text>
                 </Pressable>

                 {/* Forgot Password */}
                 <Pressable onPress={handleForgotPassword}>
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
               </View>

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