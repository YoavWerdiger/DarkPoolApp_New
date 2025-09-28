import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { X, User } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated } from 'react-native';
import { ReactionDetail } from '../../services/supabase';

interface ReactionDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  messageId: string;
}

export default function ReactionDetailsModal({
  visible,
  onClose,
  messageId
}: ReactionDetailsModalProps) {
  const [reactionDetails, setReactionDetails] = useState<ReactionDetail[]>([]);
  const [selectedTab, setSelectedTab] = useState<'all' | string>('all');
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // טעינת פירוט הריאקציות
  useEffect(() => {
    if (visible && messageId) {
      loadReactionDetails();
    }
  }, [visible, messageId]);

  // Fade overlay in/out
  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

  const loadReactionDetails = async () => {
    setLoading(true);
    try {
      // Dynamic import כדי למנוע בעיות
      const ChatService = await import('../../services/chatService');
      const details = await ChatService.ChatService.getReactionDetails(messageId);
      setReactionDetails(details);
    } catch (error) {
      console.error('Error loading reaction details:', error);
    } finally {
      setLoading(false);
    }
  };

  // קבלת כל סוגי הריאקציות
  const reactionTypes = reactionDetails.map(r => r.emoji);
  const allReactions = reactionDetails.flatMap(r => 
    r.user_ids.map((userId, index) => ({
      emoji: r.emoji,
      userId,
      userName: r.user_names[index] || 'משתמש לא ידוע'
    }))
  );

  // סינון לפי טאב נבחר
  const filteredReactions = selectedTab === 'all' 
    ? allReactions 
    : allReactions.filter(r => r.emoji === selectedTab);

  if (loading) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="none"
        onRequestClose={onClose}
      >
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', opacity: fadeAnim, justifyContent: 'flex-end' }}>
          <View className="bg-[#1a1a1a] rounded-t-3xl p-6 items-center justify-center min-h-[200px] relative overflow-hidden">
            <LinearGradient
              colors={['rgba(0, 230, 84, 0.10)', 'rgba(0, 0, 0, 0.08)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <ActivityIndicator size="large" color="#007AFF" />
            <Text className="text-white mt-4">טוען ריאקציות...</Text>
          </View>
        </Animated.View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', opacity: fadeAnim, justifyContent: 'flex-end' }}>
        <View className="bg-[#1a1a1a] rounded-t-3xl p-6 max-h-[80%] relative overflow-hidden">
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.10)', 'rgba(0, 0, 0, 0.08)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Header */}
          <View className="flex-row-reverse items-center justify-between mb-6">
            <Text className="text-white text-xl font-bold text-right">ריאקציות</Text>
            <Pressable 
              onPress={onClose}
              className="w-8 h-8 bg-[#333] rounded-full items-center justify-center"
            >
              <X size={20} color="white" strokeWidth={2} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View className="flex-row-reverse mb-6">
            <Pressable
              onPress={() => setSelectedTab('all')}
              className={`px-4 py-2 rounded-full ml-2 ${
                selectedTab === 'all' ? 'bg-primary' : 'bg-[#333]'
              }`}
            >
              <Text className={`font-semibold ${
                selectedTab === 'all' ? 'text-white' : 'text-gray-400'
              }`}>
                הכל {allReactions.length}
              </Text>
            </Pressable>
            
            {reactionTypes.map(emoji => (
              <Pressable
                key={emoji}
                onPress={() => setSelectedTab(emoji)}
                className={`px-4 py-2 rounded-full ml-2 ${
                  selectedTab === emoji ? 'bg-primary' : 'bg-[#333]'
                }`}
              >
                <View className="items-center">
                  <Text className="text-lg">{emoji}</Text>
                  <Text className={`text-xs ${
                    selectedTab === emoji ? 'text-white' : 'text-gray-400'
                  }`}>
                    {reactionDetails.find(r => r.emoji === emoji)?.count}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Users List */}
          <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
            {filteredReactions.length === 0 ? (
              <View className="items-center py-8">
                <Text className="text-gray-400 text-lg">אין ריאקציות</Text>
              </View>
            ) : (
              filteredReactions.map((reaction, index) => (
                <View key={index} className="flex-row-reverse items-center py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <View className="w-10 h-10 bg-[#333] rounded-full ml-3 items-center justify-center">
                    <User size={20} color="#666" strokeWidth={2} />
                  </View>
                  <Text className="text-white flex-1 text-base text-right">{reaction.userName}</Text>
                  <Text className="text-2xl">{reaction.emoji}</Text>
                </View>
              ))
            )}
          </ScrollView>

          {/* Close Button */}
          <Pressable
            onPress={onClose}
            className="mt-6 bg-[#333] py-3 rounded-2xl items-center border border-[#444]"
          >
            <Text className="text-white font-semibold text-base">סגור</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}
