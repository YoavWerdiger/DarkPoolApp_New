// ============================================
// AddStoryBottomSheet – הוספת סטטוס (תמונה)
// ============================================

import { legacyAlert } from '../../utils/appDialog';
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { uploadStoryImage, createStory } from '../../services/storiesService';
import { logger } from '../../utils/logger';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatBottomSheet, ChatSheetContent } from './ChatBottomSheet';
import { appSheetButtonLabelStyle } from '../ui/appType';
import MediaPickerSheet from './MediaPickerSheet';
import {
  resolvePickedMedia,
  scheduleMediaRecentsPrefetch,
} from '../../lib/mediaRecentsCache';

interface AddStoryBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddStoryBottomSheet({ visible, onClose, onAdded }: AddStoryBottomSheetProps) {
  const tokens = useDesignTokens();
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      setGalleryOpen(false);
      return;
    }
    const recents = scheduleMediaRecentsPrefetch('photo');
    return () => recents.cancel();
  }, [visible]);

  const uploadPickedUri = async (uri: string) => {
    if (!user?.id) return;
    setIsUploading(true);
    try {
      const { url, error } = await uploadStoryImage(uri, user.id);
      if (error || !url) {
        legacyAlert('שגיאה', error || 'לא הצלחנו להעלות את התמונה');
        return;
      }
      await createStory(user.id, { media_type: 'image', media_url: url });
      onAdded();
      onClose();
    } catch (e) {
      logger.error('AddStoryBottomSheet', 'uploadPickedUri failed', e);
      legacyAlert('שגיאה', 'משהו השתבש');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickImage = () => {
    if (!user?.id) return;
    setGalleryOpen(true);
  };

  const handleTakePhoto = async () => {
    if (!user?.id) return;

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        legacyAlert('אישור נדרש', 'אנא אשר גישה למצלמה');
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
        legacyAlert('שגיאה', error || 'לא הצלחנו להעלות את התמונה');
        return;
      }

      await createStory(user.id, { media_type: 'image', media_url: url });
      onAdded();
      onClose();
    } catch (e) {
      logger.error('AddStoryBottomSheet', 'handleTakePhoto failed', e);
      legacyAlert('שגיאה', 'משהו השתבש');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
    <ChatBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[0.34]}
      showBrandWatermark={false}
    >
      <ChatSheetContent>
        <View style={styles.content}>
          {isUploading ? (
            <View style={styles.uploading}>
              <ActivityIndicator size="large" color={tokens.colors.primary.main} />
              <Text style={[styles.uploadingText, { color: tokens.colors.text.secondary }]}>מעלה...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.option, { backgroundColor: tokens.colors.background.primary }]}
                onPress={handleTakePhoto}
              >
                <Ionicons name="camera" size={28} color={tokens.colors.primary.main} />
                <Text style={[styles.optionText, { color: tokens.colors.text.primary }]}>צלם תמונה</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.option, { backgroundColor: tokens.colors.background.primary }]}
                onPress={handlePickImage}
              >
                <Ionicons name="images" size={28} color={tokens.colors.primary.main} />
                <Text style={[styles.optionText, { color: tokens.colors.text.primary }]}>בחר מהגלריה</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ChatSheetContent>
    </ChatBottomSheet>
    <MediaPickerSheet
      visible={galleryOpen}
      onClose={() => setGalleryOpen(false)}
      kind="photo"
      allowsMultiple={false}
      cameraLaunch="system"
      onCamera={handleTakePhoto}
      onPickedMedia={(items) => {
        const first = items[0];
        if (!first) return;
        void (async () => {
          const [resolved] = await resolvePickedMedia([first]);
          await uploadPickedUri(resolved?.uri || first.uri);
        })();
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionText: {
    ...appSheetButtonLabelStyle,
    marginRight: 12,
    textAlign: 'right',
  },
  uploading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  uploadingText: {
    marginTop: 12,
  },
});
