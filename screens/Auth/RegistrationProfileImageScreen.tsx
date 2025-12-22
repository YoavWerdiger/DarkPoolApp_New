import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { DesignTokens } from '../../components/ui/DesignTokens';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';

const RegistrationProfileImageScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const [image, setImage] = useState(data.profileImage || null);
  const [loading, setLoading] = useState(false);

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

  const skipImage = () => {
    setData({ ...data, profileImage: null });
    navigation.navigate('RegistrationIntro');
  };

  const continueWithImage = () => {
    setData({ ...data, profileImage: image });
    navigation.navigate('RegistrationIntro');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <OnboardingLayout
      title="תמונת פרופיל"
      subtitle="הוסף תמונת פרופיל או דלג על השלב"
      currentStep={2}
      totalSteps={5}
      showBack={true}
      onBack={handleBack}
    >
      {/* Profile Image Section */}
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <View style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: DesignTokens.colors.background.secondary,
          borderWidth: 3,
          borderColor: DesignTokens.colors.primary.main,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          shadowColor: DesignTokens.colors.primary.main,
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
            <Ionicons name="person" size={50} color={DesignTokens.colors.text.tertiary} />
          )}
        </View>

        {/* Image Selection Buttons */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
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
            <Ionicons name="images-outline" size={20} color={DesignTokens.colors.primary.main} style={{ marginLeft: 8 }} />
            <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 14, fontWeight: '600' }}>
              גלריה
            </Text>
          </TouchableOpacity>

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
            <Ionicons name="camera-outline" size={20} color={DesignTokens.colors.primary.main} style={{ marginLeft: 8 }} />
            <Text style={{ color: DesignTokens.colors.text.primary, fontSize: 14, fontWeight: '600' }}>
              מצלמה
            </Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={{ marginTop: 20 }}>
            <ActivityIndicator color={DesignTokens.colors.primary.main} size="small" />
            <Text style={{ color: DesignTokens.colors.text.secondary, fontSize: 14, marginTop: 8 }}>
              טוען תמונה...
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={{ gap: 16 }}>
        <LinearGradient
          colors={['#00E654', '#00B84A', '#008F3A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 14,
            shadowColor: DesignTokens.colors.primary.main,
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
              color: DesignTokens.colors.background.primary, 
              fontSize: 16, 
              fontWeight: '700',
              letterSpacing: 0.5,
              textTransform: 'uppercase'
            }}>
              המשך
            </Text>
          </TouchableOpacity>
        </LinearGradient>

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
            color: DesignTokens.colors.text.secondary, 
            fontSize: 16, 
            fontWeight: '600',
            letterSpacing: 0.3
          }}>
            דלג על השלב
          </Text>
        </TouchableOpacity>
      </View>
    </OnboardingLayout>
  );
};

export default RegistrationProfileImageScreen;
