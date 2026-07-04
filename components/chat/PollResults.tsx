import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Users, Lock } from 'lucide-react-native';
import { PollOption } from '../../services/pollService';
import { chatPalette } from './chatDesignTokens';

interface PollResultsProps {
  options: PollOption[];
  userVotes: string[];
  totalVotes: number;
  multipleChoice: boolean;
  isLocked: boolean;
}

export default function PollResults({
  options,
  userVotes,
  totalVotes,
  multipleChoice,
  isLocked
}: PollResultsProps) {
  const getVotePercentage = (votesCount: number): number => {
    if (totalVotes === 0) return 0;
    return Math.round((votesCount / totalVotes) * 100);
  };

  const getVoteColor = (votesCount: number): string => {
    if (votesCount === 0) return 'rgba(255,255,255,0.2)';
    const percentage = getVotePercentage(votesCount);
    if (percentage > 50) return chatPalette.primary;
    if (percentage > 25) return chatPalette.success;
    if (percentage > 10) return chatPalette.warning;
    return chatPalette.danger;
  };

  const isUserVoted = (optionId: string): boolean => {
    return userVotes.includes(optionId);
  };

  const getVoteIcon = (optionId: string): string => {
    if (!isUserVoted(optionId)) return '';
    
    if (multipleChoice) {
      return 'checkmark-circle';
    } else {
      return 'radio-button-on';
    }
  };

  return (
    <View className="mt-4">
      {/* Results Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white font-bold text-lg">תוצאות ההצבעה</Text>
        <View className="flex-row items-center">
          <Users size={16} color={chatPalette.primary} strokeWidth={2} />
          <Text className="text-primary text-sm mr-1">
            {totalVotes} הצבעות
          </Text>
          {isLocked && (
            <View className="flex-row items-center mr-2">
              <Lock size={14} color="#ff6b6b" strokeWidth={2} />
              <Text className="text-red-400 text-xs mr-1">נעול</Text>
            </View>
          )}
        </View>
      </View>

      {/* Results List */}
      {options.map((option, index) => {
        const percentage = getVotePercentage(option.votes_count);
        const isVoted = isUserVoted(option.id);
        const voteIcon = getVoteIcon(option.id);
        
        return (
          <View key={option.id} className="mb-3">
            {/* Option Row */}
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center flex-1">
                {/* Vote Icon */}
                {voteIcon && (
                  <Ionicons
                    name={voteIcon as any}
                    size={20}
                    color={chatPalette.primary}
                    style={{ marginRight: 8 }}
                  />
                )}
                
                {/* Option Text */}
                <Text className="text-white text-base flex-1" numberOfLines={2}>
                  {option.text}
                </Text>
              </View>
              
              {/* Vote Count & Percentage */}
              <View className="items-end">
                <Text className="text-white font-bold text-sm">
                  {option.votes_count}
                </Text>
                <Text className="text-gray-400 text-xs">
                  {percentage}%
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View className="bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: getVoteColor(option.votes_count)
                }}
              />
            </View>

            {/* Option Details */}
            <View className="flex-row items-center justify-between mt-1">
              <Text className="text-gray-400 text-xs">
                {isVoted ? 'בחרת באפשרות זו' : 'לא בחרת'}
              </Text>
              
            </View>
          </View>
        );
      })}

    </View>
  );
}
