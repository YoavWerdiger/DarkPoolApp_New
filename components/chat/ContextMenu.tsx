// ============================================
// Context Menu — Telegram-style action grid
// תוכן על ChatBottomSheet — בלי כרטיס זכוכית מקונן (כמו MediaPicker)
// ============================================
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useDesignTokens } from '../ui/DesignTokens';
import { chatPalette } from './chatDesignTokens';

type OptionDef = { key: string; label: string; icon: string; danger: boolean };

interface ContextMenuProps {
  onSelect: (key: string) => void;
  isAdmin?: boolean;
  isMe?: boolean;
  canEdit?: boolean;
}

export default function ContextMenu({ onSelect, isAdmin = false, isMe = false, canEdit = true }: ContextMenuProps) {
  const tokens = useDesignTokens();

  const { mainOptions, dangerOptions } = useMemo(() => {
    const main: OptionDef[] = [
      { key: 'reply',   label: 'השב',       icon: 'arrow-undo-outline',  danger: false },
      { key: 'forward', label: 'העבר',      icon: 'arrow-redo-outline',  danger: false },
      { key: 'copy',    label: 'העתק',      icon: 'copy-outline',        danger: false },
      { key: 'star',    label: 'כוכב',      icon: 'star-outline',        danger: false },
      ...(isMe && canEdit ? [{ key: 'edit', label: 'ערוך', icon: 'create-outline', danger: false } as OptionDef] : []),
      ...(isAdmin ? [{ key: 'info', label: 'מידע', icon: 'information-circle-outline', danger: false } as OptionDef] : []),
    ];
    const danger: OptionDef[] = [
      ...(isMe ? [{ key: 'delete', label: 'מחק אצלי', icon: 'trash-outline', danger: true } as OptionDef] : []),
      ...((isMe || isAdmin) ? [{ key: 'deleteForEveryone', label: 'מחק לכולם', icon: 'people-outline', danger: true } as OptionDef] : []),
    ];
    return { mainOptions: main, dangerOptions: danger };
  }, [isAdmin, isMe, canEdit]);

  const handlePress = (key: string) => {
    void HapticFeedback.selection();
    onSelect(key);
  };

  return (
    <View style={styles.root}>
      {mainOptions.length > 0 && (
        <View style={styles.grid}>
          {mainOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => handlePress(opt.key)}
              activeOpacity={0.65}
              style={styles.tile}
              accessibilityLabel={opt.label}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={opt.icon as any} size={22} color={tokens.colors.text.primary} />
              </View>
              <Text style={[styles.tileLabel, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {dangerOptions.length > 0 && (
        <View style={[styles.grid, styles.dangerRow]}>
          {dangerOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => handlePress(opt.key)}
              activeOpacity={0.65}
              style={styles.tile}
              accessibilityLabel={opt.label}
            >
              <View style={[styles.tileIcon, styles.dangerTileIcon]}>
                <Ionicons name={opt.icon as any} size={22} color={tokens.colors.text.danger} />
              </View>
              <Text style={[styles.tileLabel, { color: tokens.colors.text.danger }]} numberOfLines={1}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
    paddingBottom: 4,
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dangerRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: chatPalette.glassBorder,
    paddingTop: 10,
    marginTop: 2,
  },
  tile: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 5,
    minWidth: 62,
  },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dangerTileIcon: {
    backgroundColor: 'rgba(255,60,60,0.18)',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});
