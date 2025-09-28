import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Mic, FileText, MessageCircle, RotateCcw, Copy, Edit, Heart } from 'lucide-react-native';
import { Message, ReactionSummary } from '../../services/supabase';
import { MediaFile } from '../../services/mediaService';
import { DesignTokens } from '../ui/DesignTokens';

interface MessageActionSheetProps {
  visible: boolean;
  onClose: () => void;
  message: Message;
  reactions: ReactionSummary[];
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onReact: () => void;
  onReactionDetails: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  canPin?: boolean;
  canEdit?: boolean;
  isPinned?: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MessageActionSheet({
  visible,
  onClose,
  message,
  reactions,
  onReply,
  onForward,
  onCopy,
  onReact,
  onReactionDetails,
  onEdit,
  onPin,
  onUnpin,
  canPin = false,
  canEdit = false,
  isPinned = false
}: MessageActionSheetProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  // רנדור תוכן ההודעה
  const renderMessageContent = () => {
    if (message.type === 'image' || message.type === 'video') {
      return (
        <View className="w-16 h-16 bg-[#333] rounded-xl items-center justify-center mr-3">
          <Ionicons 
            name={message.type === 'image' ? 'image' : 'videocam'} 
            size={24} 
            color="#666" 
          />
        </View>
      );
    }
    
    if (message.type === 'audio' || message.type === 'voice') {
      return (
        <View className="w-16 h-16 bg-[#333] rounded-xl items-center justify-center mr-3">
          <Mic size={24} color="#666" strokeWidth={2} />
        </View>
      );
    }
    
    if (message.type === 'file' || message.type === 'document') {
      return (
        <View className="w-16 h-16 bg-[#333] rounded-xl items-center justify-center mr-3">
          <FileText size={24} color="#666" strokeWidth={2} />
        </View>
      );
    }

    // הודעת טקסט
    return (
      <View className="flex-1 mr-3">
        <Text className="text-white text-base leading-5" numberOfLines={3}>
          {message.content}
        </Text>
      </View>
    );
  };

  // רנדור ריאקציות
  const renderReactions = () => {
    if (!reactions || reactions.length === 0) return null;

    const displayReactions = reactions.slice(0, 5); // עד 5 ריאקציות
    const remainingCount = reactions.length > 5 ? reactions.length - 5 : 0;

    return (
      <View className="flex-row items-center justify-center mb-4">
        {displayReactions.map((reaction, index) => (
          <Pressable
            key={index}
            onPress={onReactionDetails}
            className="px-3 py-2 rounded-full border mx-1 items-center justify-center"
            style={{
              backgroundColor: 'rgba(26, 26, 26, 0.7)',
              borderColor: 'rgba(51, 51, 51, 0.5)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3,
              minWidth: 40,
              minHeight: 36
            }}
          >
            <Text className="text-base">{reaction.emoji}</Text>
            {reaction.count > 1 && (
              <Text className="text-xs text-gray-400 mt-1 font-medium">
                {reaction.count}
              </Text>
            )}
          </Pressable>
        ))}
        
        {remainingCount > 0 && (
          <View className="px-3 py-2 rounded-full border mx-1 items-center justify-center"
            style={{
              backgroundColor: 'rgba(26, 26, 26, 0.7)',
              borderColor: 'rgba(51, 51, 51, 0.5)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3,
              minWidth: 40,
              minHeight: 36
            }}>
            <Text className="text-sm text-gray-400 font-medium">
              +{remainingCount}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View 
        className="flex-1"
        style={{ opacity: fadeAnim }}
      >
        {/* Blur Background */}
        <Pressable 
          className="flex-1 bg-black/60"
          onPress={onClose}
        />
        
        {/* Message Preview */}
        <View className="absolute top-20 left-4 right-4">
          <View className="bg-[#111111] rounded-3xl p-4" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
            borderWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.08)'
          }}>
            <View className="flex-row items-start">
              {renderMessageContent()}
              
              {/* פרטי ההודעה */}
              <View className="flex-1">
                <Text className="text-gray-400 text-sm mb-1">
                  {message.sender?.full_name || 'משתמש'}
                </Text>
                <Text className="text-gray-500 text-xs">
                  {new Date(message.created_at).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Reactions Bar */}
        {renderReactions()}

        {/* Action Menu */}
        <Animated.View 
          className="absolute bottom-0 left-0 right-0"
          style={{
            transform: [{ translateY: slideAnim }]
          }}
        >
          <View 
            className="rounded-t-3xl p-6" 
            style={{
              backgroundColor: DesignTokens.colors.surface,
              borderTopWidth: 0.5,
              borderTopColor: DesignTokens.colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
              elevation: 10
            }}
          >
            {/* Header */}
            <View className="items-center mb-6">
              <View 
                className="w-12 h-1 rounded-full mb-4" 
                style={{ backgroundColor: DesignTokens.colors.border }}
              />
              <Text 
                className="text-lg font-bold"
                style={{ 
                  color: DesignTokens.colors.textPrimary,
                  fontSize: DesignTokens.typography.fontSize.lg,
                  fontWeight: DesignTokens.typography.fontWeight.bold
                }}
              >
                פעולות הודעה
              </Text>
            </View>

            {/* Actions Grid */}
            <View className="flex-row flex-wrap justify-center">
              {/* Reply */}
              <Pressable
                onPress={() => handleAction(onReply)}
                className="w-20 h-20 rounded-2xl items-center justify-center m-2"
                style={{
                  backgroundColor: DesignTokens.colors.elevated,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                  borderWidth: 0.5,
                  borderColor: DesignTokens.colors.border
                }}
              >
                <MessageCircle size={28} color={DesignTokens.colors.accent} strokeWidth={2} />
                <Text 
                  className="text-xs font-semibold mt-2"
                  style={{ 
                    color: DesignTokens.colors.textPrimary,
                    fontSize: DesignTokens.typography.fontSize.xs,
                    fontWeight: DesignTokens.typography.fontWeight.semibold
                  }}
                >
                  תגובה
                </Text>
              </Pressable>

              {/* Forward */}
              <Pressable
                onPress={() => handleAction(onForward)}
                className="w-20 h-20 rounded-2xl items-center justify-center m-2"
                style={{
                  backgroundColor: DesignTokens.colors.elevated,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                  borderWidth: 0.5,
                  borderColor: DesignTokens.colors.border
                }}
              >
                <RotateCcw size={28} color={DesignTokens.colors.warning} strokeWidth={2} />
                <Text 
                  className="text-xs font-semibold mt-2"
                  style={{ 
                    color: DesignTokens.colors.textPrimary,
                    fontSize: DesignTokens.typography.fontSize.xs,
                    fontWeight: DesignTokens.typography.fontWeight.semibold
                  }}
                >
                  העבר
                </Text>
              </Pressable>

              {/* Copy */}
              <Pressable
                onPress={() => handleAction(onCopy)}
                className="w-20 h-20 rounded-2xl items-center justify-center m-2"
                style={{
                  backgroundColor: DesignTokens.colors.elevated,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                  borderWidth: 0.5,
                  borderColor: DesignTokens.colors.border
                }}
              >
                <Copy size={28} color={DesignTokens.colors.success} strokeWidth={2} />
                <Text 
                  className="text-xs font-semibold mt-2"
                  style={{ 
                    color: DesignTokens.colors.textPrimary,
                    fontSize: DesignTokens.typography.fontSize.xs,
                    fontWeight: DesignTokens.typography.fontWeight.semibold
                  }}
                >
                  העתק
                </Text>
              </Pressable>

              {/* Edit - Only show if canEdit is true */}
              {canEdit && onEdit && (
                <Pressable
                  onPress={() => handleAction(onEdit)}
                  className="w-20 h-20 rounded-2xl items-center justify-center m-2"
                  style={{
                    backgroundColor: DesignTokens.colors.elevated,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 3,
                    borderWidth: 0.5,
                    borderColor: DesignTokens.colors.border
                  }}
                >
                  <Edit size={28} color={DesignTokens.colors.warning} strokeWidth={2} />
                  <Text 
                    className="text-xs font-semibold mt-2"
                    style={{ 
                      color: DesignTokens.colors.textPrimary,
                      fontSize: DesignTokens.typography.fontSize.xs,
                      fontWeight: DesignTokens.typography.fontWeight.semibold
                    }}
                  >
                    ערוך
                  </Text>
                </Pressable>
              )}

              {/* React */}
              <Pressable
                onPress={() => handleAction(onReact)}
                className="w-20 h-20 rounded-2xl items-center justify-center m-2"
                style={{
                  backgroundColor: DesignTokens.colors.elevated,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3,
                  borderWidth: 0.5,
                  borderColor: DesignTokens.colors.border
                }}
              >
                <Heart size={28} color={DesignTokens.colors.danger} strokeWidth={2} />
                <Text 
                  className="text-xs font-semibold mt-2"
                  style={{ 
                    color: DesignTokens.colors.textPrimary,
                    fontSize: DesignTokens.typography.fontSize.xs,
                    fontWeight: DesignTokens.typography.fontWeight.semibold
                  }}
                >
                  ריאקציה
                </Text>
              </Pressable>

              {/* Star/Unstar - Only show if user can star */}
              {canPin && (
                <Pressable
                  onPress={() => handleAction(isPinned ? onUnpin : onPin)}
                  className="w-20 h-20 bg-[#1F1F1F] rounded-2xl items-center justify-center m-2 active:bg-yellow-500/20"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 3,
                    borderWidth: 0.5,
                    borderColor: 'rgba(255,255,255,0.1)'
                  }}
                >
                  <Ionicons 
                    name={isPinned ? "star" : "star-outline"} 
                    size={28} 
                    color={isPinned ? "#FFD700" : "#FFD700"} 
                  />
                  <Text className="text-white text-xs font-semibold mt-2">
                    {isPinned ? 'הסר כוכב' : 'סמן בכוכב'}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Close Button */}
            <Pressable
              onPress={onClose}
              className="mt-6 bg-[#1F1F1F] py-4 rounded-2xl items-center"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 3,
                borderWidth: 0.5,
                borderColor: 'rgba(255,255,255,0.1)'
              }}
            >
              <Text className="text-white font-semibold text-base">ביטול</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

