import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Lock, Trash2, Clock, X } from 'lucide-react-native';
import { PollService, PollWithVotes, PollOption } from '../../services/pollService';
import PollResults from './PollResults';
import { useAuth } from '../../context/AuthContext';

interface PollMessageProps {
  poll: PollWithVotes;
  chatId: string;
  onPollUpdated: (updatedPoll: PollWithVotes) => void;
  isAdmin?: boolean;
  isMe?: boolean;
}

export default function PollMessage({
  poll,
  chatId,
  onPollUpdated,
  isAdmin = false,
  isMe = false
}: PollMessageProps) {
  const { user } = useAuth();
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [currentPoll, setCurrentPoll] = useState<PollWithVotes>(poll);

  // עדכון הסקר כאשר הוא משתנה
  useEffect(() => {
    setCurrentPoll(poll);
    // אם המשתמש כבר הצביע, הצג תוצאות
    if (poll.user_votes && poll.user_votes.length > 0) {
      setShowResults(true);
    }
  }, [poll]);

  const handleOptionSelect = (optionId: string) => {
    if (currentPoll.is_locked) return;

    if (currentPoll.multiple_choice) {
      // בחירה מרובה - toggle
      setSelectedOptions(prev => {
        if (prev.includes(optionId)) {
          return prev.filter(id => id !== optionId);
        } else {
          return [...prev, optionId];
        }
      });
    } else {
      // בחירה יחידה - החלף
      setSelectedOptions([optionId]);
    }
  };

  const handleVote = async () => {
    if (selectedOptions.length === 0) {
      Alert.alert('שגיאה', 'יש לבחור לפחות אפשרות אחת');
      return;
    }

    if (!currentPoll.multiple_choice && selectedOptions.length > 1) {
      Alert.alert('שגיאה', 'סקר זה מאפשר רק תשובה אחת');
      return;
    }

    setIsVoting(true);
    try {
      await PollService.votePoll(
        currentPoll.id,
        selectedOptions,
        user?.id || ''
      );

      // רענן את הסקר
      console.log('🔄 Refreshing poll after vote...');
      const updatedPoll = await PollService.getPollResults(currentPoll.id, user?.id);
      console.log('🔄 Updated poll received:', updatedPoll);
      
      if (updatedPoll) {
        setCurrentPoll(updatedPoll);
        onPollUpdated(updatedPoll);
        setShowResults(true);
        setSelectedOptions([]);
        console.log('✅ Poll updated successfully');
      } else {
        console.log('❌ No updated poll received');
      }

      Alert.alert('הצלחה', 'ההצבעה נשלחה בהצלחה!');
    } catch (error: any) {
      console.error('❌ Error voting:', error);
      Alert.alert('שגיאה', error.message || 'לא ניתן לשלוח את ההצבעה');
    } finally {
      setIsVoting(false);
    }
  };

  const handleLockPoll = async () => {
    if (!isAdmin || currentPoll.creator_id !== user?.id) return;

    Alert.alert(
      'נעילת סקר',
      'האם אתה בטוח שברצונך לנעול את הסקר? לא ניתן יהיה להצביע יותר.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'נעל',
          style: 'destructive',
          onPress: async () => {
            try {
              await PollService.lockPoll(currentPoll.id, user?.id || '');
              
              // רענן את הסקר
              const updatedPoll = await PollService.getPollResults(currentPoll.id, user?.id);
              if (updatedPoll) {
                setCurrentPoll(updatedPoll);
                onPollUpdated(updatedPoll);
              }

              Alert.alert('הצלחה', 'הסקר ננעל בהצלחה');
            } catch (error: any) {
              console.error('❌ Error locking poll:', error);
              Alert.alert('שגיאה', error.message || 'לא ניתן לנעול את הסקר');
            }
          }
        }
      ]
    );
  };

  const handleDeletePoll = async () => {
    if (!isAdmin || currentPoll.creator_id !== user?.id) return;

    Alert.alert(
      'מחיקת סקר',
      'האם אתה בטוח שברצונך למחוק את הסקר? פעולה זו אינה הפיכה!',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await PollService.deletePoll(currentPoll.id, user?.id || '');
              Alert.alert('הצלחה', 'הסקר נמחק בהצלחה');
              // כאן צריך להודיע להורה על המחיקה
            } catch (error: any) {
              console.error('❌ Error deleting poll:', error);
              Alert.alert('שגיאה', error.message || 'לא ניתן למחוק את הסקר');
            }
          }
        }
      ]
    );
  };

  const isUserVoted = currentPoll.user_votes && currentPoll.user_votes.length > 0;
  const canVote = !currentPoll.is_locked && !isUserVoted;
  
  console.log('🔍 PollMessage Debug:', {
    pollId: currentPoll.id,
    userId: user?.id,
    isMe,
    isAdmin,
    isUserVoted,
    canVote,
    userVotes: currentPoll.user_votes,
    isLocked: currentPoll.is_locked
  });

  return (
    <View className={`${isMe ? 'bg-[#00E654]' : 'bg-[#111111]'} border border-[#333] rounded-xl p-4 mb-3`}>
      {/* Poll Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Image 
            source={require('../../assets/icons/ico-40-poll-2.png')} 
            style={{ width: 20, height: 20, marginRight: 8 }} 
            resizeMode="contain"
          />
          <Text className={`${isMe ? 'text-black' : 'text-primary'} font-bold text-sm mr-2`}>סקר</Text>
          {currentPoll.multiple_choice && (
            <View className="bg-gray-600 px-2 py-1 rounded-lg mr-2">
              <Text className="text-white text-xs">בחירה מרובה</Text>
            </View>
          )}
        </View>
        
        <View className="flex-row items-center">
          {currentPoll.is_locked && (
            <View className="flex-row items-center mr-2">
              <Lock size={14} color="#ff6b6b" strokeWidth={2} />
              <Text className="text-red-400 text-xs">נעול</Text>
            </View>
          )}
          
          {/* Admin Actions */}
          {isAdmin && currentPoll.creator_id === user?.id && (
            <View className="flex-row">
              {!currentPoll.is_locked && (
                <TouchableOpacity
                  onPress={handleLockPoll}
                  className="bg-yellow-600 p-2 rounded-lg mr-2"
                >
                  <Lock size={16} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                onPress={handleDeletePoll}
                className="bg-red-600 p-2 rounded-lg"
              >
                <Trash2 size={16} color="#fff" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Question */}
      <Text className={`${isMe ? 'text-black' : 'text-white'} font-bold text-lg mb-4 text-center`}>
        {currentPoll.question}
      </Text>

      {/* Options */}
      {!showResults ? (
        <View>
          {currentPoll.options.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => handleOptionSelect(option.id)}
              disabled={!canVote}
              className={`mb-3 p-3 rounded-xl border-2 ${
                selectedOptions.includes(option.id)
                  ? isMe ? 'border-black bg-black/20' : 'border-primary bg-primary/20'
                  : isMe ? 'border-[#333] bg-white/10' : 'border-[#333] bg-[#1a1a1a]'
              } ${!canVote ? 'opacity-50' : ''}`}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name={
                    currentPoll.multiple_choice
                      ? selectedOptions.includes(option.id)
                        ? 'checkbox'
                        : 'checkbox-outline'
                      : selectedOptions.includes(option.id)
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  size={20}
                  color={selectedOptions.includes(option.id) ? '#00E654' : '#666'}
                  style={{ marginRight: 12 }}
                />
                <Text className={`${isMe ? 'text-black' : 'text-white'} text-base flex-1`}>{option.text}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Vote Button - הצבעה ישירה */}
          {canVote && selectedOptions.length > 0 && (
            <TouchableOpacity
              onPress={handleVote}
              disabled={isVoting}
              className={`mt-4 py-3 rounded-xl ${
                isVoting ? 'bg-gray-600' : isMe ? 'bg-black' : 'bg-primary'
              }`}
            >
              <Text
                className={`text-center font-bold text-lg ${
                  isVoting ? 'text-gray-400' : isMe ? 'text-white' : 'text-black'
                }`}
              >
                {isVoting ? 'שולח...' : 'הצבע'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Show Results Button */}
          {isUserVoted && (
            <TouchableOpacity
              onPress={() => setShowResults(true)}
              className="mt-3 py-2 rounded-xl bg-[#1a1a1a] border border-[#333]"
            >
              <Text className="text-white text-center font-bold">
                הצג תוצאות
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* Results View */
        <PollResults
          options={currentPoll.options}
          userVotes={currentPoll.user_votes || []}
          totalVotes={currentPoll.total_votes}
          multipleChoice={currentPoll.multiple_choice}
          isLocked={currentPoll.is_locked}
        />
      )}

      {/* Footer */}
      <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-[#333]">
        <Text className="text-gray-400 text-xs">
          נוצר על ידי {currentPoll.creator_id === user?.id ? 'אתה' : 'משתמש אחר'}
        </Text>
        
        <View className="flex-row items-center">
          <Clock size={14} color="#666" strokeWidth={2} />
          <Text className="text-gray-400 text-xs mr-1">
            {new Date(currentPoll.created_at).toLocaleDateString('he-IL')}
          </Text>
        </View>
      </View>

    </View>
  );
}
