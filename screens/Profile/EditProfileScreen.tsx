import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  Pressable, 
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet
} from 'react-native';
import { 
  Camera, 
  User, 
  ArrowRight,
  Check,
  X,
  ChevronDown
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { mediaService } from '../../services/mediaService';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';

export default function EditProfileScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const { theme } = useTheme();
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
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
      console.error('Error loading user data:', error);
      setIsLoading(false);
    }
  };

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('שגיאה', 'נדרשת הרשאה לגישה לתמונות');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('שגיאה', 'שגיאה בבחירת תמונה');
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('שגיאה', 'נא להזין שם תצוגה');
      return;
    }

    setIsSaving(true);

    try {
      if (!user) {
        Alert.alert('שגיאה', 'לא נמצא משתמש מחובר');
        setIsSaving(false);
        return;
      }

      let profilePictureUrl = profileImage;

      if (profileImage && (profileImage.startsWith('file:') || profileImage.startsWith('assets:'))) {
        const upload = await mediaService.uploadMedia(profileImage, 'image');
        if (upload.success) {
          profilePictureUrl = upload.url || null;
        }
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
        Alert.alert('שגיאה', 'שגיאה בעדכון הפרופיל');
        return;
      }
      
      Alert.alert('הצלחה', 'הפרופיל נשמר בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() }
      ]);
      
    } catch (error) {
      setIsSaving(false);
      console.error('Error saving profile:', error);
      Alert.alert('שגיאה', 'שגיאה בעדכון הפרופיל');
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
          locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
            <Text style={{ color: DesignTokens.colors.text.secondary, fontSize: 16, marginTop: 16 }}>טוען...</Text>
          </View>
        </RNSafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* רקע עם גרדיאנט ירוק כהה-שחור אנכי */}
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header עם blur */}
        <View style={{ paddingTop: 0 + DesignTokens.spacing.md, paddingHorizontal: DesignTokens.spacing.lg }}>
          <UICard 
            variant="blur"
            padding="sm"
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: DesignTokens.spacing.md,
              minHeight: 44,
            }}>
              <Text style={{ 
                flex: 1,
                textAlign: 'center',
                fontSize: DesignTokens.typography.fontSize.lg,
                fontWeight: DesignTokens.typography.fontWeight.bold as any,
                color: DesignTokens.colors.text.primary,
                marginLeft: 36
              }}>
                עריכת פרופיל
              </Text>

              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
                style={{
                  width: 36,
                  height: 36,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 18,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }}
              >
                <ArrowRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </UICard>
        </View>

        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Main Card עם blur */}
            <View style={{ paddingHorizontal: DesignTokens.spacing.lg, paddingTop: DesignTokens.spacing.lg }}>
              <UICard 
                variant="blur"
                padding="lg"
              >
              {/* Avatar Section */}
              <View style={{
                alignItems: 'center',
                paddingVertical: DesignTokens.spacing.lg,
                marginBottom: DesignTokens.spacing.lg
              }}>
                <TouchableOpacity 
                  onPress={handleImagePicker}
                  style={{ position: 'relative' }}
                >
                  <View style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    borderWidth: 3,
                    borderColor: DesignTokens.colors.primary.main
                  }}>
                    {profileImage ? (
                      <Image 
                        source={{ uri: profileImage }} 
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <User size={60} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
                    )}
                  </View>
                  
                  <View style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: DesignTokens.colors.primary.main,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 4,
                    borderColor: DesignTokens.colors.background.secondary
                  }}>
                    <Camera size={20} color={DesignTokens.colors.text.primary} strokeWidth={2.5} />
                  </View>
                </TouchableOpacity>

                <Text style={{
                  fontSize: DesignTokens.typography.fontSize.sm,
                  color: DesignTokens.colors.text.tertiary,
                  marginTop: DesignTokens.spacing.md,
                  textAlign: 'center'
                }}>
                  לחץ לשינוי תמונת פרופיל
                </Text>
              </View>

              {/* Divider */}
              <View style={{
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.1)',
                marginVertical: DesignTokens.spacing.lg
              }} />

              {/* Display Name */}
              <View>
            <Text style={{ 
                  fontSize: 14,
              fontWeight: '600', 
                  color: theme.textPrimary,
                  marginBottom: 8,
                  textAlign: 'right'
            }}>
                  שם תצוגה
            </Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="הזן שם תצוגה"
                  placeholderTextColor={theme.textTertiary}
              style={{
                    backgroundColor: theme.background,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    fontSize: 16,
                    color: theme.textPrimary,
                    textAlign: 'right',
                borderWidth: 1,
                    borderColor: theme.border
                  }}
                />
              </View>

              {/* Phone */}
              <View>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.textPrimary,
                  marginBottom: 8,
                  textAlign: 'right'
                }}>
                  טלפון
                </Text>
              <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="הזן מספר טלפון"
                  placeholderTextColor={theme.textTertiary}
                  keyboardType="phone-pad"
                style={{
                    backgroundColor: theme.background,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                  fontSize: 16,
                    color: theme.textPrimary,
                    textAlign: 'right',
                    borderWidth: 1,
                    borderColor: theme.border
                  }}
                />
              </View>

              {/* Gender */}
              <View>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.textPrimary,
                  marginBottom: 8,
                  textAlign: 'right'
                }}>
                  מין
                </Text>
                <TouchableOpacity
                  onPress={() => setShowGenderPicker(true)}
                  style={{
                    backgroundColor: theme.background,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <ChevronDown size={20} color={theme.textTertiary} strokeWidth={2} />
                  <Text style={{
                    fontSize: 16,
                    color: gender ? theme.textPrimary : theme.textTertiary,
                    textAlign: 'right',
                    flex: 1
                  }}>
                    {gender === 'male' ? 'זכר' : gender === 'female' ? 'נקבה' : 'בחר מין'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Email (Read Only) */}
              <View style={{ marginBottom: DesignTokens.spacing.lg }}>
                <Text style={{
                  fontSize: DesignTokens.typography.fontSize.sm,
                  fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                  color: DesignTokens.colors.text.primary,
                  marginBottom: DesignTokens.spacing.sm,
                  textAlign: 'right'
                }}>
                  אימייל
                </Text>
                <View style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: DesignTokens.borderRadius.lg,
                  paddingHorizontal: DesignTokens.spacing.md,
                  paddingVertical: DesignTokens.spacing.md,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  opacity: 0.7,
                  minHeight: 48,
                  justifyContent: 'center'
                }}>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.base,
                    color: DesignTokens.colors.text.tertiary,
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

              {/* Divider */}
              <View style={{
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.1)',
                marginVertical: DesignTokens.spacing.lg
              }} />

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                style={{
                  backgroundColor: DesignTokens.colors.primary.main,
                  paddingVertical: DesignTokens.spacing.md,
                  paddingHorizontal: DesignTokens.spacing.lg,
                  borderRadius: DesignTokens.borderRadius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isSaving ? 0.6 : 1,
                  minHeight: 52,
                  ...DesignTokens.shadows.md
                }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={DesignTokens.colors.text.primary} />
                ) : (
                  <Text style={{ 
                    fontSize: DesignTokens.typography.fontSize.base,
                    fontWeight: DesignTokens.typography.fontWeight.bold as any,
                    color: DesignTokens.colors.text.primary
                  }}>
                    שמור שינויים
                  </Text>
                )}
              </TouchableOpacity>
              </UICard>
            </View>
          </ScrollView>
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
            variant="blur"
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

