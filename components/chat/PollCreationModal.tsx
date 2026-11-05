import i18n from '../../lib/i18n';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { X, Trash2 } from 'lucide-react-native';
import { PollService } from '../../services/pollService';
import { useAuth } from '../../context/AuthContext';
import { useDesignTokens } from '../ui/DesignTokens';

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
  const { user } = useAuth();
  const DesignTokens = useDesignTokens();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
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
      legacyAlert(i18n.t('auto.components__chat__PollCreationModal.s1'), i18n.t('auto.components__chat__PollCreationModal.s2'));
      return false;
    }

    if (options.some(option => !option.trim())) {
      legacyAlert(i18n.t('auto.components__chat__PollCreationModal.s1'), i18n.t('auto.components__chat__PollCreationModal.s3'));
      return false;
    }

    if (options.length < 2) {
      legacyAlert(i18n.t('auto.components__chat__PollCreationModal.s1'), i18n.t('auto.components__chat__PollCreationModal.s4'));
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
        user?.id || '',
        multipleChoice
      );

      if (poll) {
        legacyAlert(i18n.t('auto.components__chat__PollCreationModal.s5'), i18n.t('auto.components__chat__PollCreationModal.s6'));
        onPollCreated(poll);
        resetForm();
        onClose();
      }
    } catch (error: any) {
      legacyAlert(i18n.t('auto.components__chat__PollCreationModal.s1'), error.message || i18n.t('auto.components__chat__PollCreationModal.s7'));
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
      legacyAlert(
        i18n.t('auto.components__chat__PollCreationModal.s8'),
        i18n.t('auto.components__chat__PollCreationModal.s9'),
        [
          { text: i18n.t('auto.components__chat__PollCreationModal.s10'), style: 'cancel' },
          { text: i18n.t('auto.components__chat__PollCreationModal.s11'), style: 'destructive', onPress: () => {
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
          <View className="flex-row items-center px-4 py-3 border-b border-gray-800">
            {/* Left action: close */}
            <View className="flex-1 flex-row items-center">
              <TouchableOpacity onPress={handleClose} className="mr-3">
                <X size={24} color="#fff" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            {/* Title centered */}
            <View className="flex-1 items-center">
              <Text className="text-xl text-white font-bold">{i18n.t('auto.components__chat__PollCreationModal.s12')}</Text>
            </View>
            {/* Right spacer */}
            <View className="flex-1" />
          </View>

          <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
            {/* Question Input */}
            <View className="mb-6">
              <Text className="text-white font-bold text-lg mb-3 text-right">{i18n.t('auto.components__chat__PollCreationModal.s13')}</Text>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder={i18n.t('auto.components__chat__PollCreationModal.s14')}
                placeholderTextColor="#666"
                className="bg-[#141F14] border border-[#1A2B1A] rounded-xl px-4 py-3 text-white text-lg"
                multiline
                numberOfLines={3}
                textAlign="right"
              />
            </View>

            {/* Multiple Choice Toggle */}
            <View className="mb-6">
              <TouchableOpacity
                onPress={() => setMultipleChoice(!multipleChoice)}
                className="flex-row items-center justify-center bg-[#141F14] border border-[#1A2B1A] rounded-xl px-4 py-3"
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={multipleChoice ? 'checkbox' : 'radio-button-off'}
                    size={24}
                    color={multipleChoice ? DesignTokens.colors.primary.main : DesignTokens.colors.text.tertiary}
                  />
                  <Text className="text-white text-lg mr-3">
                    {multipleChoice ? i18n.t('auto.components__chat__PollCreationModal.s15') : i18n.t('auto.components__chat__PollCreationModal.s16')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Options */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white font-bold text-lg text-right" style={{ flex: 1 }}>{i18n.t('auto.components__chat__PollCreationModal.s17')}</Text>
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
                  <View className="flex-1 ml-3">
                    <TextInput
                      value={option}
                      onChangeText={(text) => updateOption(index, text)}
                      placeholder={i18n.t('auto.components__chat__PollCreationModal.s18', { v0: index + 1 })}
                      placeholderTextColor="#666"
                      className="bg-[#141F14] border border-[#1A2B1A] rounded-xl px-4 py-3 text-white text-lg"
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
                {i18n.t('auto.components__chat__PollCreationModal.s19', { v0: options.length })}</Text>
            </View>

            {/* Preview */}
            <View className="mb-6">
              <Text className="text-white font-bold text-lg mb-3 text-right">{i18n.t('auto.components__chat__PollCreationModal.s20')}</Text>
              <View className="bg-[#141F14] border border-[#1A2B1A] rounded-xl p-4">
                <Text className="text-white font-bold text-lg mb-3 text-right">
                  {question || i18n.t('auto.components__chat__PollCreationModal.s21')}
                </Text>
                
                {options.map((option, index) => (
                  <View key={index} className="mb-2">
                    {option.trim() && (
                      <View className="flex-row items-center">
                        <Ionicons
                          name={multipleChoice ? 'checkbox-outline' : 'radio-button-off'}
                          size={20}
                          color={DesignTokens.colors.primary.main}
                          style={{ marginRight: 8 }}
                        />
                        <Text className="text-white text-base">{option}</Text>
                      </View>
                    )}
                  </View>
                ))}

                {options.every(opt => !opt.trim()) && (
                  <Text className="text-gray-500 text-center italic">{i18n.t('auto.components__chat__PollCreationModal.s22')}</Text>
                )}
              </View>
            </View>

            {/* Create button at bottom under preview */}
            <View className="mb-6 items-center">
              <TouchableOpacity
                onPress={handleCreatePoll}
                disabled={isCreating}
                className={`${isCreating ? 'bg-gray-600' : 'bg-primary'} w-4/5 py-4 rounded-2xl items-center`}
              >
                <Text className={`font-bold text-lg ${isCreating ? 'text-gray-400' : 'text-black'}`}>
                  {isCreating ? i18n.t('auto.components__chat__PollCreationModal.s23') : i18n.t('auto.components__chat__PollCreationModal.s24')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* טיפים הוסרו לבקשתך */}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
