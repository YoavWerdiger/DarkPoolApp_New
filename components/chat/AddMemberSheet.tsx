// ============================================
// Add Member Sheet
// ============================================
// חיפוש ובחירת משתמשים להוספה לקבוצה — ChatBottomSheet + glass כמו Action sheet
// ============================================

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { searchUsers } from '../../services/chat/chatSearchService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { isUserPresenceOnline } from '../../utils/userPresence';
import { ChatBottomSheet, ChatSheetContent } from './ChatBottomSheet';
import { chatPalette, chatRtlRow, chatRtlText } from './chatDesignTokens';

interface User {
  id: string;
  display_name: string | null;
  full_name: string | null;
  profile_picture: string | null;
  is_online?: boolean;
  last_active?: string | null;
}

interface AddMemberSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (userId: string, displayName: string) => Promise<void>;
  existingMemberIds?: string[];
}

export default function AddMemberSheet({
  visible,
  onClose,
  onAdd,
  existingMemberIds = [],
}: AddMemberSheetProps) {
  const tokens = useDesignTokens();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (!text.trim()) {
        setResults([]);
        return;
      }
      searchTimeout.current = setTimeout(async () => {
        setIsSearching(true);
        const { data } = await searchUsers(text.trim(), existingMemberIds, 20);
        setResults(data || []);
        setIsSearching(false);
      }, 350);
    },
    [existingMemberIds],
  );

  const handleAdd = async (user: User) => {
    void HapticFeedback.impactLight();
    setAddingId(user.id);
    const name = user?.display_name || user?.full_name || 'משתמש';
    await onAdd(user.id, name);
    setAddingId(null);
    setResults((prev) => prev.filter((u) => u.id !== user.id));
  };

  const handleClose = () => {
    void HapticFeedback.impactLight();
    setQuery('');
    setResults([]);
    onClose();
  };

  const renderUser = ({ item }: { item: User }) => {
    const name = item.display_name || item.full_name || 'משתמש';
    const isAdding = addingId === item.id;
    return (
      <View style={[styles.userRow, { borderBottomColor: tokens.colors.border.subtle ?? tokens.colors.border.primary }]}>
        <View style={styles.userLeft}>
          {item.profile_picture ? (
            <Image source={{ uri: item.profile_picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tokens.colors.background.tertiary }]}>
              <Text style={[styles.avatarInitial, { color: tokens.colors.text.secondary }]}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {isUserPresenceOnline(item.is_online, item.last_active) && (
            <View
              style={[
                styles.onlineDot,
                {
                  backgroundColor: tokens.colors.text.success ?? '#4CAF50',
                  borderColor: tokens.colors.bubbleOther,
                },
              ]}
            />
          )}
        </View>
        <Text style={[styles.userName, { color: tokens.colors.text.primary }]} numberOfLines={1}>
          {name}
        </Text>
        <TouchableOpacity
          onPress={() => handleAdd(item)}
          disabled={isAdding}
          style={[styles.addBtn, { backgroundColor: tokens.colors.primary.main }]}
          activeOpacity={0.75}
        >
          {isAdding ? (
            <ActivityIndicator size={14} color="#fff" />
          ) : (
            <Ionicons name="add" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={handleClose}
      snapPoints={[0.72]}
      showBrandWatermark={false}
      avoidKeyboard
    >
      <ChatSheetContent style={{ backgroundColor: 'transparent', flex: 1, minHeight: 320 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={tokens.colors.text.secondary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>הוסף חברים</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={tokens.colors.text.tertiary} />
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="חפש לפי שם..."
            placeholderTextColor={tokens.colors.text.tertiary}
            style={[styles.searchInput, { color: tokens.colors.text.primary }]}
            autoFocus
            textAlign="right"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.selection();
                handleQueryChange('');
              }}
            >
              <Ionicons name="close-circle" size={16} color={tokens.colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {isSearching ? (
          <ActivityIndicator size="large" color={tokens.colors.primary.main} style={{ marginTop: 32 }} />
        ) : results.length === 0 && query.trim().length > 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={40} color={tokens.colors.text.tertiary} />
            <Text style={[styles.emptyText, { color: tokens.colors.text.tertiary }]}>לא נמצאו משתמשים</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={40} color={tokens.colors.text.tertiary} />
            <Text style={[styles.emptyText, { color: tokens.colors.text.tertiary }]}>הקלד שם לחיפוש</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            renderItem={renderUser}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    ...chatRtlRow,
    direction: 'rtl',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  headerTitle: {
    ...chatRtlText,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  searchContainer: {
    ...chatRtlRow,
    direction: 'rtl',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: chatPalette.glassBorder,
    backgroundColor: chatPalette.glass,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    ...chatRtlText,
    padding: 0,
  },
  userRow: {
    ...chatRtlRow,
    direction: 'rtl',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  userLeft: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    left: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    ...chatRtlText,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
