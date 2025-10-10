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
  Linking,
  Image
} from 'react-native';
import { 
  Camera, 
  User, 
  X,
  Check
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { mediaService } from '../../services/mediaService';

export default function EditProfileScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
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
        setDisplayName(userData.full_name || userData.display_name || user.email?.split('@')[0] || '');
        setPhone(userData.phone || '');
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
        Alert.alert(
          'הרשאה נדרשת', 
          'אנא אשר גישה לגלריית התמונות',
          [
            { text: 'ביטול', style: 'cancel' },
            { text: 'הגדרות', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('שגיאה', 'לא ניתן לבחור תמונה');
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

      // העלאת תמונה אם צריך
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
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#666', fontSize: 16 }}>טוען...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#121212' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1E1E1E',
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <TouchableOpacity 
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Text style={{ color: '#666', fontSize: 16 }}>שומר...</Text>
          ) : (
            <Check size={24} color="#00E654" strokeWidth={2} />
          )}
        </TouchableOpacity>
        
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 18, 
          fontWeight: '600',
          writingDirection: 'rtl'
        }}>
          עריכת פרופיל
        </Text>
        
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={24} color="#666" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Avatar Section */}
        <View style={{
          paddingVertical: 40,
          alignItems: 'center'
        }}>
          <TouchableOpacity 
            onPress={handleImagePicker}
            style={{ position: 'relative' }}
          >
            <View style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: '#1E1E1E',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#2A2A2A',
              overflow: 'hidden'
            }}>
              {profileImage ? (
                <Image 
                  source={{ uri: profileImage }} 
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <User size={40} color="#666" strokeWidth={1.5} />
              )}
            </View>

            {/* Camera Badge */}
            <View style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#00E654',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 3,
              borderColor: '#121212'
            }}>
              <Camera size={16} color="#000" strokeWidth={2} />
            </View>
          </TouchableOpacity>

          <Text style={{ 
            color: '#666', 
            fontSize: 14,
            marginTop: 12
          }}>
            לחץ לשינוי תמונה
          </Text>
        </View>

        {/* Form Fields */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{
            backgroundColor: '#181818',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            overflow: 'hidden'
          }}>
            {/* Display Name */}
            <View style={{ 
              paddingVertical: 16,
              paddingHorizontal: 20,
              borderBottomWidth: 0.5,
              borderBottomColor: 'rgba(255,255,255,0.08)'
            }}>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '500',
                marginBottom: 8,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}>
                שם תצוגה
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#252525',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  color: '#FFFFFF',
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  textAlign: 'right',
                  writingDirection: 'rtl'
                }}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="הזן שם תצוגה"
                placeholderTextColor="#666"
                maxLength={25}
              />
              <Text style={{ 
                color: '#666', 
                fontSize: 12,
                marginTop: 4,
                textAlign: 'left'
              }}>
                {displayName.length}/25
              </Text>
            </View>

            {/* Email (Read Only) */}
            <View style={{ 
              paddingVertical: 16,
              paddingHorizontal: 20,
              borderBottomWidth: 0.5,
              borderBottomColor: 'rgba(255,255,255,0.08)'
            }}>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '500',
                marginBottom: 8,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}>
                כתובת מייל
              </Text>
              <View style={{
                backgroundColor: '#252525',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#2A2A2A',
                opacity: 0.5
              }}>
                <TextInput
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    color: '#666',
                    fontSize: 16,
                    textAlign: 'right',
                    writingDirection: 'rtl'
                  }}
                  value={user?.email || ''}
                  editable={false}
                />
              </View>
              <Text style={{ 
                color: '#666', 
                fontSize: 12,
                marginTop: 4,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}>
                לא ניתן לשנות
              </Text>
            </View>

            {/* Phone */}
            <View style={{ 
              paddingVertical: 16,
              paddingHorizontal: 20
            }}>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '500',
                marginBottom: 8,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}>
                מספר טלפון
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#252525',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  color: '#FFFFFF',
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  textAlign: 'right',
                  writingDirection: 'rtl'
                }}
                value={phone}
                onChangeText={setPhone}
                placeholder="050-123-4567"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
