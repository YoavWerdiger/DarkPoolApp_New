// ============================================
// Context Menu — שורות פעולה לפי הטופו (כמו שיטי ההגדרות/התיק):
// כרטיס cardSolid, שורות 15px עם אייקון מימין, מפריד, ופעולות מחיקה בכרטיס נפרד.
// ============================================
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Copy, Forward, Info, Pencil, Reply, Star, Trash2, Users, type LucideIcon } from 'lucide-react-native';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { SettingsActionRow, SettingsGlassCard } from '../profile/ProfileSettingsUI';

type OptionDef = { key: string; label: string; icon: LucideIcon };

interface ContextMenuProps {
  onSelect: (key: string) => void;
  isAdmin?: boolean;
  isMe?: boolean;
  canEdit?: boolean;
}

// פעולה, לא ניווט — בלי שברון
const noChevron = <View />;

export default function ContextMenu({ onSelect, isAdmin = false, isMe = false, canEdit = true }: ContextMenuProps) {
  const { mainOptions, dangerOptions } = useMemo(() => {
    const main: OptionDef[] = [
      { key: 'reply', label: 'השב', icon: Reply },
      { key: 'forward', label: 'העבר', icon: Forward },
      { key: 'copy', label: 'העתק', icon: Copy },
      { key: 'star', label: 'סמן בכוכב', icon: Star },
      ...(isMe && canEdit ? [{ key: 'edit', label: 'עריכה', icon: Pencil }] : []),
      ...(isAdmin ? [{ key: 'info', label: 'מידע', icon: Info }] : []),
    ];
    const danger: OptionDef[] = [
      ...(isMe ? [{ key: 'delete', label: 'מחק אצלי', icon: Trash2 }] : []),
      ...(isMe || isAdmin ? [{ key: 'deleteForEveryone', label: 'מחק לכולם', icon: Users }] : []),
    ];
    return { mainOptions: main, dangerOptions: danger };
  }, [isAdmin, isMe, canEdit]);

  const handlePress = (key: string) => {
    void HapticFeedback.selection();
    onSelect(key);
  };

  return (
    // השיט עצמו LTR (בשביל תצוגת הבועה) — התפריט חוזר ל-RTL
    <View style={{ direction: 'rtl' }}>
      <SettingsGlassCard>
        {mainOptions.map((opt, i) => (
          <SettingsActionRow
            key={opt.key}
            title={opt.label}
            icon={opt.icon}
            trailing={noChevron}
            showDivider={i < mainOptions.length - 1}
            onPress={() => handlePress(opt.key)}
          />
        ))}
      </SettingsGlassCard>

      {dangerOptions.length > 0 ? (
        <SettingsGlassCard style={{ marginBottom: 0 }}>
          {dangerOptions.map((opt, i) => (
            <SettingsActionRow
              key={opt.key}
              title={opt.label}
              icon={opt.icon}
              danger
              trailing={noChevron}
              showDivider={i < dangerOptions.length - 1}
              onPress={() => handlePress(opt.key)}
            />
          ))}
        </SettingsGlassCard>
      ) : null}
    </View>
  );
}
