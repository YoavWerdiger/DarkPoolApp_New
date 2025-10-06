import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ImageBackground } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';

const RegistrationProfileImageScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const [image, setImage] = useState(data.profileImage || null);
  const [loading, setLoading] = useState(false);

  // בחירת תמונה מהגלריה
  const pickImageFromGallery = async () => {
    setLoading(true);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setLoading(false);
      Alert.alert('אין הרשאה', 'יש לאפשר גישה לגלריה');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    setLoading(false);
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  // צילום תמונה מהמצלמה
  const takePhoto = async () => {
    setLoading(true);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setLoading(false);
      Alert.alert('אין הרשאה', 'יש לאפשר גישה למצלמה');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    setLoading(false);
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  // דילוג על בחירת תמונה
  const skipImage = () => {
    setData({ ...data, profileImage: null });
    navigation.navigate('RegistrationIntro');
  };

  // המשך עם התמונה
  const continueWithImage = () => {
    setData({ ...data, profileImage: image });
    navigation.navigate('RegistrationIntro');
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
                תמונת פרופיל
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
                הוסף תמונת פרופיל או דלג על השלב
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

            {/* Profile Image Section */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              {/* Profile Image Circle */}
              <View style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: '#1a1a1a',
                borderWidth: 3,
                borderColor: '#00E654',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                shadowColor: '#00E654',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8
              }}>
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={{
                      width: 114,
                      height: 114,
                      borderRadius: 57
                    }}
                  />
                ) : (
                  <Ionicons name="person" size={50} color="#666666" />
                )}
              </View>

              {/* Image Selection Buttons */}
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {/* Gallery Button */}
                <TouchableOpacity
                  onPress={pickImageFromGallery}
                  disabled={loading}
                  style={{
                    backgroundColor: '#181818',
                    borderRadius: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <Ionicons name="images-outline" size={20} color="#00E654" style={{ marginLeft: 8 }} />
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
                    גלריה
                  </Text>
                </TouchableOpacity>

                {/* Camera Button */}
                <TouchableOpacity
                  onPress={takePhoto}
                  disabled={loading}
                  style={{
                    backgroundColor: '#181818',
                    borderRadius: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <Ionicons name="camera-outline" size={20} color="#00E654" style={{ marginLeft: 8 }} />
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
                    מצלמה
                  </Text>
                </TouchableOpacity>
              </View>

              {loading && (
                <View style={{ marginTop: 20 }}>
                  <ActivityIndicator color="#00E654" size="small" />
                  <Text style={{ color: '#B0B0B0', fontSize: 14, marginTop: 8 }}>
                    טוען תמונה...
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={{ gap: 16 }}>
              {/* Continue Button */}
              <LinearGradient
                colors={['#00E654', '#00B84A', '#008F3A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 14,
                  shadowColor: '#00E654',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8
                }}
              >
                <TouchableOpacity
                  onPress={continueWithImage}
                  style={{
                    paddingVertical: 16,
                    alignItems: 'center',
                    justifyContent: 'center'
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
                    המשך
                  </Text>
                </TouchableOpacity>
              </LinearGradient>

              {/* Skip Button */}
              <TouchableOpacity
                onPress={skipImage}
                style={{
                  backgroundColor: '#181818',
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)'
                }}
              >
                <Text style={{ 
                  color: '#B0B0B0', 
                  fontSize: 16, 
                  fontWeight: '600',
                  letterSpacing: 0.3,
                  writingDirection: 'rtl'
                }}>
                  דלג על השלב
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default RegistrationProfileImageScreen;