import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { X, Trash2 } from 'lucide-react-native';
import { PollService } from '../../services/pollService';

interface PollCreationModalProps {
  visible: boolean;
  onClose: () => void;
  chatId: string;
  onPollCreated: (poll: any) => void;
}

export default function PollCreationModal({
  visible,
  onClose,
  chatId,
  onPollCreated
}: PollCreationModalProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']); // מינימום 2 אפשרויות
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const addOption = () => {
    if (options.length < 10) { // מקסימום 10 אפשרויות
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) { // מינימום 2 אפשרויות
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const updateOption = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
  };

  const validateForm = (): boolean => {
    if (!question.trim()) {
      Alert.alert('שגיאה', 'יש להזין שאלה לסקר');
      return false;
    }

    if (options.some(option => !option.trim())) {
      Alert.alert('שגיאה', 'יש למלא את כל האפשרויות');
      return false;
    }

    if (options.length < 2) {
      Alert.alert('שגיאה', 'יש צורך לפחות ב-2 אפשרויות');
      return false;
    }

    return true;
  };

  const handleCreatePoll = async () => {
    if (!validateForm()) return;

    setIsCreating(true);
    try {
      const poll = await PollService.createPoll(
        chatId,
        question.trim(),
        options.map(opt => opt.trim()),
        multipleChoice
      );

      if (poll) {
        Alert.alert('הצלחה', 'הסקר נוצר בהצלחה!');
        onPollCreated(poll);
        resetForm();
        onClose();
      }
    } catch (error: any) {
      console.error('❌ Error creating poll:', error);
      Alert.alert('שגיאה', error.message || 'לא ניתן ליצור את הסקר');
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setMultipleChoice(false);
  };

  const handleClose = () => {
    if (question.trim() || options.some(opt => opt.trim())) {
      Alert.alert(
        'ביטול יצירת סקר',
        'האם אתה בטוח שברצונך לבטל? כל הנתונים יימחקו.',
        [
          { text: 'המשך עריכה', style: 'cancel' },
          { text: 'בטל', style: 'destructive', onPress: () => {
            resetForm();
            onClose();
          }}
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="flex-1 bg-black">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-800">
            <TouchableOpacity onPress={handleClose}>
              <X size={24} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <Text className="text-xl text-white font-bold">יצירת סקר חדש</Text>
            <TouchableOpacity
              onPress={handleCreatePoll}
              disabled={isCreating}
              className={`px-4 py-2 rounded-lg ${isCreating ? 'bg-gray-600' : 'bg-primary'}`}
            >
              <Text className={`font-bold ${isCreating ? 'text-gray-400' : 'text-black'}`}>
                {isCreating ? 'יוצר...' : 'צור סקר'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
            {/* Question Input */}
            <View className="mb-6">
              <Text className="text-white font-bold text-lg mb-3">שאלת הסקר</Text>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder="הזן את השאלה שלך..."
                placeholderTextColor="#666"
                className="bg-[#111111] border border-[#333] rounded-xl px-4 py-3 text-white text-lg"
                multiline
                numberOfLines={3}
                textAlign="right"
              />
            </View>

            {/* Multiple Choice Toggle */}
            <View className="mb-6">
              <TouchableOpacity
                onPress={() => setMultipleChoice(!multipleChoice)}
                className="flex-row items-center justify-between bg-[#111111] border border-[#333] rounded-xl px-4 py-3"
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={multipleChoice ? 'checkbox' : 'radio-button-off'}
                    size={24}
                    color={multipleChoice ? '#00E654' : '#666'}
                  />
                  <Text className="text-white text-lg mr-3">
                    {multipleChoice ? 'בחירה מרובה' : 'בחירה יחידה'}
                  </Text>
                </View>
                <Text className="text-gray-400 text-sm">
                  {multipleChoice ? 'משתמשים יכולים לבחור מספר אפשרויות' : 'משתמשים יכולים לבחור אפשרות אחת בלבד'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Options */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white font-bold text-lg">אפשרויות בחירה</Text>
                <TouchableOpacity
                  onPress={addOption}
                  disabled={options.length >= 10}
                  className={`p-2 rounded-lg ${options.length >= 10 ? 'bg-gray-600' : 'bg-primary'}`}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={options.length >= 10 ? '#666' : '#000'}
                  />
                </TouchableOpacity>
              </View>

              {options.map((option, index) => (
                <View key={index} className="flex-row items-center mb-3">
                  <View className="flex-1 mr-3">
                    <TextInput
                      value={option}
                      onChangeText={(text) => updateOption(index, text)}
                      placeholder={`אפשרות ${index + 1}`}
                      placeholderTextColor="#666"
                      className="bg-[#111111] border border-[#333] rounded-xl px-4 py-3 text-white text-lg"
                      textAlign="right"
                    />
                  </View>
                  {options.length > 2 && (
                    <TouchableOpacity
                      onPress={() => removeOption(index)}
                      className="bg-red-600 p-3 rounded-lg"
                    >
                      <Trash2 size={20} color="#fff" strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <Text className="text-gray-400 text-sm text-center">
                {options.length}/10 אפשרויות
              </Text>
            </View>

            {/* Preview */}
            <View className="mb-6">
              <Text className="text-white font-bold text-lg mb-3">תצוגה מקדימה</Text>
              <View className="bg-[#111111] border border-[#333] rounded-xl p-4">
                <Text className="text-white font-bold text-lg mb-3 text-center">
                  {question || 'שאלת הסקר תופיע כאן'}
                </Text>
                
                {options.map((option, index) => (
                  <View key={index} className="mb-2">
                    {option.trim() && (
                      <View className="flex-row items-center">
                        <Ionicons
                          name={multipleChoice ? 'checkbox-outline' : 'radio-button-off'}
                          size={20}
                          color="#00E654"
                          style={{ marginRight: 8 }}
                        />
                        <Text className="text-white text-base">{option}</Text>
                      </View>
                    )}
                  </View>
                ))}

                {options.every(opt => !opt.trim()) && (
                  <Text className="text-gray-500 text-center italic">
                    האפשרויות יופיעו כאן
                  </Text>
                )}
              </View>
            </View>

            {/* Instructions */}
            <View className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
              <Text className="text-gray-300 text-sm text-center leading-5">
                💡 <Text className="font-bold">טיפים:</Text>{'\n'}
                • שאלה ברורה תקבל תשובות טובות יותר{'\n'}
                • הוסף 3-5 אפשרויות לקבלת תוצאות איכותיות{'\n'}
                • השתמש בבחירה מרובה רק כשהדבר הכרחי
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
