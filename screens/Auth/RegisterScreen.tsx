import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback, Keyboard, ImageBackground } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { User, Mail, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { AuthService } from '../../services/authService';

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signUp, isLoading, user } = useAuth();

  // הוסף את המשתמש לערוצים הקיימים כשהמשתמש משתנה
  useEffect(() => {
    if (user?.id) {
      console.log('🔄 RegisterScreen: User signed up, adding to default channels:', user.id);
      addUserToDefaultChannels(user.id).catch(err => {
        console.error('❌ RegisterScreen: Error adding user to default channels:', err);
      });
    }
  }, [user]);

  const validateForm = async () => {
    if (!fullName.trim()) {
      Alert.alert('שגיאה', 'אנא הכנס את שמך המלא');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('שגיאה', 'אנא הכנס כתובת אימייל');
      return false;
    }
    if (!email.includes('@')) {
      Alert.alert('שגיאה', 'אנא הכנס כתובת אימייל תקינה');
      return false;
    }
    
    // בדיקה שהמייל לא קיים
    const { exists: emailExists, error: emailError } = await AuthService.checkEmailExists(email.trim());
    if (emailError) {
      Alert.alert('שגיאה', 'שגיאה בבדיקת המייל');
      return false;
    }
    if (emailExists) {
      Alert.alert('שגיאה', 'כתובת המייל כבר קיימת במערכת');
      return false;
    }
    
    if (password.length < 6) {
      Alert.alert('שגיאה', 'הסיסמה חייבת להיות לפחות 6 תווים');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('שגיאה', 'הסיסמאות אינן תואמות');
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    if (!(await validateForm())) return;

    const { error } = await signUp({
      email: email.trim(),
      password,
      display_name: fullName.trim(),
    });

    if (error) {
      Alert.alert('שגיאה בהרשמה', error);
    } else {
      Alert.alert('הצלחה', 'החשבון נוצר בהצלחה! אנא אשר את האימייל שלך.', [
        { text: 'אישור', onPress: () => navigation.navigate('Login') }
      ]);
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
          colors={['#1a1a1a', '#2d3a2d', '#1f2a1f', '#1a1a1a']}
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
            opacity: 0.22
          }}>
            <ImageBackground
              source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
              resizeMode="contain"
              style={{
                width: width,
                height: height,
              }}
              imageStyle={{
                opacity: 0.35
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
                צור חשבון
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
                הירשם כדי להתחיל להשתמש באפליקציה
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
                  borderColor: '#333333',
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <User size={20} color="#666666" strokeWidth={2} />
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
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    autoCorrect={false}
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
                    placeholder="הכנס סיסמה (לפחות 6 תווים)"
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

              {/* Confirm Password Input */}
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
                  אימות סיסמה
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
                    placeholder="הכנס שוב את הסיסמה"
                    placeholderTextColor="#666666"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <Pressable 
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ padding: 6 }}
                  >
                    <Ionicons 
                      name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color="#666666" 
                    />
                  </Pressable>
                </View>
              </View>

              {/* Register Button */}
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
                  onPress={handleSignUp}
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
                    {isLoading ? 'יוצר חשבון...' : 'צור חשבון'}
                  </Text>
                </Pressable>
              </LinearGradient>

              {/* Login Link */}
              <View style={{ 
                flexDirection: 'row-reverse', 
                justifyContent: 'center', 
                alignItems: 'center', 
                marginTop: 24,
                gap: 6
              }}>
                <Text style={{ color: '#A0A0A0', fontSize: 14, fontWeight: '400' }}>
                  יש לך כבר חשבון?
                </Text>
                <Pressable onPress={() => navigation.navigate('Login')}>
                  <Text style={{ 
                    color: '#00E654', 
                    fontSize: 14, 
                    fontWeight: '600',
                    letterSpacing: 0.2,
                    textAlign: 'right'
                  }}>
                    התחבר עכשיו
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

export async function addUserToDefaultChannels(userId: string) {
  try {
    const { data: channels } = await supabase.from('channels').select('id').eq('is_private', false);
    if (channels) {
      for (const channel of channels) {
        // בדיקה אם המשתמש כבר חבר בערוץ
        const { data: existingMember, error: checkError } = await supabase
          .from('channel_members')
          .select('id')
          .eq('channel_id', channel.id)
          .eq('user_id', userId)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('❌ Error checking existing membership for channel:', channel.id, checkError);
          continue;
        }
        
        if (existingMember) {
          console.log('ℹ️ User is already a member of channel:', channel.id);
          continue;
        }
        
        // המשתמש לא חבר, נוסיף אותו
        const { error: insertError } = await supabase.from('channel_members').insert({ 
          channel_id: channel.id, 
          user_id: userId 
        });
        
        if (insertError) {
          console.error('❌ Error adding user to channel:', channel.id, insertError);
        } else {
          console.log('✅ User added to channel:', channel.id);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in addUserToDefaultChannels:', error);
  }
}