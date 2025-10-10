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
          text: 'התנתק ומחק נתונים',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut(false); // מחק נתונים
            if (error) {
              Alert.alert('שגיאה', 'שגיאה בהתנתקות');
            }
          },
        },
        {
          text: 'התנתק ושמור נתונים',
          style: 'default',
          onPress: async () => {
            const { error } = await signOut(true); // שמור נתונים
            if (error) {
              Alert.alert('שגיאה', 'שגיאה בהתנתקות');
            } else {
              Alert.alert('התנתקות', 'נתוני ההתחברות נשמרו להפעלה הבאה');
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
        { icon: 'person-outline', title: 'עריכת פרופיל', subtitle: 'פרטים אישיים ומידע חשבון', color: '#00E654' },
      ]
    },
    {
      title: 'הגדרות',
      items: [
        { icon: 'notifications-outline', title: 'התראות', subtitle: 'הגדרת התראות פוש', color: '#00E654' },
        { icon: 'settings-outline', title: 'הגדרות', subtitle: 'הגדרות אפליקציה ואבטחה', color: '#00E654' },
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
      case 'התראות':
        navigation.navigate('Notifications');
        break;
      case 'הגדרות':
        navigation.navigate('Settings');
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
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      {/* רקע דינמי עם גרדיאנטים */}
      <LinearGradient
        colors={['#1A1A2E', '#16213E', '#0A0A0A', '#1A1A2E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1
        }}
      />
      
      {/* נקודות רקע דינמיות */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
        opacity: 0.4
      }}>
        {Array.from({ length: 30 }).map((_, index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              width: Math.random() * 4 + 2,
              height: Math.random() * 4 + 2,
              backgroundColor: '#00E654',
              borderRadius: 50,
              opacity: Math.random() * 0.3 + 0.1
            }}
          />
        ))}
      </View>
      
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header עם גרדיאנט יפה */}
        <LinearGradient
          colors={['rgba(0, 230, 84, 0.1)', 'transparent', 'rgba(0, 230, 84, 0.05)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ 
            paddingTop: 60, 
            paddingBottom: 40, 
            paddingHorizontal: 24,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0, 230, 84, 0.2)'
          }}
        >
          {/* תמונת פרופיל עם גרדיאנט */}
          <LinearGradient
            colors={['#00E654', '#00D04B', '#00E654']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 90,
              height: 90,
              borderRadius: 45,
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
            <User size={40} color="#000" strokeWidth={2} />
          </LinearGradient>
          
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center', writingDirection: 'rtl' }}>
            {user?.full_name || 'משתמש'}
          </Text>
          
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.2)', 'rgba(0, 230, 84, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 25,
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
              borderWidth: 1,
              borderColor: 'rgba(0, 230, 84, 0.3)'
            }}
          >
            <View style={{ 
              width: 10, 
              height: 10, 
              borderRadius: 5, 
              backgroundColor: '#00E654',
              marginRight: 10,
              shadowColor: '#00E654',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 4,
              elevation: 2
            }} />
            <Text style={{ 
              color: '#00E654', 
              fontSize: 14, 
              fontWeight: '600', 
              writingDirection: 'rtl' 
            }}>משתמש פעיל</Text>
          </LinearGradient>

        </LinearGradient>

        {/* כל הקטגוריות */}
        {profileSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={{ paddingHorizontal: 24, marginBottom: 40 }}>
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 22, 
              fontWeight: '600', 
              marginBottom: 24,
              marginTop: 8,
              writingDirection: 'rtl',
              letterSpacing: 0.5
            }}>
              {section.title}
            </Text>
            
            {section.items.map((item, itemIndex) => (
              <Pressable
                key={itemIndex}
                onPress={() => handleItemPress(item)}
                style={({ pressed }) => ({
                  marginBottom: 24,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                  opacity: pressed ? 0.95 : 1
                })}
              >
                <View style={{
                  padding: 20,
                  borderRadius: 16,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  backgroundColor: '#252525',
                  borderWidth: 1,
                  borderColor: '#333333',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3
                }}>
                  {/* אייקון מקצועי */}
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: '#00E654',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 20,
                    shadowColor: '#00E654',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 4
                  }}>
                    <Ionicons name={item.icon as any} size={22} color="#000000" />
                  </View>
                  
                  {/* טקסט מקצועי */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      color: '#FFFFFF', 
                      fontSize: 17, 
                      fontWeight: '500', 
                      marginBottom: 6, 
                      writingDirection: 'rtl',
                      letterSpacing: 0.3
                    }}>
                      {item.title}
                    </Text>
                    <Text style={{ 
                      color: '#B0B0B0', 
                      fontSize: 15, 
                      writingDirection: 'rtl',
                      fontWeight: '400',
                      lineHeight: 20
                    }}>
                      {item.subtitle}
                    </Text>
                  </View>
                  
                  {/* חץ מקצועי */}
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: '#333333',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8
                  }}>
                    <ChevronLeft size={18} color="#888888" />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ))}

        {/* הגדרות מנהלים (רק אם המשתמש הוא מנהל) */}
        {user?.role === 'admin' && (
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <Text style={{ 
              color: '#fff', 
              fontSize: 20, 
              fontWeight: '700', 
              marginBottom: 20,
              writingDirection: 'rtl'
            }}>
              🔧 הגדרות מנהלים
            </Text>
            
            <Pressable
              onPress={() => handleItemPress({ title: 'דשבורד מנהלים' })}
              style={({ pressed }) => ({
                marginBottom: 12,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: pressed ? 0.8 : 1
              })}
            >
              <View style={{
                padding: 16,
                borderRadius: 16,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                backgroundColor: '#1A1A1A',
                borderWidth: 1,
                borderColor: '#00E654'
              }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: '#00E654',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 16
                }}>
                  <Settings size={20} color="#000" strokeWidth={2} />
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4, writingDirection: 'rtl' }}>
                    דשבורד מנהלים
                  </Text>
                  <Text style={{ color: '#666', fontSize: 13, writingDirection: 'rtl' }}>
                    סטטיסטיקות, ניהול משתמשים, דוחות
                  </Text>
                </View>
                
                <ChevronLeft size={18} color="#666" strokeWidth={2} />
              </View>
            </Pressable>
          </View>
        )}

        {/* כפתור התנתקות */}
        <View style={{ paddingHorizontal: 24, marginTop: 40, marginBottom: 32 }}>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.99 : 1 }],
              opacity: pressed ? 0.95 : 1
            })}
          >
            <View style={{
              padding: 20,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#2A1A1A',
              borderWidth: 1,
              borderColor: '#DC2626',
              shadowColor: '#DC2626',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
              elevation: 6
            }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#DC2626',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                <LogOut size={18} color="#FFFFFF" strokeWidth={2} />
              </View>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 17, 
                fontWeight: '500',
                textAlign: 'center',
                writingDirection: 'rtl',
                letterSpacing: 0.3
              }}>
                התנתק מהחשבון
              </Text>
            </View>
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