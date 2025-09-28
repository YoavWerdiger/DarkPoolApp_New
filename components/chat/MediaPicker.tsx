import React, { useState, useRef } from 'react';
import { View, Text, Alert, Pressable, ActionSheetIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaService, MediaMetadata } from '../../services/mediaService';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { UIBottomSheet, UIButton } from '../ui';
import DesignTokens from '../ui/DesignTokens';

interface MediaPickerProps {
  visible: boolean;
  onClose: () => void;
  onMediaSelected: (mediaType: string, uri: string, metadata?: MediaMetadata) => void;
  onPollRequest: () => void; // callback ליצירת סקר
  chatId: string;
}

export default function MediaPicker({ visible, onClose, onMediaSelected, onPollRequest, chatId }: MediaPickerProps) {
  const { colors, spacing, typography } = DesignTokens;
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  // Show ActionSheet when visible changes to true
  React.useEffect(() => {
    console.log('📱 MediaPicker useEffect:', { visible });
    if (visible) {
      showActionSheet();
    }
  }, [visible]);

  const showActionSheet = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['ביטול', 'מצלמה', 'גלריה', 'וידאו', 'קובץ', 'אודיו', 'סקר'],
          cancelButtonIndex: 0,
          title: 'בחר מדיה',
        },
        (buttonIndex) => {
          onClose(); // סגור את MediaPicker
          
          if (buttonIndex === 0) {
            return;
          }
          
          const actions = ['camera', 'gallery', 'video', 'document', 'audio', 'poll'];
          const action = actions[buttonIndex - 1];
          handleAction(action);
        }
      );
    } else {
      // For Android, show a custom bottom sheet
      showAndroidActionSheet();
    }
  };

  const showAndroidActionSheet = () => {
    Alert.alert(
      'בחר מדיה',
      '',
      [
        { text: 'ביטול', style: 'cancel', onPress: onClose },
        { text: 'מצלמה', onPress: () => { onClose(); handleAction('camera'); } },
        { text: 'גלריה', onPress: () => { onClose(); handleAction('gallery'); } },
        { text: 'וידאו', onPress: () => { onClose(); handleAction('video'); } },
        { text: 'קובץ', onPress: () => { onClose(); handleAction('document'); } },
        { text: 'אודיו', onPress: () => { onClose(); handleAction('audio'); } },
        { text: 'סקר', onPress: () => { onClose(); handleAction('poll'); } },
      ],
      { cancelable: true, onDismiss: onClose }
    );
  };

  // פורמט זמן להקלטה
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // טיפול בבחירת פעולה
  const handleAction = async (actionType: string) => {
    console.log('📱 MediaPicker handleAction:', actionType);
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
          onClose(); // סגור את MediaPicker
          onPollRequest(); // פתח את PollCreationModal
          break;
      }
    } catch (error) {
      console.error('Error in media action:', error);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onMediaSelected('image', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onMediaSelected('image', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        onMediaSelected('video', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking video:', error);
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
        onMediaSelected('document', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking document:', error);
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
        onMediaSelected('audio', result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking audio file:', error);
      Alert.alert('שגיאה', 'לא ניתן לבחור קובץ אודיו');
    }
  };

  // הקלטת קול
  const handleAudioRecording = async () => {
    if (isRecording) {
      // עצור הקלטה
      await stopAudioRecording();
    } else {
      // התחל הקלטה
      await startAudioRecording();
    }
  };

  // התחלת הקלטה
  const startAudioRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('אישור נדרש', 'אנא אשר גישה למיקרופון');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // עדכן משך כל שנייה
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('שגיאה', 'שגיאה בהתחלת ההקלטה');
    }
  };

  // עצירת הקלטה
  const stopAudioRecording = async () => {
    try {
      if (!recordingRef.current) return;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }

      setIsRecording(false);
      setRecordingDuration(0);
      recordingRef.current = null;

      if (uri) {
        onMediaSelected('audio', uri);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('שגיאה', 'שגיאה בעצירת ההקלטה');
    }
  };

  // אפשר לעצור הקלטה
  const stopRecording = async () => {
    await stopAudioRecording();
  };



  // Media Options Buttons
  const mediaOptions = [
    {
      icon: 'camera' as keyof typeof Ionicons.glyphMap,
      title: 'מצלמה',
      action: 'camera',
      color: colors.primary,
    },
    {
      icon: 'images' as keyof typeof Ionicons.glyphMap,
      title: 'גלריה',
      action: 'gallery',
      color: colors.primary,
    },
    {
      icon: 'videocam' as keyof typeof Ionicons.glyphMap,
      title: 'וידאו',
      action: 'video',
      color: colors.primary,
    },
    {
      icon: 'document' as keyof typeof Ionicons.glyphMap,
      title: 'קובץ',
      action: 'document',
      color: colors.primary,
    },
    {
      icon: 'mic' as keyof typeof Ionicons.glyphMap,
      title: 'אודיו',
      action: 'audio',
      color: colors.primary,
    },
    {
      icon: 'bar-chart' as keyof typeof Ionicons.glyphMap,
      title: 'סקר',
      action: 'poll',
      color: colors.primary,
    },
  ];

  // Recording Status Component
  const RecordingStatus = () => (
    <View style={{ 
      padding: spacing.lg,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.danger,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: 20,
        marginBottom: spacing.md,
      }}>
        <View style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#fff',
          marginRight: spacing.sm,
        }} />
        <Text style={{
          color: '#fff',
          fontSize: typography.fontSize.base,
          fontWeight: '500' as const,
        }}>
          מקליט... {formatDuration(recordingDuration)}
        </Text>
      </View>
      
      <UIButton
        title="עצור הקלטה"
        variant="secondary"
        size="sm"
        onPress={stopRecording}
        icon="stop"
      />
    </View>
  );

  // For recording status, show a simple modal
  if (isRecording) {
    return (
      <UIBottomSheet
        visible={isRecording}
        onClose={() => {}}
        showHandle={true}
        dragToClose={false}
        contentStyle={{ padding: 0 }}
      >
        <RecordingStatus />
      </UIBottomSheet>
    );
  }

  // For normal media picker, ActionSheet handles everything
  return null;
}
