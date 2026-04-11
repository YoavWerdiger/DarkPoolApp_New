// ============================================
// AddStoryBottomSheet – הוספת סטטוס (תמונה)
// ============================================

import React, { useState } from 'react';
import { chatPalette } from './chatDesignTokens';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { useAuth } from '../../context/AuthContext';
import { uploadStoryImage, createStory } from '../../services/storiesService';
import { logger } from '../../utils/logger';

interface AddStoryBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddStoryBottomSheet({ visible, onClose, onAdded }: AddStoryBottomSheetProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const handlePickImage = async () => {
    if (!user?.id) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('אישור נדרש', 'אנא אשר גישה לגלריה');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setIsUploading(true);
      const { url, error } = await uploadStoryImage(result.assets[0].uri, user.id);
      if (error || !url) {
        Alert.alert('שגיאה', error || 'לא הצלחנו להעלות את התמונה');
        return;
      }

      await createStory(user.id, { media_type: 'image', media_url: url });
      onAdded();
      onClose();
    } catch (e) {
      logger.error('AddStoryBottomSheet', 'handlePickImage failed', e);
      Alert.alert('שגיאה', 'משהו השתבש');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!user?.id) return;

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('אישור נדרש', 'אנא אשר גישה למצלמה');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setIsUploading(true);
      const { url, error } = await uploadStoryImage(result.assets[0].uri, user.id);
      if (error || !url) {
        Alert.alert('שגיאה', error || 'לא הצלחנו להעלות את התמונה');
        return;
      }

      await createStory(user.id, { media_type: 'image', media_url: url });
      onAdded();
      onClose();
    } catch (e) {
      logger.error('AddStoryBottomSheet', 'handleTakePhoto failed', e);
      Alert.alert('שגיאה', 'משהו השתבש');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <BottomSheet isOpen={visible} onClose={onClose}>
      <View style={styles.content}>
        {isUploading ? (
          <View style={styles.uploading}>
            <ActivityIndicator size="large" color={chatPalette.primary} />
            <Text style={styles.uploadingText}>מעלה...</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.option} onPress={handleTakePhoto}>
              <Ionicons name="camera" size={28} color={chatPalette.primary} />
              <Text style={styles.optionText}>צלם תמונה</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={handlePickImage}>
              <Ionicons name="images" size={28} color={chatPalette.primary} />
              <Text style={styles.optionText}>בחר מהגלריה</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  option: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginBottom: 12,
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
    marginRight: 12,
  },
  uploading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  uploadingText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
  },
});
