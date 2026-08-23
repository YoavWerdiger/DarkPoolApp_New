import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { DesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert } from '../../utils/appDialog';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import { safeRegistrationBack } from '../../hooks/useExitRegistration';

const PREVIEW_SIZE = 280;
const AVATAR = 180;

const RegistrationProfileImageScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const [image, setImage] = useState<string | null>(data.profileImage || null);
  const [loading, setLoading] = useState(false);
  const surface = DesignTokens.onboardingInputSurface;

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => {});
    ImagePicker.requestCameraPermissionsAsync().catch(() => {});
  }, []);

  // Remount אחרי סיסמה — ProfileImage יכול להיות initialRoute בלי היסטוריה
  useLayoutEffect(() => {
    const syncBackState = () => {
      navigation.setOptions({ gestureEnabled: navigation.canGoBack() });
    };
    syncBackState();
    return navigation.addListener('state', syncBackState);
  }, [navigation]);

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
    if (status !== 'granted') {
      legacyAlert('אין הרשאה', 'יש לאפשר גישה לגלריה');
      return;
    }
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
    void HapticFeedback.impactLight();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      legacyAlert('אין הרשאה', 'יש לאפשר גישה למצלמה');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      await processAndSetImage(result.assets[0].uri);
    }
  };

  const handleTakePhoto = () => {
    void HapticFeedback.impactLight();
    takePhoto();
  };

  const handlePickFromGallery = () => {
    void HapticFeedback.impactLight();
    pickImageFromGallery();
  };

  const skipImage = () => {
    setData({ ...data, profileImage: null });
    navigation.navigate('RegistrationAge');
  };

  const continueWithImage = () => {
    setData({ ...data, profileImage: image });
    navigation.navigate('RegistrationAge');
  };

  const handleBack = () => {
    void HapticFeedback.impactLight();
    safeRegistrationBack(navigation, { fallbackRoute: 'RegistrationPassword' });
  };

  return (
    <OnboardingLayout
      title="תמונת פרופיל"
      subtitle="בחר תמונה שתייצג אותך בקהילת DarkPool"
      density="focused"
      currentStep={ONBOARDING_STEPS.profileImage}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      showBack
      onBack={handleBack}
      footer={
        <OnboardingButton
          title={image ? "המשך" : "דלג לעכשיו"}
          onPress={image ? continueWithImage : skipImage}
          disabled={loading}
        />
      }
    >
      <View style={{ alignItems: 'center', marginBottom: 32, flex: 1, justifyContent: 'center' }}>
        <UICard
          variant="glass"
          glassIntensity="medium"
          padding="none"
          style={{
            borderRadius: DesignTokens.borderRadius['2xl'],
            width: '100%',
            marginBottom: 20,
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
            <View
              style={{
                width: AVATAR,
                height: AVATAR,
                borderRadius: AVATAR / 2,
                borderWidth: 2,
                borderColor: image
                  ? DesignTokens.colors.primary.main
                  : 'rgba(255,255,255,0.15)',
                backgroundColor: surface.backgroundColor,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                shadowColor: DesignTokens.colors.primary.main,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: image ? 0.4 : 0,
                shadowRadius: 12,
                marginBottom: 24,
              }}
            >
              {image ? (
                <Image
                  source={{ uri: image }}
                  style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 }}
                  contentFit="cover"
                  placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                  transition={150}
                />
              ) : loading ? (
                <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
              ) : (
                <Ionicons 
                  name="person-outline" 
                  size={80} 
                  color="rgba(255,255,255,0.3)" 
                />
              )}
            </View>

            {loading ? (
              <Text
                style={{
                  color: DesignTokens.colors.primary.main,
                  fontSize: 14,
                  fontWeight: '600',
                  textAlign: 'center',
                  marginBottom: 20,
                }}
              >
                מעבד תמונה...
              </Text>
            ) : image ? (
              <>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 16,
                    fontWeight: '600',
                    textAlign: 'center',
                    marginBottom: 6,
                  }}
                >
                  נראה מעולה! 🎉
                </Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 13,
                    textAlign: 'center',
                    lineHeight: 18,
                    marginBottom: 20,
                  }}
                >
                  תמונה זו תוצג בפרופיל שלך ובצ'אטים
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 15,
                    fontWeight: '600',
                    textAlign: 'center',
                    marginBottom: 6,
                  }}
                >
                  הוסף תמונת פרופיל
                </Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 13,
                    textAlign: 'center',
                    lineHeight: 18,
                    paddingHorizontal: 20,
                    marginBottom: 20,
                  }}
                >
                  בחר תמונה שמייצגת אותך בצ'אטים
                </Text>
              </>
            )}

            {!loading && (
              <View style={{ flexDirection: 'row-reverse', gap: 12, width: '100%' }}>
                <View style={{ flex: 1 }}>
                  <OnboardingButton
                    title="מצלמה"
                    onPress={handleTakePhoto}
                    variant="secondary"
                    icon={<Ionicons name="camera" size={20} color="rgba(255,255,255,0.55)" />}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <OnboardingButton
                    title="גלריה"
                    onPress={handlePickFromGallery}
                    variant="secondary"
                    icon={<Ionicons name="images" size={20} color="rgba(255,255,255,0.55)" />}
                  />
                </View>
              </View>
            )}
          </View>
        </UICard>
      </View>
    </OnboardingLayout>
  );
};

export default RegistrationProfileImageScreen;
