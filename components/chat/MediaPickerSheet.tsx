import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChatBottomSheet } from './ChatBottomSheet';
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

const SHEET_BORDER = 'rgba(255, 255, 255, 0.10)';
/** פריסת 3 עמודות × 2 שורות (עד 6 כרטיסים) */
const GRID_COLS = 3;
const GRID_ROWS = 2;

type PickerOption = {
  id: string;
  icon: string;
  label: string;
  color: string;
  action: () => void;
};

function chunkOptions(options: PickerOption[], cols: number): PickerOption[][] {
  const rows: PickerOption[][] = [];
  for (let i = 0; i < options.length; i += cols) {
    rows.push(options.slice(i, i + cols));
  }
  return rows;
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
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();

  const options = useMemo<PickerOption[]>(
    () =>
      [
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
      ].slice(0, GRID_COLS * GRID_ROWS),
    [onAudio, onCamera, onDocument, onGallery, onPoll, onVideo],
  );

  const rows = useMemo(() => chunkOptions(options, GRID_COLS), [options]);
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[0.38]}
      showBrandWatermark={false}
    >
      <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>צרף קובץ</Text>
        </View>

        <View style={styles.grid}>
          {rows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.row}>
              {row.map((option) => (
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
                        style={{ width: 28, height: 28, tintColor: option.color }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons
                        name={option.icon as keyof typeof Ionicons.glyphMap}
                        size={28}
                        color={option.color}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.optionLabel, { color: tokens.colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {/* ממלאים עמודות ריקות כדי לשמור יישור 3 עמודות כשיש פחות מ-3 בשורה */}
              {Array.from({ length: GRID_COLS - row.length }).map((_, emptyIndex) => (
                <View key={`empty-${rowIndex}-${emptyIndex}`} style={styles.optionItem} />
              ))}
            </View>
          ))}
        </View>
      </View>
    </ChatBottomSheet>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: tokens.spacing.md,
      direction: 'rtl',
      backgroundColor: 'transparent',
    },
    header: {
      alignItems: 'center',
      paddingTop: tokens.spacing.xs,
      paddingBottom: tokens.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: SHEET_BORDER,
    },
    headerTitle: {
      ...chatRtlText,
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
      width: '100%',
    },
    grid: {
      marginTop: tokens.spacing.sm,
      marginBottom: tokens.spacing.xs,
      gap: 8,
    },
    row: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'stretch',
    },
    optionItem: {
      flex: 1,
      maxWidth: '33.333%',
      aspectRatio: 1.15,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '600',
      ...chatRtlText,
    },
  });
