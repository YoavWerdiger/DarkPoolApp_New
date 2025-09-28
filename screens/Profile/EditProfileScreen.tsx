import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  TextInput, 
  Alert, 
  Image,
  SafeAreaView 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeft, User, Camera } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';

interface EditProfileScreenProps {
  navigation: any;
}

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { user } = useAuth();
  
  const [profileData, setProfileData] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || '',
    profileImage: user?.profile_picture || null,
  });

  const [isLoading, setIsLoading] = useState(false);

  // פונקציה לבחירת תמונה
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfileData(prev => ({ ...prev, profileImage: result.assets[0].uri }));
    }
  };

  // פונקציה לשמירת השינויים
  const handleSave = async () => {
    setIsLoading(true);
    try {
      // כאן תהיה הלוגיקה לשמירה בשרת
      await new Promise(resolve => setTimeout(resolve, 1000)); // סימולציה
      Alert.alert('הצלחה', 'הפרופיל נשמר בהצלחה!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בשמירת הפרופיל');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* גרדיאנט רקע */}
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.08)', 'rgba(0, 230, 84, 0.03)', 'rgba(0, 230, 84, 0.05)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
      />
      
      {/* Header */}
      <View style={{
        backgroundColor: '#2A2A2A',
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#1A1A1A',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)'
            }}
          >
            <ArrowLeft size={20} color="#fff" strokeWidth={2} />
          </Pressable>
          
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
            עריכת פרופיל
          </Text>
          
          <Pressable
            onPress={handleSave}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#666' : '#00E654',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              opacity: isLoading ? 0.7 : 1
            }}
          >
            <Text style={{ color: isLoading ? '#ccc' : '#000', fontSize: 14, fontWeight: 'bold' }}>
              {isLoading ? 'שומר...' : 'שמור'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* תמונת פרופיל */}
        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
          <Pressable onPress={pickImage} style={{ position: 'relative' }}>
            <View style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: '#1A1A1A',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 3,
              borderColor: '#00E654',
              overflow: 'hidden'
            }}>
              {profileData.profileImage ? (
                <Image 
                  source={{ uri: profileData.profileImage }} 
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <User size={60} color="#00E654" strokeWidth={2} />
              )}
            </View>
            
            {/* כפתור עריכה */}
            <View style={{
              position: 'absolute',
              bottom: 5,
              right: 5,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#00E654',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#2A2A2A'
            }}>
              <Camera size={16} color="#000" strokeWidth={2} />
            </View>
          </Pressable>
          
          <Text style={{ color: '#999', fontSize: 14, marginTop: 12, textAlign: 'center' }}>
            לחץ כדי לשנות תמונת פרופיל
          </Text>
        </View>

        {/* טפסי עריכה */}
        <View style={{ paddingHorizontal: 20 }}>
          {/* פרטים אישיים */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              פרטים אישיים
            </Text>
            
            {/* שם מלא */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>שם מלא</Text>
              <TextInput
                value={profileData.fullName}
                onChangeText={(text) => setProfileData(prev => ({ ...prev, fullName: text }))}
                style={{
                  backgroundColor: '#2A2A2A',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 16,
                  color: '#fff',
                  fontSize: 16
                }}
                placeholderTextColor="#666"
                placeholder="הכנס שם מלא"
              />
            </View>

            {/* אימייל */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>כתובת אימייל</Text>
              <TextInput
                value={profileData.email}
                onChangeText={(text) => setProfileData(prev => ({ ...prev, email: text }))}
                style={{
                  backgroundColor: '#2A2A2A',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 16,
                  color: '#fff',
                  fontSize: 16
                }}
                placeholderTextColor="#666"
                placeholder="הכנס כתובת אימייל"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* טלפון */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>מספר טלפון</Text>
              <TextInput
                value={profileData.phone}
                onChangeText={(text) => setProfileData(prev => ({ ...prev, phone: text }))}
                style={{
                  backgroundColor: '#2A2A2A',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 16,
                  color: '#fff',
                  fontSize: 16
                }}
                placeholderTextColor="#666"
                placeholder="הכנס מספר טלפון"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* מידע נוסף */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
              מידע נוסף
            </Text>
            
            {/* ביוגרפיה */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>ביוגרפיה</Text>
              <TextInput
                value={profileData.bio}
                onChangeText={(text) => setProfileData(prev => ({ ...prev, bio: text }))}
                style={{
                  backgroundColor: '#2A2A2A',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 16,
                  color: '#fff',
                  fontSize: 16,
                  height: 80,
                  textAlignVertical: 'top'
                }}
                placeholderTextColor="#666"
                placeholder="ספר על עצמך..."
                multiline
                numberOfLines={3}
              />
            </View>

            {/* מיקום */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>מיקום</Text>
              <TextInput
                value={profileData.location}
                onChangeText={(text) => setProfileData(prev => ({ ...prev, location: text }))}
                style={{
                  backgroundColor: '#2A2A2A',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 16,
                  color: '#fff',
                  fontSize: 16
                }}
                placeholderTextColor="#666"
                placeholder="עיר, מדינה"
              />
            </View>

            {/* אתר אינטרנט */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#999', fontSize: 14, marginBottom: 8 }}>אתר אינטרנט</Text>
              <TextInput
                value={profileData.website}
                onChangeText={(text) => setProfileData(prev => ({ ...prev, website: text }))}
                style={{
                  backgroundColor: '#2A2A2A',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: 16,
                  color: '#fff',
                  fontSize: 16
                }}
                placeholderTextColor="#666"
                placeholder="https://example.com"
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* כפתורי פעולה */}
          <View style={{ marginBottom: 40 }}>
            <Pressable
              onPress={handleSave}
              disabled={isLoading}
              style={{
                backgroundColor: '#00E654',
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 12,
                opacity: isLoading ? 0.7 : 1
              }}
            >
              <Text style={{ color: '#000', fontSize: 16, fontWeight: 'bold' }}>
                {isLoading ? 'שומר שינויים...' : 'שמור שינויים'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.goBack()}
              style={{
                backgroundColor: 'transparent',
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.2)'
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>
                ביטול
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

