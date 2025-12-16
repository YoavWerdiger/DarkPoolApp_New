// ============================================
// Media Preview Modal Component
// ============================================
// מסך ביניים להצגת preview של מדיה והוספת כיתוב
// ============================================

import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useDesignTokens } from '../ui/DesignTokens';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface MediaPreviewModalProps {
  visible: boolean;
  mediaUri: string;
  mediaType: 'image' | 'video';
  onSend: (caption: string) => Promise<void>;
  onCancel: () => void;
  isUploading?: boolean;
}

export default function MediaPreviewModal({ 
  visible, 
  mediaUri,
  mediaType,
  onSend, 
  onCancel,
  isUploading = false,
}: MediaPreviewModalProps) {
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: '#000000',
        },
        header: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: DesignTokens.spacing.md,
          paddingVertical: DesignTokens.spacing.md,
          backgroundColor: 'transparent',
        },
        headerTitle: {
          color: '#FFFFFF',
          fontSize: 17,
          fontWeight: '600',
        },
        cancelButton: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        },
        sendButton: {
          paddingVertical: DesignTokens.spacing.xs,
          paddingHorizontal: DesignTokens.spacing.md,
          backgroundColor: DesignTokens.colors.primary.main,
          borderRadius: 20,
          minWidth: 70,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          shadowColor: DesignTokens.colors.primary.main,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        sendButtonDisabled: {
          opacity: 0.5,
        },
        sendButtonText: {
          color: '#FFFFFF',
          fontSize: 15,
          fontWeight: '600',
        },
        previewContainer: {
          flex: 1,
          backgroundColor: '#000000',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        },
        headerOverlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: 'transparent',
          zIndex: 10,
          overflow: 'hidden',
          borderBottomLeftRadius: DesignTokens.borderRadius['2xl'],
          borderBottomRightRadius: DesignTokens.borderRadius['2xl'],
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: Platform.OS === 'android' ? 10 : 0,
        },
        captionOverlay: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'transparent',
          zIndex: 10,
          overflow: 'hidden',
          borderTopLeftRadius: DesignTokens.borderRadius['2xl'],
          borderTopRightRadius: DesignTokens.borderRadius['2xl'],
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderBottomWidth: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: Platform.OS === 'android' ? 10 : 0,
        },
        imagePreview: {
          width: '100%',
          height: '100%',
          resizeMode: 'contain',
          backgroundColor: 'transparent',
        },
        videoPreview: {
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent',
        },
        videoContainer: {
          flex: 1,
          width: '100%',
          backgroundColor: '#000000',
          justifyContent: 'center',
          alignItems: 'center',
        },
        captionContainer: {
          flexDirection: 'row-reverse',
          alignItems: 'flex-end',
          paddingHorizontal: DesignTokens.spacing.md,
          paddingTop: DesignTokens.spacing.md,
          paddingBottom: DesignTokens.spacing.md,
          backgroundColor: 'transparent',
          gap: DesignTokens.spacing.sm,
          position: 'relative',
          zIndex: 10,
        },
        captionInputContainer: {
          flex: 1,
        },
        captionInput: {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: 24,
          paddingHorizontal: DesignTokens.spacing.md,
          paddingVertical: DesignTokens.spacing.sm + 2,
          paddingRight: DesignTokens.spacing.md + 4,
          color: '#FFFFFF',
          fontSize: 16,
          textAlign: 'right',
          minHeight: 48,
          maxHeight: 100,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
        captionSendButton: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: DesignTokens.colors.primary.main,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 0,
          shadowColor: DesignTokens.colors.primary.main,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 6,
          elevation: 4,
        },
        captionSendButtonDisabled: {
          opacity: 0.5,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          shadowOpacity: 0,
        },
        placeholder: {
          color: DesignTokens.colors.text.secondary,
        },
        loadingOverlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        loadingText: {
          color: DesignTokens.colors.text.primary,
          marginTop: DesignTokens.spacing.sm,
          fontSize: 16,
        },
      }),
    [DesignTokens]
  );

  const handleSend = async () => {
    await onSend(caption);
    setCaption(''); // נקה את הכיתוב אחרי שליחה
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        {/* Preview - Full Screen */}
        <View style={styles.previewContainer}>
          {mediaType === 'image' ? (
            <Image 
              source={{ uri: mediaUri }} 
              style={styles.imagePreview}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.videoContainer}>
              <Video
                source={{ uri: mediaUri }}
                style={styles.videoPreview}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
                isLooping={false}
              />
            </View>
          )}

          {isUploading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator
                size="large"
                color={DesignTokens.colors.primary.main}
              />
              <Text style={styles.loadingText}>מעלה...</Text>
            </View>
          )}
        </View>

        {/* Header Overlay with Blur */}
        <View 
          style={[
            styles.headerOverlay, 
            { 
              top: 0,
              paddingTop: insets.top,
            }
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={40}
              tint="dark"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: 'rgba(15, 15, 15, 0.5)',
                }
              ]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: 'rgba(20, 20, 20, 0.7)',
                },
              ]}
            />
          )}
          
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isUploading}
            >
              <Ionicons
                name="close"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              {mediaType === 'image' ? 'תמונה' : 'סרטון'}
            </Text>

            {/* Placeholder for symmetry */}
            <View style={{ width: 36 }} />
          </View>
        </View>

        {/* Caption Input Overlay with Blur */}
        <SafeAreaView 
          style={styles.captionOverlay} 
          edges={['bottom']}
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={40}
              tint="dark"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: 'rgba(15, 15, 15, 0.5)',
                }
              ]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: 'rgba(20, 20, 20, 0.7)',
                },
              ]}
            />
          )}
          
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <View style={styles.captionContainer}>
              <TouchableOpacity
                style={[styles.captionSendButton, isUploading && styles.captionSendButtonDisabled]}
                onPress={handleSend}
                disabled={isUploading}
                activeOpacity={0.7}
              >
                {isUploading ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Ionicons
                    name="send"
                    size={20}
                    color="#FFFFFF"
                  />
                )}
              </TouchableOpacity>
              
              <View style={styles.captionInputContainer}>
                <TextInput
                  style={styles.captionInput}
                  placeholder="הוסף כיתוב..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={500}
                  textAlign="right"
                  editable={!isUploading}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
