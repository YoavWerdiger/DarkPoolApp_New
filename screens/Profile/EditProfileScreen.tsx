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
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

export default function EditProfileScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const { theme } = useTheme();
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const mainTabsHeight = useMainTabsHeight();
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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ 
                paddingTop: DesignTokens.spacing.md
              }}
            >
            {/* Avatar Card - נפרד */}
            <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginBottom: DesignTokens.spacing.md }}>
              <UICard 
                variant="blur"
                padding="lg"
              >
                {/* Avatar Section */}
                <View style={{
                  alignItems: 'center',
                  paddingVertical: DesignTokens.spacing.md
                }}>
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
                      <Camera size={18} color="#000000" strokeWidth={2.5} />
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

            {/* Form Fields Card - נפרד */}
            <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginBottom: DesignTokens.spacing.md }}>
              <UICard 
                variant="blur"
                padding="lg"
              >

                {/* Display Name */}
                <View style={{ marginBottom: DesignTokens.spacing.lg }}>
                  <Text style={{ 
                    fontSize: DesignTokens.typography.fontSize.sm,
                    fontWeight: DesignTokens.typography.fontWeight.semibold as any, 
                    color: DesignTokens.colors.text.primary,
                    marginBottom: DesignTokens.spacing.sm,
                    textAlign: 'right'
                  }}>
                    שם תצוגה
                  </Text>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="הזן שם תצוגה"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: DesignTokens.borderRadius.md,
                      paddingHorizontal: DesignTokens.spacing.md,
                      paddingVertical: DesignTokens.spacing.sm + 4,
                      fontSize: DesignTokens.typography.fontSize.base,
                      color: DesignTokens.colors.text.primary,
                      textAlign: 'right',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      minHeight: 48
                    }}
                  />
                </View>

                {/* Phone */}
                <View style={{ marginBottom: DesignTokens.spacing.lg }}>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.sm,
                    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                    color: DesignTokens.colors.text.primary,
                    marginBottom: DesignTokens.spacing.sm,
                    textAlign: 'right'
                  }}>
                    טלפון
                  </Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="הזן מספר טלפון"
                    placeholderTextColor={DesignTokens.colors.text.tertiary}
                    keyboardType="phone-pad"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: DesignTokens.borderRadius.md,
                      paddingHorizontal: DesignTokens.spacing.md,
                      paddingVertical: DesignTokens.spacing.sm + 4,
                      fontSize: DesignTokens.typography.fontSize.base,
                      color: DesignTokens.colors.text.primary,
                      textAlign: 'right',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      minHeight: 48
                    }}
                  />
                </View>

                {/* Gender */}
                <View style={{ marginBottom: DesignTokens.spacing.lg }}>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.sm,
                    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                    color: DesignTokens.colors.text.primary,
                    marginBottom: DesignTokens.spacing.sm,
                    textAlign: 'right'
                  }}>
                    מין
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowGenderPicker(true)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: DesignTokens.borderRadius.md,
                      paddingHorizontal: DesignTokens.spacing.md,
                      paddingVertical: DesignTokens.spacing.sm + 4,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      minHeight: 48
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

                {/* Email (Read Only) */}
                <View>
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
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    borderRadius: DesignTokens.borderRadius.md,
                    paddingHorizontal: DesignTokens.spacing.md,
                    paddingVertical: DesignTokens.spacing.sm + 4,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    minHeight: 48,
                    justifyContent: 'center',
                    opacity: 0.8
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
              </UICard>
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
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={{ 
                    fontSize: DesignTokens.typography.fontSize.base + 1,
                    fontWeight: DesignTokens.typography.fontWeight.bold as any,
                    color: '#000000',
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

