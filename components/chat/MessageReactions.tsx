import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { DesignTokens } from '../ui/DesignTokens';
import { ReactionSummary } from '../../services/supabase';

interface MessageReactionsProps {
  reactions: ReactionSummary[];
  onReactionDetails: () => void;
}

export default function MessageReactions({ reactions, onReactionDetails }: MessageReactionsProps) {
  if (!reactions || reactions.length === 0) return null;

  const displayReactions = reactions.slice(0, 3); // רק 3 הראשונות
  const remainingCount = reactions.length > 3 ? reactions.length - 3 : 0;

  return (
    <Pressable 
      onPress={onReactionDetails}
      className="absolute -bottom-3 left-2 flex-row items-center"
    >
      {/* בועות הריאקציה */}
      <View className="flex-row">
        {displayReactions.map((reaction, index) => (
          <View
            key={index}
            className="px-2 py-1 rounded-full border items-center justify-center"
            style={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              borderColor: 'rgba(0,230,84,0.3)',
              borderWidth: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
              minWidth: 32,
              minHeight: 28,
              marginLeft: index > 0 ? -6 : 0, // חיבור הבועות
              zIndex: reactions.length - index // שכבות
            }}
          >
            <Text className="text-xs">{reaction.emoji}</Text>
            {reaction.count > 1 && (
              <Text className="text-xs text-gray-400 ml-1 font-medium">
                {reaction.count}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* +X אם יש יותר מ-3 */}
      {remainingCount > 0 && (
        <View className="px-2 py-1 rounded-full border ml-1 items-center justify-center"
          style={{
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderColor: 'rgba(0,230,84,0.3)',
            borderWidth: 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 4,
            minWidth: 32,
            minHeight: 28
          }}>
          <Text className="text-xs text-gray-400 font-medium">
            +{remainingCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
