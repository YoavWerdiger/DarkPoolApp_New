import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { DesignTokens } from '../../components/ui/DesignTokens';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingButton from '../../components/onboarding/OnboardingButton';

const PREVIEW_SIZE = 280;

const RegistrationProfileImageScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const [image, setImage] = useState<string | null>(data.profileImage || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => {});
    ImagePicker.requestCameraPermissionsAsync().catch(() => {});
  }, []);

  const processAndSetImage = async (uri: string) => {
    setLoading(true);
    try {
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: PREVIEW_SIZE, height: PREVIEW_SIZE } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      setImage(resized.uri);
    } catch {
      setImage(uri);
    } finally {
      setLoading(false);
    }
  };

  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('אין הרשאה', 'יש לאפשר גישה לגלריה'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      await processAndSetImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('אין הרשאה', 'יש לאפשר גישה למצלמה'); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      await processAndSetImage(result.assets[0].uri);
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

  return (
    <OnboardingLayout
      title="תמונת פרופיל"
      subtitle="הוסף תמונה או דלג — ניתן לשנות בהמשך"
      currentStep={2}
      totalSteps={5}
      showBack={true}
      onBack={() => navigation.goBack()}
    >
      {/* Avatar */}
      <View style={{ alignItems: 'center', marginBottom: 44 }}>
        <View
          style={{
            position: 'relative',
            marginBottom: 28,
          }}
        >
          {/* Glow ring */}
          <LinearGradient
            colors={['rgba(0,230,84,0.4)', 'rgba(0,230,84,0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 140,
              height: 140,
              borderRadius: 70,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: '#141F14',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {image ? (
                <Image
                  source={{ uri: image }}
                  style={{ width: 130, height: 130, borderRadius: 65 }}
                  contentFit="cover"
                  placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                  transition={150}
                />
              ) : loading ? (
                <ActivityIndicator size="small" color={DesignTokens.colors.primary.main} />
              ) : (
                <Ionicons name="person" size={54} color="rgba(255,255,255,0.2)" />
              )}
            </View>
          </LinearGradient>

          {/* Camera badge */}
          {!loading && (
            <TouchableOpacity
              onPress={pickImageFromGallery}
              activeOpacity={0.85}
              style={{
                position: 'absolute',
                bottom: 2,
                left: 2,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: DesignTokens.colors.primary.main,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#060C06',
              }}
            >
              <Ionicons name="camera" size={18} color="#000" />
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 12 }}>
            מעבד תמונה...
          </Text>
        )}

        {/* Source buttons */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={pickImageFromGallery}
            disabled={loading}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 24,
              paddingHorizontal: 20,
              paddingVertical: 11,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              gap: 8,
            }}
          >
            <Ionicons name="images-outline" size={18} color={DesignTokens.colors.primary.main} />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>גלריה</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={takePhoto}
            disabled={loading}
            activeOpacity={0.75}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 24,
              paddingHorizontal: 20,
              paddingVertical: 11,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              gap: 8,
            }}
          >
            <Ionicons name="camera-outline" size={18} color={DesignTokens.colors.primary.main} />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>מצלמה</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Buttons */}
      <View style={{ gap: 4 }}>
        <OnboardingButton title="המשך" onPress={continueWithImage} />
        <OnboardingButton title="דלג על השלב" onPress={skipImage} variant="secondary" />
      </View>
    </OnboardingLayout>
  );
};

export default RegistrationProfileImageScreen;
