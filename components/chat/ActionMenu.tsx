import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Animated, Pressable, Dimensions, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Copy, Share, Star, Flag, Trash2, Edit, Reply, Forward, Info, Pin } from 'lucide-react-native';
import { HapticFeedback } from '../../utils/hapticFeedback';

type ActionItem = {
  key: string;
  label: string;
  icon?: string;
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

  const getIcon = (iconName?: string, isDestructive?: boolean) => {
    const iconProps = { size: 20, color: isDestructive ? '#FF453A' : '#FFFFFF' };
    
    switch (iconName) {
      case 'copy': return <Copy {...iconProps} />;
      case 'share': return <Share {...iconProps} />;
      case 'star': return <Star {...iconProps} />;
      case 'flag': return <Flag {...iconProps} />;
      case 'trash': return <Trash2 {...iconProps} />;
      case 'edit': return <Edit {...iconProps} />;
      case 'reply': return <Reply {...iconProps} />;
      case 'forward': return <Forward {...iconProps} />;
      case 'info': return <Info {...iconProps} />;
      case 'pin': return <Pin {...iconProps} />;
      default: return null;
    }
  };

  const ActionRow = ({ item, isLast }: { item: ActionItem; isLast: boolean }) => {
    const [scaleValue] = useState(new Animated.Value(1));
    const [pressed, setPressed] = useState(false);

    const handlePressIn = () => {
      setPressed(true);
      Animated.spring(scaleValue, {
        toValue: 0.98,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      setPressed(false);
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    const handlePress = () => {
      HapticFeedback.selection();
        onClose(); 
        setTimeout(item.onPress, 100); 
    };

    return (
      <Animated.View
        style={[
          {
            borderBottomWidth: isLast ? 0 : 0.5,
            borderBottomColor: 'rgba(255,255,255,0.08)',
            transform: [{ scale: scaleValue }]
          }
        ]}
      >
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            {
         flexDirection: 'row', 
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 12,
              minHeight: 40,
              backgroundColor: pressed ? '#2A2A2A' : '#181818',
            }
          ]}
        >
         {/* אייקון */}
         {item.icon && (
            <View style={{ marginRight: 10, width: 20, alignItems: 'center' }}>
              {getIcon(item.icon, item.destructive)}
           </View>
         )}
         
         {/* טקסט */}
         <Text
           style={{ 
              color: item.destructive ? '#FF453A' : '#FFFFFF', 
              fontSize: 15,
              fontWeight: '400',
              flex: 1,
             textAlign: 'right',
           }}
         >
           {item.label}
         </Text>
    </Pressable>
      </Animated.View>
  );
  };
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
              marginBottom: 20,
              backgroundColor: '#181818',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
              overflow: 'hidden',
              width: 280,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)', 'rgba(255,255,255,0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ width: '100%' }}
              contentContainerStyle={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              {quickReactions.map((emoji, idx) => (
                <Pressable 
                  key={idx} 
                  onPress={() => handleReactionPress(emoji)}
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.85 : 1 }],
                    marginHorizontal: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    borderRadius: 20,
                    backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'transparent',
                  })}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </Pressable>
              ))}
              <Pressable 
                onPress={onOpenPicker} 
                style={({ pressed }) => ({
                  marginLeft: 12,
                  marginRight: 8,
                  transform: [{ scale: pressed ? 0.85 : 1 }],
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  borderRadius: 20,
                  backgroundColor: pressed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
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
              width: 220,
              backgroundColor: '#181818',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
              shadowColor: '#00E654',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
              marginTop: 8,
            }}
          >
            <LinearGradient
              colors={['rgba(0,230,84,0.05)', 'rgba(0,230,84,0.02)', 'rgba(0,230,84,0.08)']}
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