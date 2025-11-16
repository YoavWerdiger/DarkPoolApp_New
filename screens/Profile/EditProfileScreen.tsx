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
  SafeAreaView
} from 'react-native';
import { 
  Camera, 
  User, 
  ArrowLeft,
  Check,
  X,
  ChevronDown
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { mediaService } from '../../services/mediaService';
import { DesignTokens } from '../../components/ui/DesignTokens';

export default function EditProfileScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const { theme } = useTheme();
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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={{ color: theme.textSecondary, fontSize: 16, marginTop: 16 }}>טוען...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ backgroundColor: theme.cardBackground }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: theme.cardBackground,
          borderBottomWidth: 1,
          borderBottomColor: theme.border
        }}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={{
              width: 36,
              height: 36,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 18,
              backgroundColor: theme.isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'
            }}
          >
            <ArrowLeft size={20} color={theme.textPrimary} strokeWidth={2} />
          </TouchableOpacity>

        <Text style={{ 
            flex: 1,
            textAlign: 'center',
            fontSize: 20,
            fontWeight: '700',
            color: theme.textPrimary,
            marginRight: 36
          }}>
            עריכת פרופיל
        </Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
          {/* Main Card */}
          <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
            <View style={{
              backgroundColor: theme.cardBackground,
              borderRadius: 16,
              padding: 24,
              gap: 24
            }}>
              {/* Avatar Section */}
              <View style={{
                alignItems: 'center',
                paddingVertical: 8
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
                      <User size={60} color={theme.textTertiary} strokeWidth={1.5} />
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
                  fontSize: 14,
                  color: theme.textTertiary,
                  marginTop: 16,
                  textAlign: 'center'
                }}>
                  לחץ לשינוי תמונת פרופיל
                </Text>
              </View>

              {/* Divider */}
              <View style={{
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.1)',
                marginVertical: 8
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
              <View>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.textPrimary,
                  marginBottom: 8,
                  textAlign: 'right'
                }}>
                  אימייל
                </Text>
                <View style={{
                  backgroundColor: theme.background,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                  opacity: 0.6
                }}>
                  <Text style={{
                    fontSize: 16,
                    color: theme.textTertiary,
                    textAlign: 'right'
                  }}>
                    {user?.email || ''}
                  </Text>
                </View>
                <Text style={{
                  fontSize: 12,
                  color: theme.textTertiary,
                  marginTop: 8,
                  textAlign: 'right'
                }}>
                  לא ניתן לשנות את כתובת האימייל
                </Text>
              </View>

              {/* Divider */}
              <View style={{
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.1)',
                marginVertical: 8
              }} />

              {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={{
                  backgroundColor: 'rgba(5, 209, 87, 0.7)',
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={DesignTokens.colors.text.primary} />
                ) : (
                    <Text style={{ 
                    fontSize: 16,
                    fontWeight: '700',
                    color: DesignTokens.colors.text.primary
                    }}>
                      שמור שינויים
                    </Text>
                )}
            </TouchableOpacity>
            </View>
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
          <View style={{
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            padding: 24,
            width: '80%',
            maxWidth: 300
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: theme.textPrimary,
              marginBottom: 20,
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
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderRadius: 12,
                backgroundColor: gender === 'male' ? 'rgba(5, 209, 87, 0.15)' : theme.background,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: gender === 'male' ? DesignTokens.colors.primary.main : theme.border
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.textPrimary,
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
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderRadius: 12,
                backgroundColor: gender === 'female' ? 'rgba(5, 209, 87, 0.15)' : theme.background,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: gender === 'female' ? DesignTokens.colors.primary.main : theme.border
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.textPrimary,
                textAlign: 'right'
              }}>
                נקבה
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowGenderPicker(false)}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 12,
                backgroundColor: theme.background,
                marginTop: 8
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.textSecondary,
                textAlign: 'center'
              }}>
                ביטול
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

