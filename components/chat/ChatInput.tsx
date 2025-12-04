// ============================================
// Chat Input Component
// ============================================
// שדה הקלדה ושליחת הודעות עם כל התכונות
// ============================================

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { ChatMessageType } from '../../types/chat.types';
import { chatMediaService } from '../../services/chat';
import { Ionicons } from '@expo/vector-icons';

interface ChatInputProps {
  groupId: string;
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: ChatMessageType) => Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  onCancelReply?: () => void;
  disabled?: boolean;
}

export default function ChatInput({
  groupId,
  onSendMessage,
  onTyping,
  replyTo,
  onCancelReply,
  disabled = false,
}: ChatInputProps) {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const textInputRef = useRef<TextInput>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const canSend = text.trim().length > 0 || isRecording;

  // ============================================
  // Handle Text Change
  // ============================================

  const handleTextChange = (newText: string) => {
    setText(newText);

    // Typing indicator
    if (onTyping) {
      onTyping(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 3000);
    }
  };

  // ============================================
  // Send Text Message
  // ============================================

  const handleSend = async () => {
    if (!canSend || disabled) return;

    const messageText = text.trim();
    setText('');
    
    if (onTyping) {
      onTyping(false);
    }

    try {
      await onSendMessage(messageText);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('שגיאה', 'לא הצלחנו לשלוח את ההודעה');
    }
  };

  // ============================================
  // Pick Image (זמנית מושבת - דורש Development Build)
  // ============================================

  const handlePickImage = async () => {
    Alert.alert(
      'שליחת מדיה',
      'העלאת תמונות וסרטונים דורשת Development Build.\nבגרסת Expo Go נתמוך רק בהודעות טקסט.',
      [{ text: 'הבנתי' }]
    );
    // TODO: להוסיף חזרה כשעושים Development Build
  };

  // ============================================
  // Take Photo (זמנית מושבת)
  // ============================================

  const handleTakePhoto = async () => {
    Alert.alert('שליחת מדיה', 'זמנית מושבת ב-Expo Go');
  };

  // ============================================
  // Pick Document (זמנית מושבת)
  // ============================================

  const handlePickDocument = async () => {
    Alert.alert('שליחת מדיה', 'זמנית מושבת ב-Expo Go');
  };

  // ============================================
  // Record Audio
  // ============================================

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('הרשאה נדרשת', 'אנא אפשר גישה למיקרופון');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      Alert.alert('שגיאה', 'לא הצלחנו להתחיל הקלטה');
    }
  };

  const stopRecording = async (shouldSend: boolean = true) => {
    try {
      if (!recordingRef.current) return;

      // Stop timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);

      // TODO: העלאת אודיו דורשת Development Build
      if (shouldSend) {
        Alert.alert('שליחת אודיו', 'זמנית מושבת ב-Expo Go');
      }
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      setIsRecording(false);
      setRecordingDuration(0);
    }
  };

  const cancelRecording = () => {
    stopRecording(false);
  };

  // ============================================
  // Show Attachment Options
  // ============================================

  const showAttachmentOptions = () => {
    Alert.alert(
      'בחר סוג קובץ',
      '',
      [
        { text: '📷 מצלמה', onPress: handleTakePhoto },
        { text: '🖼️ גלריה', onPress: handlePickImage },
        { text: '📎 מסמך', onPress: handlePickDocument },
        { text: 'ביטול', style: 'cancel' },
      ]
    );
  };

  // ============================================
  // Format Recording Duration
  // ============================================

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // Cleanup
  // ============================================

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // ============================================
  // Render
  // ============================================

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        {/* Reply Preview */}
        {replyTo && (
          <View style={styles.replyPreview}>
            <View style={styles.replyContent}>
              <Text style={styles.replyLabel}>↩️ תשובה ל-{replyTo.senderName}</Text>
              <Text style={styles.replyText} numberOfLines={1}>{replyTo.content}</Text>
            </View>
            <TouchableOpacity onPress={onCancelReply} style={styles.cancelReply}>
              <Ionicons name="close" size={20} color={DesignTokens.colors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Container */}
        <View style={styles.inputContainer}>
          {/* Attachment Button */}
          {!isRecording && (
            <TouchableOpacity 
              onPress={showAttachmentOptions} 
              style={styles.iconButton}
              disabled={disabled || isUploading}
            >
              <Ionicons name="add-circle" size={28} color={DesignTokens.colors.text.secondary} />
            </TouchableOpacity>
          )}

          {/* Text Input or Recording UI */}
          {isRecording ? (
            <View style={styles.recordingContainer}>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTime}>{formatRecordingTime(recordingDuration)}</Text>
              </View>
              <Text style={styles.recordingText}>מקליט...</Text>
            </View>
          ) : (
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder={isUploading ? 'מעלה...' : 'הקלד הודעה...'}
              placeholderTextColor={DesignTokens.colors.text.secondary}
              value={text}
              onChangeText={handleTextChange}
              multiline
              maxLength={4000}
              editable={!disabled && !isUploading}
            />
          )}

          {/* Send/Voice Button */}
          {text.trim().length > 0 ? (
            <TouchableOpacity 
              onPress={handleSend} 
              style={styles.sendButton}
              disabled={!canSend || disabled || isUploading}
            >
              <Ionicons name="send" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : isRecording ? (
            <View style={styles.recordingButtons}>
              <TouchableOpacity onPress={cancelRecording} style={styles.cancelButton}>
                <Ionicons name="close-circle" size={32} color="#FF3B30" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => stopRecording(true)} style={styles.stopButton}>
                <Ionicons name="stop-circle" size={32} color={DesignTokens.colors.accent.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              onPress={startRecording} 
              style={styles.voiceButton}
              disabled={disabled || isUploading}
            >
              <Ionicons name="mic" size={24} color={DesignTokens.colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Uploading Indicator */}
        {isUploading && (
          <View style={styles.uploadingContainer}>
            <Text style={styles.uploadingText}>מעלה קובץ...</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (tokens: any) => StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.background.secondary,
  },
  
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: tokens.colors.background.secondary,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.accent.primary,
  },
  replyContent: {
    flex: 1,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.accent.primary,
    marginBottom: 4,
  },
  replyText: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
  },
  cancelReply: {
    padding: 8,
  },
  cancelReplyText: {
    fontSize: 18,
    color: tokens.colors.text.secondary,
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
  },
  
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: tokens.colors.text.primary,
    textAlignVertical: 'center',
  },
  
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.text.primary,
  },
  recordingText: {
    fontSize: 16,
    color: tokens.colors.text.secondary,
  },
  
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  voiceButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  recordingButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  uploadingContainer: {
    padding: 12,
    alignItems: 'center',
  },
  uploadingText: {
    fontSize: 14,
    color: tokens.colors.text.secondary,
  },
});

