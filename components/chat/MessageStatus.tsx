import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens } from '../ui/DesignTokens';

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
  if (!isMe) return null;

  const getReadReceiptStatus = () => {
    if (!totalRecipients) return null;
    
    // בדיקה לפי status ו-read_by
    if (messageStatus === 'sent' && readByCount === 0) {
      return { icon: '✓', color: DesignTokens.colors.textMuted }; // נשלח אבל לא נקרא על ידי אף אחד
    } else if (readByCount > 0 && readByCount >= totalRecipients) {
      return { icon: '✓✓', color: DesignTokens.colors.primary }; // נקרא על ידי כולם - ירוק
    } else if (readByCount > 0 && readByCount < totalRecipients) {
      return { icon: '✓✓', color: DesignTokens.colors.textMuted }; // נקרא על ידי חלק - אפור
    } else {
      return { icon: '✓', color: DesignTokens.colors.textMuted }; // ברירת מחדל - נשלח
    }
  };

  const getMessageStatusIcon = () => {
    let icon = '';
    let color = DesignTokens.colors.textMuted;
    
    switch (messageStatus) {
      case 'sent':
        icon = 'checkmark';
        color = DesignTokens.colors.textMuted;
        break;
      case 'delivered':
        icon = 'checkmark-done';
        color = DesignTokens.colors.textMuted;
        break;
      case 'read':
        icon = 'checkmark-done';
        color = DesignTokens.colors.primary;
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
            color: readReceipt?.color || DesignTokens.colors.textMuted,
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
