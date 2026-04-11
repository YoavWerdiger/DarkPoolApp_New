import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import BottomSheet from '../ui/BottomSheet/BottomSheet';

interface MediaPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onVideo: () => void;
  onDocument: () => void;
  onAudio?: () => void;
  onPoll?: () => void;
}

export default function MediaPickerSheet({
  visible,
  onClose,
  onCamera,
  onGallery,
  onVideo,
  onDocument,
  onAudio,
  onPoll,
}: MediaPickerSheetProps) {
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();

  const options = [
    {
      id: 'camera',
      icon: 'camera',
      label: 'מצלמה',
      color: '#007AFF', // כחול iOS
      action: onCamera,
    },
    {
      id: 'gallery',
      icon: 'images',
      label: 'תמונה',
      color: '#AF52DE', // סגול
      action: onGallery,
    },
    {
      id: 'video',
      icon: 'videocam',
      label: 'סרטון',
      color: '#FF2D55', // ורוד/אדום
      action: onVideo,
    },
    {
      id: 'document',
      icon: 'document-text',
      label: 'מסמך',
      color: '#34C759', // ירוק
      action: onDocument,
    },
    ...(onAudio ? [{
      id: 'audio',
      icon: 'mic',
      label: 'אודיו',
      color: '#5856D6', // סגול כהה
      action: onAudio,
    }] : []),
    ...(onPoll ? [{
      id: 'poll',
      icon: 'poll-image',
      label: 'סקר',
      color: '#FF9500', // כתום
      action: onPoll,
    }] : []),
  ];

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: DesignTokens.spacing.md,
    },
    header: {
      alignItems: 'center',
      paddingTop: DesignTokens.spacing.xs,
      paddingBottom: DesignTokens.spacing.sm,
    },
    title: {
      color: DesignTokens.colors.text.primary,
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: DesignTokens.spacing.sm,
    },
    optionItem: {
      width: '31%',
      aspectRatio: 1.2,
      marginBottom: 16,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: DesignTokens.colors.text.primary,
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
      <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>צרף קובץ</Text>
        </View>

        {/* Options Grid */}
        <View style={styles.grid}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionItem}
              onPress={() => {
                // ⚡ פעולה קודם – מתחיל לפתוח picker/מצלמה מיד, sheet נסגר במקביל
                option.action();
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
                {option.icon === 'poll-image' ? (
                  <Image 
                    source={require('../../assets/icons/ico-40-poll-2.png')} 
                    style={{ 
                      width: 28, 
                      height: 28,
                      tintColor: option.color
                    }} 
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name={option.icon as any} size={28} color={option.color} />
                )}
              </View>
              <Text style={styles.optionLabel}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

