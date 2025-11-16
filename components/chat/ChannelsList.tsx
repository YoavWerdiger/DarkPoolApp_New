import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle, Users } from 'lucide-react-native';
import UIBottomSheet from '../ui/UIBottomSheet';
import { useDesignTokens } from '../ui/DesignTokens';

interface Channel {
  id: string;
  name: string;
  image_url?: string;
  description?: string;
  member_count?: number;
}

export default function ChannelsList() {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [myChannelIds, setMyChannelIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showJoinSheet, setShowJoinSheet] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchChannels();
  }, [user]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('sessionData:', sessionData);
    };
    checkSession();
  }, []);

  const fetchChannels = async () => {
    if (!user) return;
    setLoading(true);
    // שלוף את כל הקבוצות
    const { data: allChannels } = await supabase.from('channels').select('*').order('created_at');
    setChannels(allChannels || []);
    // שלוף את הקבוצות של המשתמש
    const { data: myChannels } = await supabase.from('channel_members').select('channel_id').eq('user_id', user.id);
    setMyChannelIds((myChannels || []).map(c => c.channel_id));
    setLoading(false);
  };

  const handleJoinClick = async (channel: Channel) => {
    console.log('🎯 ChannelsList: handleJoinClick called', { channelId: channel.id, channelName: channel.name });
    
    // הגדר את הערוץ הבסיסי מיד כדי שהמודל יוכל להציג משהו
    setSelectedChannel(channel);
    
    // טען את כל הנתונים המלאים של הקבוצה
    try {
      // טען את נתוני הקבוצה
      const { data: fullChannelData, error: channelError } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channel.id)
        .single();
      
      if (channelError) {
        console.error('❌ ChannelsList: Error loading full channel data:', channelError);
        // נשתמש בנתונים הבסיסיים שכבר הגדרנו
        setShowJoinSheet(true);
        return;
      }
      
      // טען את מספר החברים
      const { count: membersCount, error: countError } = await supabase
        .from('channel_members')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channel.id);
      
      if (countError) {
        console.error('❌ ChannelsList: Error loading members count:', countError);
      }
      
      // נשתמש בנתונים המלאים
      const channelWithCount = {
        ...fullChannelData,
        member_count: membersCount || fullChannelData.member_count || 0
      };
      
      console.log('✅ ChannelsList: Full channel data loaded:', {
        name: channelWithCount.name,
        image_url: channelWithCount.image_url,
        description: channelWithCount.description,
        member_count: channelWithCount.member_count
      });
      
      // עדכן את הנתונים המלאים
      setSelectedChannel(channelWithCount);
    } catch (error) {
      console.error('❌ ChannelsList: Exception loading channel data:', error);
      // נשתמש בנתונים הבסיסיים שכבר הגדרנו
    }
    
    // פתח את המודל אחרי שהגדרנו את selectedChannel
    setShowJoinSheet(true);
    console.log('🎯 ChannelsList: setShowJoinSheet(true) done');
  };

  const handleJoin = async () => {
    if (!user || !selectedChannel) return;
    
    const channelId = selectedChannel.id;
    setJoining(channelId);
    
    try {
      // בדיקה אם המשתמש כבר חבר בערוץ
      const { data: existingMember, error: checkError } = await supabase
        .from('channel_members')
        .select('id')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .single();
        
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ Error checking existing membership:', checkError);
        alert('שגיאה בבדיקת חברות: ' + checkError.message);
        return;
      }
      
      if (existingMember) {
        console.log('ℹ️ User is already a member of this channel');
        alert('אתה כבר חבר בערוץ זה');
        setShowJoinSheet(false);
        return;
      }
      
      // המשתמש לא חבר, נוסיף אותו
      const { error } = await supabase.from('channel_members').insert({ channel_id: channelId, user_id: user.id });
      if (error) {
        console.error('שגיאה בהצטרפות לקבוצה:', error);
        alert('שגיאה בהצטרפות לקבוצה: ' + error.message);
      } else {
        await fetchChannels();
        setShowJoinSheet(false);
      }
    } catch (error) {
      console.error('❌ Exception in handleJoin:', error);
      alert('שגיאה בהצטרפות לקבוצה');
    } finally {
      setJoining(null);
    }
  };

  const handleLeave = async (channelId: string) => {
    if (!user) return;
    setJoining(channelId);
    await supabase.from('channel_members').delete().eq('channel_id', channelId).eq('user_id', user.id);
    await fetchChannels();
    setJoining(null);
  };

  if (!user) return null;
  if (loading) {
    return <ActivityIndicator color={DesignTokens.colors.success.main} style={{ marginTop: 40 }} />;
  }

  return (
    <>
      <View className="flex-1 bg-black px-4 py-6">
        <Text className="text-2xl font-bold text-white mb-6" style={{ textAlign: 'right' }}>רשימת קבוצות</Text>
        <FlatList
          data={channels}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const isMember = myChannelIds.includes(item.id);
            return (
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DesignTokens.colors.background.secondary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, borderWidth: 1, borderColor: DesignTokens.colors.border.main }}>
                <View className="flex-row-reverse items-center">
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={{ width: 64, height: 64, borderRadius: 32, marginLeft: 12, borderWidth: 2, borderColor: DesignTokens.colors.primary.main, shadowColor: DesignTokens.colors.success.main, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }} />
                  ) : (
                    <MessageCircle size={32} color={DesignTokens.colors.success.main} strokeWidth={2} style={{ marginLeft: 12 }} />
                  )}
                  <Text className="text-lg text-white font-bold" style={{ textAlign: 'right' }}>{item.name}</Text>
                </View>
                {isMember ? (
                  <View className="bg-gray-700 px-4 py-2 rounded-xl">
                    <Text className="text-white font-bold">חבר</Text>
                  </View>
                ) : (
                  <Pressable onPress={() => handleJoinClick(item)} disabled={joining === item.id} className="bg-primary px-4 py-2 rounded-xl">
                    <Text className="text-black font-bold">הצטרף</Text>
                  </Pressable>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text className="text-white text-center mt-10">אין קבוצות להצגה</Text>}
        />
      </View>

      {/* Bottom Sheet להצטרפות לקבוצה - SwiftUI style */}
      <UIBottomSheet
        visible={showJoinSheet}
        onClose={() => setShowJoinSheet(false)}
        maxHeight="70%"
        showHandle={true}
        dragToClose={true}
      >
        {selectedChannel ? (
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 }}>
            {/* תמונת הקבוצה */}
            <View style={{ alignItems: 'center', marginBottom: 36 }}>
              {selectedChannel.image_url ? (
                <View style={{
                  shadowColor: DesignTokens.colors.success.main,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 8,
                }}>
                  <Image 
                    source={{ uri: selectedChannel.image_url }} 
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      borderWidth: 3,
                      borderColor: DesignTokens.colors.success.main,
                    }}
                  />
                </View>
              ) : (
                <View style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  backgroundColor: `${DesignTokens.colors.success.main}26`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: DesignTokens.colors.success.main,
                  shadowColor: DesignTokens.colors.success.main,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 8,
                }}>
                  <MessageCircle size={48} color={DesignTokens.colors.success.main} strokeWidth={2.5} />
                </View>
              )}
              
              <Text style={{
                color: DesignTokens.colors.text.primary,
                fontSize: 28,
                fontWeight: '700',
                textAlign: 'center',
                marginTop: 24,
                marginBottom: 12,
                letterSpacing: -0.5
              }}>
                {selectedChannel.name}
              </Text>
              
              {selectedChannel.description && (
                <Text style={{ 
                  color: DesignTokens.colors.text.secondary, 
                  fontSize: 16, 
                  textAlign: 'center',
                  lineHeight: 24,
                  marginBottom: 20,
                  paddingHorizontal: 16
                }}>
                  {selectedChannel.description}
                </Text>
              )}
              
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: `${DesignTokens.colors.success.main}1F`,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: `${DesignTokens.colors.success.main}4D`
              }}>
                <Users size={16} color={DesignTokens.colors.success.main} strokeWidth={2.5} />
                <Text style={{ 
                  color: DesignTokens.colors.success.main, 
                  fontSize: 15, 
                  fontWeight: '600',
                  marginLeft: 10
                }}>
                  {selectedChannel.member_count || 0} משתתפים
                </Text>
              </View>
            </View>

            {/* כפתורי פעולה - SwiftUI style */}
            <View style={{ gap: 14 }}>
              <TouchableOpacity
                onPress={handleJoin}
                disabled={joining === selectedChannel.id}
                style={{
                  backgroundColor: DesignTokens.colors.success.main,
                  paddingVertical: 18,
                  borderRadius: 14,
                  alignItems: 'center',
                  opacity: joining === selectedChannel.id ? 0.7 : 1,
                  shadowColor: DesignTokens.colors.success.main,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                {joining === selectedChannel.id ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={{
                    color: '#000',
                    fontSize: 18,
                    fontWeight: '700',
                    letterSpacing: 0.3
                  }}>
                    הצטרף לקבוצה
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowJoinSheet(false)}
                style={{
                  paddingVertical: 16,
                  alignItems: 'center',
                  borderRadius: 14,
                  backgroundColor: DesignTokens.colors.background.secondary,
                }}
              >
                <Text style={{
                  color: DesignTokens.colors.text.secondary,
                  fontSize: 17,
                  fontWeight: '600',
                }}>
                  ביטול
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </UIBottomSheet>
    </>
  );
} 