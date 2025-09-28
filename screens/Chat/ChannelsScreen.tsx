import React from 'react';
import { View, Text, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ChannelsList from '../../components/chat/ChannelsList';

export default function ChannelsScreen() {
  return (
    <View className="flex-1 bg-black">
      {/* Background Gradient */}
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      
      {/* Header - extends to top of screen */}
      <View className="flex-row-reverse items-center justify-between px-4 pt-12 pb-3 border-b border-gray-800 relative" style={{ minHeight: 80 }}>
        <LinearGradient
          colors={['rgba(0, 230, 84, 0.08)', 'rgba(0, 230, 84, 0.03)', 'rgba(0, 230, 84, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <ImageBackground
          source={{ uri: 'https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/backgrounds/transback.png' }}
          style={{
            position: 'absolute',
            top: 20, // Move down to avoid notch
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.3
          }}
          resizeMode="cover"
        />
        <Text className="text-2xl font-bold text-[#00E654] relative z-10">כל הקבוצות</Text>
      </View>
      <ChannelsList />
    </View>
  );
} 