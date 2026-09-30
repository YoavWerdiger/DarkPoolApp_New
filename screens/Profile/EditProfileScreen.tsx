import { legacyAlert } from '../../utils/appDialog';
import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  Platform,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  AndroidSoftInputModes,
  KeyboardAwareScrollView,
  KeyboardController,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { Camera, UserRound } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { mediaService } from '../../services/mediaService';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UIButton from '../../components/ui/UIButton';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE, appFormFieldHelperStyle } from '../../components/ui/appType';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldShellStyle,
} from '../../components/ui/formControl';
import { settingsButtonLabelStyle, settingsMetaType } from '../../components/profile/settingsType';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { restoreAndroidSoftInputIfUnlocked } from '../../components/chat/androidChatKeyboard';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Gender = 'male' | 'female' | '';

function GenderGlyph({ name, color }: { name: 'male' | 'female'; color: string }) {
  if (name === 'male') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx="10" cy="14.5" r="5" stroke={color} strokeWidth={2} />
        <Path
          d="M13.6 10.9 L19 5.5 M19 5.5 H14.2 M19 5.5 V10.3"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8.5" r="5" stroke={color} strokeWidth={2} />
      <Path
        d="M12 13.5 V20 M8.75 16.75 H15.25"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}
type FocusedField = 'displayName' | 'phone' | null;

const PREVIEW_SIZE = 280;
const AVATAR = 120;
const CAMERA_BADGE = 36;
/** גובה כפתור השמירה (52) + הריווח מעליו ומתחתיו, כדי שהשדה הפעיל לא יישב מתחתיו. */
const PROFILE_SAVE_KEYBOARD_CLEARANCE = APP_LAYOUT.cardStackGap + 52 + APP_LAYOUT.cardStackGap;

export default function EditProfileScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender>('');
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

  const screenStyle = [styles.root, { backgroundColor: tokens.colors.background.primary }];

  if (isLoading) {
    return (
      <RNSafeAreaView style={screenStyle} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title="עריכת פרופיל"
          onBack={() => {
            void HapticFeedback.impactLight();
            navigation.goBack();
          }}
        />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={tokens.colors.text.secondary} />
          <Text
            style={[
              settingsMetaType,
              styles.loadingText,
              { color: tokens.colors.text.secondary },
            ]}
          >
            טוען פרופיל...
          </Text>
        </View>
      </RNSafeAreaView>
    );
  }

  const fieldText = [formFieldInputStyle(), { color: tokens.colors.text.primary }];

  return (
    <RNSafeAreaView style={screenStyle} edges={['top']}>
      <ChatSubScreenHeader
        title="עריכת פרופיל"
        onBack={() => {
          void HapticFeedback.impactLight();
          navigation.goBack();
        }}
      />

      <View style={styles.flex}>
        <KeyboardAwareScrollView
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={PROFILE_SAVE_KEYBOARD_CLEARANCE}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.avatarBlock}>
            <Pressable
              onPress={() => {
                if (isProcessingImage) return;
                void HapticFeedback.impactLight();
                void handleImageFromGallery();
              }}
              style={styles.avatarWrap}
              accessibilityRole="button"
              accessibilityLabel="בחירת תמונה מהגלריה"
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: tokens.colors.background.tertiary },
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
                  <ActivityIndicator size="small" color={tokens.colors.text.secondary} />
                ) : (
                  <UserRound size={44} color={tokens.colors.text.primary} strokeWidth={1.75} />
                )}
              </View>
              <View
                style={[
                  styles.cameraBadge,
                  {
                    backgroundColor: tokens.colors.background.cardSolid,
                    borderColor: tokens.colors.background.primary,
                  },
                ]}
              >
                <Camera size={18} color={tokens.colors.text.primary} strokeWidth={2} />
              </View>
            </Pressable>
            {isProcessingImage ? (
              <Text style={[settingsMetaType, styles.processingText, { color: tokens.colors.text.secondary }]}>
                מעבד תמונה...
              </Text>
            ) : null}
          </View>

          <ProfileEditField label="שם תצוגה" focused={focusedField === 'displayName'}>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="הזן שם תצוגה"
              placeholderTextColor={tokens.colors.text.muted}
              onFocus={() => setFocusedField('displayName')}
              onBlur={() => setFocusedField(null)}
              style={fieldText}
            />
          </ProfileEditField>

          <ProfileEditField label="טלפון" focused={focusedField === 'phone'}>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="הזן מספר טלפון"
              placeholderTextColor={tokens.colors.text.muted}
              keyboardType="phone-pad"
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
              style={fieldText}
            />
          </ProfileEditField>

          <View style={styles.fieldBlock}>
            <Text
              style={[
                formFieldLabelStyle({ tokens, focused: false, error: false }),
                styles.fieldLabel,
                { color: tokens.colors.text.secondary },
              ]}
            >
              מגדר
            </Text>
            <View style={styles.genderRow}>
              {([
                { value: 'male' as const, label: 'זכר', icon: 'male' as const },
                { value: 'female' as const, label: 'נקבה', icon: 'female' as const },
              ]).map((opt) => {
                const selected = gender === opt.value;
                const foreground = selected
                  ? tokens.colors.text.inverse
                  : tokens.colors.text.primary;
                return (
                  <View
                    key={opt.value}
                    style={[
                      styles.genderSlot,
                      {
                        backgroundColor: selected
                          ? tokens.colors.text.primary
                          : tokens.colors.background.cardSolid,
                        borderRadius: tokens.borderRadius.full,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        if (!selected) void HapticFeedback.selection();
                        setGender(opt.value);
                      }}
                      style={({ pressed }) => [{ width: '100%', opacity: pressed ? 0.85 : 1 }]}
                    >
                      <View style={styles.genderButton}>
                      <View style={styles.genderContent}>
                        <View style={styles.genderIcon}>
                          <GenderGlyph name={opt.icon} color={foreground} />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            settingsButtonLabelStyle,
                            styles.genderLabel,
                            { color: foreground },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </View>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>

          <ProfileEditField label="אימייל" helper="לא ניתן לשנות את כתובת האימייל" isLast>
            <Text
              style={[formFieldInputStyle(), { color: tokens.colors.text.secondary }]}
              numberOfLines={1}
            >
              {user?.email || '—'}
            </Text>
          </ProfileEditField>
        </KeyboardAwareScrollView>

        <KeyboardStickyView
          collapsable={false}
          offset={{
            closed: 0,
            opened: Math.max(insets.bottom - APP_LAYOUT.cardStackGap, 0),
          }}
          style={[
            styles.saveBar,
            {
              direction: 'ltr',
              backgroundColor: tokens.colors.background.primary,
              paddingBottom: Math.max(insets.bottom, APP_LAYOUT.cardStackGap),
            },
          ]}
        >
          <UIButton
            title="שמור שינויים"
            variant="primary"
            fullWidth
            loading={isSaving}
            disabled={isSaving}
            style={{ backgroundColor: tokens.colors.text.primary }}
            textStyle={{ color: tokens.colors.text.inverse }}
            onPress={() => {
              void handleSave();
            }}
          />
        </KeyboardStickyView>
        <AndroidProfileKeyboardMode />
      </View>
    </RNSafeAreaView>
  );
}

function AndroidProfileKeyboardMode() {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      try {
        KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING);
      } catch {
        /* אין מודול נייטיב בטסטים */
      }
      return () => {
        restoreAndroidSoftInputIfUnlocked();
      };
    }, []),
  );
  return null;
}

