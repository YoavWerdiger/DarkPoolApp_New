import { useDesignTokens } from "../ui/DesignTokens";
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
import UIBottomSheet from '../ui/UIBottomSheet';

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
      <UIBottomSheet
        visible={visible}
        onClose={onClose}
        maxHeight="80%"
        dragToClose={true}
        contentStyle={{ padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 200 }}
      >
        <ActivityIndicator size="large" color="#00E654" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>טוען ריאקציות...</Text>
      </UIBottomSheet>
    );
  }

  return (
    <UIBottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight="80%"
      dragToClose={true}
      contentStyle={{ padding: 0 }}
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>

            {/* Header */}
            <View style={{ 
              flexDirection: 'row-reverse', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: 20 
            }}>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 20, 
                fontWeight: '700', 
                textAlign: 'right' 
              }}>
                ריאקציות
              </Text>
              <Pressable 
                onPress={onClose}
                style={{ padding: 8 }}
              >
                <X size={24} color="#FFFFFF" strokeWidth={2.5} />
              </Pressable>
            </View>

            {/* Tabs */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
              contentContainerStyle={{ flexDirection: 'row-reverse' }}
            >
              <Pressable
                onPress={() => setSelectedTab('all')}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 16,
                  marginLeft: 8,
                  backgroundColor: selectedTab === 'all' ? '#00E654' : 'rgba(255,255,255,0.08)'
                }}
              >
                <Text style={{
                  fontWeight: '600',
                  fontSize: 15,
                  color: selectedTab === 'all' ? '#000000' : '#999999'
                }}>
                  הכל {allReactions.length}
                </Text>
              </Pressable>
              
              {reactionTypes.map(emoji => (
                <Pressable
                  key={emoji}
                  onPress={() => setSelectedTab(emoji)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 16,
                    marginLeft: 8,
                    backgroundColor: selectedTab === emoji ? '#00E654' : 'rgba(255,255,255,0.08)'
                  }}
                >
                  <View style={{ alignItems: 'center', flexDirection: 'row' }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>{emoji}</Text>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: selectedTab === emoji ? '#000000' : '#999999'
                    }}>
                      {reactionDetails.find(r => r.emoji === emoji)?.count}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            {/* Users List */}
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {filteredReactions.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Text style={{ color: '#999999', fontSize: 16 }}>אין ריאקציות</Text>
                </View>
              ) : (
                filteredReactions.map((reaction, index) => (
                  <View 
                    key={index} 
                    style={{ 
                      flexDirection: 'row-reverse', 
                      alignItems: 'center', 
                      paddingVertical: 14,
                      borderBottomWidth: index < filteredReactions.length - 1 ? 1 : 0,
                      borderBottomColor: 'rgba(255,255,255,0.05)'
                    }}
                  >
                    <View style={{ 
                      width: 40, 
                      height: 40, 
                      backgroundColor: 'rgba(0,230,84,0.15)', 
                      borderRadius: 20, 
                      marginLeft: 12, 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      <User size={20} color="#00E654" strokeWidth={2} />
                    </View>
                    <Text style={{ 
                      color: '#FFFFFF', 
                      flex: 1, 
                      fontSize: 16, 
                      textAlign: 'right',
                      fontWeight: '500'
                    }}>
                      {reaction.userName}
                    </Text>
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{reaction.emoji}</Text>
                  </View>
                ))
              )}
            </ScrollView>
      </View>
    </UIBottomSheet>
  );
}
