import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import {
  Camera,
  User,
  Check,
  X,
  ChevronDown,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { mediaService } from '../../services/mediaService';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import OnboardingInput from '../../components/onboarding/OnboardingInput';

export default function EditProfileScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const { theme } = useTheme();
  const DesignTokens = useDesignTokens();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    try {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (userData) {
        setDisplayName(userData.full_name || '');
        setPhone(userData.phone || '');
        setGender(userData.gender || '');
        setProfileImage(userData.profile_picture || null);
      }
      
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
    }
  };

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        legacyAlert('שגיאה', 'נדרשת הרשאה לגישה לתמונות');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
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

      let profilePictureUrl: string | null = profileImage;

      const isRemoteImage =
        typeof profileImage === 'string' && /^https?:\/\//i.test(profileImage);
      if (profileImage && !isRemoteImage) {
        const upload = await mediaService.uploadMedia(profileImage, 'image');
        if (!upload.success) {
          setIsSaving(false);
          legacyAlert('שגיאה', upload.error || 'העלאת תמונת הפרופיל נכשלה. נסה שוב או בחר תמונה אחרת.');
          return;
        }
        profilePictureUrl = upload.url ?? null;
      }

      const { error } = await updateProfile({
        id: user.id,
        full_name: displayName.trim(),
        phone: phone.trim(),
        gender: gender || undefined,
        profile_picture: profilePictureUrl || undefined,
      });

      setIsSaving(false);
      
      if (error) {
        legacyAlert('שגיאה', error);
        return;
      }
      
      legacyAlert('הצלחה', 'הפרופיל נשמר בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() }
      ]);
      
    } catch (error: unknown) {
      setIsSaving(false);
      const msg = error instanceof Error ? error.message : 'שגיאה בעדכון הפרופיל';
      legacyAlert('שגיאה', msg);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={{ color: DesignTokens.colors.text.secondary, fontSize: 16, marginTop: 16 }}>טוען...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title="עריכת פרופיל" onBack={() => navigation.goBack()} />

        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ 
                paddingTop: DesignTokens.spacing.md
              }}
            >
            <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginBottom: DesignTokens.spacing.md }}>
              <UICard
                variant="glass"
                glassIntensity="light"
                padding="lg"
                style={{
                  borderRadius: DesignTokens.borderRadius.lg,
                }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    paddingVertical: DesignTokens.spacing.sm,
                  }}
                >
                  <TouchableOpacity 
                    onPress={handleImagePicker}
                    style={{ position: 'relative' }}
                    activeOpacity={0.8}
                  >
                    <View style={{
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      backgroundColor: 'rgba(5, 209, 87, 0.1)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: `${DesignTokens.colors.primary.main}60`,
                      ...DesignTokens.shadows.greenGlow
                    }}>
                      {profileImage ? (
                        <Image 
                          source={{ uri: profileImage }} 
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        <User size={50} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                      )}
                    </View>
                    
                    <View style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: DesignTokens.colors.primary.main,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 3,
                      borderColor: 'rgba(0, 0, 0, 0.3)',
                      ...DesignTokens.shadows.md
                    }}>
                      <Camera size={18} color={DesignTokens.colors.text.inverse} strokeWidth={2.5} />
                    </View>
                  </TouchableOpacity>

                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.xs,
                    color: DesignTokens.colors.text.tertiary,
                    marginTop: DesignTokens.spacing.sm,
                    textAlign: 'center'
                  }}>
                    לחץ לשינוי תמונת פרופיל
                  </Text>
                </View>
              </UICard>
            </View>

            {/* Form Fields - עיצוב כמו דף הכניסה (OnboardingInput) */}
            <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginBottom: DesignTokens.spacing.md }}>
              {/* Display Name */}
              <OnboardingInput
                label="שם תצוגה"
                icon="person-outline"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="הזן שם תצוגה"
              />

              {/* Phone */}
              <OnboardingInput
                label="טלפון"
                icon="call-outline"
                value={phone}
                onChangeText={setPhone}
                placeholder="הזן מספר טלפון"
                keyboardType="phone-pad"
              />

                {/* Gender - עיצוב כמו OnboardingInput */}
                <View style={{ marginBottom: 18 }}>
                  <Text style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 13,
                    fontWeight: '600',
                    marginBottom: 8,
                    textAlign: 'right'
                  }}>
                    מין
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowGenderPicker(true)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: 'rgba(255,255,255,0.1)',
                      paddingHorizontal: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      minHeight: 52
                    }}
                  >
                    <ChevronDown size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                    <Text style={{
                      fontSize: DesignTokens.typography.fontSize.base,
                      color: gender ? DesignTokens.colors.text.primary : DesignTokens.colors.text.tertiary,
                      textAlign: 'right',
                      flex: 1
                    }}>
                      {gender === 'male' ? 'זכר' : gender === 'female' ? 'נקבה' : 'בחר מין'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Email (Read Only) - עיצוב כמו OnboardingInput */}
                <View style={{ marginBottom: 18 }}>
                  <Text style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 13,
                    fontWeight: '600',
                    marginBottom: 8,
                    textAlign: 'right'
                  }}>
                    אימייל
                  </Text>
                  <View style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.1)',
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    minHeight: 52,
                    justifyContent: 'center'
                  }}>
                    <Text style={{
                      fontSize: 16,
                      color: 'rgba(255,255,255,0.7)',
                      textAlign: 'right'
                    }}>
                      {user?.email || ''}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.xs,
                    color: DesignTokens.colors.text.tertiary,
                    marginTop: DesignTokens.spacing.xs,
                    textAlign: 'right'
                  }}>
                    לא ניתן לשנות את כתובת האימייל
                  </Text>
                </View>
            </View>

            {/* Save Button - נפרד וצמוד למטה */}
            <View style={{ 
              paddingHorizontal: DesignTokens.spacing.lg, 
              marginTop: DesignTokens.spacing.md,
              marginBottom: DesignTokens.spacing.lg
            }}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.8}
                style={{
                  backgroundColor: DesignTokens.colors.primary.main,
                  paddingVertical: DesignTokens.spacing.md + 4,
                  paddingHorizontal: DesignTokens.spacing.lg,
                  borderRadius: DesignTokens.borderRadius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isSaving ? 0.6 : 1,
                  minHeight: 56,
                  ...DesignTokens.shadows.greenGlow,
                  shadowColor: DesignTokens.colors.primary.main,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 8
                }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={DesignTokens.colors.text.inverse} />
                ) : (
                  <Text style={{ 
                    fontSize: DesignTokens.typography.fontSize.base + 1,
                    fontWeight: DesignTokens.typography.fontWeight.bold as any,
                    color: DesignTokens.colors.text.inverse,
                    letterSpacing: DesignTokens.typography.letterSpacing.tight
                  }}>
                    שמור שינויים
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Gender Picker Modal */}
        {showGenderPicker && (
          <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <UICard
            variant="glass"
            glassIntensity="light"
            padding="lg"
            style={{
              width: '80%',
              maxWidth: 300
            }}
          >
            <Text style={{
              fontSize: DesignTokens.typography.fontSize.xl,
              fontWeight: DesignTokens.typography.fontWeight.bold as any,
              color: DesignTokens.colors.text.primary,
              marginBottom: DesignTokens.spacing.lg,
              textAlign: 'right'
            }}>
              בחר מין
            </Text>
            
            <TouchableOpacity
              onPress={() => {
                setGender('male');
                setShowGenderPicker(false);
              }}
              style={{
                paddingVertical: DesignTokens.spacing.md,
                paddingHorizontal: DesignTokens.spacing.lg,
                borderRadius: DesignTokens.borderRadius.lg,
                backgroundColor: gender === 'male' ? `${DesignTokens.colors.primary.main}20` : 'rgba(255, 255, 255, 0.05)',
                marginBottom: DesignTokens.spacing.sm,
                borderWidth: 1,
                borderColor: gender === 'male' ? DesignTokens.colors.primary.main : 'rgba(255, 255, 255, 0.1)',
                minHeight: 48,
                justifyContent: 'center'
              }}
            >
              <Text style={{
                fontSize: DesignTokens.typography.fontSize.base,
                fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                color: DesignTokens.colors.text.primary,
                textAlign: 'right'
              }}>
                זכר
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setGender('female');
                setShowGenderPicker(false);
              }}
              style={{
                paddingVertical: DesignTokens.spacing.md,
                paddingHorizontal: DesignTokens.spacing.lg,
                borderRadius: DesignTokens.borderRadius.lg,
                backgroundColor: gender === 'female' ? `${DesignTokens.colors.primary.main}20` : 'rgba(255, 255, 255, 0.05)',
                marginBottom: DesignTokens.spacing.sm,
                borderWidth: 1,
                borderColor: gender === 'female' ? DesignTokens.colors.primary.main : 'rgba(255, 255, 255, 0.1)',
                minHeight: 48,
                justifyContent: 'center'
              }}
            >
              <Text style={{
                fontSize: DesignTokens.typography.fontSize.base,
                fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                color: DesignTokens.colors.text.primary,
                textAlign: 'right'
              }}>
                נקבה
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowGenderPicker(false)}
              style={{
                paddingVertical: DesignTokens.spacing.sm,
                paddingHorizontal: DesignTokens.spacing.lg,
                borderRadius: DesignTokens.borderRadius.lg,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                marginTop: DesignTokens.spacing.sm,
                minHeight: 44,
                justifyContent: 'center'
              }}
            >
              <Text style={{
                fontSize: DesignTokens.typography.fontSize.base,
                fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                color: DesignTokens.colors.text.secondary,
                textAlign: 'center'
              }}>
                ביטול
              </Text>
            </TouchableOpacity>
          </UICard>
        </View>
        )}
      </RNSafeAreaView>
    </View>
  );
}

