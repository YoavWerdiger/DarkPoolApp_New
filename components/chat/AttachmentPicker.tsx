import React from 'react';
import { View, Text, Pressable, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { X, ImageIcon, FileText, Mic } from 'lucide-react-native';
import { useState, useRef, useEffect } from 'react';

interface AttachmentPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectImage: () => void;
  onSelectFile: () => void;
  onSelectVoice: () => void;
}

export default function AttachmentPicker({
  visible,
  onClose,
  onSelectImage,
  onSelectFile,
  onSelectVoice,
}: AttachmentPickerProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSelect = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      callback();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View 
        className="flex-1 bg-black/50 justify-end"
        style={{ opacity: fadeAnim }}
      >
        <Pressable className="flex-1" onPress={onClose} />
        <Animated.View 
          className="bg-[#181818] rounded-t-3xl p-6"
          style={{ 
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-xl font-bold">בחר קובץ</Text>
            <Pressable 
              onPress={onClose}
              className="p-2 rounded-full bg-[#222]"
            >
              <X size={24} color="#fff" strokeWidth={2} />
            </Pressable>
          </View>

          <View className="flex-row justify-around">
            <Pressable
              onPress={() => handleSelect(onSelectImage)}
              className="items-center bg-[#222] p-6 rounded-2xl flex-1 mx-2 active:bg-[#333]"
            >
              <View className="w-16 h-16 bg-primary/20 rounded-full items-center justify-center mb-3">
                <ImageIcon size={32} color="#00E654" strokeWidth={2} />
              </View>
              <Text className="text-white text-sm font-medium">תמונה</Text>
            </Pressable>

            <Pressable
              onPress={() => handleSelect(onSelectFile)}
              className="items-center bg-[#222] p-6 rounded-2xl flex-1 mx-2 active:bg-[#333]"
            >
              <View className="w-16 h-16 bg-primary/20 rounded-full items-center justify-center mb-3">
                <FileText size={32} color="#00E654" strokeWidth={2} />
              </View>
              <Text className="text-white text-sm font-medium">קובץ</Text>
            </Pressable>

            <Pressable
              onPress={() => handleSelect(onSelectVoice)}
              className="items-center bg-[#222] p-6 rounded-2xl flex-1 mx-2 active:bg-[#333]"
            >
              <View className="w-16 h-16 bg-primary/20 rounded-full items-center justify-center mb-3">
                <Mic size={32} color="#00E654" strokeWidth={2} />
              </View>
              <Text className="text-white text-sm font-medium">הקלטה</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
} 