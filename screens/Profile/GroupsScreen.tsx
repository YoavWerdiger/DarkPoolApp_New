import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  Animated,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  MessageSquare, 
  Users, 
  Clock, 
  ChevronRight,
  Crown,
  Star,
  Activity,
  Bell
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isAdmin: boolean;
  isPrivate: boolean;
  category: string;
  color: string;
  icon: string;
}

export default function GroupsScreen({ navigation }: any) {
  // נתונים אמיתיים יבואו מהשרת - אין יותר mock data
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    // טעינת נתונים אמיתיים מהשרת
    loadGroupsData();
  }, []);

  const loadGroupsData = async () => {
    try {
      // כאן יהיה קריאה לשרת לקבלת רשימת הקבוצות
      // const groupsData = await groupsService.getUserGroups();
      // setGroups(groupsData);
      
      // בינתיים מציגים רשימה ריקה
      setLoading(false);
    } catch (error) {
      console.error('Error loading groups data:', error);
      setLoading(false);
    }
  };

  const getGroupIcon = (icon: string, color: string) => {
    switch (icon) {
      case 'crown':
        return <Crown size={24} color="#FFFFFF" strokeWidth={2} />;
      case 'trending':
        return <Activity size={24} color="#FFFFFF" strokeWidth={2} />;
      case 'lock':
        return <Users size={24} color="#FFFFFF" strokeWidth={2} />;
      case 'news':
        return <Bell size={24} color="#FFFFFF" strokeWidth={2} />;
      case 'chart':
        return <Star size={24} color="#FFFFFF" strokeWidth={2} />;
      default:
        return <MessageSquare size={24} color="#FFFFFF" strokeWidth={2} />;
    }
  };

  const renderGroupCard = (group: Group, index: number) => (
    <Animated.View
      key={group.id}
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        marginBottom: 16
      }}
    >
      <TouchableOpacity
        onPress={() => {/* Navigate to group */}}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3
        }}
      >
        <LinearGradient
          colors={['#252525', '#1E1E1E', '#181818']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            padding: 20,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#333333'
          }}
        >
          {/* Header עם שם הקבוצה וסטטוס */}
          <View style={{ 
            flexDirection: 'row-reverse', 
            alignItems: 'center',
            marginBottom: 12
          }}>
            {/* אייקון הקבוצה */}
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 15,
              backgroundColor: group.color,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 16,
              shadowColor: group.color,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 4
            }}>
              {getGroupIcon(group.icon, group.color)}
            </View>

            {/* פרטי הקבוצה */}
            <View style={{ flex: 1 }}>
              <View style={{ 
                flexDirection: 'row-reverse', 
                alignItems: 'center',
                marginBottom: 4
              }}>
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontSize: 18, 
                  fontWeight: '600',
                  writingDirection: 'rtl'
                }}>
                  {group.name}
                </Text>
                
                {/* תגים */}
                <View style={{ 
                  flexDirection: 'row-reverse',
                  marginRight: 8
                }}>
                  {group.isAdmin && (
                    <View style={{
                      backgroundColor: '#00E654',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 8,
                      marginLeft: 4
                    }}>
                      <Text style={{ 
                        color: '#000000', 
                        fontSize: 10, 
                        fontWeight: '600' 
                      }}>
                        מנהל
                      </Text>
                    </View>
                  )}
                  
                  {group.isPrivate && (
                    <View style={{
                      backgroundColor: '#8B5CF6',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 8,
                      marginLeft: 4
                    }}>
                      <Text style={{ 
                        color: '#FFFFFF', 
                        fontSize: 10, 
                        fontWeight: '600' 
                      }}>
                        פרטי
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              <Text style={{ 
                color: '#B0B0B0', 
                fontSize: 14, 
                fontWeight: '400',
                writingDirection: 'rtl'
              }}>
                {group.description}
              </Text>
            </View>

            {/* ספירת הודעות לא נקראות */}
            {group.unreadCount > 0 && (
              <View style={{
                backgroundColor: '#00E654',
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8
              }}>
                <Text style={{ 
                  color: '#000000', 
                  fontSize: 12, 
                  fontWeight: '700' 
                }}>
                  {group.unreadCount > 9 ? '9+' : group.unreadCount}
                </Text>
              </View>
            )}
          </View>

          {/* הודעה אחרונה */}
          <View style={{ 
            flexDirection: 'row-reverse', 
            alignItems: 'center',
            marginBottom: 12
          }}>
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 15, 
              fontWeight: '500',
              flex: 1,
              writingDirection: 'rtl'
            }}>
              {group.lastMessage}
            </Text>
            <Clock size={14} color="#666666" style={{ marginLeft: 8 }} />
            <Text style={{ 
              color: '#666666', 
              fontSize: 12, 
              fontWeight: '400',
              writingDirection: 'rtl'
            }}>
              {group.lastMessageTime}
            </Text>
          </View>

          {/* Footer עם סטטיסטיקות */}
          <View style={{ 
            flexDirection: 'row-reverse', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <View style={{ 
              flexDirection: 'row-reverse', 
              alignItems: 'center' 
            }}>
              <Users size={16} color="#B0B0B0" style={{ marginLeft: 4 }} />
              <Text style={{ 
                color: '#B0B0B0', 
                fontSize: 14, 
                fontWeight: '400',
                writingDirection: 'rtl'
              }}>
                {group.memberCount.toLocaleString()} חברים
              </Text>
            </View>
            
            <View style={{
              backgroundColor: '#333333',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8
            }}>
              <Text style={{ 
                color: group.color, 
                fontSize: 12, 
                fontWeight: '600',
                writingDirection: 'rtl'
              }}>
                {group.category}
              </Text>
            </View>
            
            <ChevronRight size={18} color="#666666" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStatsCard = () => {
    if (groups.length === 0) return null;

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          marginBottom: 30
        }}
      >
        <LinearGradient
          colors={['#00E65420', '#00E65410', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            padding: 24,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(0, 230, 84, 0.3)',
            shadowColor: '#00E654',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 6
          }}
        >
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 20, 
            fontWeight: '600', 
            marginBottom: 16,
            writingDirection: 'rtl'
          }}>
            סטטיסטיקות קבוצות
          </Text>
          
          <View style={{ 
            flexDirection: 'row-reverse', 
            justifyContent: 'space-between' 
          }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#00E654', fontSize: 24, fontWeight: '700' }}>
                {groups.length}
              </Text>
              <Text style={{ color: '#B0B0B0', fontSize: 12, fontWeight: '400' }}>
                קבוצות פעילות
              </Text>
            </View>
            
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#3B82F6', fontSize: 24, fontWeight: '700' }}>
                {groups.reduce((sum, group) => sum + group.unreadCount, 0)}
              </Text>
              <Text style={{ color: '#B0B0B0', fontSize: 12, fontWeight: '400' }}>
                הודעות לא נקראות
              </Text>
            </View>
            
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#8B5CF6', fontSize: 24, fontWeight: '700' }}>
                {groups.filter(g => g.isAdmin).length}
              </Text>
              <Text style={{ color: '#B0B0B0', fontSize: 12, fontWeight: '400' }}>
                קבוצות שאני מנהל
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <LinearGradient
          colors={['#00E65420', '#00E65410', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 60,
            paddingBottom: 30,
            paddingHorizontal: 24,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0, 230, 84, 0.2)'
          }}
        >
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 24, 
            fontWeight: '700',
            writingDirection: 'rtl'
          }}>
            הקבוצות שלי
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: 24, paddingTop: 30 }}>
          {/* כרטיס סטטיסטיקות */}
          {renderStatsCard()}

          {/* רשימת קבוצות */}
          {loading ? (
            <View style={{ 
              padding: 40, 
              alignItems: 'center',
              backgroundColor: '#1A1A1A',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#333333'
            }}>
              <Text style={{ color: '#B0B0B0', fontSize: 16, writingDirection: 'rtl' }}>
                טוען קבוצות...
              </Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={{ 
              padding: 40, 
              alignItems: 'center',
              backgroundColor: '#1A1A1A',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#333333'
            }}>
              <Users size={48} color="#666666" style={{ marginBottom: 16 }} />
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 18, 
                fontWeight: '600',
                marginBottom: 8,
                writingDirection: 'rtl'
              }}>
                אין קבוצות
              </Text>
              <Text style={{ 
                color: '#B0B0B0', 
                fontSize: 14,
                textAlign: 'center',
                writingDirection: 'rtl'
              }}>
                הצטרף לקבוצה חדשה כדי להתחיל
              </Text>
            </View>
          ) : (
            <>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 22, 
                fontWeight: '600', 
                marginBottom: 20,
                writingDirection: 'rtl'
              }}>
                כל הקבוצות
              </Text>
              
              {groups.map((group, index) => renderGroupCard(group, index))}
            </>
          )}

          {/* כפתור הצטרפות לקבוצה חדשה */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              marginTop: 20
            }}
          >
            <TouchableOpacity
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 3
              }}
            >
              <LinearGradient
                colors={['#333333', '#2A2A2A', '#1E1E1E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 20,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: '#00E654',
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <MessageSquare size={32} color="#00E654" strokeWidth={2} style={{ marginBottom: 12 }} />
                <Text style={{ 
                  color: '#00E654', 
                  fontSize: 18, 
                  fontWeight: '600',
                  writingDirection: 'rtl'
                }}>
                  הצטרף לקבוצה חדשה
                </Text>
                <Text style={{ 
                  color: '#B0B0B0', 
                  fontSize: 14, 
                  fontWeight: '400',
                  marginTop: 4,
                  writingDirection: 'rtl'
                }}>
                  חפש קבוצות לפי תחום עניין
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
