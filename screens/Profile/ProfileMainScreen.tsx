import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  Image, 
  Alert
} from 'react-native';
import { 
  User, 
  Settings, 
  Bell,
  CreditCard,
  ChevronRight,
  LogOut,
  Edit
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface MenuItem {
  id: string;
  title: string;
  icon: any;
  onPress: () => void;
}

export default function ProfileMainScreen({ navigation }: any) {
  const { user, isLoading, signOut } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setProfileData(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

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
            const { error } = await signOut(true);
            if (error) {
              Alert.alert('שגיאה', 'שגיאה בהתנתקות');
            }
          },
        },
      ]
    );
  };

  const menuItems: MenuItem[] = [
    {
      id: 'edit',
      title: 'עריכת פרופיל',
      icon: Edit,
      onPress: () => navigation.navigate('EditProfile')
    },
    {
      id: 'notifications',
      title: 'התראות',
      icon: Bell,
      onPress: () => navigation.navigate('Notifications')
    },
    {
      id: 'settings',
      title: 'הגדרות',
      icon: Settings,
      onPress: () => navigation.navigate('Settings')
    },
    {
      id: 'subscription',
      title: 'מסלול ותשלום',
      icon: CreditCard,
      onPress: () => navigation.navigate('Subscription')
    }
  ];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#666', fontSize: 16 }}>טוען...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 8 }}>
          לא מחובר
        </Text>
        <Text style={{ color: '#666', fontSize: 14, textAlign: 'center' }}>
          יש להתחבר לאפליקציה
        </Text>
      </View>
    );
  }

  const displayName = profileData?.full_name || user?.email?.split('@')[0] || 'משתמש';
  const email = user?.email || '';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#121212' }}>
      {/* Profile Header */}
      <View style={{
        paddingTop: 50,
        paddingBottom: 24,
        paddingHorizontal: 20,
        alignItems: 'center'
      }}>
        {/* Avatar */}
        <View style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: '#1A1A1A',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          borderWidth: 3,
          borderColor: '#2A2A2A'
        }}>
          {profileData?.profile_picture ? (
            <Image 
              source={{ uri: profileData.profile_picture }} 
              style={{ width: '100%', height: '100%', borderRadius: 50 }}
            />
          ) : (
            <User size={40} color="#666" strokeWidth={1.5} />
          )}
        </View>

        {/* User Info */}
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 26, 
          fontWeight: '700', 
          marginBottom: 6,
          textAlign: 'center'
        }}>
          {displayName}
        </Text>
        <Text style={{ 
          color: '#888', 
          fontSize: 15,
          marginBottom: 12,
          textAlign: 'center'
        }}>
          {email}
        </Text>

        {/* Subscription Badge */}
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          backgroundColor: '#1A1A1A',
          borderWidth: 1,
          borderColor: '#333'
        }}>
          <Text style={{ 
            color: '#00E654', 
            fontSize: 13,
            fontWeight: '600'
          }}>
            מנוי פעיל
          </Text>
        </View>
      </View>

      {/* Menu Options */}
      <View style={{ 
        paddingHorizontal: 20,
        marginBottom: 30
      }}>
        <View style={{
          backgroundColor: '#1A1A1A',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#2A2A2A'
        }}>
          {/* Edit Profile */}
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            style={({ pressed }) => ({
              paddingVertical: 16,
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? '#1E1E1E' : 'transparent',
              borderBottomWidth: 1,
              borderBottomColor: '#2A2A2A'
            })}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#252525',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16
            }}>
              <Edit size={20} color="#666" strokeWidth={2} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 16, 
                fontWeight: '500',
                marginBottom: 2,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}>
                עריכת פרופיל
              </Text>
            </View>
            
            <View style={{ marginLeft: 16 }}>
              <ChevronRight size={18} color="#666" strokeWidth={2} />
            </View>
          </Pressable>

          {/* Notifications */}
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            style={({ pressed }) => ({
              paddingVertical: 16,
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? '#1E1E1E' : 'transparent',
              borderBottomWidth: 1,
              borderBottomColor: '#2A2A2A'
            })}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#252525',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16
            }}>
              <Bell size={20} color="#666" strokeWidth={2} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 16, 
                fontWeight: '500',
                marginBottom: 2,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}>
                התראות
              </Text>
            </View>
            
            <View style={{ marginLeft: 16 }}>
              <ChevronRight size={18} color="#666" strokeWidth={2} />
            </View>
          </Pressable>

          {/* Settings */}
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => ({
              paddingVertical: 16,
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? '#1E1E1E' : 'transparent',
              borderBottomWidth: 1,
              borderBottomColor: '#2A2A2A'
            })}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#252525',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16
            }}>
              <Settings size={20} color="#666" strokeWidth={2} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 16, 
                fontWeight: '500',
                marginBottom: 2,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}>
                הגדרות
              </Text>
            </View>
            
            <View style={{ marginLeft: 16 }}>
              <ChevronRight size={18} color="#666" strokeWidth={2} />
            </View>
          </Pressable>

          {/* Subscription */}
          <Pressable
            onPress={() => navigation.navigate('Subscription')}
            style={({ pressed }) => ({
              paddingVertical: 16,
              paddingHorizontal: 20,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? '#1E1E1E' : 'transparent'
            })}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#252525',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16
            }}>
              <CreditCard size={20} color="#666" strokeWidth={2} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 16, 
                fontWeight: '500',
                marginBottom: 2,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}>
                מסלול ותשלום
              </Text>
            </View>
            
            <View style={{ marginLeft: 16 }}>
              <ChevronRight size={18} color="#666" strokeWidth={2} />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Sign Out Button */}
      <View style={{ 
        paddingHorizontal: 20,
        marginBottom: 30
      }}>
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({
            paddingVertical: 18,
            paddingHorizontal: 20,
            borderRadius: 16,
            backgroundColor: pressed ? '#2A1A1A' : '#1A1A1A',
            borderWidth: 1,
            borderColor: '#DC2626',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
          })}
        >
          <LogOut size={20} color="#DC2626" strokeWidth={2} />
          <Text style={{ 
            color: '#DC2626', 
            fontSize: 17, 
            fontWeight: '600',
            marginLeft: 12
          }}>
            התנתק מהחשבון
          </Text>
        </Pressable>
      </View>

      {/* Version */}
      <View style={{ 
        alignItems: 'center',
        paddingBottom: 40,
        paddingTop: 20
      }}>
        <Text style={{ color: '#555', fontSize: 13 }}>
          גרסה 1.0.0 • DarkPool App
        </Text>
      </View>
    </ScrollView>
  );
}