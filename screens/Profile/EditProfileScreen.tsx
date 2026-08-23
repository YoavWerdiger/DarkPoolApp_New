import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ChevronDown, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { mediaService } from '../../services/mediaService';
import { DesignTokens as StaticTokens, useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import OnboardingButton from '../../components/onboarding/OnboardingButton';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Gender = 'male' | 'female' | '';
type FocusedField = 'displayName' | 'phone' | null;

const PREVIEW_SIZE = 280;

export default function EditProfileScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const surface = StaticTokens.onboardingInputSurface;

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);

  useEffect(() => {
    loadUserData();
  }, [user]);

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => {});
    ImagePicker.requestCameraPermissionsAsync().catch(() => {});
  }, []);

  const loadUserData = async () => {
    try {
      if (!user) {
        setIsLoading(false);
        return;
      }

      // phone ו-gender כבר לא קריאים ישירות מ-public.users (הרשאות עמודה),
      // הפרופיל המלא של המשתמש עצמו מגיע מ-RPC שנעול על auth.uid().
      const { data: rows } = await supabase.rpc('get_my_profile');
      const userData = Array.isArray(rows) ? rows[0] : rows;

      if (userData) {
        setDisplayName(userData.full_name || '');
        setPhone(userData.phone || '');
        setGender(userData.gender || '');
        setProfileImage(userData.profile_picture || null);
      }

      setIsLoading(false);
    } catch {
      setIsLoading(false);
    }
  };

  const processAndSetImage = async (uri: string) => {
    setIsProcessingImage(true);
    try {
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: PREVIEW_SIZE, height: PREVIEW_SIZE } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      setProfileImage(resized.uri);
    } catch {
      setProfileImage(uri);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleImageFromGallery = async () => {
    try {
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
    } catch {
      legacyAlert('שגיאה', 'שגיאה בבחירת תמונה');
    }
  };

  const handleImageFromCamera = async () => {
    try {
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
    } catch {
      legacyAlert('שגיאה', 'שגיאה בצילום תמונה');
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      legacyAlert('שגיאה', 'נא להזין שם תצוגה');
      return;
    }

    setIsSaving(true);

    try {
      if (!user) {
        legacyAlert('שגיאה', 'לא נמצא משתמש מחובר');
        setIsSaving(false);
        return;
      }

      const remote = await mediaService.ensureRemoteMediaUrl(profileImage, 'image');
      if (profileImage && remote.error) {
        setIsSaving(false);
        legacyAlert(
          'שגיאה',
          remote.error || 'העלאת תמונת הפרופיל נכשלה. נסה שוב או בחר תמונה אחרת.',
        );
        return;
      }
      const profilePictureUrl = remote.url;

      const trimmedPhone = phone.trim();
      const { error } = await updateProfile({
        id: user.id,
        full_name: displayName.trim(),
        // ריק → '' ואז authService מנרמל ל-null (לא '' — לא מתנגש ב-UNIQUE)
        phone: trimmedPhone,
        gender: gender || undefined,
        profile_picture: profilePictureUrl || undefined,
      });

      setIsSaving(false);

      if (error) {
        legacyAlert('שגיאה', error);
        return;
      }

      void HapticFeedback.success();
      legacyAlert('הצלחה', 'הפרופיל נשמר בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() },
      ]);
    } catch {
      setIsSaving(false);
      legacyAlert('שגיאה', 'לא הצלחנו לשמור את הפרופיל. נסה שוב.');
    }
  };

  const fieldBorder = (field: FocusedField) =>
    focusedField === field
      ? DesignTokens.colors.primary.main
      : DesignTokens.colors.border.divider;

  if (isLoading) {
    return (
      <RNSafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title="עריכת פרופיל"
          onBack={() => {
            void HapticFeedback.impactLight();
            navigation.goBack();
          }}
        />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text
            style={[
              styles.loadingText,
              {
                color: DesignTokens.colors.text.secondary,
                marginTop: DesignTokens.spacing.md,
              },
            ]}
          >
            טוען פרופיל...
          </Text>
        </View>
      </RNSafeAreaView>
    );
  }

  return (
    <RNSafeAreaView style={styles.root} edges={['top']}>
      <ChatSubScreenHeader
        title="עריכת פרופיל"
        onBack={() => {
          void HapticFeedback.impactLight();
          navigation.goBack();
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: DesignTokens.spacing.base,
            paddingTop: DesignTokens.spacing.sm,
            paddingBottom: DesignTokens.spacing.xl,
          }}
        >
          {/* Avatar — אותו דפוס כמו RegistrationProfileImageScreen */}
          <UICard
            variant="glass"
            glassIntensity="medium"
            padding="none"
            style={{
              borderRadius: DesignTokens.borderRadius['2xl'],
              width: '100%',
              marginBottom: DesignTokens.spacing.base,
            }}
          >
            <View style={styles.avatarCardInner}>
              <View
                style={[
                  styles.avatarRing,
                  {
                    borderColor: profileImage
                      ? DesignTokens.colors.primary.main
                      : 'rgba(255,255,255,0.15)',
                    backgroundColor: surface.backgroundColor,
                    shadowColor: DesignTokens.colors.primary.main,
                    shadowOpacity: profileImage ? 0.4 : 0,
                  },
                ]}
              >
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                    transition={150}
                  />
                ) : isProcessingImage ? (
                  <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
                ) : (
                  <Ionicons name="person-outline" size={72} color="rgba(255,255,255,0.3)" />
                )}
              </View>

              {isProcessingImage ? (
                <Text style={styles.avatarStatusPrimary}>מעבד תמונה...</Text>
              ) : (
                <>
                  <Text style={styles.avatarStatusPrimary}>
                    {profileImage ? 'תמונת הפרופיל שלך' : 'עדכון תמונת פרופיל'}
                  </Text>
                  <Text style={styles.avatarStatusSecondary}>
                    {profileImage
                      ? 'אפשר להחליף עם מצלמה או גלריה'
                      : 'בחר תמונה שמייצגת אותך בצ׳אטים'}
                  </Text>
                </>
              )}

              {!isProcessingImage && (
                <View style={styles.photoActionsRow}>
                  <View style={styles.photoActionFlex}>
                    <OnboardingButton
                      title="מצלמה"
                      onPress={() => {
                        void handleImageFromCamera();
                      }}
                      variant="secondary"
                      icon={
                        <Ionicons name="camera" size={20} color="rgba(255,255,255,0.55)" />
                      }
                    />
                  </View>
                  <View style={styles.photoActionFlex}>
                    <OnboardingButton
                      title="גלריה"
                      onPress={() => {
                        void handleImageFromGallery();
                      }}
                      variant="secondary"
                      icon={
                        <Ionicons name="images" size={20} color="rgba(255,255,255,0.55)" />
                      }
                    />
                  </View>
                </View>
              )}
            </View>
          </UICard>

          {/* Form — single glass card */}
          <UICard
            variant="glass"
            glassIntensity="light"
            padding="md"
            style={{
              borderRadius: DesignTokens.borderRadius.xl,
              borderWidth: 1,
              borderColor: DesignTokens.colors.border.main,
            }}
          >
            <FieldLabel tokens={DesignTokens}>שם תצוגה</FieldLabel>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="הזן שם תצוגה"
              placeholderTextColor={DesignTokens.colors.text.muted}
              onFocus={() => setFocusedField('displayName')}
              onBlur={() => setFocusedField(null)}
              style={[
                styles.input,
                {
                  backgroundColor: DesignTokens.colors.background.input,
                  borderColor: fieldBorder('displayName'),
                  color: DesignTokens.colors.text.primary,
                  borderRadius: DesignTokens.borderRadius.md,
                },
              ]}
            />

            <FieldLabel tokens={DesignTokens}>טלפון</FieldLabel>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="הזן מספר טלפון"
              placeholderTextColor={DesignTokens.colors.text.muted}
              keyboardType="phone-pad"
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
              style={[
                styles.input,
                {
                  backgroundColor: DesignTokens.colors.background.input,
                  borderColor: fieldBorder('phone'),
                  color: DesignTokens.colors.text.primary,
                  borderRadius: DesignTokens.borderRadius.md,
                },
              ]}
            />

            <FieldLabel tokens={DesignTokens}>מין</FieldLabel>
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.impactLight();
                setShowGenderPicker(true);
              }}
              activeOpacity={0.7}
              style={[
                styles.selectRow,
                {
                  backgroundColor: DesignTokens.colors.background.input,
                  borderColor: DesignTokens.colors.border.divider,
                  borderRadius: DesignTokens.borderRadius.md,
                },
              ]}
            >
              <ChevronDown size={18} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
              <Text
                style={[
                  styles.selectText,
                  {
                    color: gender
                      ? DesignTokens.colors.text.primary
                      : DesignTokens.colors.text.muted,
                  },
                ]}
              >
                {gender === 'male' ? 'זכר' : gender === 'female' ? 'נקבה' : 'בחר מין'}
              </Text>
            </TouchableOpacity>

            <FieldLabel tokens={DesignTokens}>אימייל</FieldLabel>
            <View
              style={[
                styles.readonlyBox,
                {
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderColor: DesignTokens.colors.border.subtle,
                  borderRadius: DesignTokens.borderRadius.md,
                },
              ]}
            >
              <Text
                style={[styles.readonlyText, { color: DesignTokens.colors.text.secondary }]}
                numberOfLines={1}
              >
                {user?.email || '—'}
              </Text>
            </View>
            <Text
              style={[
                styles.helperText,
                { color: DesignTokens.colors.text.muted },
              ]}
            >
              לא ניתן לשנות את כתובת האימייל
            </Text>
          </UICard>
        </ScrollView>

        {/* Sticky save CTA */}
        <View
          style={[
            styles.saveBar,
            {
              paddingHorizontal: DesignTokens.spacing.base,
              paddingTop: DesignTokens.spacing.sm,
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopColor: DesignTokens.colors.border.subtle,
              backgroundColor: 'rgba(10, 14, 10, 0.92)',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              void HapticFeedback.medium();
              void handleSave();
            }}
            disabled={isSaving}
            activeOpacity={0.85}
            style={[
              styles.saveButton,
              {
                backgroundColor: DesignTokens.colors.primary.main,
                borderRadius: 999,
                opacity: isSaving ? 0.65 : 1,
                ...DesignTokens.shadows.greenGlow,
              },
            ]}
          >
            {isSaving ? (
              <View style={styles.saveBusy}>
                <ActivityIndicator size="small" color={DesignTokens.colors.text.inverse} />
                <Text
                  style={[
                    styles.saveButtonText,
                    { color: DesignTokens.colors.text.inverse },
                  ]}
                >
                  שומר...
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.saveButtonText,
                  { color: DesignTokens.colors.text.inverse },
                ]}
              >
                שמור שינויים
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Gender picker */}
      {showGenderPicker && (
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowGenderPicker(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <UICard
              variant="glass"
              glassIntensity="medium"
              padding="lg"
              style={{
                width: 300,
                maxWidth: '85%',
                borderRadius: DesignTokens.borderRadius.xl,
                borderWidth: 1,
                borderColor: DesignTokens.colors.border.main,
                alignSelf: 'center',
              }}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { color: DesignTokens.colors.text.primary },
                ]}
              >
                בחר מין
              </Text>

              {([
                { value: 'male' as const, label: 'זכר' },
                { value: 'female' as const, label: 'נקבה' },
              ]).map((opt) => {
                const selected = gender === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => {
                      if (!selected) void HapticFeedback.selection();
                      setGender(opt.value);
                      setShowGenderPicker(false);
                    }}
                    activeOpacity={0.75}
                    style={[
                      styles.genderOption,
                      {
                        backgroundColor: selected
                          ? DesignTokens.colors.primary.dim
                          : DesignTokens.colors.background.input,
                        borderColor: selected
                          ? DesignTokens.colors.primary.main
                          : DesignTokens.colors.border.divider,
                        borderRadius: DesignTokens.borderRadius.md,
                      },
                    ]}
                  >
                    {selected ? (
                      <Check size={18} color={DesignTokens.colors.primary.main} strokeWidth={2.5} />
                    ) : (
                      <View style={styles.genderCheckSpacer} />
                    )}
                    <Text
                      style={[
                        styles.genderOptionText,
                        { color: DesignTokens.colors.text.primary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                onPress={() => {
                  void HapticFeedback.selection();
                  setShowGenderPicker(false);
                }}
                activeOpacity={0.7}
                style={styles.cancelBtn}
              >
                <Text
                  style={[
                    styles.cancelText,
                    { color: DesignTokens.colors.text.secondary },
                  ]}
                >
                  ביטול
                </Text>
              </TouchableOpacity>
            </UICard>
          </Pressable>
        </Pressable>
      )}
    </RNSafeAreaView>
  );
}

function FieldLabel({
  children,
  tokens,
}: {
  children: string;
  tokens: ReturnType<typeof useDesignTokens>;
}) {
  return (
    <Text
      style={[
        styles.fieldLabel,
        {
          color: tokens.colors.text.tertiary,
          marginBottom: tokens.spacing.xs + 2,
        },
      ]}
    >
      {children}
    </Text>
  );
}

const AVATAR = 160;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  avatarCardInner: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  avatarRing: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    marginBottom: 20,
  },
  avatarImage: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarStatusPrimary: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  avatarStatusSecondary: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  photoActionsRow: {
    flexDirection: 'row-reverse',
    gap: 12,
    width: '100%',
  },
  photoActionFlex: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    textAlign: 'right',
    marginBottom: 16,
    minHeight: 50,
  },
  selectRow: {
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    textAlign: 'right',
  },
  readonlyBox: {
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 50,
    justifyContent: 'center',
  },
  readonlyText: {
    fontSize: 15,
    textAlign: 'right',
  },
  helperText: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },
  saveBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  saveBusy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 16,
  },
  genderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    marginBottom: 8,
    minHeight: 50,
  },
  genderOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  genderCheckSpacer: {
    width: 18,
    height: 18,
  },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
