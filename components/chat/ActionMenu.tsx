import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Animated, Pressable, Dimensions, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Plus } from 'lucide-react-native';

type ActionItem = {
  key: string;
  label: string;
  icon: string;
  destructive?: boolean;
  onPress: () => void;
};

interface ActionMenuProps {
  visible: boolean;
  onClose: () => void;
  isMe: boolean;
  items: ActionItem[];
  preview?: React.ReactNode; // תוכן הבועה לשכפול
  onReact?: (emoji: string) => void;
  onOpenPicker?: () => void;
  messageId?: string;
  currentReactions?: { [emoji: string]: string[] }; // ריאקשנים קיימים
}

export default function ActionMenu({ visible, onClose, isMe, items, preview, onReact, onOpenPicker, messageId, currentReactions = {} }: ActionMenuProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(20);
    }
  }, [visible, opacity, translateY]);

  const handleReactionPress = (emoji: string) => {
    setSelectedReaction(emoji);
    onReact?.(emoji);
    // סגירת התפריט אחרי בחירת ריאקשן
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const ActionRow = ({ item, isLast }: { item: ActionItem; isLast: boolean }) => (
    <View>
      <Pressable
        onPress={() => { onClose(); setTimeout(item.onPress, 0); }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          height: 50,
          paddingLeft: 15,
          paddingRight: 15,
          backgroundColor: pressed ? 'rgba(0,230,84,0.08)' : 'transparent',
        })}
      >
        <Ionicons 
          name={item.icon as any} 
          size={18} 
          color={item.destructive ? '#ff3b30' : '#E5E7EB'} 
        />
        <Text style={{ 
          color: item.destructive ? '#ff3b30' : '#E5E7EB', 
          fontSize: 14,
          fontWeight: '500',
          marginLeft: 12,
          flex: 1,
          textAlign: 'right'
        }}>{item.label}</Text>
      </Pressable>
      {!isLast && (
        <View style={{
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.1)',
          marginLeft: 45,
          marginRight: 15
        }} />
      )}
    </View>
  );

  const screen = Dimensions.get('window');
  const width = Math.min(260, screen.width - 40);
  const quickReactions = ['👍','❤️','😂','😮','😢','🙏','🔥','💯','🎉','👏'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1 }}>
        {/* שכבת טשטוש */}
        <BlurView intensity={60} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
        
        {/* תוכן התפריט */}
        <Animated.View
          style={{
            position: 'absolute',
            top: Math.max(100, screen.height * 0.25),
            right: 20,
            alignItems: 'flex-end',
            opacity,
            transform: [{ translateY }],
          }}
          pointerEvents="box-none"
        >
          {/* ריאקשנים - מוצמדים מעל הבועה עם מרווח מתחת */}
          <View
            style={{
              alignSelf: 'flex-end',
              marginBottom: 14,
              backgroundColor: '#141414',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(0,230,84,0.3)',
              overflow: 'hidden',
              width: 280,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <LinearGradient
              colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ width: '100%' }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              {quickReactions.map((e, idx) => (
                <Pressable 
                  key={idx} 
                  onPress={() => handleReactionPress(e)}
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                    marginHorizontal: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 4,
                    borderRadius: 12,
                    backgroundColor: pressed ? 'rgba(0,230,84,0.1)' : 'transparent',
                  })}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Pressable>
              ))}
              <Pressable 
                onPress={onOpenPicker} 
                style={({ pressed }) => ({
                  marginLeft: 12,
                  marginRight: 8,
                  transform: [{ scale: pressed ? 0.9 : 1 }],
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  borderRadius: 12,
                  backgroundColor: pressed ? 'rgba(0,230,84,0.15)' : 'rgba(0,230,84,0.08)',
                })}
              >
                <Plus size={22} color="#00E654" strokeWidth={2} />
              </Pressable>
            </ScrollView>
          </View>

          {/* פריוויו של הבועה - קטן */}
          <View
            style={{
              marginBottom: 14,
              alignSelf: 'flex-end',
              maxWidth: width,
            }}
          >
            {preview}
          </View>

          {/* רשימת פעולות - בגוון האפור של האפליקציה עם גרדיאנט חדשני */}
          <View
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              width: 280,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              backgroundColor: '#1A1A1A',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.28,
              shadowRadius: 12,
              elevation: 10,
            }}
          >
            <LinearGradient
              colors={['rgba(0, 230, 84, 0.03)', 'transparent', 'rgba(0, 230, 84, 0.02)']}
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


