import React from 'react';
import { 
  View, 
  Text, 
  Modal, 
  Pressable, 
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ReactionPickerProps {
  visible: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
}

// רשימת אימוג'ים פופולריים
const POPULAR_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉',
  '🔥', '💯', '✨', '🌟', '💪', '🙏', '🤔', '😍',
  '😎', '🤩', '🥳', '😴', '🤯', '😱', '🥺', '😤'
];

export default function ReactionPicker({ 
  visible, 
  onClose, 
  onReaction 
}: ReactionPickerProps) {
  
  const handleReaction = (emoji: string) => {
    onReaction(emoji);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        className="flex-1 bg-black/50 justify-center items-center"
        onPress={onClose}
      >
        <View className="bg-[#1a1a1a] rounded-3xl p-6 mx-4 border border-[#333] max-w-sm">
          {/* Header */}
          <View className="items-center mb-6">
            <Text className="text-white text-lg font-bold mb-2">בחר ריאקציה</Text>
            <Text className="text-gray-400 text-sm text-center">
              בחר אימוג'י כדי להגיב להודעה
            </Text>
          </View>

          {/* Emojis Grid */}
          <ScrollView 
            className="max-h-80"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View className="flex-row flex-wrap justify-center">
              {POPULAR_EMOJIS.map((emoji, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleReaction(emoji)}
                  className="w-16 h-16 bg-[#2a2a2a] rounded-2xl items-center justify-center m-2 border border-[#444] active:bg-primary/20 active:border-primary"
                >
                  <Text className="text-2xl">{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Close Button */}
          <Pressable
            onPress={onClose}
            className="mt-4 bg-[#333] py-3 rounded-2xl items-center border border-[#444]"
          >
            <Text className="text-white font-semibold">ביטול</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
