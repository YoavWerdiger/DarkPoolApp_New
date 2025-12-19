import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';

interface MessageStatusProps {
  isMe: boolean;
  messageStatus: string;
  readByCount: number;
  totalRecipients: number;
  onSeenByPress: () => void;
}

export default function MessageStatus({ 
  isMe, 
  messageStatus, 
  readByCount, 
  totalRecipients, 
  onSeenByPress 
}: MessageStatusProps) {
  const DesignTokens = useDesignTokens();
  if (!isMe) return null;

  const getReadReceiptStatus = () => {
    if (!totalRecipients) return null;
    
    // בדיקה לפי status ו-read_by
    if (messageStatus === 'sent' && readByCount === 0) {
      return { icon: '✓', color: DesignTokens.colors.text.tertiary }; // נשלח אבל לא נקרא על ידי אף אחד
    } else if (readByCount > 0 && readByCount >= totalRecipients) {
      return { icon: '✓✓', color: DesignTokens.colors.primary.main }; // נקרא על ידי כולם - ירוק
    } else if (readByCount > 0 && readByCount < totalRecipients) {
      return { icon: '✓✓', color: DesignTokens.colors.text.tertiary }; // נקרא על ידי חלק - אפור
    } else {
      return { icon: '✓', color: DesignTokens.colors.text.tertiary }; // ברירת מחדל - נשלח
    }
  };

  const getMessageStatusIcon = () => {
    let icon = '';
    let color = DesignTokens.colors.text.tertiary;
    
    switch (messageStatus) {
      case 'sent':
        icon = 'checkmark';
        color = DesignTokens.colors.text.tertiary;
        break;
      case 'delivered':
        icon = 'checkmark-done';
        color = DesignTokens.colors.text.tertiary;
        break;
      case 'read':
        icon = 'checkmark-done';
        color = DesignTokens.colors.primary.main;
        break;
    }
    
    return { icon, color };
  };

  const statusIcon = getMessageStatusIcon();
  const readReceipt = getReadReceiptStatus();

  return (
    <View className="flex-row items-center">
      {/* סטטוס שליחה - רק אם יש read receipts */}
      {readReceipt && (
        <View className="mr-1">
          <Ionicons name={statusIcon.icon as any} size={12} color={statusIcon.color} />
        </View>
      )}
      
      {/* Read Receipts - קומפקטי יותר */}
      <Pressable 
        onPress={onSeenByPress} 
        className="mr-1"
      >
        <Text 
          className="text-xs" 
          style={{ 
            color: readReceipt?.color || DesignTokens.colors.text.tertiary,
            fontSize: 10,
            fontWeight: '500' as const
          }}
        >
          {readReceipt?.icon || '✓'}
        </Text>
      </Pressable>
    </View>
  );
}
