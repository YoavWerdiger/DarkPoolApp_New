// ============================================
// Context Menu — Telegram-style action grid
// שיט Action (LongPressOverlay): כרטיסים שטוחים, בלי BlurView מקונן
// ============================================
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useDesignTokens } from '../ui/DesignTokens';

type OptionDef = { key: string; label: string; icon: string; danger: boolean };

interface ContextMenuProps {
  onSelect: (key: string) => void;
  isAdmin?: boolean;
  isMe?: boolean;
  canEdit?: boolean;
}

function ActionCard({
  children,
  danger,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  // מעטפת clip נפרדת: borderWidth על אותו View עם overflow עלול
  // להשאיר מילוי מרובע ב-Android — הרדיוס + overflow על המעטפת חותכים בבירור.
  return (
    <View style={styles.gridCardClip} collapsable={false}>
      <View style={[styles.gridCard, danger ? styles.dangerCard : null]}>
        {children}
      </View>
    </View>
  );
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
        <ActionCard>
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
                  <Ionicons name={opt.icon as any} size={20} color={tokens.colors.text.primary} />
                </View>
                <Text style={[styles.tileLabel, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ActionCard>
      )}

      {dangerOptions.length > 0 && (
        <ActionCard danger>
          <View style={styles.grid}>
            {dangerOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => handlePress(opt.key)}
                activeOpacity={0.65}
                style={styles.tile}
                accessibilityLabel={opt.label}
              >
                <View style={[styles.tileIcon, styles.dangerTileIcon]}>
                  <Ionicons name={opt.icon as any} size={20} color={tokens.colors.text.danger} />
                </View>
                <Text style={[styles.tileLabel, { color: tokens.colors.text.danger }]} numberOfLines={1}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ActionCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 4,
    gap: 10,
    paddingBottom: 6,
  },
  gridCardClip: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  gridCard: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dangerCard: {
    backgroundColor: 'rgba(255,60,60,0.08)',
    borderColor: 'rgba(255,60,60,0.18)',
  },
  grid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  tile: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 6,
    minWidth: 60,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dangerTileIcon: {
    backgroundColor: 'rgba(255,60,60,0.14)',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});
