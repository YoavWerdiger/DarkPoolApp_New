import { View, Text, Pressable, Alert, ScrollView, Switch, Image, SafeAreaView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { User, ChevronRight, Settings, LogOut } from 'lucide-react-native';

interface ProfileScreenProps {
  navigation: any;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

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

  // רשימת כל הקטגוריות והשירותים
  const profileSections = [
    {
      title: 'פרופיל אישי',
      items: [
        { icon: 'person-outline', title: 'עריכת פרופיל', subtitle: 'שם, תמונה, פרטים אישיים', color: '#4F46E5' },
        { icon: 'card-outline', title: 'מידע חשבון', subtitle: 'אימייל, טלפון, סטטוס חברות', color: '#059669' },
        { icon: 'stats-chart-outline', title: 'סטטיסטיקות אישיות', subtitle: 'פעילות, הישגים, נתונים', color: '#DC2626' },
      ]
    },
    {
      title: 'הגדרות כלליות',
      items: [
        { icon: 'notifications-outline', title: 'התראות והודעות', subtitle: 'התראות פוש, צלילים, רטט', color: '#7C3AED' },
        { icon: 'shield-checkmark-outline', title: 'פרטיות ואבטחה', subtitle: 'הרשאות, חסימות, סיסמה', color: '#EA580C' },
        { icon: 'color-palette-outline', title: 'מראה ונושא', subtitle: 'ערכת צבעים, גודל טקסט', color: '#0891B2' },
        { icon: 'language-outline', title: 'שפה ואזור', subtitle: 'שפת ממשק, אזור זמן', color: '#65A30D' },
      ]
    },
    {
      title: 'מנויים ותשלומים',
      items: [
        { icon: 'diamond-outline', title: 'מנוי פרימיום', subtitle: 'שדרוג, ביטול, הטבות', color: '#F59E0B' },
        { icon: 'card-outline', title: 'היסטוריית תשלומים', subtitle: 'חשבוניות, החזרים', color: '#10B981' },
        { icon: 'gift-outline', title: 'מבצעים והטבות', subtitle: 'קודי הנחה, הפניות', color: '#EF4444' },
      ]
    },
    {
      title: 'למידה ופיתוח',
      items: [
        { icon: 'school-outline', title: 'התקדמות בקורסים', subtitle: 'מעקב אחר למידה', color: '#8B5CF6' },
        { icon: 'trophy-outline', title: 'תעודות והישגים', subtitle: 'הישגים ותגמולים', color: '#F59E0B' },
        { icon: 'bookmark-outline', title: 'תוכן שמור', subtitle: 'מאמרים, סרטונים שמורים', color: '#06B6D4' },
      ]
    },
    {
      title: 'כלים מתקדמים',
      items: [
        { icon: 'download-outline', title: 'ייצוא נתונים', subtitle: 'גיבוי מידע אישי', color: '#6366F1' },
        { icon: 'sync-outline', title: 'סנכרון ושחזור', subtitle: 'גיבוי והשחזור', color: '#059669' },
        { icon: 'bug-outline', title: 'דיווח על בעיות', subtitle: 'תמיכה טכנית', color: '#DC2626' },
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
      case 'דשבורד מנהלים':
        navigation.navigate('AdminDashboard');
        break;
      default:
        Alert.alert(item.title, `פתיחת ${item.title} - בקרוב!`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A1A' }}>
      {/* גרדיאנט רקע עדין */}
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
        pointerEvents="none"
      />
      
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header עם תמונת פרופיל */}
        <View style={{ 
          backgroundColor: '#2A2A2A', 
          paddingTop: 50, 
          paddingBottom: 20, 
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0, 230, 84, 0.1)'
        }}>
          <View style={{ alignItems: 'center' }}>
            {/* תמונת פרופיל */}
            <View style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: '#1A1A1A',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 3,
              borderColor: '#00E654',
              shadowColor: '#00E654',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8
            }}>
              <User size={50} color="#00E654" strokeWidth={2} />
            </View>
            
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
              {user?.full_name || 'משתמש'}
            </Text>
            <Text style={{ color: '#999', fontSize: 16, marginBottom: 12 }}>
              {user?.email}
            </Text>
            
            {/* סטטוס */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00E654', marginRight: 8 }} />
              <Text style={{ color: '#00E654', fontSize: 14 }}>פעיל כעת</Text>
            </View>
          </View>
        </View>

        {/* סטטיסטיקות מהירות */}
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{
              flex: 1,
              backgroundColor: '#2A2A2A',
              padding: 16,
              borderRadius: 16,
              alignItems: 'center',
              marginRight: 8,
              borderWidth: 1,
              borderColor: 'rgba(0, 230, 84, 0.1)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2
            }}>
              <Text style={{ color: '#00E654', fontSize: 24, fontWeight: 'bold' }}>127</Text>
              <Text style={{ color: '#999', fontSize: 12 }}>הודעות</Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: '#2A2A2A',
              padding: 16,
              borderRadius: 16,
              alignItems: 'center',
              marginHorizontal: 8,
              borderWidth: 1,
              borderColor: 'rgba(0, 230, 84, 0.1)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2
            }}>
              <Text style={{ color: '#00E654', fontSize: 24, fontWeight: 'bold' }}>23</Text>
              <Text style={{ color: '#999', fontSize: 12 }}>קבוצות</Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: '#2A2A2A',
              padding: 16,
              borderRadius: 16,
              alignItems: 'center',
              marginLeft: 8,
              borderWidth: 1,
              borderColor: 'rgba(0, 230, 84, 0.1)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2
            }}>
              <Text style={{ color: '#00E654', fontSize: 24, fontWeight: 'bold' }}>15</Text>
              <Text style={{ color: '#999', fontSize: 12 }}>ימים פעילים</Text>
            </View>
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
              <View style={{
                width: 4,
                height: 20,
                backgroundColor: '#00E654',
                borderRadius: 2,
                marginRight: 12
              }} />
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>
                {section.title}
              </Text>
            </View>
            
            {section.items.map((item, itemIndex) => (
              <Pressable
                key={itemIndex}
                onPress={() => handleItemPress(item)}
                style={({ pressed }) => ({
                  backgroundColor: '#2A2A2A',
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0, 230, 84, 0.1)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  opacity: pressed ? 0.8 : 1
                })}
              >
                {/* אייקון */}
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: item.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 16,
                  shadowColor: item.color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 4
                }}>
                  <Ionicons name={item.icon as any} size={24} color="#fff" />
                </View>
                
                {/* טקסט */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: '#999', fontSize: 14 }}>
                    {item.subtitle}
                  </Text>
                </View>
                
                {/* חץ */}
                <ChevronRight size={20} color="#666" strokeWidth={2} />
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
              <View style={{
                width: 4,
                height: 20,
                backgroundColor: '#00E654',
                borderRadius: 2,
                marginRight: 12
              }} />
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>
                🔧 הגדרות מנהלים
              </Text>
            </View>
            
            <Pressable
              onPress={() => handleItemPress({ title: 'דשבורד מנהלים' })}
              style={({ pressed }) => ({
                backgroundColor: '#2A2A2A',
                padding: 16,
                borderRadius: 16,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: '#00E654',
                shadowColor: '#00E654',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: pressed ? 0.8 : 1
              })}
            >
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: '#00E654',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
                shadowColor: '#00E654',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.5,
                shadowRadius: 6,
                elevation: 6
              }}>
                <Settings size={24} color="#000" strokeWidth={2} />
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                  דשבורד מנהלים
                </Text>
                <Text style={{ color: '#999', fontSize: 14 }}>
                  סטטיסטיקות, ניהול משתמשים, דוחות
                </Text>
              </View>
              
              <ChevronRight size={20} color="#00E654" strokeWidth={2} />
            </Pressable>
          </View>
        )}

        {/* כפתור התנתקות */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => ({
              backgroundColor: '#DC2626',
              padding: 16,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(220, 38, 38, 0.3)',
              shadowColor: '#DC2626',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              opacity: pressed ? 0.8 : 1
            })}
          >
            <LogOut size={20} color="#fff" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>התנתק מהחשבון</Text>
          </Pressable>
        </View>

        {/* גרסת אפליקציה */}
        <View style={{ alignItems: 'center', paddingTop: 20 }}>
          <Text style={{ color: '#666', fontSize: 12 }}>גרסה 1.0.0 • DarkPool App</Text>
        </View>
      </ScrollView>
    </View>
  );
} 