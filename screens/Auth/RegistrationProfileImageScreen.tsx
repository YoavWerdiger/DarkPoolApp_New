import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Reanimated, { ZoomIn } from 'react-native-reanimated';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import CashAppScreen from '../../components/ui/CashAppScreen';
import CashAppButton from '../../components/ui/CashAppButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert } from '../../utils/appDialog';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '../../constants/onboardingFlow';
import { safeRegistrationBack } from '../../hooks/useExitRegistration';

const PREVIEW_SIZE = 280;
const AVATAR = 180;

const RegistrationProfileImageScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const tokens = useDesignTokens();
  const [image, setImage] = useState<string | null>(data.profileImage || null);
  const [loading, setLoading] = useState(false);

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
    <CashAppScreen
      title="תמונת פרופיל"
      subtitle="בחר תמונה שתייצג אותך בקהילת DarkPool"
      currentStep={ONBOARDING_STEPS.profileImage}
      totalSteps={ONBOARDING_TOTAL_STEPS}
      progressVariant="dots"
      showBack
      onBack={handleBack}
      footer={
        <CashAppButton
          title={image ? "המשך" : "דלג לעכשיו"}
          variant="primary"
          size="lg"
          onPress={image ? continueWithImage : skipImage}
          disabled={loading}
        />
      }
    >
      <View style={styles.body}>
        <Pressable
          onPress={loading ? undefined : handlePickFromGallery}
          accessibilityRole="button"
          accessibilityLabel={image ? 'החלף תמונת פרופיל' : 'בחר תמונת פרופיל'}
        >
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: tokens.colors.background.cardSolid,
                borderColor: image ? tokens.colors.text.primary : tokens.colors.text.tertiary,
                borderStyle: image ? 'solid' : 'dashed',
              },
            ]}
          >
            {image ? (
              <Reanimated.View key={image} entering={ZoomIn.duration(320)} style={styles.avatarImgWrap}>
                <Image
                  source={{ uri: image }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  transition={150}
                />
              </Reanimated.View>
            ) : loading ? (
              <ActivityIndicator size="large" color={tokens.colors.text.primary} />
            ) : (
              <Ionicons name="person" size={72} color={tokens.colors.text.tertiary} />
            )}
          </View>
          {!loading ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: tokens.colors.text.primary,
                  borderColor: tokens.colors.background.primary,
                },
              ]}
            >
              <Ionicons
                name={image ? 'pencil' : 'add'}
                size={image ? 16 : 22}
                color={tokens.colors.text.inverse}
              />
            </View>
          ) : null}
        </Pressable>

        <Text style={[styles.status, { color: tokens.colors.text.secondary }]}>
          {loading
            ? 'מעבד תמונה…'
            : image
              ? 'נראה מעולה. התמונה תוצג בפרופיל ובצ׳אטים'
              : 'לחץ על העיגול או בחר מקור למטה'}
        </Text>

        {!loading ? (
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <CashAppButton
                title="צלם"
                variant="secondary"
                size="md"
                icon="camera-outline"
                onPress={handleTakePhoto}
              />
            </View>
            <View style={{ flex: 1 }}>
              <CashAppButton
                title="מהגלריה"
                variant="secondary"
                size="md"
                icon="images-outline"
                onPress={handlePickFromGallery}
              />
            </View>
          </View>
        ) : null}
      </View>
    </CashAppScreen>
  );
};

export default RegistrationProfileImageScreen;

const BADGE = 40;

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: APP_LAYOUT.sectionGap,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImgWrap: {
    width: '100%',
    height: '100%',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    fontWeight: APP_TYPE.cardBody.fontWeight,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: APP_LAYOUT.componentGap + 4,
    marginBottom: APP_LAYOUT.sectionGap / 2 + 4,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: APP_LAYOUT.stackGapTight,
    width: '100%',
  },
});
