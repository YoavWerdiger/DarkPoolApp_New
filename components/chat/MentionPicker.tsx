// ============================================
// MentionPicker — styled like replyPreviewContainer in ChatInput
// ============================================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, Platform, Keyboard, KeyboardEvent,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { useDesignTokens } from '../ui/DesignTokens';

interface User {
  id: string;
  full_name: string | null;
  display_name: string | null;
  profile_picture: string | null;
}

interface MentionPickerProps {
  visible: boolean;
  onSelectUser: (user: { id: string; display: string }) => void;
  onClose: () => void;
  groupId: string;
  searchQuery: string;
}

const MentionPicker: React.FC<MentionPickerProps> = ({
  visible, onSelectUser, onClose, groupId, searchQuery,
}) => {
  const tokens = useDesignTokens();
  const [members, setMembers] = useState<User[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      currentUserIdRef.current = data.user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent  = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const s1 = Keyboard.addListener(showEvent, onShow);
    const s2 = Keyboard.addListener(hideEvent,  onHide);
    return () => { s1.remove(); s2.remove(); };
  }, []);

  useEffect(() => {
    if (visible && groupId) loadGroupMembers();
  }, [visible, groupId]);

  const loadGroupMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_group_members')
        .select('user_id, users:user_id(id, full_name, display_name, profile_picture)')
        .eq('group_id', groupId);
      if (!error && data) {
        setMembers(
          data
            .filter(m => m.user_id !== currentUserIdRef.current)
            .map(m => {
              const u = m.users as any;
              return {
                id: m.user_id,
                full_name: u?.full_name ?? null,
                display_name: u?.display_name ?? u?.full_name ?? null,
                profile_picture: u?.profile_picture ?? null,
              };
            })
        );
      }
    } catch (e) {
      logger.error('MentionPicker', 'load failed', e);
    }
  };

  // אם השם נראה כמו email — מציג רק את החלק לפני @
  const cleanName = (raw: string | null): string => {
    if (!raw) return '';
    if (raw.includes('@')) return raw.split('@')[0];
    return raw;
  };

  const filtered = useMemo(() => {
    // deduplicate by user id
    const seen = new Set<string>();
    const unique = members.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    if (!searchQuery) return unique;
    const q = searchQuery.toLowerCase().replace('@', '');
    return unique.filter(m => {
      const name = cleanName(m.display_name || m.full_name || '');
      return name.toLowerCase().includes(q);
    });
  }, [members, searchQuery]);

  const handleSelect = (m: User) => {
    const display = cleanName(m.display_name || m.full_name) || 'משתמש';
    onSelectUser({ id: m.id, display: `@${display}` });
    onClose();
  };

  if (!visible || filtered.length === 0) return null;

  const bottomOffset = keyboardHeight > 0 ? keyboardHeight + 4 : 76;
  const maxItems = Math.min(filtered.length, 5);
  const ITEM_H = 44;
  const primary = tokens.colors.primary.main;
  const dividerBg = tokens.colors.border?.divider ?? 'rgba(255,255,255,0.07)';
  const lgRadius = tokens.borderRadius?.lg ?? 16;

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { zIndex: 2000 }]}
    >
      <View
        style={[
          styles.container,
          {
            bottom: bottomOffset,
            height: maxItems * ITEM_H,
            backgroundColor: dividerBg,
            borderRadius: lgRadius,
          },
        ]}
      >
        {/* פס ירוק שמאלי — בדיוק כמו replyPreviewBar */}
        <View style={[styles.accentBar, { backgroundColor: primary }]} />

        <FlatList
          data={filtered}
          keyExtractor={m => m.id}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          style={styles.list}
            renderItem={({ item, index }) => {
            const name = cleanName(item.display_name || item.full_name) || 'משתמש';
            const isLast = index === filtered.length - 1;
            return (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                activeOpacity={0.55}
                style={[
                  styles.row,
                  { height: ITEM_H },
                  !isLast && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: 'rgba(255,255,255,0.08)',
                  },
                ]}
              >
                {/* @ prefix — כמו replyLabel */}
                <Text style={[styles.atSign, { color: primary }]}>@</Text>

                {/* שם */}
                <Text style={[styles.name, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                  {name}
                </Text>

                {/* Avatar */}
                {item.profile_picture ? (
                  <Image source={{ uri: item.profile_picture }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={[styles.avatarLetter, { color: tokens.colors.text.secondary }]}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 10,
  },
  accentBar: {
    width: 3,
    borderRadius: 1.5,
    marginVertical: 8,
    marginLeft: 10,
    flexShrink: 0,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  atSign: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
    width: 14,
    textAlign: 'center',
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default MentionPicker;
