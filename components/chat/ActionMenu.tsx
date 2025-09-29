import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Animated, Pressable, Dimensions, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';

type ActionItem = {
  key: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

interface ActionMenuProps {
  visible: boolean;
  onClose: () => void;
  isMe: boolean;
  items: ActionItem[];
  preview?: React.ReactNode;
  onReact?: (emoji: string) => void;
  onOpenPicker?: () => void;
  messageId?: string;
  currentReactions?: { [emoji: string]: string[] };
}

export default function ActionMenu({ 
  visible, 
  onClose, 
  isMe, 
  items, 
  preview, 
  onReact, 
  onOpenPicker, 
  messageId, 
  currentReactions = {} 
}: ActionMenuProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(20);
    }
  }, [visible, opacity, translateY]);

  const handleReactionPress = (emoji: string) => {
    setSelectedReaction(emoji);
    onReact?.(emoji);
    setTimeout(() => {
      onClose();
    }, 150);
  };

  const ActionRow = ({ item, isLast }: { item: ActionItem; isLast: boolean }) => (
    <Pressable
      onPress={() => { 
        onClose(); 
        setTimeout(item.onPress, 100); 
      }}
      style={({ pressed }) => ({
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent',
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
      })}
    >
      <Text style={{ 
        color: item.destructive ? '#ff6b6b' : '#ffffff', 
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'right',
        letterSpacing: 0.2,
      }}>
        {item.label}
      </Text>
    </Pressable>
  );

  const screen = Dimensions.get('window');
  const width = Math.min(280, screen.width - 40);
  const quickReactions = ['👍','❤️','😂','😮','😢','🙏','🔥','💯','🎉','👏'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1 }}>
        {/* רקע מטושטש */}
        <BlurView intensity={80} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        
        {/* תוכן התפריט */}
        <Animated.View
          style={{
            position: 'absolute',
            top: Math.max(120, screen.height * 0.3),
            right: 20,
            alignItems: 'flex-end',
            opacity,
            transform: [{ translateY }],
          }}
          pointerEvents="box-none"
        >
          {/* ריאקשנים מהירים */}
          <View
            style={{
              alignSelf: 'flex-end',
              marginBottom: 16,
              backgroundColor: 'rgba(20,20,20,0.95)',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              overflow: 'hidden',
              width: 300,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ width: '100%' }}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              {quickReactions.map((emoji, idx) => (
                <Pressable 
                  key={idx} 
                  onPress={() => handleReactionPress(emoji)}
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.85 : 1 }],
                    marginHorizontal: 4,
                    paddingVertical: 8,
                    paddingHorizontal: 6,
                    borderRadius: 16,
                    backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
                  })}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </Pressable>
              ))}
              <Pressable 
                onPress={onOpenPicker} 
                style={({ pressed }) => ({
                  marginLeft: 16,
                  marginRight: 12,
                  transform: [{ scale: pressed ? 0.85 : 1 }],
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                  backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                })}
              >
                <Plus size={24} color="#ffffff" strokeWidth={2} />
              </Pressable>
            </ScrollView>
          </View>

          {/* תצוגה מקדימה של ההודעה */}
          {preview && (
            <View
              style={{
                marginBottom: 16,
                alignSelf: 'flex-end',
                maxWidth: width,
                opacity: 0.7,
              }}
            >
              {preview}
            </View>
          )}

          {/* תפריט הפעולות */}
          <View
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              width: 300,
              backgroundColor: 'rgba(20,20,20,0.95)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.02)', 'transparent', 'rgba(255,255,255,0.01)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {items.map((item, i) => (
              <ActionRow key={item.key} item={item} isLast={i === items.length - 1} />
            ))}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}