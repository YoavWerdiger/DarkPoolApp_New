import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardEvent,
  Platform,
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
  visible,
  onSelectUser,
  onClose,
  groupId,
  searchQuery,
}) => {
  const DesignTokens = useDesignTokens();
  const styles = useMemo(() => createMentionStyles(DesignTokens), [DesignTokens]);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);

    const sub1 = Keyboard.addListener(showEvent, onShow);
    const sub2 = Keyboard.addListener(hideEvent, onHide);
    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  useEffect(() => {
    if (visible && groupId) {
      loadGroupMembers();
    }
  }, [visible, groupId]);

  const loadGroupMembers = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('chat_group_members')
        .select(`
          user_id,
          role,
          users:user_id (
            id,
            full_name,
            display_name,
            profile_picture
          )
        `)
        .eq('group_id', groupId);

      if (membersError) {
        setLoading(false);
        return;
      }

      if (membersData && membersData.length > 0) {
        const formattedMembers = membersData.map(member => {
          const userData = member.users as any;
          return {
            id: member.user_id,
            full_name: userData?.full_name || null,
            profile_picture: userData?.profile_picture || null,
            display_name: userData?.display_name || userData?.full_name || `User ${member.user_id.slice(0, 8)}`,
          };
        });
        setMembers(formattedMembers);
      } else {
        setMembers([]);
      }
    } catch (error) {
      logger.error('MentionPicker', 'Failed to load members', error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members;
    const query = searchQuery.toLowerCase().replace('@', '');
    return members.filter(member => {
      const name = (member.display_name || member.full_name || '').toLowerCase();
      return name.includes(query);
    });
  }, [members, searchQuery]);

  const handleSelectUser = (member: User) => {
    const displayName = member.display_name || member.full_name || 'משתמש';
    onSelectUser({ id: member.id, display: `@${displayName}` });
    onClose();
  };

  const renderMember = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.memberRow}
      onPress={() => handleSelectUser(item)}
      activeOpacity={0.7}
    >
      <Image
        source={
          item.profile_picture
            ? { uri: item.profile_picture }
            : require('../../assets/icon.png')
        }
        style={styles.avatar}
      />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {item.display_name || item.full_name || 'משתמש'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (!visible) return null;

  // Position the picker just above the keyboard
  const bottomOffset = keyboardHeight > 0 ? keyboardHeight + 8 : 80;

  return (
    // Full-screen backdrop to dismiss on outside tap
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <TouchableWithoutFeedback>
          <View style={[styles.container, { bottom: bottomOffset }]}>
            <View style={styles.picker}>
              <View style={styles.header}>
                <Text style={styles.title}>בחר משתמש</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>טוען...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredMembers}
                  renderItem={renderMember}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.listContainer}
                  keyboardShouldPersistTaps="handled"
                  style={styles.list}
                />
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
};

const createMentionStyles = (tokens: any) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 20,
      right: 20,
      zIndex: 1000,
    },
    picker: {
      backgroundColor: tokens.colors.background.elevated2,
      borderRadius: tokens.borderRadius.lg,
      maxHeight: 300,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.subtle,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: tokens.spacing.base,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
    },
    title: {
      color: tokens.colors.text.primary,
      fontSize: tokens.typography.fontSize.base,
      fontWeight: '600',
    },
    closeButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: tokens.colors.background.input,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeText: {
      color: tokens.colors.text.primary,
      fontSize: tokens.typography.fontSize.sm,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    loadingText: {
      color: tokens.colors.text.tertiary,
      fontSize: tokens.typography.fontSize.base,
    },
    listContainer: {
      paddingBottom: tokens.spacing.base,
    },
    list: {
      maxHeight: 220,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: tokens.spacing.base,
      paddingVertical: tokens.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: 12,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      color: tokens.colors.text.primary,
      fontSize: tokens.typography.fontSize.base,
      fontWeight: '500',
      textAlign: 'right',
    },
  });

export default MentionPicker;
