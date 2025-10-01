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
    <View style={{ flex: 1, backgroundColor: '#181818' }}>
      {/* גרדיאנט רקע */}
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.05)', 'transparent', 'rgba(0, 230, 84, 0.03)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
      />
      
      {/* Header */}
      <LinearGradient
        colors={['#181818', '#1a1a1a', '#181818']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: 50,
          paddingBottom: 16,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.1)'
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#181818',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)'
            }}
          >
            <ArrowLeft size={20} color="#fff" strokeWidth={2} />
          </Pressable>
          
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', writingDirection: 'rtl' }}>
            עריכת פרופיל
          </Text>
          
          <LinearGradient
            colors={isLoading ? ['#666', '#555'] : ['#00E654', '#00D04B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              opacity: isLoading ? 0.7 : 1
            }}
          >
            <Pressable
              onPress={handleSave}
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              <Text style={{ color: isLoading ? '#ccc' : '#000', fontSize: 14, fontWeight: 'bold', writingDirection: 'rtl' }}>
                {isLoading ? 'שומר...' : 'שמור'}
              </Text>
            </Pressable>
          </LinearGradient>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* תמונת פרופיל */}
        <View style={{ 
          alignItems: 'center', 
          paddingVertical: 30,
          marginHorizontal: 20,
          borderRadius: 20,
          backgroundColor: 'rgba(0, 230, 84, 0.02)',
          borderWidth: 1,
          borderColor: 'rgba(0, 230, 84, 0.08)'
        }}>
          <Pressable onPress={pickImage} style={{ position: 'relative' }}>
            <LinearGradient
              colors={['#00E654', '#00D04B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                shadowColor: '#00E654',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 8
              }}
            >
              {profileData.profileImage ? (
                <Image 
                  source={{ uri: profileData.profileImage }} 
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <User size={60} color="#000" strokeWidth={2} />
              )}
            </LinearGradient>
            
            {/* כפתור עריכה עם גרדיאנט */}
            <LinearGradient
              colors={['#181818', '#1a1a1a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: 'absolute',
                bottom: 5,
                right: 5,
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: '#00E654'
              }}
            >
              <Camera size={16} color="#00E654" strokeWidth={2} />
            </LinearGradient>
          </Pressable>
          
          <Text style={{ color: '#999', fontSize: 14, marginTop: 12, textAlign: 'center', writingDirection: 'rtl' }}>
            לחץ כדי לשנות תמונת פרופיל
          </Text>
        </View>

        {/* טפסי עריכה */}
        <View style={{ paddingHorizontal: 20 }}>
          {/* פרטים אישיים */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, writingDirection: 'rtl' }}>
              פרטים אישיים
            </Text>
            
            {/* שם מלא */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#999', fontSize: 14, marginBottom: 8, writingDirection: 'rtl' }}>שם מלא</Text>
              <View style={{
                backgroundColor: '#181818',
                borderWidth: 1,
                borderColor: 'rgba(0, 230, 84, 0.1)',
                borderRadius: 12,
                overflow: 'hidden'
              }}>
                <TextInput
                  value={profileData.fullName}
                  onChangeText={(text) => setProfileData(prev => ({ ...prev, fullName: text }))}
                  style={{
                    padding: 16,
                    color: '#fff',
                    fontSize: 16,
                    textAlign: 'right'
                  }}
                  placeholderTextColor="#666"
                  placeholder="הכנס שם מלא"
                />
              </View>
            </View>

            {/* אימייל */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#999', fontSize: 14, marginBottom: 8, writingDirection: 'rtl' }}>כתובת אימייל</Text>
              <View style={{
                backgroundColor: '#181818',
                borderWidth: 1,
                borderColor: 'rgba(0, 230, 84, 0.1)',
                borderRadius: 12,
                overflow: 'hidden'
              }}>
                <TextInput
                  value={profileData.email}
                  onChangeText={(text) => setProfileData(prev => ({ ...prev, email: text }))}
                  style={{
                    padding: 16,
                    color: '#fff',
                    fontSize: 16,
                    textAlign: 'right'
                  }}
                  placeholderTextColor="#666"
                  placeholder="הכנס כתובת אימייל"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* טלפון */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#999', fontSize: 14, marginBottom: 8, writingDirection: 'rtl' }}>מספר טלפון</Text>
              <View style={{
                backgroundColor: '#181818',
                borderWidth: 1,
                borderColor: 'rgba(0, 230, 84, 0.1)',
                borderRadius: 12,
                overflow: 'hidden'
              }}>
                <TextInput
                  value={profileData.phone}
                  onChangeText={(text) => setProfileData(prev => ({ ...prev, phone: text }))}
                  style={{
                    padding: 16,
                    color: '#fff',
                    fontSize: 16,
                    textAlign: 'right'
                  }}
                  placeholderTextColor="#666"
                  placeholder="הכנס מספר טלפון"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>


          {/* כפתורי פעולה */}
          <View style={{ marginBottom: 40 }}>
            <LinearGradient
              colors={isLoading ? ['#666', '#555'] : ['#00E654', '#00D04B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
                marginBottom: 12,
                opacity: isLoading ? 0.7 : 1,
                shadowColor: '#00E654',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6
              }}
            >
              <Pressable
                onPress={handleSave}
                disabled={isLoading}
                style={{ opacity: isLoading ? 0.7 : 1 }}
              >
                <Text style={{ color: isLoading ? '#ccc' : '#000', fontSize: 16, fontWeight: 'bold', writingDirection: 'rtl' }}>
                  {isLoading ? 'שומר שינויים...' : 'שמור שינויים'}
                </Text>
              </Pressable>
            </LinearGradient>

            <Pressable
              onPress={() => navigation.goBack()}
              style={{
                backgroundColor: 'transparent',
                padding: 16,
                borderRadius: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(0, 230, 84, 0.2)'
              }}
            >
              <Text style={{ color: '#00E654', fontSize: 16, fontWeight: '600', writingDirection: 'rtl' }}>
                ביטול
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

