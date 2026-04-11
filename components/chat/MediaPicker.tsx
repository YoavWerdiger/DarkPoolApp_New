import React from 'react';
import { View, Text, Alert, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaMetadata } from '../../services/mediaService';
import * as ImagePicker from 'expo-image-picker';
import { logger } from '../../utils/logger';
import * as DocumentPicker from 'expo-document-picker';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../ui/DesignTokens';

// ImagePicker media types - using new array format for Expo SDK 52+

interface MediaPickerProps {
  visible: boolean;
  onClose: () => void;
  onMediaSelected: (mediaType: string, uri: string, metadata?: MediaMetadata) => void;
  onPollRequest: () => void;
  chatId: string;
}

export default function MediaPicker({ visible, onClose, onMediaSelected, onPollRequest }: MediaPickerProps) {
  const DesignTokens = useDesignTokens();

  // טיפול בבחירת פעולה
  const handleAction = async (actionType: string) => {
    try {
      switch (actionType) {
        case 'camera':
          await handleCameraCapture();
          break;
        case 'gallery':
          await handleGalleryPick();
          break;
        case 'video':
          await handleVideoCapture();
          break;
        case 'document':
          await handleDocumentPick();
          break;
        case 'audio':
          await handleAudioFilePick();
          break;
        case 'poll':
          onClose();
          onPollRequest();
          break;
      }
    } catch (error) {
      logger.error('MediaPicker', 'handleAction failed', error);
    }
  };

  // צילום תמונה
  const handleCameraCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('אישור נדרש', 'אנא אשר גישה למצלמה');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        onMediaSelected('image', uri);
        // סגירת ה-BottomSheet - ה-MessageInputBar יטפל ב-state שלו בנפרד
        onClose();
      }
    } catch (error) {
      Alert.alert('שגיאה', 'שגיאה בצילום התמונה');
    }
  };

  // בחירת תמונה מהגלריה
  const handleGalleryPick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('אישור נדרש', 'אנא אשר גישה לגלריה');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        onMediaSelected('image', uri);
        onClose();
      }
    } catch (error) {
      Alert.alert('שגיאה', 'שגיאה בבחירת התמונה');
    }
  };

  // צילום וידאו
  const handleVideoCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('אישור נדרש', 'אנא אשר גישה למצלמה');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        onMediaSelected('video', uri);
        onClose();
      }
    } catch (error) {
      Alert.alert('שגיאה', 'שגיאה בצילום הוידאו');
    }
  };

  // בחירת קובץ
  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        onMediaSelected('document', uri);
        onClose();
      }
    } catch (error) {
      Alert.alert('שגיאה', 'שגיאה בבחירת הקובץ');
    }
  };

  // בחירת קובץ אודיו
  const handleAudioFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        onMediaSelected('audio', uri);
        onClose();
      }
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לבחור קובץ אודיו');
    }
  };

  // Media Options - iOS Style עם עיגולים צבעוניים גדולים
  const mediaOptions = [
    {
      icon: 'camera' as keyof typeof Ionicons.glyphMap,
      title: 'מצלמה',
      action: 'camera',
      gradient: ['#FF2D55', '#FF375F'], // iOS Pink
    },
    {
      icon: 'images' as keyof typeof Ionicons.glyphMap,
      title: 'גלריה',
      action: 'gallery',
      gradient: ['#34C759', '#30D158'], // iOS Green
    },
    {
      icon: 'videocam' as keyof typeof Ionicons.glyphMap,
      title: 'וידאו',
      action: 'video',
      gradient: ['#AF52DE', '#BF5AF2'], // iOS Purple
    },
    {
      icon: 'document-text' as keyof typeof Ionicons.glyphMap,
      title: 'קובץ',
      action: 'document',
      gradient: ['#007AFF', '#0A84FF'], // iOS Blue
    },
    {
      icon: 'musical-notes' as keyof typeof Ionicons.glyphMap,
      title: 'אודיו',
      action: 'audio',
      gradient: ['#FF9500', '#FF9F0A'], // iOS Orange
    },
    {
      icon: 'stats-chart' as keyof typeof Ionicons.glyphMap,
      title: 'סקר',
      action: 'poll',
      gradient: ['#5AC8FA', '#64D2FF'], // iOS Cyan
    },
  ];

  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: DesignTokens.colors.background.primary,
      paddingTop: DesignTokens.spacing.md,
      paddingBottom: DesignTokens.spacing.xl + 10,
      paddingHorizontal: DesignTokens.spacing.xl,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: DesignTokens.colors.text.primary,
      textAlign: 'center',
      marginBottom: DesignTokens.spacing.xl + 4,
      letterSpacing: -0.4,
    },
    optionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
      paddingHorizontal: DesignTokens.spacing.sm,
    },
    optionItem: {
      width: '33.33%',
      alignItems: 'center',
      marginBottom: DesignTokens.spacing.lg + 4,
    },
    optionButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    optionButtonPressed: {
      transform: [{ scale: 0.9 }],
      opacity: 0.85,
    },
    optionText: {
      fontSize: 12,
      fontWeight: '500',
      color: DesignTokens.colors.text.secondary,
      textAlign: 'center',
      letterSpacing: -0.2,
    },
  }), [DesignTokens]);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.38]}
      showHandle={true}
      enablePanDownToClose={true}
      useModal={true}
      backdropOpacity={0.15}
    >
      <View style={styles.container}>
        <Text style={styles.title}>שתף</Text>
        <View style={styles.optionsGrid}>
          {mediaOptions.map((option) => (
            <View key={option.action} style={styles.optionItem}>
              <Pressable
                style={({ pressed }) => [
                  styles.optionButton,
                  { backgroundColor: option.gradient[0] },
                  pressed && styles.optionButtonPressed,
                ]}
                onPress={() => handleAction(option.action)}
              >
                <Ionicons
                  name={option.icon}
                  size={26}
                  color="#FFFFFF"
                />
              </Pressable>
              <Text style={styles.optionText}>{option.title}</Text>
            </View>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}
