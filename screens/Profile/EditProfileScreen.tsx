import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  Pressable, 
  Alert,
  Animated,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GradientHeader from '../../components/GradientHeader';
import { 
  Camera, 
  User, 
  Save, 
  ArrowRight,
  Check,
  ArrowLeft
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { mediaService } from '../../services/mediaService';

export default function EditProfileScreen({ navigation }: any) {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    console.log('🚀 EditProfileScreen useEffect triggered with user:', user?.id);
    
    // אנימציה של כניסה
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    
    // טעינת נתוני המשתמש הנוכחיים
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    try {
      console.log('🔄 Loading user data in EditProfileScreen...');
      console.log('🔍 Current user object:', JSON.stringify(user, null, 2));
      
      if (!user) {
        console.log('❌ No user found in EditProfileScreen');
        setIsLoading(false);
        return;
      }
      
      console.log('✅ User found in EditProfileScreen:', user.id);
      console.log('🔍 User email:', user.email);
      
      // נטען נתונים ישירות מטבלת users כמו הדפים האחרים
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (userError) {
        console.error('❌ Error loading user data from database:', userError);
        // נשתמש בנתונים מ-AuthContext כגיבוי
        setDisplayName((user as any).full_name || (user as any).display_name || user.email?.split('@')[0] || 'משתמש');
        setEmail(user.email || '');
        setPhone((user as any).phone || '');
        setProfileImage((user as any).profile_picture || null);
      } else if (userData) {
        console.log('✅ User data loaded from database:', userData);
        
        // עדכון השדות עם הנתונים מהמסד
        setDisplayName(userData.full_name || userData.display_name || user.email?.split('@')[0] || 'משתמש');
        setEmail(userData.email || user.email || '');
        setPhone(userData.phone || '');
        setProfileImage(userData.profile_picture || null);
        
        console.log('📋 Setting form data:', { 
          fullName: userData.full_name, 
          email: userData.email || user.email, 
          phone: userData.phone, 
          profileImage: userData.profile_picture 
        });
      } else {
        console.log('❌ No user data found in database');
        // נשתמש בנתונים מ-AuthContext כגיבוי
        setDisplayName((user as any).full_name || (user as any).display_name || user.email?.split('@')[0] || 'משתמש');
        setEmail(user.email || '');
        setPhone((user as any).phone || '');
        setProfileImage((user as any).profile_picture || null);
      }
      
      console.log('✅ User data loaded successfully in EditProfileScreen');
    } catch (error) {
      console.error('❌ Error loading user data in EditProfileScreen:', error);
      // נשתמש בערכים דיפולטיביים
      setDisplayName('משתמש');
      setEmail('');
      setPhone('');
      setProfileImage(null);
    } finally {
      console.log('🏁 Setting isLoading to false');
      setIsLoading(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    // תמיכה בפורמטים: +972-50-123-4567, 050-123-4567, +972501234567
    const phoneRegex = /^(\+972|0)[0-9]{1,2}-?[0-9]{3}-?[0-9]{4}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'שם תצוגה הוא שדה חובה';
    }

    if (!email.trim()) {
      newErrors.email = 'כתובת מייל היא שדה חובה';
    } else if (!validateEmail(email)) {
      newErrors.email = 'כתובת מייל לא תקינה';
    }

    if (!phone.trim()) {
      newErrors.phone = 'מספר טלפון הוא שדה חובה';
    } else if (!validatePhone(phone)) {
      newErrors.phone = 'מספר טלפון לא תקין';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImagePicker = async () => {
    try {
      // בקשת הרשאות
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'הרשאה נדרשת', 
          'אנא אשר גישה לגלריית התמונות כדי לבחור תמונת פרופיל',
          [
            { text: 'ביטול', style: 'cancel' },
            { text: 'הגדרות', onPress: () => {
              // פתיחת הגדרות האפליקציה
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }}
          ]
        );
        return;
      }

      // בחירת תמונה
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        setProfileImage(selectedImage.uri);
        
        // כאן תוכל להוסיף העלאה לשרת:
        // await uploadProfileImage(selectedImage.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('שגיאה', 'לא ניתן לבחור תמונה. אנא נסה שוב.');
    }
  };

  const uploadProfileImage = async (imageUri: string) => {
    try {
      // כאן תוכל להוסיף העלאה אמיתית לשרת
      // const formData = new FormData();
      // formData.append('profile_image', {
      //   uri: imageUri,
      //   type: 'image/jpeg',
      //   name: 'profile.jpg',
      // });
      // 
      // const response = await fetch('/api/upload-profile-image', {
      //   method: 'POST',
      //   body: formData,
      //   headers: {
      //     'Content-Type': 'multipart/form-data',
      //   },
      // });
      
      console.log('Image uploaded:', imageUri);
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('שגיאה', 'לא ניתן להעלות את התמונה. אנא נסה שוב.');
    }
  };

  const handleSave = async () => {
    // בדיקת ולידציה
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setErrors({});
    
    // אנימציה של שמירה
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // הוספת timeout להגנה מפני קריסה
    setTimeout(async () => {
      await performSave();
    }, 100);
  };

  const performSave = async () => {
    try {
      console.log('Starting profile update...');
      console.log('Data to save:', {
        full_name: displayName.trim().slice(0, 25),
        phone: phone.trim(),
        profile_picture: profileImage
      });

      if (!user) {
        console.error('No user found for update');
        Alert.alert('שגיאה', 'לא נמצא משתמש מחובר');
        setIsSaving(false);
        return;
      }

      let profilePictureUrl = profileImage;

      // העלאת תמונת פרופיל ל-Storage אם מדובר ב-URI מקומי
      if (profileImage && (profileImage.startsWith('file:') || profileImage.startsWith('assets:') || profileImage.startsWith('data:'))) {
        const upload = await mediaService.uploadMedia(profileImage, 'image');
        if (!upload.success) {
          console.error('Error uploading profile image:', upload.error);
          // לא חוסמים שמירה: נמשיך בלי לעדכן תמונה
          profilePictureUrl = null;
        } else {
          profilePictureUrl = upload.url || null;
        }
      }

      // עדכון נתוני המשתמש דרך ה-AuthContext לשמירה על אחידות
      const { error } = await updateProfile({
        id: user.id,
        full_name: displayName.trim().slice(0, 25),
        phone: phone.trim(),
        profile_picture: profilePictureUrl || undefined,
      });

      setIsSaving(false);
      
      if (error) {
        console.error('Error updating profile:', error);
        Alert.alert('שגיאה', `שגיאה בעדכון הפרופיל: ${typeof error === 'string' ? error : (error as any)?.message || 'שגיאה לא ידועה'}`);
        return;
      }
      
      console.log('Profile updated successfully');
      
      // נטען מחדש את נתוני המשתמש מהמסד כדי לעדכן את AuthContext
      try {
        console.log('🔄 Refreshing user data from database...');
        const { data: updatedUserData, error: refreshError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (!refreshError && updatedUserData) {
          console.log('✅ User data refreshed after update:', updatedUserData);
          // נטען מחדש את הנתונים בטופס
          setDisplayName(updatedUserData.full_name || updatedUserData.display_name || user.email?.split('@')[0] || 'משתמש');
          setEmail(updatedUserData.email || user.email || '');
          setPhone(updatedUserData.phone || '');
          setProfileImage(updatedUserData.profile_picture || null);
          console.log('✅ Form data updated with fresh data');
        }
      } catch (refreshError) {
        console.log('Could not refresh user data:', refreshError);
      }
      
      Alert.alert(
        'הצלחה', 
        'הפרופיל נשמר בהצלחה!',
        [
          {
            text: 'אישור',
            onPress: () => navigation.goBack()
          }
        ]
      );
      
    } catch (error: any) {
      setIsSaving(false);
      console.error('Error saving profile:', error);
      Alert.alert(
        'שגיאה', 
        'שגיאה בעדכון הפרופיל',
        [
          {
            text: 'אישור',
            onPress: () => navigation.goBack()
          }
        ]
      );
    }
  };

  const renderProfileImageSection = () => (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        alignItems: 'center',
        marginBottom: 40
      }}
    >
      <LinearGradient
        colors={['#00E65420', '#00E65410', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: 30,
          borderRadius: 30,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(0, 230, 84, 0.3)'
        }}
      >
        {/* תמונת פרופיל */}
        <View>
          <TouchableOpacity onPress={handleImagePicker}>
            <LinearGradient
            colors={['#00E654', '#00D04B', '#00E654']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              shadowColor: '#00E654',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8
            }}
            >
              {profileImage ? (
                <View style={{
                  width: 110,
                  height: 110,
                  borderRadius: 55,
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF'
                }}>
                  <Image 
                    source={{ uri: profileImage }} 
                    style={{
                      width: '100%',
                      height: '100%',
                      resizeMode: 'cover'
                    }}
                  />
                </View>
              ) : (
                <User size={60} color="#000000" strokeWidth={2} />
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* אייקון מצלמה כ-badge כמו מחובר (גדול וחופף יותר) */}
          <TouchableOpacity 
            onPress={handleImagePicker}
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#00E654',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: 'rgba(0,0,0,0.6)'
            }}
          >
            <Camera size={16} color="#000000" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 18, 
          fontWeight: '600',
          marginTop: 10,
          writingDirection: 'rtl'
        }}>
          לחץ לעדכון תמונה
        </Text>
        <Text style={{ 
          color: '#B0B0B0', 
          fontSize: 14, 
          fontWeight: '400',
          marginTop: 4,
          writingDirection: 'rtl'
        }}>
          JPG, PNG עד 5MB
        </Text>
      </LinearGradient>
    </Animated.View>
  );

  const renderInputField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    errorKey: string,
    keyboardType: 'default' | 'email-address' | 'phone-pad' = 'default',
    maxLength?: number
  ) => (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        marginBottom: 24
      }}
    >
      <Text style={{ 
        color: '#FFFFFF', 
        fontSize: 16, 
        fontWeight: '600', 
        marginBottom: 12,
        writingDirection: 'rtl'
      }}>
        {label}
      </Text>
      
      <LinearGradient
        colors={['#252525', '#1E1E1E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: errors[errorKey] ? '#DC2626' : '#333333',
          shadowColor: errors[errorKey] ? '#DC2626' : '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3
        }}
      >
        <TextInput
          style={{
            padding: 16,
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '400',
            textAlign: keyboardType === 'email-address' || keyboardType === 'phone-pad' ? 'left' : 'right',
            writingDirection: keyboardType === 'email-address' || keyboardType === 'phone-pad' ? 'ltr' : 'rtl',
            minHeight: 50,
            textAlignVertical: 'center'
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#666666"
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
          autoCorrect={keyboardType === 'email-address' ? false : true}
          textContentType={keyboardType === 'email-address' ? 'emailAddress' : keyboardType === 'phone-pad' ? 'telephoneNumber' : 'none'}
        />
        {maxLength && (
          <Text style={{ 
            color: '#666666', 
            fontSize: 12, 
            textAlign: 'left',
            paddingHorizontal: 16,
            paddingBottom: 8
          }}>
            {value.length}/{maxLength}
          </Text>
        )}
      </LinearGradient>
      
      {errors[errorKey] && (
        <Text style={{ 
          color: '#DC2626', 
          fontSize: 14, 
          fontWeight: '400',
          marginTop: 8,
          writingDirection: 'rtl'
        }}>
          {errors[errorKey]}
        </Text>
      )}
    </Animated.View>
  );

  console.log('🔍 EditProfileScreen render:', { isLoading, displayName, email, phone, profileImage });

  // נסה להציג את הדף גם אם עדיין טוען
  console.log('✅ EditProfileScreen: Rendering main content (isLoading:', isLoading, ')');

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#121212' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <GradientHeader title="עריכת פרופיל" onBack={() => navigation.goBack()} />

        <View style={{ paddingHorizontal: 24, paddingTop: 30 }}>
          {/* תמונת פרופיל */}
          {renderProfileImageSection()}

          {/* שדות טקסט */}
          {renderInputField(
            'שם תצוגה',
            displayName,
            setDisplayName,
            'הכנס שם תצוגה',
            'displayName',
            'default',
            25
          )}

          {/* שדה מייל לקריאה בלבד */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              marginBottom: 24
            }}
          >
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 16, 
              fontWeight: '600', 
              marginBottom: 12,
              writingDirection: 'rtl'
            }}>
              כתובת מייל
            </Text>
            <LinearGradient
              colors={['#252525', '#1E1E1E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#333333',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 3
              }}
            >
              <TextInput
                style={{
                  padding: 16,
                  color: '#AAAAAA',
                  fontSize: 16,
                  fontWeight: '400',
                  textAlign: 'left',
                  writingDirection: 'ltr',
                  minHeight: 50,
                  textAlignVertical: 'center'
                }}
                value={email}
                editable={false}
                selectTextOnFocus={false}
              />
            </LinearGradient>
          </Animated.View>

          {renderInputField(
            'מספר טלפון',
            phone,
            setPhone,
            'הכנס מספר טלפון',
            'phone',
            'phone-pad',
            15
          )}

          {/* כפתור שמירה */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
              marginTop: 20
            }}
          >
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={{
                shadowColor: '#00E654',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6
              }}
            >
              <LinearGradient
                colors={['#00E654', '#00D04B', '#00E654']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 18,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                {isSaving ? (
                  <>
                    <Text style={{ 
                      color: '#000000', 
                      fontSize: 18, 
                      fontWeight: '600',
                      marginRight: 8,
                      writingDirection: 'rtl'
                    }}>
                      שומר...
                    </Text>
                    <Check size={20} color="#000000" strokeWidth={2} />
                  </>
                ) : (
                  <>
                    <Text style={{ 
                      color: '#000000', 
                      fontSize: 18, 
                      fontWeight: '600',
                      marginRight: 8,
                      writingDirection: 'rtl'
                    }}>
                      שמור שינויים
                    </Text>
                    <Save size={20} color="#000000" strokeWidth={2} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}