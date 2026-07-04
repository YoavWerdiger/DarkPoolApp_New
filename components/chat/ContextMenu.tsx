// ============================================
// Context Menu — Telegram-style action grid
// ============================================
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
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
      ...(isAdmin ? [{ key: 'pin', label: 'הצמד', icon: 'pin-outline', danger: false } as OptionDef] : []),
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

  const tileBg = 'rgba(255,255,255,0.07)';
  const tileIconBg = 'rgba(255,255,255,0.10)';
  const dangerBg = 'rgba(255,60,60,0.12)';

  return (
    <View style={styles.root}>
      {/* Main actions grid */}
      {mainOptions.length > 0 && (
        <BlurView intensity={Platform.OS === 'ios' ? 40 : 20} tint="dark" style={styles.gridCard}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tileBg }]} />
          <View style={styles.grid}>
            {mainOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => handlePress(opt.key)}
                activeOpacity={0.65}
                style={styles.tile}
                accessibilityLabel={opt.label}
              >
                <View style={[styles.tileIcon, { backgroundColor: tileIconBg }]}>
                  <Ionicons name={opt.icon as any} size={22} color={tokens.colors.text.primary} />
                </View>
                <Text style={[styles.tileLabel, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>
      )}

      {/* Danger actions — separate card */}
      {dangerOptions.length > 0 && (
        <BlurView intensity={Platform.OS === 'ios' ? 40 : 20} tint="dark" style={[styles.gridCard, styles.dangerCard]}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: dangerBg }]} />
          <View style={styles.grid}>
            {dangerOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => handlePress(opt.key)}
                activeOpacity={0.65}
                style={styles.tile}
                accessibilityLabel={opt.label}
              >
                <View style={[styles.tileIcon, { backgroundColor: 'rgba(255,60,60,0.18)' }]}>
                  <Ionicons name={opt.icon as any} size={22} color={tokens.colors.text.danger} />
                </View>
                <Text style={[styles.tileLabel, { color: tokens.colors.text.danger }]} numberOfLines={1}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 14,
    gap: 10,
    paddingBottom: 12,
  },
  gridCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: chatPalette.glassBorder,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  dangerCard: {},
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignItems: 'center',
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
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});
