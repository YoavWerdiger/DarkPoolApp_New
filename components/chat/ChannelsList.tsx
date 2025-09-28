import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle } from 'lucide-react-native';

interface Channel {
  id: string;
  name: string;
  image_url?: string;
}

export default function ChannelsList() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [myChannelIds, setMyChannelIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

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

  const handleJoin = async (channelId: string) => {
    if (!user) return;
    // בדוק את ה-session והאם ה-user.id תואם ל-auth.uid
    const { data: { user: authUser } } = await supabase.auth.getUser();
    console.log('auth.uid:', authUser?.id);
    console.log('user.id:', user.id);
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
        return;
      }
      
      // המשתמש לא חבר, נוסיף אותו
      const { error } = await supabase.from('channel_members').insert({ channel_id: channelId, user_id: user.id });
      if (error) {
        console.error('שגיאה בהצטרפות לקבוצה:', error);
        alert('שגיאה בהצטרפות לקבוצה: ' + error.message);
      } else {
        await fetchChannels();
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
    return <ActivityIndicator color="#00E654" style={{ marginTop: 40 }} />;
  }

  return (
    <View className="flex-1 bg-black px-4 py-6">
      <Text className="text-2xl font-bold text-white mb-6" style={{ textAlign: 'right' }}>רשימת קבוצות</Text>
      <FlatList
        data={channels}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isMember = myChannelIds.includes(item.id);
          return (
            <View className="flex-row-reverse items-center justify-between bg-[#181818] rounded-xl px-4 py-3 mb-3 border border-[#222]">
              <View className="flex-row-reverse items-center">
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} className="w-16 h-16 rounded-full ml-3 border-2 border-primary" style={{ shadowColor: '#00E654', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }} />
                ) : (
                  <MessageCircle size={32} color="#00E654" strokeWidth={2} style={{ marginLeft: 12 }} />
                )}
                <Text className="text-lg text-white font-bold" style={{ textAlign: 'right' }}>{item.name}</Text>
              </View>
              {isMember ? (
                <View className="bg-gray-700 px-4 py-2 rounded-xl">
                  <Text className="text-white font-bold">חבר</Text>
                </View>
              ) : (
                <Pressable onPress={() => handleJoin(item.id)} disabled={joining === item.id} className="bg-primary px-4 py-2 rounded-xl">
                  <Text className="text-black font-bold">הצטרף</Text>
                </Pressable>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text className="text-white text-center mt-10">אין קבוצות להצגה</Text>}
      />
    </View>
  );
} 