function ProfileEditField({
  label,
  focused = false,
  helper,
  isLast = false,
  onPress,
  children,
}: {
  label: string;
  focused?: boolean;
  helper?: string;
  isLast?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const tokens = useDesignTokens();
  const shellStyle = [
    styles.shell,
    formFieldShellStyle({ tokens, focused, error: false }),
    {
      borderRadius: tokens.borderRadius.full,
      backgroundColor: focused
        ? tokens.colors.background.tertiary
        : tokens.colors.background.cardSolid,
    },
  ];

  return (
    <View style={[styles.fieldBlock, isLast ? styles.fieldBlockLast : null]}>
      <Text
        style={[
          formFieldLabelStyle({ tokens, focused, error: false }),
          styles.fieldLabel,
          { color: tokens.colors.text.secondary },
        ]}
      >
        {label}
      </Text>
      {onPress ? (
        <Pressable onPress={onPress} style={shellStyle}>
          {children}
        </Pressable>
      ) : (
        <View style={shellStyle}>{children}</View>
      )}
      {helper ? (
        <Text style={[appFormFieldHelperStyle, styles.fieldHelper, { color: tokens.colors.text.muted }]}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
    textAlign: 'center',
    marginTop: APP_LAYOUT.cardStackGap,
  },
  scrollContent: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: APP_LAYOUT.sectionHeaderToContent,
    paddingBottom: APP_LAYOUT.componentGap,
  },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: APP_LAYOUT.componentGap,
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    direction: 'ltr',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: CAMERA_BADGE,
    height: CAMERA_BADGE,
    borderRadius: CAMERA_BADGE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    textAlign: 'center',
    marginTop: APP_LAYOUT.cardStackGap,
  },
  genderRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    gap: APP_LAYOUT.cardStackGap,
  },
  genderSlot: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    overflow: 'hidden',
  },
  genderButton: {
    width: '100%',
    minHeight: 52,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderContent: {
    alignSelf: 'center',
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  genderIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderLabel: {
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'center',
  },
  fieldBlock: {
    alignSelf: 'stretch',
    width: '100%',
    alignItems: 'stretch',
    marginBottom: APP_LAYOUT.componentGap,
  },
  fieldBlockLast: {
    marginBottom: 0,
  },
  fieldLabel: {
    alignSelf: 'stretch',
    width: '100%',
    textAlign: 'right',
    marginBottom: 8,
    fontSize: APP_TYPE.groupLabel.fontSize,
    fontWeight: APP_TYPE.groupLabel.fontWeight,
    lineHeight: APP_TYPE.groupLabel.lineHeight,
  },
  fieldHelper: {
    alignSelf: 'stretch',
    width: '100%',
    textAlign: 'right',
  },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: APP_LAYOUT.cardPadding,
    minHeight: 52,
    gap: APP_LAYOUT.cardStackGap,
  },
  saveBar: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: APP_LAYOUT.cardStackGap,
  },
});
