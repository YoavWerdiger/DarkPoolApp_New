import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { DesignTokens } from '../ui/DesignTokens';

interface UnreadDividerProps {
  unreadCount: number;
  onPress?: () => void;
}

const UnreadDivider: React.FC<UnreadDividerProps> = ({ 
  unreadCount, 
  onPress 
}) => {
  console.log('🟢 UnreadDivider: Rendering with count:', unreadCount);
  
  if (unreadCount <= 0) {
    console.log('🔴 UnreadDivider: Not rendering - count is', unreadCount);
    return null;
  }

  return (
    <Pressable 
      onPress={onPress}
      className="my-4 mx-4"
      disabled={!onPress}
      style={{
        opacity: onPress ? 1 : 0.8
      }}
    >
      <View className="flex-row items-center justify-center">
        {/* קו שמאל */}
        <View 
          className="flex-1 h-[1px]" 
          style={{ 
            backgroundColor: DesignTokens.colors.border,
            shadowColor: DesignTokens.colors.border,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1
          }}
        />
        
        {/* טקסט במרכז */}
        <View 
          className="mx-4 px-4 py-2 rounded-full"
          style={{ 
            backgroundColor: DesignTokens.colors.primary,
            shadowColor: DesignTokens.colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 4,
            borderWidth: 1,
            borderColor: DesignTokens.colors.primary + '40'
          }}
        >
          <Text 
            className="text-sm font-bold text-center"
            style={{ 
              color: DesignTokens.colors.textPrimary,
              fontSize: DesignTokens.typography.fontSize.sm,
              fontWeight: DesignTokens.typography.fontWeight.bold
            }}
          >
            {unreadCount} הודעות חדשות
          </Text>
        </View>
        
        {/* קו ימין */}
        <View 
          className="flex-1 h-[1px]" 
          style={{ 
            backgroundColor: DesignTokens.colors.border,
            shadowColor: DesignTokens.colors.border,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1
          }}
        />
      </View>
    </Pressable>
  );
}

export default UnreadDivider;

