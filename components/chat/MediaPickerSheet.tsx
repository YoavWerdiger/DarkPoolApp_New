import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatBottomSheet } from './ChatBottomSheet';
import { BOTTOM_SHEET_EDGE_HANDLE_HEIGHT } from '../ui/BottomSheet/BottomSheet';
import { chatRtlText } from './chatDesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { runAfterSheetDismiss } from './mediaPickerLaunch';

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

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_BORDER = 'rgba(255, 255, 255, 0.10)';

type PickerOption = {
  id: string;
  icon: string;
  label: string;
  color: string;
  action: () => void;
};

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
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const sheetBottomPad = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 16 : 8;
    return Math.max(insets.bottom, minBottom);
  }, [insets.bottom]);

  const options = useMemo<PickerOption[]>(
    () => [
      { id: 'camera', icon: 'camera', label: 'מצלמה', color: '#007AFF', action: onCamera },
      { id: 'gallery', icon: 'images', label: 'תמונה', color: '#AF52DE', action: onGallery },
      { id: 'video', icon: 'videocam', label: 'סרטון', color: '#FF2D55', action: onVideo },
      { id: 'document', icon: 'document-text', label: 'מסמך', color: '#34C759', action: onDocument },
      ...(onAudio
        ? [{ id: 'audio', icon: 'mic', label: 'אודיו', color: '#5856D6', action: onAudio }]
        : []),
      ...(onPoll
        ? [{ id: 'poll', icon: 'poll-image', label: 'סקר', color: '#FF9500', action: onPoll }]
        : []),
    ],
    [onAudio, onCamera, onDocument, onGallery, onPoll, onVideo],
  );

  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const handleContentLayout = useCallback((height: number) => {
    if (height > 0) {
      setContentHeight((prev) => (prev === height ? prev : height));
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      setContentHeight(null);
    }
  }, [visible]);

  const snapPoint = useMemo(() => {
    if (contentHeight != null && contentHeight > 0) {
      const totalPx = contentHeight + BOTTOM_SHEET_EDGE_HANDLE_HEIGHT;
      return Math.min(0.62, Math.max(0.22, totalPx / SCREEN_HEIGHT));
    }

    const rows = Math.ceil(options.length / 4);
    const estimatedPx = 68 + rows * 88 + sheetBottomPad + BOTTOM_SHEET_EDGE_HANDLE_HEIGHT;
    return Math.min(0.55, Math.max(0.24, estimatedPx / SCREEN_HEIGHT));
  }, [contentHeight, options.length, sheetBottomPad]);

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      showBrandWatermark={false}
      contentPaddingBottom={0}
    >
      <View
        style={[styles.container, { paddingBottom: sheetBottomPad }]}
        onLayout={(e) => handleContentLayout(e.nativeEvent.layout.height)}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>צרף קובץ</Text>
        </View>

        <View style={styles.grid}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionItem}
              onPress={() => {
                void HapticFeedback.selection();
                onClose();
                runAfterSheetDismiss(option.action);
              }}
              activeOpacity={0.75}
              accessibilityLabel={option.label}
            >
              <View style={[styles.iconContainer, { backgroundColor: option.color + '22' }]}>
                {option.icon === 'poll-image' ? (
                  <Image
                    source={require('../../assets/icons/ico-40-poll-2.png')}
                    style={{ width: 26, height: 26, tintColor: option.color }}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name={option.icon as keyof typeof Ionicons.glyphMap} size={26} color={option.color} />
                )}
              </View>
              <Text style={[styles.optionLabel, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ChatBottomSheet>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: tokens.spacing.lg,
      direction: 'rtl',
      backgroundColor: 'transparent',
    },
    header: {
      alignItems: 'center',
      paddingBottom: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: SHEET_BORDER,
    },
    headerTitle: {
      ...chatRtlText,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.35,
      textAlign: 'center',
      width: '100%',
    },
    grid: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
      paddingTop: 16,
      paddingBottom: 4,
    },
    optionItem: {
      width: '22%',
      minWidth: 72,
      maxWidth: 88,
      alignItems: 'center',
      gap: 8,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionLabel: {
      fontSize: 13,
      fontWeight: '600',
      ...chatRtlText,
    },
  });
