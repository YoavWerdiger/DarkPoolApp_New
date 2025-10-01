import { View, Text, Pressable, Alert, ScrollView, Image, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { User, ChevronLeft, Settings, LogOut, Bell, Shield, Palette } from 'lucide-react-native';

interface ProfileScreenProps {
  navigation: any;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'התנתק',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('שגיאה', 'שגיאה בהתנתקות');
            }
          },
        },
      ]
    );
  };

  // רשימת מינימלית של פריטים חיוניים בלבד
  const profileSections = [
    {
      title: 'פרופיל אישי',
      items: [
        { icon: 'person-outline', title: 'עריכת פרופיל', subtitle: 'שם, תמונה, פרטים אישיים', color: '#00E654' },
      ]
    },
    {
      title: 'הגדרות',
      items: [
        { icon: 'notifications-outline', title: 'התראות והודעות', subtitle: 'התראות פוש, צלילים', color: '#00E654' },
        { icon: 'shield-checkmark-outline', title: 'פרטיות ואבטחה', subtitle: 'הרשאות, חסימות', color: '#00E654' },
      ]
    },
    {
      title: 'מסלול ותשלומים',
      items: [
        { icon: 'diamond-outline', title: 'מסלול', subtitle: 'שדרוג, ביטול, הטבות', color: '#00E654' },
      ]
    }
  ];

  // פונקציה לטיפול בלחיצה על פריט
  const handleItemPress = (item: any) => {
    switch (item.title) {
      case 'עריכת פרופיל':
        navigation.navigate('EditProfile');
        break;
      case 'התראות והודעות':
        navigation.navigate('Notifications');
        break;
      case 'פרטיות ואבטחה':
        navigation.navigate('Privacy');
        break;
      case 'מסלול':
        navigation.navigate('Subscription');
        break;
      case 'דשבורד מנהלים':
        navigation.navigate('AdminDashboard');
        break;
      default:
        Alert.alert(item.title, `פתיחת ${item.title} - בקרוב!`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#181818' }}>
      {/* גרדיאנט רקע עדין */}
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.05)', 'transparent', 'rgba(0, 230, 84, 0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
        pointerEvents="none"
      />
      
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header עם תמונת פרופיל */}
        <View style={{ 
          paddingTop: 50, 
          paddingBottom: 30, 
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0, 230, 84, 0.1)',
          backgroundColor: '#181818'
        }}>
          <View style={{ alignItems: 'center' }}>
            {/* תמונת פרופיל עם גרדיאנט */}
            <LinearGradient
              colors={['#00E654', '#00D04B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                shadowColor: '#00E654',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 8
              }}
            >
              <User size={50} color="#000" strokeWidth={2} />
            </LinearGradient>
            
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center', writingDirection: 'rtl' }}>
              {user?.full_name || 'משתמש'}
            </Text>
            <Text style={{ color: '#999', fontSize: 16, marginBottom: 12, textAlign: 'center', writingDirection: 'rtl' }}>
              {user?.email}
            </Text>
            
            {/* סטטוס עם גרדיאנט */}
            <LinearGradient
              colors={['#00E654', '#00D04B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                flexDirection: 'row',
                alignItems: 'center'
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#000', marginRight: 8 }} />
              <Text style={{ color: '#000', fontSize: 14, fontWeight: 'bold', writingDirection: 'rtl' }}>פעיל כעת</Text>
            </LinearGradient>
          </View>
        </View>


        {/* כל הקטגוריות */}
        {profileSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginBottom: 16,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(0, 230, 84, 0.1)'
            }}>
              <LinearGradient
                colors={['#00E654', '#00D04B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: 4,
                  height: 20,
                  borderRadius: 2,
                  marginRight: 12
                }}
              />
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', writingDirection: 'rtl' }}>
                {section.title}
              </Text>
            </View>
            
            {section.items.map((item, itemIndex) => (
              <Pressable
                key={itemIndex}
                onPress={() => handleItemPress(item)}
                style={({ pressed }) => ({
                  marginBottom: 12,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  opacity: pressed ? 0.8 : 1
                })}
              >
                <LinearGradient
                  colors={['#181818', '#1a1a1a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(0, 230, 84, 0.1)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2
                  }}
                >
                  {/* אייקון עם גרדיאנט */}
                  <LinearGradient
                    colors={['#00E654', '#00D04B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 16,
                      shadowColor: '#00E654',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 4
                    }}
                  >
                    <Ionicons name={item.icon as any} size={24} color="#000" />
                  </LinearGradient>
                  
                  {/* טקסט */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4, writingDirection: 'rtl' }}>
                      {item.title}
                    </Text>
                    <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl' }}>
                      {item.subtitle}
                    </Text>
                  </View>
                  
                  {/* חץ */}
                  <ChevronLeft size={20} color="#00E654" strokeWidth={2} />
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        ))}

        {/* הגדרות מנהלים (רק אם המשתמש הוא מנהל) */}
        {user?.role === 'admin' && (
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              marginBottom: 16,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(0, 230, 84, 0.1)'
            }}>
              <LinearGradient
                colors={['#00E654', '#00D04B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  width: 4,
                  height: 20,
                  borderRadius: 2,
                  marginRight: 12
                }}
              />
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', writingDirection: 'rtl' }}>
                🔧 הגדרות מנהלים
              </Text>
            </View>
            
            <Pressable
              onPress={() => handleItemPress({ title: 'דשבורד מנהלים' })}
              style={({ pressed }) => ({
                marginBottom: 12,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: pressed ? 0.8 : 1
              })}
            >
              <LinearGradient
                colors={['#181818', '#1a1a1a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: '#00E654',
                  shadowColor: '#00E654',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6
                }}
              >
                <LinearGradient
                  colors={['#00E654', '#00D04B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 16,
                    shadowColor: '#00E654',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.5,
                    shadowRadius: 6,
                    elevation: 6
                  }}
                >
                  <Settings size={24} color="#000" strokeWidth={2} />
                </LinearGradient>
                
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4, writingDirection: 'rtl' }}>
                    דשבורד מנהלים
                  </Text>
                  <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl' }}>
                    סטטיסטיקות, ניהול משתמשים, דוחות
                  </Text>
                </View>
                
                <ChevronLeft size={20} color="#00E654" strokeWidth={2} />
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {/* כפתור התנתקות */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.98 : 1 }],
              opacity: pressed ? 0.8 : 1
            })}
          >
            <LinearGradient
              colors={['#DC2626', '#B91C1C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                padding: 16,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#DC2626',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6
              }}
            >
              <LogOut size={20} color="#fff" strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', writingDirection: 'rtl' }}>התנתק מהחשבון</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* גרסת אפליקציה */}
        <View style={{ alignItems: 'center', paddingTop: 20 }}>
          <Text style={{ color: '#666', fontSize: 12, writingDirection: 'rtl' }}>גרסה 1.0.0 • DarkPool App</Text>
        </View>
      </ScrollView>
    </View>
  );
} 